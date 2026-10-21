# Canonical Upsert Helper (Create-or-Update)

**Pattern ID:** PAT-UPSERT-001  
**Status:** ✅ Documented  
**Related:** [Stable Entity Key Updates](./stable-entity-key-updates.md) | [Idempotent Writes](./idempotent-writes.md) | [Arkiv Patterns Catalog](../arkiv-patterns-catalog.md)

## Overview

The `arkivUpsertEntity()` helper provides a single canonical path for create-or-update operations, ensuring deterministic key derivation, single writer path, and consistent return values. This eliminates duplicate code and ensures consistent behavior across all entity update operations.

## When to Use

**Always use this pattern when:**

- Creating or updating entities (use `arkivUpsertEntity()` instead of separate create/update functions)
- Implementing Pattern B (stable entity key updates)
- Ensuring idempotent writes
- Maintaining consistent entity update behavior

**Key derivation:**

- If `key` is provided and entity exists: updates the entity
- If `key` is not provided or entity doesn't exist: creates a new entity
- Deterministic key derivation enables idempotent operations

## Invariants

- Single canonical path for all create-or-update operations
- Deterministic key derivation when `key` is provided
- Consistent return values: `{ key: string, txHash: string }`
- Signer metadata is automatically added to attributes
- Transaction timeout handling is built-in
- Default TTL is 6 months (15768000 seconds) if not provided

## Threat Model / Failure Modes

- **Non-deterministic keys:** Random keys prevent idempotency
- **Missing key parameter:** Creates new entity instead of updating existing
- **Race conditions:** Concurrent writes may conflict (handled by query-before-create pattern)
- **Inconsistent return values:** Different return formats cause integration issues

## Arkiv Primitives Used

- `patchEntity({ entityKey, set, unset, payload })` (via `replaceArkivEntity()`) - Updates an existing entity. Expiry, owner and flags are not patchable.
- `createEntity({ payload, contentType, attributes, expires, flags })` (via `createArkivEntity()`) - Creates a new entity
- `entityAttributes()`, `lifetimeFor()`, `flagsFor()` (`lib/arkiv/schema.ts`) - Namespace, typing, lifetime and flags
- `handleTransactionWithTimeout()` - Handles transaction timeouts gracefully
- `addSignerMetadata()` - Adds signer metadata to attributes

## Canonical Algorithm

1. **Check for key:** If `key` parameter is provided, use update path
2. **Update path:** Call `replaceArkivEntity()` (Arkiv 0.8 `patchEntity`) with provided key
3. **Create path:** If no key, call `createArkivEntity()`
4. **Add signer metadata:** Automatically add signer metadata to attributes
5. **Handle timeout:** Use `handleTransactionWithTimeout()` for graceful timeout handling
6. **Return consistent format:** Return `{ key: entityKey, txHash }` for both paths

## Implementation Hooks

**Primary implementation:** ✅ Verified in repo

- `lib/arkiv/entity-utils.ts` - `arkivUpsertEntity()` canonical helper function
- `lib/arkiv/profile.ts` - `createUserProfile()` uses `arkivUpsertEntity()` for Pattern B updates
- `lib/arkiv/notificationPreferences.ts` - `upsertNotificationPreference()` uses `arkivUpsertEntity()`

**Code examples:**

```typescript
// Canonical upsert helper (lib/arkiv/entity-utils.ts)
export async function arkivUpsertEntity({
  type,
  key,
  attributes,
  payload,
  lifetimeSeconds,
  privateKey,
}: {
  type: string;
  key?: string;
  attributes: AttrRecord; // snake_case names, plain values
  payload: unknown; // JSON-serializable
  lifetimeSeconds?: number; // create only; defaults to the type lifetime
  privateKey: `0x${string}`;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);

  // Add signer metadata to attributes
  const attributesWithSigner = addSignerMetadata(attributes, privateKey);

  const result = await handleTransactionWithTimeout(async () => {
    if (key) {
      // Update existing entity: patchEntity with set + unset (full replace)
      return await replaceArkivEntity(walletClient, {
        entityKey: key,
        type,
        attributes: attributesWithSigner,
        payload,
      });
    }
    // Create new entity: namespace, schema_version, typed attributes,
    // lifetimeFor(type) and flagsFor(type) are applied by createArkivEntity
    return await createArkivEntity(walletClient, {
      type,
      attributes: attributesWithSigner,
      payload,
      lifetimeSeconds,
    });
  });

  return { key: result.entityKey, txHash: result.txHash };
}

// Usage: Update existing entity
const result = await arkivUpsertEntity({
  type: 'user_profile',
  key: existingProfile.key, // Update existing
  attributes: { wallet, space_id: SPACE_ID, username },
  payload, // plain object; encoded with jsonToPayload
  privateKey,
});

// Usage: Create new entity
const result = await arkivUpsertEntity({
  type: 'user_profile',
  // No key parameter = create new (lifetime: 365 days for user_profile)
  attributes: { wallet, space_id: SPACE_ID, username },
  payload,
  privateKey,
});
```

## Debug Recipe

- Check key parameter: Verify `key` is provided for updates
- Check return values: Verify consistent `{ key, txHash }` format
- Check signer metadata: Verify signer metadata is added automatically
- Check timeout handling: Verify `handleTransactionWithTimeout()` is used
- Check TTL: Verify default TTL (6 months) is used when not provided

## Anti-Patterns

- ❌ Using separate create/update functions (inconsistent behavior)
- ❌ Not using `arkivUpsertEntity()` (duplicate code)
- ❌ Missing key parameter for updates (creates duplicates)
- ❌ Inconsistent return values (different formats cause integration issues)
- ❌ Not handling timeouts (transactions may hang)

## Known Tradeoffs

- **Consistency:** Single canonical path ensures consistent behavior
- **Simplicity:** Eliminates duplicate create/update code
- **Idempotency:** Deterministic keys enable idempotent operations
- **Performance:** Query-before-create adds latency (mitigated by providing key directly)

## Related Patterns

- [Stable Entity Key Updates](./stable-entity-key-updates.md) - Upsert enables Pattern B updates
- [Idempotent Writes](./idempotent-writes.md) - Upsert with deterministic keys ensures idempotency
- [PAT-TIMEOUT-001: Transaction Timeouts](./transaction-timeouts.md) - Upsert uses timeout handling
