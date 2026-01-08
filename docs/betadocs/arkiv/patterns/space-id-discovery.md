# Network-Wide Space ID Discovery

**Pattern ID:** PAT-QUERY-002  
**Status:** ✅ Documented  
**Related:** [Space Isolation](./space-isolation.md) | [Query Optimization](./query-optimization.md) | [Arkiv Patterns Catalog](./pattern-catalog.md)

## Overview

Discover all unique `spaceId` values used across the Arkiv network by querying entities without `spaceId` filters. This pattern enables network-wide space discovery, cross-app interoperability, and user-facing space selection interfaces.

## When to Use

**Apply this pattern when:**
- Building space selection UIs (dropdowns, filters)
- Discovering spaces created by other applications
- Enabling network-wide space browsing
- Filtering spaces by creator (e.g., p2pmentor vs other apps)
- Displaying space metadata (entity counts, activity)

**Do not use when:**
- Querying entities for a known `spaceId` (use [Space Isolation](./space-isolation.md) instead)
- Performance-critical queries (this queries all entities)
- Private or hidden spaces (all discovered spaces are public)

## Invariants

- Queries omit `spaceId` filter to discover all spaces
- Space IDs are extracted from entity attributes (not from a registry)
- Only spaces with at least one entity are discoverable
- Discovery is public (anyone can query all spaces)
- Signer metadata (`signer_wallet`) identifies space creator
- Metadata (entity counts, recency) is computed from query results

## Threat Model / Failure Modes

- **Performance:** Querying all entities can be slow as network grows
- **Spam:** Malicious actors can create many entities with random space IDs
- **Namespace collision:** Multiple apps may use the same space ID unintentionally
- **Empty spaces:** Spaces with no entities won't appear in discovery
- **Query limits:** May miss spaces if entity count exceeds query limit
- **Indexer lag:** New spaces may not appear immediately after creation

## Arkiv Primitives Used

- Entity queries without `spaceId` filter: `where(eq('type', 'entity_type'))`
- Attribute extraction: `spaceId` from entity attributes
- Signer metadata: `signer_wallet` attribute to identify creator
- Query limits: `limit(1000)` to fetch all entities (adjust as needed)

## Canonical Algorithm

1. Query all entities of target type(s) without `spaceId` filter
2. Extract `spaceId` attribute from each entity
3. Track metadata per space ID (entity counts, most recent activity, signer_wallet)
4. Filter by signer_wallet if needed (to distinguish app-created vs network spaces)
5. Sort by relevance (entity count, then recency)
6. Return unique space IDs with metadata

**Implementation:**
```typescript
// Query all entities without spaceId filter
const result = await publicClient.buildQuery()
  .where(eq('type', 'lite_ask'))
  .withAttributes(true)
  .limit(1000)
  .fetch();

// Extract space IDs and metadata
const spaceIdMap = new Map<string, SpaceIdMetadata>();
result.entities.forEach((entity: any) => {
  const attrs = entity.attributes || {};
  const spaceId = getAttr(attrs, 'spaceId')?.trim();
  const signerWallet = getAttr(attrs, 'signer_wallet')?.toLowerCase();
  const createdAt = getAttr(attrs, 'createdAt');
  
  if (!spaceId) return;
  
  if (!spaceIdMap.has(spaceId)) {
    spaceIdMap.set(spaceId, {
      spaceId,
      entityCount: 0,
      mostRecentActivity: createdAt,
      isAppSpace: signerWallet === CURRENT_WALLET?.toLowerCase(),
    });
  }
  
  const metadata = spaceIdMap.get(spaceId)!;
  metadata.entityCount++;
  if (new Date(createdAt) > new Date(metadata.mostRecentActivity)) {
    metadata.mostRecentActivity = createdAt;
  }
});

// Sort by relevance
const spaces = Array.from(spaceIdMap.values())
  .sort((a, b) => {
    if (b.entityCount !== a.entityCount) {
      return b.entityCount - a.entityCount;
    }
    return new Date(b.mostRecentActivity).getTime() - 
           new Date(a.mostRecentActivity).getTime();
  });
```

## Implementation Hooks

**Primary implementation:** ✅ Verified in repo
- `lib/arkiv/liteSpaceIds.ts` - `getAllLiteSpaceIds()` function
- `app/api/lite/space-ids/route.ts` - API endpoint with filtering
- `app/lite/page.tsx` - Frontend space ID selector with metadata

**Code references:**
- Function: `getAllLiteSpaceIds()` in `lib/arkiv/liteSpaceIds.ts`
- API route: `GET /api/lite/space-ids` in `app/api/lite/space-ids/route.ts`
- Type: `SpaceIdMetadata` in `lib/arkiv/liteSpaceIds.ts`
- Frontend: Space ID selector in `app/lite/page.tsx` (lines 423-478)

**Query pattern:**
```typescript
// Query without spaceId filter (discovery mode)
const query = publicClient.buildQuery()
  .where(eq('type', 'lite_ask'))
  .withAttributes(true)
  .limit(1000)
  .fetch();

// Extract spaceId from attributes
const spaceId = getAttr(entity.attributes, 'spaceId');
```

## Debug Recipe

- Verify query omits `spaceId` filter (check query builder)
- Check entity count: ensure query limit is high enough
- Verify attribute extraction: `spaceId` must be in entity attributes
- Test signer filtering: verify `signer_wallet` comparison works
- Check sorting: verify spaces are sorted by relevance
- Monitor performance: query time increases with entity count

## Anti-Patterns

- ❌ Querying with `spaceId` filter (defeats discovery purpose)
- ❌ Hardcoding space ID list (breaks network interoperability)
- ❌ Not extracting signer_wallet (can't distinguish app vs network spaces)
- ❌ Ignoring query limits (may miss spaces if limit too low)
- ❌ Not sorting results (poor UX in space selection UI)
- ❌ Caching indefinitely (new spaces won't appear)

## Known Tradeoffs

- **Performance vs Completeness:** Querying all entities is slower but discovers all spaces
- **Network Interoperability:** Discovers spaces from all apps (good) but includes spam (bad)
- **Privacy:** All spaces are public and discoverable (by design)
- **Empty Spaces:** Spaces with no entities won't appear (may confuse users)
- **Query Limits:** May miss spaces if entity count exceeds limit (need pagination for scale)

## Filtering Options

**By Creator:**
- Filter by `signer_wallet` to show only app-created spaces
- Compare with `CURRENT_WALLET` from config to identify own app's spaces
- Use `filter: 'p2pmentor' | 'network' | 'all'` in API

**By Activity:**
- Filter by `minEntities` to show only active spaces
- Filter by `recentDays` to show only recently active spaces
- Sort by entity count and recency for relevance

## Related Patterns

- [PAT-SPACE-001: Space Isolation](./space-isolation.md) - Using spaceId for environment boundaries
- [PAT-QUERY-001: Query Optimization](./query-optimization.md) - Indexed attributes and query patterns
- [Environments](../operations/environments.md) - Space ID configuration
- [Central Signer Phase 0](../operations/central-signer-phase0.md) - Signer metadata for filtering

## Example Use Cases

1. **Lite Version Space Selector:** `/lite` page discovers all spaces for user selection
2. **Cross-App Discovery:** Find spaces created by other applications on Arkiv
3. **Space Browsing:** Browse all available spaces with metadata (entity counts, activity)
4. **App Filtering:** Show only spaces created by your app vs all network spaces

## See Also

- Implementation: `refs/lite-space-id-audit.md` (internal audit document)
- User flow: [Lite Version](/docs/user-flows/lite-version) - Space selection UI
- API: `GET /api/lite/space-ids` - Space discovery endpoint
