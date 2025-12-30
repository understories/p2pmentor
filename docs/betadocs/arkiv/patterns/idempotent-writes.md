# Idempotent Writes

**Pattern ID:** PAT-IDEMPOTENT-001  
**Status:** ✅ Documented  
**Related:** [Stable Entity Key Updates](./stable-entity-key-updates.md) | [Canonical Upsert Helper](./canonical-upsert.md) | [Arkiv Patterns Catalog](../arkiv-patterns-catalog.md)

## Overview

Network retries, user double-clicks, or race conditions can cause duplicate writes. Idempotent writes ensure the same operation produces the same result, preventing duplicate entities and maintaining data consistency.

## When to Use

**Always apply this pattern when:**
- User actions can be retried (double-clicks, network retries)
- Race conditions are possible (concurrent writes)
- Operations should be safe to retry
- Duplicate entities would cause problems

**Strategies:**
1. **Deterministic key derivation:** Derive `entity_key` from stable identifiers (wallet, notificationId, etc.)
2. **Idempotency keys:** Use unique `idempotencyKey` in payload to detect duplicates
3. **Query-before-create:** Check for existing entity before creating
4. **Upsert pattern:** Use create-or-update logic to handle both cases

## Invariants

- Same operation can be safely retried
- Deterministic `entity_key` derivation prevents duplicates
- Operation keys (if used) are unique per operation
- Duplicate writes are detected and ignored
- Retrying an operation produces the same result

## Threat Model / Failure Modes

- **Double-submission:** User double-clicks submit button (creates duplicates)
- **Network retries:** Failed requests are retried, creating duplicates
- **Race conditions:** Concurrent writes create conflicting state
- **Missing checks:** Not checking for existing entity before creating
- **Non-deterministic keys:** Random or time-based keys allow duplicates

## Arkiv Primitives Used

- Deterministic `entity_key` derivation from stable identifiers
- Query before create: `buildQuery().where(eq(...)).fetch()` to check existence
- Upsert pattern: `arkivUpsertEntity()` with key parameter
- Idempotency keys: Stored in payload for duplicate detection

## Canonical Algorithm

1. **Derive stable key:** Use deterministic function (e.g., `deriveProfileKey(wallet)`)
2. **Check existence:** Query for entity with derived key
3. **If exists:** Return existing entity (idempotent)
4. **If not exists:** Create new entity with derived key
5. **Handle race conditions:** If create fails with "already exists", query and return existing

**Alternative (idempotency key):**
1. **Generate idempotency key:** Unique per operation (e.g., UUID)
2. **Query by attributes:** Check for existing entity with same idempotency key in payload
3. **If found:** Return existing entity
4. **If not found:** Create new entity with idempotency key in payload

## Implementation Hooks

**Primary implementation:** ✅ Verified in repo
- `lib/arkiv/metaLearningQuest.ts` - `createMetaLearningArtifact()` uses `idempotencyKey` in payload
- `lib/arkiv/authIdentity.ts` - `createPasskeyIdentity()` handles race conditions with query-before-create
- `lib/arkiv/profile.ts` - `createUserProfile()` checks for existing profile before creating
- `lib/arkiv/notificationPreferences.ts` - `upsertNotificationPreference()` uses deterministic key derivation
- `lib/arkiv/entity-utils.ts` - `arkivUpsertEntity()` provides canonical upsert pattern

**Code examples:**
```typescript
// Strategy 1: Deterministic key derivation
const deriveProfileKey = (wallet: string): string => {
  // Deterministic derivation ensures same wallet = same key
  return keccak256(toBytes(`profile:${wallet.toLowerCase()}`));
};

// Strategy 2: Query before create
const existingProfile = await getProfileByWallet(wallet);
if (existingProfile?.key) {
  // Update existing (idempotent)
  return await arkivUpsertEntity({
    type: 'user_profile',
    key: existingProfile.key,
    attributes,
    payload,
    privateKey,
  });
} else {
  // Create new
  return await arkivUpsertEntity({
    type: 'user_profile',
    attributes,
    payload,
    privateKey,
  });
}

// Strategy 3: Idempotency key in payload
const idempotencyKey = generateUUID();
const existing = await queryByAttributes({
  type: 'meta_learning_artifact',
  questId,
  stepId,
});

// Check payload for idempotency key
for (const entity of existing.entities) {
  const payload = JSON.parse(new TextDecoder().decode(entity.payload));
  if (payload.idempotencyKey === idempotencyKey) {
    return { key: entity.key, txHash: entity.txHash }; // Return existing
  }
}

// Create new with idempotency key
const payload = {
  questId,
  stepId,
  idempotencyKey, // Stored in payload
  data,
};

// Strategy 4: Handle race conditions
try {
  return await createEntity({...});
} catch (createError) {
  // If "already exists", query and return existing
  const existing = await findEntityByKey(derivedKey);
  if (existing) {
    return { key: existing.key, txHash: existing.txHash };
  }
  throw createError; // Real error, not race condition
}
```

## Debug Recipe

- Check key derivation: Verify deterministic keys (same input = same key)
- Check duplicate detection: Verify queries check for existing entities
- Check race conditions: Test concurrent writes (should not create duplicates)
- Check idempotency keys: Verify keys are unique per operation
- Check retry behavior: Retry same operation (should return same result)

## Anti-Patterns

- ❌ Random or time-based keys (allows duplicates)
- ❌ Not checking for existing entity before creating
- ❌ Not handling race conditions (concurrent writes create duplicates)
- ❌ Non-deterministic key derivation (same input produces different keys)
- ❌ Ignoring "already exists" errors (should query and return existing)

## Known Tradeoffs

- **Consistency:** Idempotent writes ensure consistent state
- **Performance:** Query-before-create adds latency (mitigated by upsert pattern)
- **Complexity:** Requires careful key derivation and duplicate detection
- **Race conditions:** Must handle concurrent writes gracefully

## Related Patterns

- [Stable Entity Key Updates](./stable-entity-key-updates.md) - Deterministic key derivation enables idempotency
- [Canonical Upsert Helper](./canonical-upsert.md) - Single canonical path for create-or-update
- [PAT-OPTIMISTIC-001: Optimistic UI + Reconciliation](../arkiv-patterns-catalog.md#pat-optimistic-001-optimistic-ui--reconciliation) - Retries require idempotency

