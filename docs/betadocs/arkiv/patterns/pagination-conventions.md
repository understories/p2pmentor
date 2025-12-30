# Pagination Conventions

**Pattern ID:** PAT-PAGINATION-001  
**Status:** ✅ Documented  
**Related:** [Query Optimization](./query-optimization.md) | [Arkiv Patterns Catalog](../arkiv-patterns-catalog.md)

## Overview

Large result sets need pagination. Arkiv doesn't support offset-based pagination, so use cursor-based pagination (e.g., `createdAt` timestamp) or client-side pagination after fetching all results.

## When to Use

**Always apply this pattern when:**
- Result sets may be large (more than 20-50 items)
- Users need to browse through multiple pages
- Performance is a concern (avoid fetching all data at once)

**Strategies:**
1. **Cursor-based pagination:** Use `createdAt` timestamp or `entity_key` as cursor
2. **Client-side pagination:** Fetch all results with `.limit()`, paginate in UI
3. **Defensive limits:** Always use `.limit()` to bound queries

## Invariants

- Offset-based pagination is not supported by our current query strategy
- Use cursor-based pagination (e.g., `createdAt` timestamp) for server-side pagination
- Or paginate client-side after fetching all results
- Always use `.limit()` to bound queries
- Cursor values must be stable and sortable

## Threat Model / Failure Modes

- **Large result sets:** Missing pagination causes performance issues
- **Cursor drift:** If entities are created during pagination, cursors may skip results
- **Client-side pagination:** May fetch more data than needed (wasteful)
- **Missing limits:** Unbounded queries can return huge result sets
- **Non-stable cursors:** Cursors that change cause pagination to break

## Arkiv Primitives Used

- Query limits: `.limit(n)` to bound result sets
- Attribute filtering: Filter by `createdAt` or other sortable attributes for cursors
- Client-side filtering: Filter results after fetching for complex pagination

## Canonical Algorithm

**Strategy 1: Cursor-based pagination**
1. Query with `.limit(pageSize)` and filter by cursor (e.g., `createdAt > cursor`)
2. Sort results by cursor attribute (ascending or descending)
3. Use last item's cursor value for next page
4. Continue until no more results

**Strategy 2: Client-side pagination**
1. Query with defensive `.limit(maxResults)` (e.g., 500)
2. Fetch all results matching filters
3. Paginate in UI (slice array by page)
4. Show page controls in UI

**Strategy 3: Defensive limits**
1. Always use `.limit()` on queries
2. Choose limit based on expected result size
3. Document limit choices in code

## Implementation Hooks

**Primary implementation:** ✅ Verified in repo
- `lib/arkiv/profile.ts` - `listUserProfiles()` uses `.limit(100)` or `.limit(500)` for builder mode
- `lib/arkiv/asks.ts` - `listAsks()` uses `.limit(500)` with optional `limit` parameter
- `lib/arkiv/offers.ts` - `listOffers()` uses `.limit(500)` with optional `limit` parameter
- `lib/arkiv/sessions.ts` - `listSessions()` uses `.limit(500)` for sessions
- All query functions use defensive limits

**Code examples:**
```typescript
// Strategy 1: Cursor-based pagination (not yet implemented, but pattern)
async function listAsksPaginated(cursor?: string, pageSize: number = 20) {
  const queryBuilder = publicClient.buildQuery()
    .where(eq('type', 'ask'))
    .where(eq('status', 'open'))
    .where(eq('spaceId', SPACE_ID));
  
  if (cursor) {
    // Filter by createdAt > cursor for next page
    queryBuilder.where(eq('createdAt', cursor)); // Note: Arkiv may need different syntax
  }
  
  const result = await queryBuilder
    .withAttributes(true)
    .withPayload(true)
    .limit(pageSize)
    .fetch();
  
  // Sort by createdAt descending (newest first)
  const sorted = result.entities.sort((a, b) => {
    const aTime = getAttr(a, 'createdAt');
    const bTime = getAttr(b, 'createdAt');
    return bTime.localeCompare(aTime);
  });
  
  // Use last item's createdAt as next cursor
  const nextCursor = sorted.length > 0 
    ? getAttr(sorted[sorted.length - 1], 'createdAt')
    : null;
  
  return { items: sorted, nextCursor };
}

// Strategy 2: Client-side pagination (current pattern)
async function listAsks(params?: { limit?: number }) {
  const limit = params?.limit ?? 500; // Defensive limit
  const queryBuilder = publicClient.buildQuery()
    .where(eq('type', 'ask'))
    .where(eq('status', 'open'))
    .where(eq('spaceId', SPACE_ID));
  
  const result = await queryBuilder
    .withAttributes(true)
    .withPayload(true)
    .limit(limit) // Always use limit
    .fetch();
  
  // Return all results, paginate in UI
  return result.entities.map(/* ... */);
}

// Strategy 3: Defensive limits (always use)
const result = await publicClient.buildQuery()
  .where(eq('type', 'user_profile'))
  .where(eq('spaceId', SPACE_ID))
  .withAttributes(true)
  .withPayload(true)
  .limit(100) // Defensive limit
  .fetch();
```

## Debug Recipe

- Check limits: Verify all queries use `.limit()`
- Check cursor stability: Verify cursor values don't change between pages
- Check result size: Monitor query result sizes (should be bounded)
- Check pagination UI: Verify page controls work correctly
- Check performance: Profile queries with large limits

## Anti-Patterns

- ❌ Missing `.limit()` on queries (unbounded result sets)
- ❌ Using offset-based pagination (not supported)
- ❌ Non-stable cursors (cursors that change break pagination)
- ❌ Fetching all data when only a page is needed (wasteful)
- ❌ Not handling cursor drift (entities created during pagination)

## Known Tradeoffs

- **Cursor-based:** More efficient (only fetch needed data) but requires stable cursors
- **Client-side:** Simpler implementation but may fetch more data than needed
- **Defensive limits:** Prevents unbounded queries but may truncate results
- **Performance:** Pagination adds complexity but improves performance for large datasets

## Related Patterns

- [Query Optimization](./query-optimization.md) - Defensive limits are part of query optimization
- [PAT-QUERY-001: Indexer-Friendly Query Shapes](./query-optimization.md) - Limits are required for indexed queries

