# GraphQL Migration Status & Findings

**Last Updated:** 2025-01-XX  
**Status:** PAUSED - Returning to higher priority tasks  
**Next Steps:** See "Resuming Work" section below

---

## Executive Summary

We've been migrating from direct Arkiv JSON-RPC calls to a GraphQL API layer. The migration is **partially complete** with significant progress on infrastructure, but a critical blocker remains: the `asks` and `offers` GraphQL resolvers are failing with "Cannot return null for non-nullable field" errors, despite comprehensive error handling.

**What Works:**
- ✅ GraphQL API infrastructure (`/api/graphql` endpoint)
- ✅ `networkOverview` resolver (uses `listAsks()` and `listOffers()` successfully)
- ✅ GraphQL schema definition
- ✅ Performance tracking infrastructure
- ✅ Admin dashboard for monitoring GraphQL usage
- ✅ Feature flags system

**What Doesn't Work:**
- ❌ Direct `asks` query resolver (fails with null error)
- ❌ Direct `offers` query resolver (fails with null error)
- ❌ Client-side pages (`/asks`, `/offers`) cannot use GraphQL yet

**Key Mystery:**
The `networkOverview` resolver successfully calls `listAsks()` and `listOffers()`, proving these functions work. However, the direct `asks` and `offers` resolvers fail with the same underlying functions. This suggests the issue is in the resolver structure or GraphQL execution context, not in the data fetching layer.

---

## Architecture Overview

### Current Implementation

```
Client Pages (/asks, /offers, /profiles/[wallet])
  ↓
Feature Flags (useGraphqlForAsks, useGraphqlForOffers, useGraphqlForProfile)
  ↓
GraphQL Client (lib/graph/client.ts)
  ↓
GraphQL API (/api/graphql)
  ↓
GraphQL Resolvers (lib/graphql/resolvers.ts)
  ↓
Arkiv Functions (lib/arkiv/asks.ts, offers.ts, profile.ts)
  ↓
Arkiv JSON-RPC
```

### Working Path: `/network` Page

```
/network → buildNetworkGraphData()
  → fetchNetworkOverview() (GraphQL)
    → graphRequest('networkOverview')
      → /api/graphql
        → resolvers.Query.networkOverview
          → buildNetworkOverview()
            → listAsks() ✅ WORKS
            → listOffers() ✅ WORKS
```

### Failing Path: `/asks` Page

```
/asks → fetchAsks() (GraphQL)
  → graphRequest('asks')
    → /api/graphql
      → resolvers.Query.asks
        → listAsks() ❌ FAILS (returns null somehow)
```

---

## Detailed Findings

### 1. GraphQL Infrastructure ✅

**Status:** Complete and working

- **GraphQL API Endpoint:** `/app/api/graphql/route.ts`
  - Uses `graphql-http` library
  - Properly configured with schema and resolvers
  - Handles errors gracefully

- **GraphQL Schema:** `lib/graphql/schema.ts`
  - Defines `Query.asks: [Ask!]!` (non-nullable array)
  - Defines `Query.offers: [Offer!]!` (non-nullable array)
  - Defines `Query.networkOverview` (works correctly)

- **GraphQL Client:** `lib/graph/client.ts`
  - Generic `graphRequest()` function
  - Handles errors and throws `GraphRequestError`
  - Performance tracking removed (handled by callers)

### 2. Feature Flags System ✅

**Status:** Complete and working

**Files:**
- `lib/graph/featureFlags.ts`
- `app/api/graphql-flags/route.ts` (server-side)
- `app/api/admin/graphql-flags/route.ts` (admin dashboard)

**Flags:**
- `USE_GRAPHQL_FOR_NETWORK` ✅ (working)
- `USE_GRAPHQL_FOR_ASKS` ⚠️ (enabled but resolver fails)
- `USE_GRAPHQL_FOR_OFFERS` ⚠️ (enabled but resolver fails)
- `USE_GRAPHQL_FOR_PROFILE` ⚠️ (not fully tested)
- `USE_GRAPHQL_FOR_ME` ⚠️ (not fully tested)

**Client-Side Issue Resolved:**
- Client-side pages cannot read `process.env` directly
- Solution: Created `/api/graphql-flags` endpoint
- Client-side flag functions now fetch from API

### 3. Performance Tracking ✅

**Status:** Complete and working

**Infrastructure:**
- `lib/metrics/perf.ts` - Performance sample recording
- `app/api/admin/perf-samples/route.ts` - API for fetching samples
- `app/api/admin/perf-snapshots/route.ts` - Historical snapshots
- Admin dashboard shows GraphQL vs JSON-RPC usage

**What's Tracked:**
- Operation name (e.g., `listAsks`, `buildNetworkGraphData`)
- Route (e.g., `/asks`, `/network`)
- Duration, payload size, HTTP requests
- Source (`graphql` vs `arkiv`)

**Current Data:**
- `/network` shows GraphQL usage ✅
- `/asks`, `/offers`, `/profiles` show no GraphQL samples (because queries fail)

### 4. Admin Dashboard ✅

**Status:** Complete and working

**Location:** `/app/admin/page.tsx`

**Features:**
- GraphQL Migration Status section
- Performance metrics (collapsible sections)
- Query performance comparison
- Page load times
- Historical snapshots

**UI:**
- All sections are collapsible (default hidden)
- GraphQL migration status shows which pages use GraphQL
- Performance data aggregated by route

### 5. The Critical Problem: `asks` and `offers` Resolvers ❌

**Status:** Blocking issue - root cause unknown

**Error:**
```
Cannot return null for non-nullable field Query.asks.
```

**What We Know:**
1. ✅ `listAsks()` function works (proven by `networkOverview` resolver)
2. ✅ `listAsks()` is wrapped to never throw (returns `[]` on error)
3. ✅ Resolver has comprehensive try-catch blocks
4. ✅ Resolver returns `[]` in all error paths
5. ❌ GraphQL still sees `null` somehow

**Resolver Code Structure:**
```typescript
asks: async (_: any, args: any) => {
  try {
    let asks: any = null;
    try {
      asks = await listAsks({ skill, includeExpired, limit });
    } catch (fetchError) {
      return []; // Return immediately on error
    }
    
    if (!asks || !Array.isArray(asks)) {
      return []; // Return if invalid
    }
    
    try {
      const transformed = asks.map(transformAsk).filter(x => x !== null);
      return transformed;
    } catch (transformError) {
      return []; // Return if transformation fails
    }
  } catch (error) {
    return []; // Outer catch - should never reach here
  }
}
```

**Hypotheses Tested:**
1. ❌ `listAsks()` throwing - No, it's wrapped to return `[]`
2. ❌ Resolver not being called - No, logs would show
3. ❌ Transformation failing - No, we catch and return `[]`
4. ❌ GraphQL execution context - Unknown, needs investigation
5. ❌ Resolver structure/syntax - TypeScript compiles, but runtime issue?

**Key Observation:**
- `networkOverview` resolver calls `listAsks()` inside `buildNetworkOverview()` and it works
- Direct `asks` resolver calls `listAsks()` and it fails
- Same function, different execution context

**Possible Root Causes:**
1. GraphQL execution order/context issue
2. Resolver function not properly attached to schema
3. `graphql-http` library behavior with async resolvers
4. Type mismatch between schema and resolver return type
5. Undefined resolver function (syntax error we're missing)

---

## Code Changes Made

### Files Modified

1. **`lib/graphql/resolvers.ts`**
   - Added comprehensive error handling to `asks` and `offers` resolvers
   - Added logging throughout
   - Ensured all paths return arrays, never null

2. **`lib/arkiv/asks.ts`**
   - Wrapped `listAsks()` and `listAsksForWallet()` in try-catch
   - Always returns `[]` on error, never throws

3. **`lib/arkiv/offers.ts`**
   - Wrapped `listOffers()` and `listOffersForWallet()` in try-catch
   - Always returns `[]` on error, never throws

4. **`lib/graph/featureFlags.ts`**
   - Updated client-side flags to fetch from `/api/graphql-flags`
   - Fixed `readBoolEnv()` to check `NEXT_PUBLIC_` prefix

5. **`app/asks/page.tsx`**
   - Added GraphQL fallback to JSON-RPC
   - Updated to await feature flag check

6. **`app/offers/page.tsx`**
   - Added GraphQL fallback to JSON-RPC
   - Updated to await feature flag check

7. **`app/profiles/[wallet]/page.tsx`**
   - Updated to await feature flag check

8. **`app/api/admin/perf-samples/route.ts`**
   - Added aggregation across all operations
   - Added seed function for testing

9. **`app/api/admin/perf-snapshots/route.ts`**
   - Updated to query all operations (not just `buildNetworkGraphData`)
   - Added transaction timeout handling

10. **`app/admin/page.tsx`**
    - Added GraphQL migration status section
    - Made all sections collapsible
    - Updated to show all routes

### Files Created

1. **`app/api/graphql-flags/route.ts`** - Client-side feature flag API
2. **`app/api/admin/graphql-flags/route.ts`** - Admin dashboard feature flag API
3. **`docs/GRAPHQL_MIGRATION_STATUS.md`** - This document

---

## Testing & Verification

### What We Tested

1. ✅ `/network` page with GraphQL - Works
2. ✅ `networkOverview` GraphQL query - Returns data
3. ❌ Direct `asks` GraphQL query - Fails with null error
4. ❌ `/asks` page with GraphQL enabled - Falls back to JSON-RPC
5. ✅ Feature flags system - Works
6. ✅ Admin dashboard - Shows GraphQL status
7. ✅ Performance tracking - Records samples for `/network`

### Test Commands

```bash
# Test networkOverview (works)
curl -X POST 'https://p2pmentor.com/api/graphql' \
  -H 'Content-Type: application/json' \
  -d '{"query":"query { networkOverview(limitAsks: 5) { skillRefs { asks { id } } } }"}'

# Test asks (fails)
curl -X POST 'https://p2pmentor.com/api/graphql' \
  -H 'Content-Type: application/json' \
  -d '{"query":"query { asks(limit: 10) { id key wallet skill } }"}'
```

---

## Resuming Work

### Immediate Next Steps

1. **Debug the Resolver Execution**
   - Add a minimal test resolver that just returns `[]` to verify GraphQL execution
   - Check if the resolver function is actually being called (add console.log at very start)
   - Verify resolver is properly attached to schema

2. **Compare Working vs Failing Resolvers**
   - `networkOverview` works - study its exact execution path
   - `asks` fails - compare structure, context, execution
   - Look for differences in how GraphQL executes them

3. **Test GraphQL Library Behavior**
   - Check `graphql-http` documentation for async resolver requirements
   - Test if returning `Promise.resolve([])` vs `[]` makes a difference
   - Verify schema-to-resolver mapping

4. **Add More Logging**
   - Log at the very start of resolver (before any code)
   - Log resolver function existence/type
   - Log GraphQL execution context

5. **Alternative Approach: Test Minimal Resolver**
   ```typescript
   asks: async () => {
     console.log('RESOLVER CALLED');
     return [];
   }
   ```
   - If this works, the issue is in `listAsks()` or transformation
   - If this fails, the issue is in resolver structure/schema mapping

### Investigation Checklist

- [ ] Verify resolver function is actually a function (not undefined)
- [ ] Check if GraphQL schema-to-resolver mapping is correct
- [ ] Test if `graphql-http` has specific requirements for array resolvers
- [ ] Compare exact execution path of `networkOverview` vs `asks`
- [ ] Check if there's a build/bundling issue causing resolver to be undefined
- [ ] Test resolver with minimal implementation (just return `[]`)
- [ ] Check GraphQL execution logs/errors more carefully
- [ ] Verify TypeScript compilation doesn't hide runtime issues

### Files to Review When Resuming

1. **`lib/graphql/resolvers.ts`** - Resolver implementations
2. **`lib/graphql/schema.ts`** - Schema definitions
3. **`app/api/graphql/route.ts`** - GraphQL API setup
4. **`lib/graph/client.ts`** - GraphQL client
5. **`lib/arkiv/asks.ts`** - Data fetching (works, but verify in resolver context)

### Key Questions to Answer

1. Why does `networkOverview` resolver work but `asks` resolver fails?
2. Is the resolver function actually being called?
3. Is there a difference in how GraphQL executes top-level vs nested resolvers?
4. Does `graphql-http` have specific requirements we're missing?
5. Is there a build/bundling issue causing the resolver to be undefined at runtime?

---

## Lessons Learned

1. **Feature Flags for Client-Side:** Client-side pages cannot read `process.env` directly - need API endpoint
2. **Error Handling:** Comprehensive try-catch is necessary, but GraphQL may still see null if resolver structure is wrong
3. **Testing:** Need to test resolvers in isolation, not just through full page loads
4. **GraphQL Execution:** GraphQL execution context may behave differently than expected - need to understand library behavior
5. **Building Blocks:** The data fetching layer (`listAsks()`) works - the issue is in the GraphQL layer

---

## Current State Summary

**Infrastructure:** ✅ Complete  
**Feature Flags:** ✅ Complete  
**Performance Tracking:** ✅ Complete  
**Admin Dashboard:** ✅ Complete  
**Working Resolvers:** ✅ `networkOverview`  
**Failing Resolvers:** ❌ `asks`, `offers`  
**Client Pages:** ⚠️ Fallback to JSON-RPC works, but GraphQL path fails

**Blocking Issue:** `asks` and `offers` resolvers return null despite comprehensive error handling. Root cause unknown - needs deeper investigation into GraphQL execution context.

---

## References

- GraphQL Schema: `lib/graphql/schema.ts`
- GraphQL Resolvers: `lib/graphql/resolvers.ts`
- GraphQL API: `app/api/graphql/route.ts`
- Feature Flags: `lib/graph/featureFlags.ts`
- Admin Dashboard: `app/admin/page.tsx`
- Engineering Guidelines: `docs/ENGINEERING_GUIDELINES.md`

---

**Note:** This migration is paused but the infrastructure is solid. The remaining issue appears to be a GraphQL execution/runtime problem rather than an architectural issue. When resuming, focus on debugging the resolver execution context and comparing the working `networkOverview` resolver with the failing `asks` resolver.

