# Quest Step Progress Entity Schema

## Status
- Canonical for p2pmentor: Yes
- Mutability: Pattern B
- Pattern dependencies: PAT-UPDATE-001, PAT-QUERY-001, PAT-IDENTITY-001, PAT-SPACE-001, PAT-OPTIMISTIC-001, PAT-INDEXER-001

## Entity Type
`quest_step_progress`

## Patterns Used

- [PAT-UPDATE-001: Stable Entity Key Updates](../patterns/stable-entity-key-updates.md) - Progress uses stable entity keys (Pattern B)
- [PAT-QUERY-001: Indexer-Friendly Query Shapes](../patterns/query-optimization.md) - Queries use indexed attributes (type, wallet, questId, stepId, spaceId)
- [PAT-IDENTITY-001: Wallet Normalization](../patterns/wallet-normalization.md) - Wallet addresses normalized to lowercase
- [PAT-SPACE-001: Space ID as Environment Boundary](../patterns/space-isolation.md) - spaceId attribute for data isolation
- [PAT-OPTIMISTIC-001: Optimistic UI + Reconciliation](../patterns/optimistic-ui-reconciliation.md) - UI updates optimistically, reconciles with indexer
- [PAT-INDEXER-001: Read-Your-Writes Under Indexer Lag](../patterns/indexer-lag-handling.md) - Handles submitted → indexed state transitions

## Field Table

| Field Name | Type | Required | Location | Description |
|------------|------|----------|----------|-------------|
| type | string | Yes | Attribute | Always "quest_step_progress" |
| wallet | string | Yes | Attribute | Wallet address (lowercase, primary identifier) |
| questId | string | Yes | Attribute | Quest identifier (e.g., "arkiv_builder") |
| stepId | string | Yes | Attribute | Step identifier (e.g., "intro", "first_entity") |
| stepType | string | Yes | Attribute | Step type: "READ" | "DO" | "QUIZ" | "SUBMIT" | "SESSION" | "VERIFY" |
| spaceId | string | Yes | Attribute | Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) |
| createdAt | string | Yes | Attribute | ISO timestamp |
| evidence | QuestStepEvidence | Yes | Payload | Evidence record for step completion |
| questVersion | string | No | Payload | Quest version this progress is for (defaults to "1") |
| status | string | No | Payload | Progress status: "submitted" | "indexed" (for reconciliation) |

## Evidence Structure

Evidence structure varies by step type. See [Quest Step Evidence Types](#evidence-by-step-type) below.

### QuestStepEvidence Interface

```typescript
interface QuestStepEvidence {
  stepId: string;
  completedAt: string; // ISO timestamp
  evidenceType: QuestEvidenceType;
  questVersion?: string;
  
  // Evidence pointers (populated based on evidenceType)
  entityKey?: string;        // For entity_created (DO steps)
  txHash?: string;           // Transaction hash for verification
  queryFingerprint?: string; // Hash of normalized query params (for query_proof)
  resultKeys?: string[];     // Entity keys returned by query (for query_proof)
  
  // Quiz-specific evidence
  score?: number;            // Points earned (for quiz_result)
  maxScore?: number;         // Max possible points (for quiz_result)
  rubricVersion?: string;    // Which rubric was used (for quiz_result)
  questionIds?: string[];    // Which questions were answered (for quiz_result)
  
  // Submission-specific evidence
  submittedValue?: string;   // The submitted URL/hash/text (for submission)
  submittedType?: 'url' | 'hash' | 'text' | 'file_reference';
  
  // Session-specific evidence
  sessionEntityKey?: string; // Reference to the session entity (for session_completed)
  sessionDurationMinutes?: number;
}
```

## Evidence by Step Type

| Step Type | Evidence Type | Required Fields | Optional Fields |
|-----------|---------------|-----------------|-----------------|
| READ | `completion` | `stepId`, `completedAt`, `evidenceType` | `questVersion` |
| DO | `entity_created` | `stepId`, `completedAt`, `evidenceType`, `entityKey` | `txHash`, `questVersion` |
| QUIZ | `quiz_result` | `stepId`, `completedAt`, `evidenceType`, `score`, `rubricVersion` | `maxScore`, `questionIds`, `questVersion` |
| SUBMIT | `submission` | `stepId`, `completedAt`, `evidenceType`, `submittedValue`, `submittedType` | `questVersion` |
| SESSION | `session_completed` | `stepId`, `completedAt`, `evidenceType`, `sessionEntityKey` | `sessionDurationMinutes`, `questVersion` |
| VERIFY | `query_proof` | `stepId`, `completedAt`, `evidenceType`, `queryFingerprint` | `resultKeys`, `questVersion` |

## Update Handling

Progress entities use stable entity keys (Pattern B). The same entity key is reused for all updates to a step's progress.

**Entity Key Format:** `quest_step_progress:${spaceId}:${wallet}:${questId}:${stepId}`

**Example:** `quest_step_progress:beta-launch:0xabc123:arkiv_builder:intro`

**Rationale:**
- Stable keys enable reliable querying without query-first patterns
- Progress updates overwrite previous state (last-write-wins)
- Full transaction history preserved on-chain (immutable ledger)
- Entity identity never changes (relationships don't break)

Implementation: `lib/arkiv/questProgress.ts` - `createQuestStepProgress()` uses `generateProgressKey()` for deterministic key derivation.

## Query Pattern

Fetch all progress for a quest:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'quest_step_progress'))
  .where(eq('wallet', wallet.toLowerCase()))
  .where(eq('questId', 'arkiv_builder'))
  .where(eq('spaceId', spaceId))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

Check if a specific step is completed:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'quest_step_progress'))
  .where(eq('wallet', wallet.toLowerCase()))
  .where(eq('questId', 'arkiv_builder'))
  .where(eq('stepId', 'intro'))
  .where(eq('spaceId', spaceId))
  .withAttributes(true)
  .withPayload(true)
  .limit(1)
  .fetch();
```

Implementation: `lib/arkiv/questProgress.ts` - `getQuestStepProgress()`, `getStepCompletion()`

## Indexer Lag Handling

Progress entities track indexer state via status field in payload:

- **"submitted"**: Transaction confirmed, but not yet queryable via indexer
- **"indexed"**: Entity is queryable via indexer (can be fetched)

**Reconciliation Flow:**
1. User completes step → UI shows "submitted" state optimistically
2. API creates progress entity → returns `{ status: 'submitted', txHash }`
3. Client polls indexer until entity is queryable
4. Once queryable, status updates to "indexed"
5. UI updates to show "completed" state

**Implementation:**
- `lib/hooks/useProgressReconciliation.ts` - React hook for optimistic UI reconciliation
- `lib/arkiv/questProgress.ts` - Returns "submitted" status, caller handles reconciliation
- Exponential backoff polling until entity is indexed

## Entity Relationships

- Links to `quest_definition` entities via `questId` attribute (string reference)
- Links to `proof_of_skill_badge` entities via evidence references (badges store progress entity keys)
- For DO steps: Links to created entities via `evidence.entityKey`
- For SESSION steps: Links to `session` entities via `evidence.sessionEntityKey`
- For VERIFY steps: Links to queried entities via `evidence.resultKeys`

## Expiration

Progress entities expire after 1 year (31536000 seconds). This is effectively permanent for user progress tracking.

## Transaction Hash Tracking

Separate `quest_step_progress_txhash` entity (optional) tracks transaction hash:
- `type`: "quest_step_progress_txhash"
- `progressKey`: Entity key of progress entity
- `txHash`: Transaction hash
- `wallet`: Wallet address (normalized lowercase)
- `spaceId`: Space ID (matches progress entity)
- `createdAt`: ISO timestamp

## Step Type Details

### READ Steps
- **Evidence Type:** `completion`
- **Evidence:** Simple completion timestamp
- **Use Case:** Content reading, reflection

### DO Steps
- **Evidence Type:** `entity_created`
- **Evidence:** `entityKey` (required), `txHash` (optional)
- **Use Case:** User creates an Arkiv entity as part of learning

### QUIZ Steps
- **Evidence Type:** `quiz_result`
- **Evidence:** `score`, `rubricVersion` (required), `maxScore`, `questionIds` (optional)
- **Use Case:** Auto-scored assessments

### SUBMIT Steps
- **Evidence Type:** `submission`
- **Evidence:** `submittedValue`, `submittedType` (required)
- **Use Case:** User submits artifact (URL, hash, text)

### SESSION Steps
- **Evidence Type:** `session_completed`
- **Evidence:** `sessionEntityKey` (required), `sessionDurationMinutes` (optional)
- **Use Case:** User completes a mentorship session

### VERIFY Steps
- **Evidence Type:** `query_proof`
- **Evidence:** `queryFingerprint` (required), `resultKeys` (optional)
- **Use Case:** Client-side verification of Arkiv query results

## Files Referenced

- `lib/arkiv/questProgress.ts` - Progress entity CRUD operations
- `lib/arkiv/questStep.ts` - Step types and evidence definitions
- `lib/hooks/useProgressReconciliation.ts` - Optimistic UI reconciliation hook
- `app/api/quests/progress/route.ts` - API route for progress operations
