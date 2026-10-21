# Pagination Conventions

**Pattern ID:** PAT-PAGINATION-001  
**Status:** ✅ Documented  
**Related:** [Query Optimization](./query-optimization.md) | [Arkiv Patterns Catalog](../arkiv-patterns-catalog.md)

## Overview

Large result sets need pagination. Arkiv doesn't support offset-based pagination. The node returns at most **200 entities per page**; a fetched page has `hasNextPage()` / `next()` for cursor paging. In p2pmentor, `fetchAll(builder, max)` (`lib/arkiv/read.ts`) pages for you, pinned to a single block. There is no server-side ordering (newest-created comes first), so sort on the client.

## When to Use

**Always apply this pattern when:**

- Result sets may be large (more than 20-50 items)
- Users need to browse through multiple pages
- Performance is a concern (avoid fetching all data at once)

**Strategies:**

1. **Cursor-based pagination:** Use `createdAt` timestamp or `entity_key` as cursor
2. **Client-side pagination:** Fetch all results with `fetchAll(builder, max)`, paginate in UI
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

- Query limits: `.limit(n)` (max 200) to bound a page; `fetchAll(builder, max)` for more
- Attribute filtering: Filter by `createdAt` or other sortable attributes for cursors
- Client-side filtering: Filter results after fetching for complex pagination

## Canonical Algorithm

**Strategy 1: Cursor-based pagination**

1. Query with `.limit(pageSize)` (max 200) pinned with `.atBlock(block)`, then follow `page.next()` while `page.hasNextPage()`
2. Sort results by cursor attribute (ascending or descending)
3. Use last item's cursor value for next page
4. Continue until no more results

**Strategy 2: Client-side pagination**

1. Query with a defensive maximum: `fetchAll(builder, 500)` (`.limit()` above 200 is rejected by the node)
2. Fetch all results matching filters
3. Paginate in UI (slice array by page)
4. Show page controls in UI

**Strategy 3: Defensive limits**

1. Always use `.limit()` on queries
2. Choose limit based on expected result size
3. Document limit choices in code

## Implementation Hooks

**Primary implementation:** ✅ Verified in repo

- `lib/arkiv/read.ts` - `fetchAll(builder, max)` pages through the 200-per-page node limit, pinned to one block
- `lib/arkiv/profile.ts` - `listUserProfiles()` uses `fetchAll(queryBuilder, limit)`
- `lib/arkiv/asks.ts` - `listAsks()` uses `fetchAll(queryBuilder, limit)` with optional `limit` parameter
- `lib/arkiv/offers.ts` - `listOffers()` uses `fetchAll` with optional `limit` parameter
- `lib/arkiv/sessions.ts` - `listSessions()` uses `fetchAll` for sessions
- All query functions use defensive limits

**Code examples:**

```typescript
// Strategy 1: Cursor-based pagination (SDK 0.8 pages)
// The node returns at most 200 entities per page. A fetched page exposes
// hasNextPage() / next(); pin the query to one block so pages stay consistent.
async function listAsksPaged(pageSize: number = 20) {
  const block = await getPublicClient().getBlockNumber();
  const page = await arkivSelect('ask')
    .where(eqAttr('status', 'open'))
    .where(eqAttr('space_id', SPACE_ID))
    .atBlock(block)
    .limit(pageSize) // max 200
    .fetch();

  // No server-side ordering (newest-created first); sort on the client if needed
  return { items: page.entities, next: page.hasNextPage() ? () => page.next() : null };
}

// Strategy 2: Client-side pagination (current pattern)
async function listAsks(params?: { limit?: number }) {
  const limit = params?.limit ?? 500; // Defensive limit
  const queryBuilder = arkivSelect('ask')
    .where(eqAttr('status', 'open'))
    .where(eqAttr('space_id', SPACE_ID));

  // fetchAll pages through the 200-per-page limit, pinned to one block
  const { entities } = await fetchAll(queryBuilder, limit);

  // Return all results, paginate in UI
  return entities.map(/* ... */);
}

// Strategy 3: Defensive limits (always use)
const result = await arkivSelect('user_profile')
  .where(eqAttr('space_id', SPACE_ID))
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
