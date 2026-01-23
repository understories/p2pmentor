# Proof of Skill Badge Entity Schema

## Status
- Canonical for p2pmentor: Yes
- Mutability: Pattern B
- Pattern dependencies: PAT-UPDATE-001, PAT-QUERY-001, PAT-IDENTITY-001, PAT-SPACE-001, PAT-REF-001

## Entity Type
`proof_of_skill_badge`

## Patterns Used

- [PAT-UPDATE-001: Stable Entity Key Updates](../patterns/stable-entity-key-updates.md) - Badges use stable entity keys (Pattern B)
- [PAT-QUERY-001: Indexer-Friendly Query Shapes](../patterns/query-optimization.md) - Queries use indexed attributes (type, wallet, badgeType, questId, spaceId)
- [PAT-IDENTITY-001: Wallet Normalization](../patterns/wallet-normalization.md) - Wallet addresses normalized to lowercase
- [PAT-SPACE-001: Space ID as Environment Boundary](../patterns/space-isolation.md) - spaceId attribute for data isolation
- [PAT-REF-001: Relationship References That Survive Updates](../patterns/reference-integrity.md) - Badges reference quest_step_progress entities via evidenceRefs

## Field Table

| Field Name | Type | Required | Location | Description |
|------------|------|----------|----------|-------------|
| type | string | Yes | Attribute | Always "proof_of_skill_badge" |
| wallet | string | Yes | Attribute | Wallet address (lowercase, primary identifier) |
| badgeType | string | Yes | Attribute | Badge type: "arkiv_builder" | "mandarin_starter" | "spanish_starter" | "cryptography_basics" | "privacy_fundamentals" | "ai_intro" |
| questId | string | Yes | Attribute | Quest identifier this badge was earned for (e.g., "arkiv_builder") |
| spaceId | string | Yes | Attribute | Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) |
| issuedAt | string | Yes | Attribute | ISO timestamp when badge was issued |
| evidenceRefs | Array<EvidenceRef> | Yes | Payload | Array of evidence references to quest_step_progress entities |
| questVersion | string | Yes | Payload | Quest version this badge was earned on (e.g., "1") |
| version | string | Yes | Payload | Badge schema version (currently "1") |
| issuer | string | Yes | Payload | Badge issuer identifier (e.g., "p2pmentor") |

## Evidence Reference Structure

```typescript
interface EvidenceRef {
  stepId: string;        // Step identifier
  entityKey: string;    // Entity key of quest_step_progress entity
  txHash?: string;      // Transaction hash (optional, for verification)
}
```

## Update Handling

Badge entities use stable entity keys (Pattern B). The same entity key is reused for badge updates.

**Entity Key Format:** `badge:${spaceId}:${wallet}:${badgeType}`

**Example:** `badge:beta-launch:0xabc123:arkiv_builder`

**Rationale:**
- Stable keys enable reliable querying
- Badge updates overwrite previous state (last-write-wins)
- Full transaction history preserved on-chain
- Entity identity never changes

**Note:** Badges are typically issued once and not updated. The stable key pattern ensures consistency if badge metadata needs to change.

Implementation: `lib/arkiv/badge.ts` - `issueBadge()` uses stable key derivation.

## Query Pattern

Fetch all badges for a wallet:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'proof_of_skill_badge'))
  .where(eq('wallet', wallet.toLowerCase()))
  .where(eq('spaceId', spaceId))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

Fetch specific badge:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'proof_of_skill_badge'))
  .where(eq('wallet', wallet.toLowerCase()))
  .where(eq('badgeType', 'arkiv_builder'))
  .where(eq('spaceId', spaceId))
  .withAttributes(true)
  .withPayload(true)
  .limit(1)
  .fetch();
```

Fetch badges by quest:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'proof_of_skill_badge'))
  .where(eq('questId', 'arkiv_builder'))
  .where(eq('spaceId', spaceId))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

Implementation: `lib/arkiv/badge.ts` - `getUserBadges()`, `getUserBadge()`

## Badge Eligibility

Badges are issued when a user completes all required steps for a quest. Eligibility is checked by:

1. Loading quest definition for the version referenced in progress
2. Getting required step IDs (from quest.badge.requiredSteps or all required steps)
3. Checking that all required steps have completed progress entities
4. Verifying progress entities reference the same quest version

**Eligibility Check:**
```typescript
const eligibility = await checkBadgeEligibility({
  wallet,
  questId: 'arkiv_builder',
  spaceId,
});

// Returns:
// {
//   eligible: boolean,
//   completedSteps: string[],
//   missingSteps: string[],
//   questVersion: string
// }
```

Implementation: `lib/arkiv/badge.ts` - `checkBadgeEligibility()`

## Entity Relationships

- Links to `quest_definition` entities via `questId` attribute (string reference)
- Links to `quest_step_progress` entities via `evidenceRefs` array (stores entity keys)
- Links to `user_profile` entities via `wallet` attribute (wallet address)

## Quest Version Tracking

Badges store `questVersion` in payload to reference the specific quest version they were earned on. This ensures:

- Badge validity even if quest definition changes
- Progress validation against the correct quest version
- Historical accuracy of badge requirements

**Version Chain:**
- Badge → `questId` + `questVersion` (in payload)
- Badge → `evidenceRefs` → `quest_step_progress` entities
- `quest_step_progress` → `questId` + `questVersion` (in payload)

## Badge Revocation

Badge revocation is not currently implemented. If needed, use marker entity pattern:

- Create `badge_revocation` entity
- Reference badge via `badgeKey` attribute
- Queries check for revocation markers before displaying badges

## Expiration

Badge entities expire after 1 year (31536000 seconds). This is effectively permanent for user achievements.

## Transaction Hash Tracking

Separate `proof_of_skill_badge_txhash` entity (optional) tracks transaction hash:
- `type`: "proof_of_skill_badge_txhash"
- `badgeKey`: Entity key of badge
- `txHash`: Transaction hash
- `wallet`: Wallet address (normalized lowercase)
- `spaceId`: Space ID (matches badge entity)
- `createdAt`: ISO timestamp

## Badge Types

Supported badge types:
- `arkiv_builder` - Completed Arkiv Builder track
- `mandarin_starter` - Completed Mandarin Starter track
- `spanish_starter` - Completed Spanish Starter track
- `cryptography_basics` - Completed Cryptography Basics track
- `privacy_fundamentals` - Completed Privacy Fundamentals track
- `ai_intro` - Completed AI Introduction track

Badge types are defined in `lib/arkiv/badge.ts` - `BadgeType` type.

## Verification

Badges are verifiable on-chain:

1. **Badge Entity:** Query badge entity by wallet + badgeType
2. **Evidence Chain:** Verify evidenceRefs point to valid `quest_step_progress` entities
3. **Quest Definition:** Load quest definition for the version referenced in badge
4. **Step Validation:** Verify all required steps are completed

**Verification Flow:**
```typescript
// 1. Load badge
const badge = await getUserBadge({ wallet, badgeType: 'arkiv_builder' });

// 2. Load quest definition for the version badge was earned on
const quest = await getQuestDefinition({ 
  questId: badge.questId, 
  version: badge.questVersion 
});

// 3. Verify evidence refs match required steps
const requiredSteps = quest.steps.filter(s => s.required).map(s => s.stepId);
const completedSteps = badge.evidenceRefs.map(ref => ref.stepId);
const valid = requiredSteps.every(stepId => completedSteps.includes(stepId));
```

## Files Referenced

- `lib/arkiv/badge.ts` - Badge entity CRUD operations and eligibility checking
- `lib/arkiv/questDefinition.ts` - Quest definition loading for eligibility checks
- `lib/arkiv/questProgress.ts` - Progress entity queries for eligibility checks
- `app/api/badges/route.ts` - API route for badge operations
