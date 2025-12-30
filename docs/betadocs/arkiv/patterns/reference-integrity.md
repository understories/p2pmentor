# Relationship References That Survive Updates

**Pattern ID:** PAT-REF-001  
**Status:** ✅ Documented  
**Related:** [Stable Entity Key Updates](./stable-entity-key-updates.md) | [Entity Versioning](./entity-versioning.md) | [Arkiv Patterns Catalog](../arkiv-patterns-catalog.md)

## Overview

Relationships between entities must survive updates. Use stable identifiers (wallet, stable `entity_key`, or explicit logical IDs) instead of volatile `entity_key` when using Pattern A. Pattern B (stable entity key) ensures relationships never break by reusing the same `entity_key` for all updates.

## When to Use

**Always apply this pattern when:**
- Entities reference other entities (relationships)
- Referenced entities may be updated
- Using Pattern A (entity versioning) where `entity_key` changes
- Relationships must persist across entity updates

**Stable identifier strategies:**
1. **Pattern B (preferred):** Use stable `entity_key` (never changes)
2. **Pattern A with stable IDs:** Reference `wallet` or logical ID instead of `entity_key`
3. **Explicit logical IDs:** Use domain-specific stable identifiers (e.g., `sessionKey`, `notificationId`)

## Invariants

- Relationships use stable identifiers (never change)
- Pattern B: `entity_key` is stable (relationships never break)
- Pattern A: Reference `wallet` or logical ID, not volatile `entity_key`
- Backlinks use same stable identifier strategy
- Denormalization preserves stable references

## Threat Model / Failure Modes

- **Broken relationships:** Volatile `entity_key` references break when entity updates
- **Orphaned references:** References to deleted/updated entities become invalid
- **Inconsistent state:** Relationships and entities get out of sync
- **Query failures:** Queries fail when referenced entity key changes

## Arkiv Primitives Used

- Stable `entity_key`: Pattern B ensures `entity_key` never changes
- Stable identifiers: `wallet`, logical IDs (e.g., `sessionKey`, `notificationId`)
- Backlink attributes: Store references in both directions for queryability
- Denormalization: Store stable identifiers in related entities

## Canonical Algorithm

**Pattern B (preferred):**
1. Use stable `entity_key` for all entity updates
2. Reference other entities by their stable `entity_key`
3. Relationships never break (entity_key never changes)

**Pattern A with stable IDs:**
1. Reference entities by stable identifier (e.g., `wallet`, `sessionKey`)
2. Query for current entity using stable identifier
3. Don't reference volatile `entity_key` in relationships

**Backlink pattern:**
1. Store reference in both directions (bidirectional)
2. Use stable identifiers for both forward and back references
3. Query from either direction using stable identifier

## Implementation Hooks

**Primary implementation:** ✅ Verified in repo
- Pattern B: `lib/arkiv/profile.ts` - Profiles use stable `entity_key` per wallet
- Pattern B: `lib/arkiv/notificationPreferences.ts` - Preferences use stable `entity_key` per `(wallet, notificationId)`
- Pattern A: `lib/arkiv/learnerQuest.ts` - Quest progress references `questKey` (stable entity_key from Pattern B)
- Backlinks: Feedback entities reference profiles by stable `entity_key`

**Code examples:**
```typescript
// Pattern B: Stable entity_key (relationships never break)
const profile = await arkivUpsertEntity({
  type: 'user_profile',
  key: deriveProfileKey(wallet), // Stable key
  attributes,
  payload,
  privateKey,
});

// Reference profile by stable entity_key
const feedback = await createEntity({
  type: 'feedback',
  attributes: [
    { key: 'profileKey', value: profile.key }, // Stable reference
    { key: 'wallet', value: wallet }, // Also store wallet for querying
  ],
  payload,
  privateKey,
});

// Pattern A: Reference by stable identifier (wallet)
const session = await createEntity({
  type: 'session',
  attributes: [
    { key: 'mentorWallet', value: mentorWallet }, // Stable reference
    { key: 'learnerWallet', value: learnerWallet }, // Stable reference
    // Don't reference profile entity_key (may change with Pattern A)
  ],
  payload,
  privateKey,
});

// Query current profile by wallet (stable identifier)
const currentProfile = await getProfileByWallet(mentorWallet);

// Backlink pattern: Bidirectional references
const session = await createSession({...});
const confirmation = await createEntity({
  type: 'session_confirmation',
  attributes: [
    { key: 'sessionKey', value: session.key }, // Forward reference
    { key: 'confirmedBy', value: wallet }, // Stable identifier
  ],
  payload,
  privateKey,
});

// Query from either direction
const confirmations = await query({ type: 'session_confirmation', sessionKey: session.key });
const sessions = await query({ type: 'session', mentorWallet: wallet });
```

## Debug Recipe

- Check reference stability: Verify references use stable identifiers
- Check Pattern B usage: Verify entities use stable `entity_key` for updates
- Check Pattern A references: Verify Pattern A entities reference stable IDs, not `entity_key`
- Check backlinks: Verify bidirectional references use stable identifiers
- Check query patterns: Verify queries use stable identifiers, not volatile `entity_key`

## Anti-Patterns

- ❌ Referencing volatile `entity_key` in Pattern A (breaks when entity updates)
- ❌ Not using stable identifiers for relationships (references break)
- ❌ Mixing Pattern A and Pattern B references (inconsistent behavior)
- ❌ Not storing backlinks (can't query from both directions)
- ❌ Using non-stable identifiers (references become invalid)

## Known Tradeoffs

- **Pattern B:** Relationships never break (preferred for relationships)
- **Pattern A:** Requires stable identifier references (adds complexity)
- **Backlinks:** Enable bidirectional queries but require maintaining both references
- **Denormalization:** Improves query performance but requires keeping references in sync

## Related Patterns

- [Stable Entity Key Updates](./stable-entity-key-updates.md) - Pattern B ensures stable references
- [Entity Versioning](./entity-versioning.md) - Pattern A requires stable identifier references
- [PAT-UPSERT-001: Canonical Upsert Helper](./canonical-upsert.md) - Upsert with stable keys enables Pattern B

