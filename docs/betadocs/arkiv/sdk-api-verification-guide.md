# SDK API Verification Guide (U0.1)

**Date:** 2025-12-21  
**Status:** ⏳ Pending Verification  
**Purpose:** Guide for verifying Arkiv SDK update API to enable Phase 2 of entity update rollout

## Overview

Before implementing entity updates in production, we need to verify that the Arkiv SDK supports updating entities and understand the exact API signature.

## Current SDK Version

- **Package:** `@arkiv-network/sdk`
- **Version:** `^0.4.4`
- **Network:** Mendoza testnet

## Verification Steps

### Step 1: Run Verification Script

```bash
tsx scripts/verify-sdk-update-api.ts
```

This script will:
1. Check if `walletClient` has an `updateEntity` method
2. Create a test entity
3. Attempt to call `updateEntity` with the test entity
4. Report the API signature if successful

### Step 2: Check SDK Documentation

1. Visit [Arkiv Network Documentation](https://arkiv.network/docs)
2. Look for "Entity Updates" or "Updating Entities" section
3. Check TypeScript API reference

### Step 3: Check SDK Source Code

If documentation is unclear, check the SDK source:

```bash
# Check node_modules for SDK types
cat node_modules/@arkiv-network/sdk/dist/index.d.ts | grep -i update
```

Or check the SDK repository:
- GitHub: Check for `updateEntity` method in wallet client
- TypeScript definitions: Look for update-related types

### Step 4: Test with Real Entity

If the verification script succeeds, test with a real profile entity:

1. Create a test profile
2. Update the profile using the verified API
3. Query the profile to confirm the update
4. Verify the entity key remains stable

## Expected API Signature

Based on the implementation plan, we expect:

```typescript
const result = await walletClient.updateEntity({
  entityKey: string,        // Stable entity key from creation
  payload: Uint8Array,       // Updated payload
  contentType: 'application/json',
  attributes: Array<{ key: string; value: string }>,  // Updated attributes
  expiresIn?: number,        // Optional TTL
});
```

**Returns:**
```typescript
{
  entityKey: string,  // Same as input (stable)
  txHash: string,     // New transaction hash
}
```

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

## After Verification

Once verified:

1. **Update `arkivUpsertEntity`** in `lib/arkiv/entity-utils.ts`:
   - Replace placeholder with actual `updateEntity` call
   - Remove the error throw for updates

2. **Update documentation:**
   - Mark U0.1 as complete in implementation plan
   - Update `entity-update-rollout.md` Phase 2 status

3. **Test thoroughly:**
   - Run `scripts/test-entity-updates.ts` with `ENTITY_UPDATE_MODE=shadow`
   - Test profile updates
   - Test notification preference updates
   - Verify query paths work correctly

4. **Enable for new users:**
   - Set `ENTITY_UPDATE_MODE=shadow` in production
   - Monitor for issues
   - Gradually move to `on` mode

## Related Documentation

- [Entity Update Implementation Plan](/refs/entity-update-implementation-plan.md) - Full technical plan
- [Entity Update Rollout](/docs/betadocs/arkiv/entity-update-rollout.md) - Rollout phases
- [Editable Entities](/docs/betadocs/arkiv/editable-entities.md) - Mental model

