# Arkiv TTL (Time To Live) Implementation Plan

## Problem Statement

1. **Asks and Offers default to fixed TTLs** (1 hour and 2 hours respectively) regardless of user preference
2. **Users cannot set custom expiration times** for their asks/offers
3. **When listing entities, we hardcode `ttlSeconds`** instead of calculating from actual entity expiration
4. **Sessions already work correctly** - they calculate expiration based on `sessionDate + duration + buffer`

## Current Implementation Analysis

### Asks (`lib/arkiv/asks.ts`)
- Default: `ASK_TTL_SECONDS = 3600` (1 hour)
- `createAsk()` accepts optional `expiresIn` parameter (in seconds)
- API route (`app/api/asks/route.ts`) already accepts `expiresIn` but UI doesn't send it
- **Bug**: `listAsks()` and `listAsksForWallet()` hardcode `ttlSeconds: ASK_TTL_SECONDS` instead of calculating from actual expiration

### Offers (`lib/arkiv/offers.ts`)
- Default: `OFFER_TTL_SECONDS = 7200` (2 hours)
- `createOffer()` accepts optional `expiresIn` parameter (in seconds)
- API route (`app/api/offers/route.ts`) already accepts `expiresIn` but UI doesn't send it
- **Bug**: `listOffers()` and `listOffersForWallet()` hardcode `ttlSeconds: OFFER_TTL_SECONDS` instead of calculating from actual expiration

### Sessions (`lib/arkiv/sessions.ts`)
- ✅ **Already correct**: Calculates expiration as `sessionDate + duration + 1 hour buffer`
- ✅ **Already correct**: All related entities (confirmations, rejections, payment validations, Jitsi) use the same calculated expiration

## Arkiv SDK Documentation Research

Based on codebase analysis:
- `expiresIn` parameter in `createEntity()` accepts **seconds** (number)
- Entities are stored with expiration, but we need to verify if expiration is exposed in query results
- Current pattern: We store `createdAt` as ISO string, and we pass `expiresIn` in seconds to `createEntity()`

**Key Finding**: We need to calculate `ttlSeconds` from:
- `createdAt` (when entity was created)
- `expiresIn` (how many seconds from creation it expires)

**Formula**: `expirationTime = createdAt + expiresIn`, so `ttlSeconds = expiresIn` (the value we passed)

However, when listing, we don't have access to the original `expiresIn` value. We need to either:
1. Store `expiresIn` in the entity payload/attributes, OR
2. Calculate from entity metadata if Arkiv exposes it

## Implementation Plan

### Phase 1: Store TTL in Entity Attributes (Recommended)

**Why**: Ensures we can always retrieve the actual TTL, even if we can't get it from Arkiv metadata.

**Changes**:
1. **Update `createAsk()`**: Store `ttlSeconds` in entity attributes
2. **Update `createOffer()`**: Store `ttlSeconds` in entity attributes
3. **Update `listAsks()` and `listAsksForWallet()`**: Read `ttlSeconds` from attributes instead of hardcoding
4. **Update `listOffers()` and `listOffersForWallet()`**: Read `ttlSeconds` from attributes instead of hardcoding

### Phase 2: Add UI for TTL Selection

**For Asks (`app/asks/page.tsx`)**:
- Add expiration duration selector (dropdown or input)
- Options: 1 hour, 2 hours, 6 hours, 12 hours, 24 hours, 48 hours, 1 week, Custom (number input)
- Default: 1 hour (maintains current behavior)
- Convert user selection to seconds before sending to API

**For Offers (`app/offers/page.tsx`)**:
- Same as asks, but default: 2 hours (maintains current behavior)
- Allow longer durations (offers typically stay up longer)

### Phase 3: Update API Routes

**Already done**: Both API routes accept `expiresIn` parameter.

**Verification needed**: Ensure proper validation:
- Minimum: 60 seconds (1 minute)
- Maximum: 31536000 seconds (1 year) - reasonable limit
- Must be a positive integer

### Phase 4: Update Display Logic

**Update time remaining calculations**:
- `formatTimeRemaining()` functions should use actual `ttlSeconds` from entity
- Network graph filtering should use actual `ttlSeconds` for active/inactive determination

### Phase 5: Session Expiration Verification

**Already correct**: Sessions calculate expiration based on `sessionDate + duration + buffer`.

**No changes needed**, but document the pattern:
- Session entities expire at: `sessionDate + duration + 1 hour buffer`
- All related entities (confirmations, rejections, payment validations, Jitsi) use the same expiration

## Step-by-Step Implementation

### Step 1: Store TTL in Entity Attributes

**File**: `lib/arkiv/asks.ts`
- In `createAsk()`, add `{ key: 'ttlSeconds', value: String(ttl) }` to attributes
- In `listAsks()` and `listAsksForWallet()`, read `ttlSeconds` from attributes: `getAttr('ttlSeconds') || ASK_TTL_SECONDS`

**File**: `lib/arkiv/offers.ts`
- In `createOffer()`, add `{ key: 'ttlSeconds', value: String(ttl) }` to attributes
- In `listOffers()` and `listOffersForWallet()`, read `ttlSeconds` from attributes: `getAttr('ttlSeconds') || OFFER_TTL_SECONDS`

### Step 2: Add TTL Selection UI

**File**: `app/asks/page.tsx`
- Add `ttlHours` or `ttlSeconds` to `newAsk` state
- Add dropdown/input for expiration selection
- Convert to seconds before API call
- Default: 1 hour (3600 seconds)

**File**: `app/offers/page.tsx`
- Same as asks
- Default: 2 hours (7200 seconds)

### Step 3: Validate TTL in API Routes

**File**: `app/api/asks/route.ts`
- Add validation: `if (parsedExpiresIn < 60 || parsedExpiresIn > 31536000) { return error }`

**File**: `app/api/offers/route.ts`
- Same validation

### Step 4: Update Network Graph Filtering

**File**: `lib/arkiv/networkGraph.ts`
- Already uses `ttlSeconds` from entity, should work once Step 1 is complete

## Testing Checklist

- [ ] Create ask with custom TTL (e.g., 6 hours)
- [ ] Verify ask appears in list with correct time remaining
- [ ] Verify ask expires at correct time
- [ ] Create offer with custom TTL (e.g., 1 week)
- [ ] Verify offer appears in list with correct time remaining
- [ ] Verify offer expires at correct time
- [ ] Test with default TTLs (should maintain current behavior)
- [ ] Test with minimum TTL (1 minute)
- [ ] Test with maximum TTL (1 year)
- [ ] Verify session expiration still works correctly
- [ ] Verify network graph filtering uses actual TTL

## Edge Cases

1. **Backward compatibility**: Existing entities won't have `ttlSeconds` in attributes
   - **Solution**: Fallback to default TTL when attribute is missing

2. **Invalid TTL values**: User enters negative or zero
   - **Solution**: API validation rejects invalid values

3. **Very long TTLs**: User sets 1 year TTL
   - **Solution**: Set reasonable maximum (1 year = 31536000 seconds)

4. **Session expiration**: Already handled correctly, no changes needed

## Documentation Updates

- Update `docs/dx_arkiv_runbook.md` with TTL patterns
- Document that sessions use `sessionDate + duration + buffer` pattern
- Document that asks/offers now support user-defined TTL

## Files to Modify

1. `lib/arkiv/asks.ts` - Store and retrieve TTL from attributes
2. `lib/arkiv/offers.ts` - Store and retrieve TTL from attributes
3. `app/asks/page.tsx` - Add TTL selection UI
4. `app/offers/page.tsx` - Add TTL selection UI
5. `app/api/asks/route.ts` - Add TTL validation
6. `app/api/offers/route.ts` - Add TTL validation
7. `docs/dx_arkiv_runbook.md` - Document TTL patterns

## Notes

- **Sessions are already correct** - they calculate expiration dynamically based on meeting time
- **The bug**: We're not storing or retrieving the actual TTL, we're using hardcoded defaults
- **The fix**: Store TTL in attributes, retrieve it when listing, allow users to set it in UI

