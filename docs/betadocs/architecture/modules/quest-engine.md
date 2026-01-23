# Quest Engine

## Overview

The Quest Engine is an Arkiv-native learning quest system that enables structured learning paths with verifiable proof of completion. Unlike the older "Learner Quests" system (which uses `learner_quest` entities), the Quest Engine uses `quest_definition` entities for quest definitions and `quest_step_progress` entities for progress tracking.

**Key Features:**
- Arkiv-native quest definitions (stored as entities, queryable on-chain)
- Six step types: READ, DO, QUIZ, SUBMIT, SESSION, VERIFY
- Verifiable progress tracking with evidence
- Proof of Skill badges for quest completion
- Network-wide quest discovery
- File-based authoring with entity sync

## Architecture

### Quest Definition Storage

**Hybrid Approach:**
- **Authoring:** Quest definitions authored as JSON files in `content/quests/<track>/quest.json`
- **Distribution:** Quest definitions synced to Arkiv entities (`quest_definition` type)
- **Rationale:** File-based authoring is easier for content creators, entity-based distribution enables Arkiv-native discovery

**Entity Structure:**
- Entity type: `quest_definition`
- Entity key: `quest_definition:${track}:v${version}` (Pattern A - immutable versions)
- Payload: Full quest definition JSON with inline markdown content
- Default spaceId: `'global'` (network-wide quests)

### Progress Tracking

**Progress Entities:**
- Entity type: `quest_step_progress`
- Entity key: `quest_step_progress:${spaceId}:${wallet}:${questId}:${stepId}` (Pattern B - stable keys)
- Evidence structure varies by step type
- Indexer lag handling: submitted → indexed states

**Evidence Types:**
- `completion` - Simple completion (READ steps)
- `entity_created` - Entity creation proof (DO steps)
- `quiz_result` - Quiz score and rubric (QUIZ steps)
- `submission` - User-submitted artifact (SUBMIT steps)
- `session_completed` - Mentorship session completion (SESSION steps)
- `query_proof` - Query verification proof (VERIFY steps)

### Badge System

**Badge Entities:**
- Entity type: `proof_of_skill_badge`
- Entity key: `badge:${spaceId}:${wallet}:${badgeType}` (Pattern B - stable keys)
- Evidence references: Links to `quest_step_progress` entities
- Quest version tracking: Badges store `questVersion` for validation

## Step Types

### READ
- **Purpose:** Content reading and reflection
- **Evidence:** Completion timestamp
- **Use Case:** Tutorial content, reading materials

### DO
- **Purpose:** Perform an action (e.g., create Arkiv entity)
- **Evidence:** Entity key and transaction hash
- **Use Case:** Hands-on practice, entity creation

### QUIZ
- **Purpose:** Auto-scored assessment
- **Evidence:** Score, rubric version, question IDs
- **Use Case:** Knowledge checks, proficiency tests

### SUBMIT
- **Purpose:** User submits artifact (URL, hash, text)
- **Evidence:** Submitted value and type
- **Use Case:** Project submissions, external work

### SESSION
- **Purpose:** Complete a mentorship session
- **Evidence:** Session entity key, duration
- **Use Case:** Mentorship requirements, peer learning

### VERIFY
- **Purpose:** Client-side verification of Arkiv query result
- **Evidence:** Query fingerprint, result keys
- **Use Case:** Trustless verification, walkaway tests

## Data Flow

### Quest Discovery

1. **Entity Query:** Query `quest_definition` entities by track, language, spaceId
2. **Version Selection:** Get latest version per questId (sort by createdAt DESC)
3. **Content Loading:** Load quest definition with inline markdown content from payload

### Step Completion

1. **User Action:** User completes step (reads content, creates entity, takes quiz, etc.)
2. **Evidence Collection:** Collect evidence based on step type
3. **Progress Creation:** Create `quest_step_progress` entity with evidence
4. **Optimistic UI:** UI shows "submitted" state immediately
5. **Reconciliation:** Poll indexer until entity is queryable, update to "indexed" state

### Badge Issuance

1. **Eligibility Check:** Verify all required steps are completed
2. **Evidence Collection:** Gather evidence references from progress entities
3. **Badge Creation:** Create `proof_of_skill_badge` entity with evidence refs
4. **Profile Update:** Badge appears on user profile

## API Routes

### GET /api/quests
- List all quests or fetch specific quest by trackId
- Supports entity-first mode (queries Arkiv) with file fallback
- Returns quest definition with inline markdown content

### GET /api/quests/progress
- Fetch user progress for a quest
- Returns array of `quest_step_progress` entities
- Filters by wallet, questId, spaceId

### POST /api/quests/progress
- Record step completion
- Creates `quest_step_progress` entity
- Returns submitted status with txHash

### GET /api/badges
- Fetch user badges
- Returns array of `proof_of_skill_badge` entities

### POST /api/badges
- Issue badge for completed quest
- Checks eligibility, creates badge entity
- Returns badge entity key and txHash

## Quest Authoring

### File Structure

```
content/quests/
├── arkiv/
│   ├── quest.json          # Quest definition
│   └── steps/
│       ├── 01-intro.md
│       ├── 02-setup.md
│       └── ...
├── mandarin/
│   ├── quest.json
│   └── steps/
│       └── ...
└── spanish/
    ├── quest.json
    └── steps/
        └── ...
```

### Quest JSON Schema

```json
{
  "questId": "arkiv_builder",
  "version": "1",
  "track": "arkiv",
  "title": "Arkiv Builder Track",
  "description": "...",
  "estimatedDuration": "90 minutes",
  "difficulty": "beginner",
  "steps": [
    {
      "stepId": "intro",
      "type": "READ",
      "title": "Welcome to Arkiv",
      "contentFile": "steps/01-intro.md",
      "order": 1,
      "required": true
    }
  ],
  "rubrics": {
    "arkiv_basics_v1": {
      "version": "1",
      "passingScore": 0.7,
      "questions": [...]
    }
  },
  "badge": {
    "id": "arkiv_builder",
    "name": "Arkiv Builder",
    "description": "..."
  }
}
```

### Sync Process

1. **Authoring:** Edit quest files in `content/quests/`
2. **Sync Script:** Run `scripts/sync-quest-entities.ts`
3. **Content Inlining:** Script reads markdown files, inlines content into quest.steps[].content
4. **Entity Creation:** Script creates/updates `quest_definition` entities on Arkiv
5. **Version Management:** New versions create new entities (Pattern A)

**CI/CD Integration:**
- GitHub Action runs sync script on merge to main
- Automatically syncs quest files → entities on deployment
- Sets `QUEST_ENTITY_MODE=entity` for production

## Configuration

### Quest Entity Mode

Environment variable `QUEST_ENTITY_MODE` controls quest serving:

- **`entity`** (production): Entity-first mode, queries Arkiv entities only
- **`dual`** (transition): Try entities first, fallback to files
- **`file`** (development): File-based only, no Arkiv queries

Default: `dual` (backward compatible during transition)

## Space Isolation

**Quest Definitions:**
- Network-wide quests: `spaceId: 'global'` (default)
- Space-specific quests: Use specific `spaceId`

**Progress Tracking:**
- Progress entities use `spaceId` for isolation
- User progress is space-specific (same quest, different progress per space)

**Badges:**
- Badge entities use `spaceId` for isolation
- Badges are space-specific (earned per space)

## Versioning

**Quest Definitions:**
- Pattern A (immutable versions): Each version creates new entity
- Entity key includes version: `quest_definition:arkiv:v1`, `quest_definition:arkiv:v2`
- Latest version selected by `createdAt` DESC

**Progress:**
- Progress entities store `questVersion` in payload
- Progress remains valid for the quest version it was created for
- If quest updates, new version created, old progress remains valid

**Badges:**
- Badges store `questVersion` in payload
- Badge validity tied to specific quest version
- Badges remain valid even if quest definition changes

## Files Referenced

- `lib/arkiv/questDefinition.ts` - Quest definition entity operations
- `lib/arkiv/questProgress.ts` - Progress entity operations
- `lib/arkiv/badge.ts` - Badge entity operations
- `lib/arkiv/questStep.ts` - Step types and evidence definitions
- `lib/quests/questFormat.ts` - Quest JSON schema types
- `lib/quests/questLoader.ts` - Quest file loading
- `scripts/sync-quest-entities.ts` - Sync script for files → entities
- `app/api/quests/route.ts` - Quest API routes
- `app/api/quests/progress/route.ts` - Progress API routes
- `app/api/badges/route.ts` - Badge API routes

## Related Documentation

- [Quest Definition Entity Schema](/docs/arkiv/entities/quest-definition) - Quest definition entity details
- [Quest Step Progress Entity Schema](/docs/arkiv/entities/quest-step-progress) - Progress entity details
- [Proof of Skill Badge Entity Schema](/docs/arkiv/entities/proof-of-skill-badge) - Badge entity details
- [Learner Quests](/docs/architecture/modules/learner-quests) - Older learner quest system (different from Quest Engine)
