# 20_query_shapes.md — Query Shapes + Defensive Reading

## Every query must include:
- `type` filter
- `spaceId` filter
- `limit` (safe default, e.g. 50 or 100)

## Defensive result validation
Do not assume query responses are well-formed:
- Validate array shape before mapping
- Validate required attributes exist before using
- On failure: return `[]` (empty array), not throw (unless truly fatal)

## Multi-space "builder mode"
If you need to read across multiple spaces:
- Arkiv does not support OR across spaceId in a single query (assume no OR).
- Strategy: query broadly by `type` with a safe limit, then filter client-side by allowed spaceIds.
- Document this explicitly in README so builders don't debug ghosts.

## Parallel reads
When using txhash companion entities:
- Fetch primary entities and `*_txhash` entities in parallel.
- Merge client-side for display and debugging.

## Sorting
Prefer explicit `created_at` attribute for ordering rather than relying on indexer ordering.

