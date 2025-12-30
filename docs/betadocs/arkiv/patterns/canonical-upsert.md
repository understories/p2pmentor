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

- `updateEntity({ entityKey, payload, attributes, expiresIn })` - Updates existing entity
- `createEntity({ payload, attributes, expiresIn })` - Creates new entity
- `handleTransactionWithTimeout()` - Handles transaction timeouts gracefully
- `addSignerMetadata()` - Adds signer metadata to attributes

## Canonical Algorithm

1. **Check for key:** If `key` parameter is provided, use update path
2. **Update path:** Call `updateEntity()` with provided key
3. **Create path:** If no key or update fails, call `createEntity()`
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
// Canonical upsert helper
export async function arkivUpsertEntity({
  type,
  key,
  attributes,
  payload,
  contentType = 'application/json',
  expiresIn,
  privateKey,
}: {
  type: string;
  key?: string;
  attributes: Array<{ key: string; value: string }>;
  payload: Uint8Array;
  contentType?: 'application/json';
  expiresIn?: number;
  privateKey: `0x${string}`;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  
  // Add signer metadata to attributes
  const attributesWithSigner = addSignerMetadata(attributes, privateKey);
  
  if (key) {
    // Update existing entity
    const finalExpiresIn = expiresIn ?? 15768000; // 6 months default
    const result = await handleTransactionWithTimeout(async () => {
      return await walletClient.updateEntity({
        entityKey: key as `0x${string}`,
        payload,
        attributes: attributesWithSigner,
        contentType,
        expiresIn: finalExpiresIn,
      });
    });
    return { key: result.entityKey, txHash: result.txHash };
  } else {
    // Create new entity
    const finalExpiresIn = expiresIn ?? 15768000; // 6 months default
    const result = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload,
        contentType,
        attributes: attributesWithSigner,
        expiresIn: finalExpiresIn,
      });
    });
    return { key: result.entityKey, txHash: result.txHash };
  }
}

// Usage: Update existing entity
const result = await arkivUpsertEntity({
  type: 'user_profile',
  key: existingProfile.key, // Update existing
  attributes,
  payload: enc.encode(JSON.stringify(payload)),
  expiresIn: 31536000, // 1 year
  privateKey,
});

// Usage: Create new entity
const result = await arkivUpsertEntity({
  type: 'user_profile',
  // No key parameter = create new
  attributes,
  payload: enc.encode(JSON.stringify(payload)),
  expiresIn: 31536000,
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

