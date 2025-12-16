# Learner Quests

## Overview

Learner Quests are structured learning paths that help users explore curated content and assess their knowledge. The system supports two quest types:

1. **Reading List Quests**: Curated reading materials (articles, documents, books) with progress tracking
2. **Language Assessment Quests**: Interactive language proficiency tests with questions, scoring, and certification

The initial quest, "Web3Privacy Foundations," is a reading list quest incorporating materials from the Web3Privacy Academy Library. Language assessment quests support certifications like CEFR A1 Spanish and HSK 1 Chinese.

## Features

### Reading List Quests
- Display curated reading materials with descriptions
- Track read status when users click external links
- Show progress (X/Y materials read)
- Display completion percentage on user profiles (public and edit views)

### Language Assessment Quests
- Interactive question-based assessments
- Multiple question types: multiple choice, fill-in-the-blank, matching, true/false, sentence ordering
- Real-time answer validation and scoring
- Section-based progress tracking
- Automatic certification issuance for passing scores
- Time tracking per question and section

### Common Features
- Store progress as Arkiv entities (verifiable, transparent)
- Privacy-preserving (wallet-based, no additional PII)
- Immutable entity pattern for versioning

## Data Model

### Learner Quest Definition

**Entity Type:** `learner_quest`

**Attributes:**
- `type`: `'learner_quest'`
- `questId`: Unique quest identifier (e.g., `'web3privacy_foundations'`, `'spanish_a1'`, `'hsk1'`)
- `title`: Quest title
- `description`: Quest description
- `source`: Source URL
- `questType`: `'reading_list' | 'language_assessment'` (required, defaults to `'reading_list'` for backward compatibility)
- `language`: Language code (e.g., `'es'`, `'zh'`) - only for `language_assessment` quests
- `proficiencyLevel`: Proficiency level (e.g., `'A1'`, `'HSK1'`) - only for `language_assessment` quests
- `status`: `'active' | 'archived'`
- `spaceId`: `'local-dev'`
- `createdAt`: ISO timestamp

**Payload (Reading List Quest):**
```json
{
  "materials": [
    {
      "id": "crypto-anarchist-manifesto",
      "title": "The Crypto Anarchist Manifesto",
      "author": "Timothy May",
      "year": 1988,
      "url": "https://activism.net/cypherpunk/crypto-anarchist-manifesto.html",
      "category": "foundational",
      "description": "..."
    }
  ],
  "metadata": {
    "totalMaterials": 9,
    "categories": ["foundational", "recent"],
    "lastUpdated": "2025-01-16T00:00:00.000Z"
  }
}
```

**Payload (Language Assessment Quest):**
```json
{
  "questType": "language_assessment",
  "language": "es",
  "proficiencyLevel": "A1",
  "sections": [
    {
      "id": "reading",
      "title": "Reading Comprehension",
      "description": "Lee textos cortos y responde a las preguntas.",
      "timeLimit": 600,
      "points": 30,
      "questions": [
        {
          "id": "r1",
          "type": "multiple_choice",
          "question": "¿Cómo se llama la persona?",
          "options": [
            { "id": "a", "text": "Ana", "correct": true },
            { "id": "b", "text": "Juan", "correct": false }
          ],
          "correctAnswer": "a",
          "points": 1,
          "explanation": "Dice 'me llamo Ana'."
        }
      ]
    }
  ],
  "metadata": {
    "totalQuestions": 100,
    "totalPoints": 100,
    "passingScore": 60,
    "timeLimit": 1800,
    "certificationName": "CEFR A1 Spanish"
  }
}
```

**TTL:** 10 years (quest definitions are curated content)

**Notes:**
- Immutable: Updates create new entities (versioning)
- Latest version selected by querying most recent `createdAt`
- Quest definitions are curated/admin-created, not user-created
- `questType` field distinguishes between reading list and language assessment quests
- For reading list quests, payload contains `materials` array
- For language assessment quests, payload contains `sections` array with questions

### Learner Quest Progress

**Entity Type:** `learner_quest_progress`

**Attributes:**
- `type`: `'learner_quest_progress'`
- `wallet`: Wallet address (lowercase, required)
- `questId`: Quest identifier
- `materialId`: Material identifier (for reading list quests)
- `sectionId`: Section identifier (for language assessment quests)
- `questionId`: Question identifier (for language assessment quests)
- `status`: `'read' | 'in_progress' | 'not_started'` (for reading list quests)
- `spaceId`: `'local-dev'`
- `createdAt`: ISO timestamp

**Payload (Reading List Quest Progress):**
```json
{
  "wallet": "0x...",
  "questId": "web3privacy_foundations",
  "materialId": "crypto-anarchist-manifesto",
  "status": "read",
  "readAt": "2025-01-16T10:30:00.000Z",
  "metadata": {
    "clickedAt": "2025-01-16T10:29:45.000Z",
    "sourceUrl": "https://activism.net/cypherpunk/crypto-anarchist-manifesto.html"
  }
}
```

**Payload (Language Assessment Quest Progress):**
```json
{
  "wallet": "0x...",
  "questId": "spanish_a1",
  "sectionId": "reading",
  "questionId": "r1",
  "answer": "a",
  "correct": true,
  "score": 1,
  "timeSpent": 15,
  "answeredAt": "2025-01-16T10:30:00.000Z"
}
```

**TTL:** 1 year (31536000 seconds)

**Notes:**
- Immutable: Each action creates new entity
- For reading list quests: Soft-delete pattern - to "unread", create new entity with `status: 'not_started'`
- For reading list quests: Query pattern - Get most recent entity per `wallet + questId + materialId` combination
- For language assessment quests: Each answer submission creates a new entity
- For language assessment quests: Query pattern - Get most recent entity per `wallet + questId + sectionId + questionId` combination
- Progress entities are differentiated by presence of `materialId` (reading list) vs `sectionId`/`questionId` (assessment)

### Assessment Result (Language Assessment Only)

**Entity Type:** `learner_quest_assessment_result`

**Purpose:** Store complete assessment results and certification

**Attributes:**
- `type`: `'learner_quest_assessment_result'`
- `wallet`: Wallet address (lowercase, required)
- `questId`: Quest identifier
- `questType`: `'language_assessment'`
- `language`: Language code
- `proficiencyLevel`: Proficiency level
- `status`: `'in_progress' | 'completed' | 'passed' | 'failed'`
- `spaceId`: `'local-dev'`
- `createdAt`: ISO timestamp
- `completedAt`: ISO timestamp (when assessment finished)

**Payload:**
```json
{
  "wallet": "0x...",
  "questId": "spanish_a1",
  "language": "es",
  "proficiencyLevel": "A1",
  "status": "passed",
  "sections": [
    {
      "sectionId": "reading",
      "questionsAnswered": 21,
      "questionsCorrect": 18,
      "pointsEarned": 18,
      "pointsPossible": 30,
      "timeSpent": 580
    }
  ],
  "totalScore": 75,
  "totalPoints": 100,
  "percentage": 75,
  "passed": true,
  "certification": {
    "issued": true,
    "certificateId": "cert_spanish_a1_0x1234_20250116",
    "issuedAt": "2025-01-16T10:45:00.000Z",
    "verificationUrl": "https://explorer.mendoza.hoodi.arkiv.network/entity/..."
  },
  "metadata": {
    "attemptNumber": 1,
    "totalTimeSpent": 2400,
    "startedAt": "2025-01-16T10:05:00.000Z",
    "completedAt": "2025-01-16T10:45:00.000Z"
  }
}
```

**TTL:** 1 year (31536000 seconds)

**Notes:**
- Created when user completes an assessment
- Certification automatically issued for passing scores (score >= passingScore)
- Immutable: Each completion creates new entity (allows retakes)
- Query pattern: Get most recent entity per `wallet + questId` combination

### Transaction Hash Tracking

**Entity Type:** `learner_quest_progress_txhash`

**Purpose:** Transaction hash tracking for reliable querying

**Attributes:**
- `type`: `'learner_quest_progress_txhash'`
- `progressKey`: Reference to `learner_quest_progress` entity key
- `txHash`: Transaction hash
- `spaceId`: `'local-dev'`
- `createdAt`: ISO timestamp

**TTL:** 1 year (matches progress entity)

**Entity Type:** `learner_quest_assessment_result_txhash`

**Purpose:** Transaction hash tracking for assessment results

**Attributes:**
- `type`: `'learner_quest_assessment_result_txhash'`
- `resultKey`: Reference to `learner_quest_assessment_result` entity key
- `txHash`: Transaction hash
- `spaceId`: `'local-dev'`
- `createdAt`: ISO timestamp

**TTL:** 1 year (matches result entity)

## User Journey

### Reading List Quest Journey

1. User visits `/learner-quests`
   - Page loads quest definitions from Arkiv (filtered by `questType: 'reading_list'`)
   - Page loads user progress from Arkiv
   - Displays materials with read status

2. User clicks "Read Material"
   - Link opens in new tab (`target="_blank"`)
   - API call creates `learner_quest_progress` entity with `materialId`
   - Local state updates optimistically
   - Progress reloads after 2 seconds (Arkiv indexing)

3. User returns to page
   - Progress is loaded from Arkiv
   - Read materials show checkmark
   - Progress bar updates

### Language Assessment Quest Journey

1. User visits `/learner-quests`
   - Page loads quest definitions from Arkiv (includes both quest types)
   - Language assessment quests show badge indicating quest type

2. User starts assessment
   - Assessment interface loads questions from quest payload
   - Timer starts for each section
   - User answers questions one by one

3. User submits answer
   - API call creates `learner_quest_progress` entity with `sectionId`, `questionId`, `answer`
   - Answer is validated against correct answer
   - Score and correctness stored in progress entity
   - Time spent tracked per question

4. User completes assessment
   - API calculates total score from all progress entities
   - Creates `learner_quest_assessment_result` entity
   - If passing score achieved, certification is issued
   - Results page shows score breakdown by section

5. User views results
   - Certification displayed if passed
   - Section-by-section breakdown shown
   - Verification URL provided for certificate

## API Routes

### GET /api/learner-quests

Fetch quest definition(s).

**Query Parameters:**
- `questId` (optional): Fetch specific quest by ID. If omitted, returns all active quests.
- `questType` (optional): Filter by quest type (`'reading_list'` or `'language_assessment'`)

**Response (Single Quest):**
```json
{
  "ok": true,
  "quest": {
    "questId": "web3privacy_foundations",
    "title": "Web3Privacy Foundations",
    "description": "...",
    "questType": "reading_list",
    "materials": [...]
  }
}
```

**Response (All Quests):**
```json
{
  "ok": true,
  "quests": [
    {
      "questId": "web3privacy_foundations",
      "questType": "reading_list",
      "materials": [...]
    },
    {
      "questId": "spanish_a1",
      "questType": "language_assessment",
      "language": "es",
      "proficiencyLevel": "A1"
    }
  ],
  "count": 2
}
```

### POST /api/learner-quests

Mark material as read (creates progress entity for reading list quests).

**Body:**
```json
{
  "action": "markRead",
  "wallet": "0x...",
  "questId": "web3privacy_foundations",
  "materialId": "crypto-anarchist-manifesto",
  "sourceUrl": "https://..."
}
```

**Response:**
```json
{
  "ok": true,
  "progress": {
    "key": "...",
    "txHash": "0x..."
  }
}
```

### POST /api/learner-quests/assessment/answer

Submit answer to assessment question (creates progress entity for language assessment quests).

**Body:**
```json
{
  "wallet": "0x...",
  "questId": "spanish_a1",
  "sectionId": "reading",
  "questionId": "r1",
  "answer": "a",
  "timeSpent": 15
}
```

**Response:**
```json
{
  "ok": true,
  "progress": {
    "key": "...",
    "txHash": "0x...",
    "correct": true,
    "score": 1
  }
}
```

### POST /api/learner-quests/assessment/complete

Complete assessment and create result entity.

**Body:**
```json
{
  "wallet": "0x...",
  "questId": "spanish_a1",
  "startedAt": "2025-01-16T10:05:00.000Z"
}
```

**Response:**
```json
{
  "ok": true,
  "result": {
    "key": "...",
    "txHash": "0x...",
    "result": {
      "totalScore": 75,
      "totalPoints": 100,
      "percentage": 75,
      "passed": true,
      "certification": {
        "issued": true,
        "certificateId": "cert_spanish_a1_0x1234_20250116",
        "verificationUrl": "https://explorer.mendoza.hoodi.arkiv.network/entity/..."
      }
    }
  }
}
```

### GET /api/learner-quests/progress

Fetch user progress for a quest.

**Query Parameters:**
- `questId` (required)
- `wallet` (required)

**Response (Reading List Quest):**
```json
{
  "ok": true,
  "progress": {
    "crypto-anarchist-manifesto": {
      "key": "...",
      "wallet": "0x...",
      "questId": "web3privacy_foundations",
      "materialId": "crypto-anarchist-manifesto",
      "status": "read",
      "readAt": "2025-01-16T10:30:00.000Z"
    }
  }
}
```

**Response (Language Assessment Quest):**
```json
{
  "ok": true,
  "progress": {
    "reading:r1": {
      "sectionId": "reading",
      "questionId": "r1",
      "answer": "a",
      "correct": true,
      "score": 1,
      "timeSpent": 15,
      "answeredAt": "2025-01-16T10:30:00.000Z"
    }
  }
}
```

### GET /api/learner-quests/assessment/result

Fetch assessment result for a user.

**Query Parameters:**
- `questId` (required)
- `wallet` (required)

**Response:**
```json
{
  "ok": true,
  "result": {
    "key": "...",
    "wallet": "0x...",
    "questId": "spanish_a1",
    "status": "passed",
    "totalScore": 75,
    "totalPoints": 100,
    "percentage": 75,
    "passed": true,
    "certification": {
      "issued": true,
      "certificateId": "cert_spanish_a1_0x1234_20250116",
      "verificationUrl": "https://explorer.mendoza.hoodi.arkiv.network/entity/..."
    },
    "sections": [...]
  }
}
```

## Privacy Considerations

### Privacy-Preserving Design

1. Wallet-Based Identity
   - Progress linked to wallet address (public on Arkiv)
   - No additional PII collected
   - Consistent with existing patterns

2. Transparent Storage
   - All progress stored as Arkiv entities
   - Verifiable on-chain
   - Users can query their own progress

3. No External Tracking
   - External links open in new tab
   - No tracking of external site visits
   - Only tracks click action (user intent)

4. Opt-In Behavior
   - User explicitly clicks "Read Material"
   - No automatic tracking
   - User controls when progress is recorded

### Privacy Trade-offs

1. Wallet Address Visibility
   - Progress entities include wallet address (public on Arkiv)
   - Anyone can query progress for any wallet
   - This is by design (transparent, verifiable)

2. External Link Privacy
   - External sites may track visits
   - We only track click action, not external site behavior
   - Users should be aware external sites may track

## Initial Quest: Web3Privacy Foundations

The initial quest includes 9 materials from the Web3Privacy Academy Library:

**Foundational Documents:**
- The Crypto Anarchist Manifesto (Timothy May, 1988)
- The Cypherpunk Manifesto (Eric Hughes, 1993)
- Crypto Anarchy and Virtual Communities (Timothy C. May, 1994)
- The Cyphernomicon (Timothy C. May, 1994)
- Declaration of independence of cyberspace (John Perry Barlow, 1996)

**Recent Articles:**
- A Political History of DAOs (Kelsie Nabben, 2022)
- The Core of Crypto is Punks and Principles (Piergiorgio Catti De Gasperi, 2023)
- Make Ethereum Cypherpunk Again (Vitalik Buterin, 2023)
- Make Public Policy Cypherpunk Again (Peter Van Valkenburgh, 2024)

**Source:** https://academy.web3privacy.info/p/library

## Question Bank Format

Language assessment quests use JSON question banks stored in `static-data/language-quests/`. The format supports multiple question types:

**Question Types:**
- `multiple_choice`: Select one correct option from multiple choices
- `fill_blank`: Fill in the blank from a word bank
- `matching`: Match pairs of items
- `true_false`: True or false questions
- `sentence_order`: Order sentences to form a correct sentence

**File Structure:**
- `spanish-a1-questions.json`: CEFR A1 Spanish assessment
- `hsk1-questions.json`: HSK 1 Chinese assessment

Each file contains sections with questions, metadata (total points, passing score, time limits), and certification information.

## Seeding

### Reading List Quest

To create the initial reading list quest definition, run:

```bash
npx tsx scripts/seed-learner-quest.ts
```

This creates the `learner_quest` entity with all materials from the Web3Privacy Academy Library.

### Language Assessment Quests

To create language assessment quests from question bank JSON files, run:

```bash
# Spanish A1
ARKIV_PRIVATE_KEY=0x... npx tsx scripts/seed-spanish-a1-quest.ts

# HSK 1
ARKIV_PRIVATE_KEY=0x... npx tsx scripts/seed-hsk1-quest.ts
```

These scripts load question banks from `static-data/language-quests/`, validate the structure, and create `learner_quest` entities with `questType: 'language_assessment'`.

