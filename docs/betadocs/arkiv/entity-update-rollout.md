# Entity Update Pattern Rollout

**Date:** 2025-12-21  
**Status:** ✅ Enabled for new users (shadow mode)  
**Purpose:** Document the rollout of the entity update pattern for profiles and notifications

## Overview

The entity update pattern allows profiles and notifications to use stable entity keys, ensuring consistent references and simpler queries while maintaining full transaction history on-chain.

## Rollout Strategy

### Phase 1: Shadow Mode (Current)

**Status:** ✅ Enabled  
**Environment Variable:** `ENTITY_UPDATE_MODE=shadow`

**Behavior:**
- New users are automatically marked as migrated when they create their first profile
- Migrated wallets attempt to use entity updates (will fallback to create-new-entity until SDK API is verified)
- Non-migrated wallets continue using create-new-entity pattern (backward compatible)
- Query paths check migration status and use canonical entity when available

**Safety:**
- Falls back gracefully if SDK update API is not yet verified
- No data loss - old pattern still works
- Can be disabled by setting `ENTITY_UPDATE_MODE=off`

### Phase 2: SDK API Verification (U0.1)

**Status:** ⏳ Pending  
**Next Step:** Verify Arkiv SDK update API signature

Once verified, the `arkivUpsertEntity` function in `lib/arkiv/entity-utils.ts` will be updated to use the actual SDK update call.

### Phase 3: Full Rollout (On Mode)

**Status:** ⏳ Pending  
**Prerequisite:** SDK API verified and tested

When ready, set `ENTITY_UPDATE_MODE=on` to enable updates for all wallets.

## Testing

### Test Script

Run the test script to validate the implementation:

```bash
ENTITY_UPDATE_MODE=shadow pnpm dlx tsx scripts/test-entity-updates.ts
```

### Manual Testing

1. Visit `/profiles` page
2. Check profile count display (should show number of versions per wallet)
3. Hover over tooltips to see educational explanations
4. Verify migration metrics banner shows correct percentages

## Monitoring

### Metrics

- **Profile count per wallet** - Displayed on `/profiles` page
- **Migration progress** - Shown in migration metrics banner
- **Query performance** - Tracked via performance metrics

### Observability

- Console logs for migration markers
- Warnings when multiple profiles found for migrated wallets
- Error logs if update attempts fail (with graceful fallback)

## Rollback

To disable entity updates:

1. Set `ENTITY_UPDATE_MODE=off` in environment variables
2. Redeploy application
3. New users will no longer be marked as migrated
4. Existing migrated wallets continue using update pattern (per-wallet markers persist)

## Related Documentation

- [Entity Update Implementation Plan](/refs/entity-update-implementation-plan.md) - Technical details
- [Editable Entities](/docs/betadocs/arkiv/editable-entities.md) - Mental model explanation
- [Wallet Architecture](/docs/betadocs/arkiv/wallet-architecture.md) - Profile wallet vs signing wallet

