# Learner Quests

## Overview

Learner Quests are curated reading lists that help users explore foundational documents and recent articles related to Web3 privacy principles. The initial quest, "Web3Privacy Foundations," incorporates materials from the Web3Privacy Academy Library.

## Features

- Display curated reading materials with descriptions
- Track read status when users click external links
- Show progress (X/Y materials read)
- Display completion percentage on user profiles (public and edit views)
- Store progress as Arkiv entities (verifiable, transparent)
- Privacy-preserving (wallet-based, no additional PII)

## Data Model

### Learner Quest Definition

**Entity Type:** `learner_quest`

**Attributes:**
- `type`: `'learner_quest'`
- `questId`: Unique quest identifier (e.g., `'web3privacy_foundations'`)
- `title`: Quest title
- `description`: Quest description
- `source`: Source URL
- `status`: `'active' | 'archived'`
- `spaceId`: `'local-dev'`
- `createdAt`: ISO timestamp

**Payload:**
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

**TTL:** 10 years (quest definitions are curated content)

**Notes:**
- Immutable: Updates create new entities (versioning)
- Latest version selected by querying most recent `createdAt`
- Quest definitions are curated/admin-created, not user-created

### Learner Quest Progress

**Entity Type:** `learner_quest_progress`

**Attributes:**
- `type`: `'learner_quest_progress'`
- `wallet`: Wallet address (lowercase, required)
- `questId`: Quest identifier
- `materialId`: Material identifier
- `status`: `'read' | 'in_progress' | 'not_started'`
- `spaceId`: `'local-dev'`
- `createdAt`: ISO timestamp

**Payload:**
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

**TTL:** 1 year (31536000 seconds)

**Notes:**
- Immutable: Each read action creates new entity
- Soft-delete pattern: To "unread", create new entity with `status: 'not_started'`
- Query pattern: Get most recent entity per `wallet + questId + materialId` combination

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

## User Journey

1. User visits `/learner-quests`
   - Page loads quest definition from Arkiv
   - Page loads user progress from Arkiv
   - Displays materials with read status

2. User clicks "Read Material"
   - Link opens in new tab (`target="_blank"`)
   - API call creates `learner_quest_progress` entity
   - Local state updates optimistically
   - Progress reloads after 2 seconds (Arkiv indexing)

3. User returns to page
   - Progress is loaded from Arkiv
   - Read materials show checkmark
   - Progress bar updates

## API Routes

### GET /api/learner-quests

Fetch quest definition.

**Query Parameters:**
- `questId` (optional, default: `'web3privacy_foundations'`)

**Response:**
```json
{
  "ok": true,
  "quest": {
    "questId": "web3privacy_foundations",
    "title": "Web3Privacy Foundations",
    "description": "...",
    "materials": [...]
  }
}
```

### POST /api/learner-quests

Mark material as read (creates progress entity).

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

### GET /api/learner-quests/progress

Fetch user progress for a quest.

**Query Parameters:**
- `questId` (optional, default: `'web3privacy_foundations'`)
- `wallet` (required)

**Response:**
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

## Seeding

To create the initial quest definition, run:

```bash
npx tsx scripts/seed-learner-quest.ts
```

This creates the `learner_quest` entity with all materials from the Web3Privacy Academy Library.

