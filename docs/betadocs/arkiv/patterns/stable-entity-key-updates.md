# Stable Entity Key Updates (Pattern B)

**Pattern ID:** PAT-UPDATE-001  
**Status:** ✅ Documented  
**Related:** [Entity Versioning (Pattern A)](./entity-versioning.md) | [Designing with Immutable Data](./designing-with-immutable-data.md)

## Overview

Frequently updated entities (profiles, preferences, notifications) need stable identity for relationships and simpler queries. This pattern reuses the same `entity_key` for all updates, ensuring relationships never break and queries remain simple.

## When to Use

**Use Pattern B when:**
- Entities are frequently updated
- Relationships depend on stable identity
- Simpler queries are preferred
- Current state is more important than explicit version history

**Use Pattern A (versioning) when:**
- Version history is a feature
- Entities are rarely updated
- Relationships don't depend on stable `entity_key`

## Invariants

- Same `entity_key` is reused for all updates to an entity
- Entity identity never changes (relationships don't break)
- Query by `entity_key` always returns current state
- Transaction history is preserved (all updates are queryable)

## Threat Model / Failure Modes

- **Concurrent updates:** Last-write-wins (or merge strategy per field)
- **Entity key derivation:** Must be deterministic (e.g., `wallet` for profiles)
- **Migration:** Existing Pattern A entities need migration markers

## Arkiv Primitives Used

- `updateEntity({ entityKey, payload, attributes, expiresIn })`
- Deterministic `entity_key` derivation (e.g., `deriveProfileKey(wallet)`)
- Migration markers for per-wallet migration status

## Canonical Algorithm

1. Derive stable `entity_key` from identifier (e.g., `wallet`)
2. Query for existing entity by `entity_key`
3. If exists: call `updateEntity()` with same `entity_key`
4. If not exists: call `createEntity()` (first time)
5. All subsequent updates reuse the same `entity_key`

## Implementation Hooks

**Primary implementation:**
- `lib/arkiv/entity-utils.ts` - `arkivUpsertEntity()` with `key` parameter
- `lib/arkiv/profile.ts` - `createUserProfile()` checks for existing profile
- `lib/arkiv/notifications.ts` - Notification preference updates

**Code references status:** ✅ Verified in repo

## Debug Recipe

- Verify `entity_key` is stable across updates (should not change)
- Query transaction history: all updates should have same `entity_key`
- Check migration markers: `query({ type: 'entity_update_migration', wallet })`
- Verify relationships still work (e.g., feedback → profile via stable key)

## Anti-Patterns

- ❌ Creating new `entity_key` for each update (use Pattern A instead)
- ❌ Non-deterministic `entity_key` derivation
- ❌ Mixing Pattern A and Pattern B for same entity type

## Known Tradeoffs

- **Simplicity:** Queries are simpler (no "latest version" selection)
- **Relationships:** Stable identity ensures relationships never break
- **Storage:** Less storage growth over time (updates reuse same entity)
- **Version history:** Implicit (all transactions for one `entity_key`)

## Related Patterns

- [Entity Versioning (Pattern A)](./entity-versioning.md) - Alternative pattern for versioning scenarios
- [Designing with Immutable Data](./designing-with-immutable-data.md) - Core principles
- [PAT-UPSERT-001: Canonical Upsert Helper](../arkiv-patterns-catalog.md#pat-upsert-001-canonical-upsert-helper-create-or-update) - Implementation helper

