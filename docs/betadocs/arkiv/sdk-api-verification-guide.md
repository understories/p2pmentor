# SDK API Verification Guide (U0.1)

**Date:** 2025-12-21  
**Status:** ✅ Verified and Implemented  
**Purpose:** Guide for verifying Arkiv SDK update API to enable Phase 2 of entity update rollout

## Overview

Before implementing entity updates in production, we need to verify that the Arkiv SDK supports updating entities and understand the exact API signature.

## Current SDK Version

- **Package:** `@arkiv-network/sdk`
- **Version:** `^0.4.4`
- **Network:** Mendoza testnet

## Verification Results

### ✅ Verification Complete

**Method:** TypeScript type definitions inspection  
**Date:** 2025-12-21  
**SDK Version:** `@arkiv-network/sdk@0.4.4`

**Findings:**
1. ✅ `updateEntity` method exists on `walletClient`
2. ✅ Type definitions found in `node_modules/@arkiv-network/sdk/dist/entity-CWj4qVCX.d.ts`
3. ✅ API signature matches expected pattern
4. ✅ Return type includes `entityKey` (stable) and `txHash`

**Verification Steps Used:**
1. Inspected SDK TypeScript definitions: `node_modules/@arkiv-network/sdk/dist/index.d.ts`
2. Found `UpdateEntityParameters` and `UpdateEntityReturnType` type definitions
3. Confirmed method signature matches `createEntity` pattern
4. Verified implementation in `lib/arkiv/entity-utils.ts`

**Note:** The verification script (`scripts/verify-sdk-update-api.ts`) requires `ARKIV_PRIVATE_KEY` environment variable to run. Type inspection was sufficient to verify the API exists and understand its signature.

## Verified API Signature

**Status:** ✅ Verified on 2025-12-21  
**SDK Version:** `@arkiv-network/sdk@0.4.4`

The SDK **does support** entity updates via `updateEntity` method:

```typescript
const result = await walletClient.updateEntity({
  entityKey: `0x${string}`,  // Hex type - stable entity key from creation
  payload: Uint8Array,       // Updated payload
  contentType: 'application/json' as MimeType,
  attributes: Array<{ key: string; value: string | number }>,  // Updated attributes
  expiresIn: number,         // Required TTL in seconds (not optional)
}, txParams?: TxParams);    // Optional transaction parameters
```

**Returns:**
```typescript
{
  entityKey: `0x${string}`,  // Same as input (stable)
  txHash: `0x${string}`,      // New transaction hash
}
```

**Type Definitions:**
- `UpdateEntityParameters`: `{ entityKey: Hex, payload: Uint8Array, attributes: Attribute[], contentType: MimeType, expiresIn: number }`
- `UpdateEntityReturnType`: `{ entityKey: Hex, txHash: Hash }`
- `Attribute`: `{ key: string, value: string | number }`

**Key Differences from createEntity:**
- `entityKey` is required (not optional)
- `expiresIn` is required (not optional)
- `attributes` values can be `string | number` (not just `string`)

## Alternative Method Names

If `updateEntity` doesn't exist, check for:
- `update`
- `modifyEntity`
- `patchEntity`
- `upsertEntity`

## If Update API Doesn't Exist

If the SDK doesn't support entity updates yet:

1. **Document the limitation** in `refs/entity-update-implementation-plan.md`
2. **Continue with create-new-entity pattern** for now
3. **Monitor SDK updates** for when update support is added
4. **Consider alternative approaches:**
   - Use entity versioning (create new entity with reference to old)
   - Use payload-only updates if supported
   - Wait for SDK update support

## Implementation Status

### ✅ Implementation Complete

1. **✅ Updated `arkivUpsertEntity`** in `lib/arkiv/entity-utils.ts`:
   - Replaced placeholder with actual `updateEntity` call
   - Removed error throw for updates
   - Added signer metadata support
   - Handles both create and update paths

2. **✅ Updated documentation:**
   - Marked U0.1 as complete in implementation plan
   - Updated `entity-update-rollout.md` Phase 2 status to "✅ Complete"

3. **Next Steps:**
   - Test thoroughly with `scripts/test-entity-updates.ts` (requires `ENTITY_UPDATE_MODE=shadow`)
   - Test profile updates in production (shadow mode already enabled)
   - Test notification preference updates
   - Verify query paths work correctly
   - Monitor for issues in production
   - Gradually move to `on` mode when confident

## Related Documentation

- [Entity Update Implementation Plan](/refs/entity-update-implementation-plan.md) - Full technical plan
- [Entity Update Rollout](/docs/arkiv/entity-update-rollout) - Rollout phases
- [Editable Entities](/docs/arkiv/editable-entities) - Mental model

