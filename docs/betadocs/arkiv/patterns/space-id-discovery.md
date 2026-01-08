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
- Queries both `lite_ask` and `lite_offer` entity types in parallel
- Space IDs are extracted from entity attributes (not from a registry)
- Only spaces with at least one entity are discoverable
- Discovery is public (anyone can query all spaces)
- Signer metadata (`signer_wallet`) identifies space creator
- Metadata (ask count, offer count, total entities, recency, active status) is computed from query results
- TTL is checked to determine if entities are active (non-expired)
- Spaces are marked as p2pmentor if ANY entity has matching `signer_wallet`

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

1. Query all entities of target type(s) without `spaceId` filter (query both `lite_ask` and `lite_offer` in parallel)
2. Extract `spaceId` attribute from each entity
3. Track metadata per space ID:
   - Count asks and offers separately
   - Track most recent activity timestamp
   - Check TTL to determine if entities are active
   - Identify creator via `signer_wallet` comparison with `CURRENT_WALLET`
4. Apply filters:
   - Filter by signer_wallet if needed (to distinguish app-created vs network spaces)
   - Filter by minimum entity count if specified
   - Filter by recent activity if specified
5. Sort by relevance (total entity count descending, then most recent activity descending)
6. Return unique space IDs with full metadata

**Implementation:**
```typescript
// Query all entities of both types without spaceId filter
const [asksResult, offersResult] = await Promise.all([
  publicClient.buildQuery()
    .where(eq('type', 'lite_ask'))
    .withAttributes(true)
    .limit(1000)
    .fetch()
    .catch(() => ({ entities: [] })),
  publicClient.buildQuery()
    .where(eq('type', 'lite_offer'))
    .withAttributes(true)
    .limit(1000)
    .fetch()
    .catch(() => ({ entities: [] })),
]);

// Helper to extract attribute value
const getAttr = (attrs: any, key: string): string => {
  if (Array.isArray(attrs)) {
    const attr = attrs.find((a: any) => a.key === key);
    return String(attr?.value || '');
  }
  return String(attrs[key] || '');
};

// Track metadata per space ID
const spaceIdMap = new Map<string, {
  askCount: number;
  offerCount: number;
  mostRecentActivity: number; // timestamp
  isP2pmentorSpace: boolean;
  hasActiveEntities: boolean;
}>();

// Process entities from both types
[asksResult, offersResult].forEach((result, typeIndex) => {
  if (result?.entities && Array.isArray(result.entities)) {
    result.entities.forEach((entity: any) => {
      const attrs = entity.attributes || {};
      const spaceId = getAttr(attrs, 'spaceId')?.trim();
      if (!spaceId) return;

      const createdAt = getAttr(attrs, 'createdAt');
      const createdAtTime = createdAt ? new Date(createdAt).getTime() : 0;
      const ttlSeconds = parseInt(getAttr(attrs, 'ttlSeconds') || '2592000', 10);
      const expiresAt = createdAtTime + (ttlSeconds * 1000);
      const isActive = Date.now() < expiresAt;

      const signerWallet = getAttr(attrs, 'signer_wallet')?.toLowerCase();
      const isP2pmentor = !!(CURRENT_WALLET && signerWallet === CURRENT_WALLET.toLowerCase());

      if (!spaceIdMap.has(spaceId)) {
        spaceIdMap.set(spaceId, {
          askCount: 0,
          offerCount: 0,
          mostRecentActivity: createdAtTime,
          isP2pmentorSpace: isP2pmentor,
          hasActiveEntities: isActive,
        });
      }

      const metadata = spaceIdMap.get(spaceId)!;
      if (typeIndex === 0) {
        metadata.askCount++;
      } else {
        metadata.offerCount++;
      }
      if (createdAtTime > metadata.mostRecentActivity) {
        metadata.mostRecentActivity = createdAtTime;
      }
      if (isActive) {
        metadata.hasActiveEntities = true;
      }
      if (isP2pmentor) {
        metadata.isP2pmentorSpace = true;
      }
    });
  }
});

// Convert to array and apply filters
let results: SpaceIdMetadata[] = Array.from(spaceIdMap.entries()).map(([spaceId, meta]) => ({
  spaceId,
  askCount: meta.askCount,
  offerCount: meta.offerCount,
  totalEntities: meta.askCount + meta.offerCount,
  mostRecentActivity: new Date(meta.mostRecentActivity).toISOString(),
  isP2pmentorSpace: meta.isP2pmentorSpace,
  hasActiveEntities: meta.hasActiveEntities,
}));

// Apply filters (filter, minEntities, recentDays)
if (filter === 'p2pmentor') {
  results = results.filter(r => r.isP2pmentorSpace);
} else if (filter === 'network') {
  results = results.filter(r => !r.isP2pmentorSpace);
}

// Sort by relevance: total entities (desc), then most recent activity (desc)
results.sort((a, b) => {
  if (b.totalEntities !== a.totalEntities) {
    return b.totalEntities - a.totalEntities;
  }
  return new Date(b.mostRecentActivity).getTime() - new Date(a.mostRecentActivity).getTime();
});
```

## Implementation Hooks

**Primary implementation:** ✅ Verified in repo
- `lib/arkiv/liteSpaceIds.ts` - `getAllLiteSpaceIds()` function
- `app/api/lite/space-ids/route.ts` - API endpoint with filtering
- `app/lite/page.tsx` - Frontend space ID selector with metadata

**Code references:**
- Function: `getAllLiteSpaceIds()` in `lib/arkiv/liteSpaceIds.ts` (lines 37-212)
- Function: `getAllLiteSpaceIdsSimple()` in `lib/arkiv/liteSpaceIds.ts` (lines 220-227) - backward compatibility
- API route: `GET /api/lite/space-ids` in `app/api/lite/space-ids/route.ts` (lines 19-53)
- Type: `SpaceIdMetadata` in `lib/arkiv/liteSpaceIds.ts` (lines 18-26)
- Frontend: Space ID selector in `app/lite/page.tsx` (lines 567-640)
- Frontend: Filter dropdown in `app/lite/page.tsx` (lines 572-611)

**Query pattern:**
```typescript
// Query both entity types in parallel without spaceId filter (discovery mode)
const [asksResult, offersResult] = await Promise.all([
  publicClient.buildQuery()
    .where(eq('type', 'lite_ask'))
    .withAttributes(true)
    .limit(1000)
    .fetch()
    .catch(() => ({ entities: [] })),
  publicClient.buildQuery()
    .where(eq('type', 'lite_offer'))
    .withAttributes(true)
    .limit(1000)
    .fetch()
    .catch(() => ({ entities: [] })),
]);

// Extract spaceId and metadata from attributes
const getAttr = (attrs: any, key: string): string => {
  if (Array.isArray(attrs)) {
    const attr = attrs.find((a: any) => a.key === key);
    return String(attr?.value || '');
  }
  return String(attrs[key] || '');
};

const spaceId = getAttr(entity.attributes, 'spaceId')?.trim();
const signerWallet = getAttr(entity.attributes, 'signer_wallet')?.toLowerCase();
const createdAt = getAttr(entity.attributes, 'createdAt');
const ttlSeconds = parseInt(getAttr(entity.attributes, 'ttlSeconds') || '2592000', 10);
```

## Debug Recipe

- Verify query omits `spaceId` filter (check query builder)
- Verify both entity types are queried (`lite_ask` and `lite_offer`)
- Check entity count: ensure query limit is high enough (currently 1000 per type)
- Verify attribute extraction: `spaceId` must be in entity attributes
- Test signer filtering: verify `signer_wallet` comparison with `CURRENT_WALLET` works
- Check TTL calculation: verify active entity detection uses correct TTL
- Verify metadata aggregation: askCount, offerCount, totalEntities should be correct
- Check sorting: verify spaces are sorted by totalEntities (desc), then mostRecentActivity (desc)
- Test filter changes: verify dropdown updates when filter changes
- Monitor performance: query time increases with entity count (two parallel queries)
- Test error handling: verify function returns empty array on error (never throws)

## Anti-Patterns

- ❌ Querying with `spaceId` filter (defeats discovery purpose)
- ❌ Querying only one entity type (may miss spaces that only have asks or only offers)
- ❌ Hardcoding space ID list (breaks network interoperability)
- ❌ Not extracting signer_wallet (can't distinguish app vs network spaces)
- ❌ Not checking TTL for active entities (may show expired spaces as active)
- ❌ Ignoring query limits (may miss spaces if limit too low)
- ❌ Not sorting results (poor UX in space selection UI)
- ❌ Caching indefinitely (new spaces won't appear)
- ❌ Merging localStorage with filtered results (defeats filter purpose)
- ❌ Not handling query errors gracefully (should return empty array, not throw)

## Known Tradeoffs

- **Performance vs Completeness:** Querying all entities is slower but discovers all spaces
- **Network Interoperability:** Discovers spaces from all apps (good) but includes spam (bad)
- **Privacy:** All spaces are public and discoverable (by design)
- **Empty Spaces:** Spaces with no entities won't appear (may confuse users)
- **Query Limits:** May miss spaces if entity count exceeds limit (need pagination for scale)
- **Parallel Queries:** Querying both entity types in parallel improves performance but requires merging results
- **TTL Checking:** Checking TTL for each entity adds computation but enables active/inactive filtering
- **Filter vs Cache:** Filtering requires choosing between showing only filtered results vs merging with localStorage cache

## Filtering Options

**By Creator:**
- Filter by `signer_wallet` to show only app-created spaces
- Compare with `CURRENT_WALLET` from config to identify own app's spaces
- Use `filter: 'p2pmentor' | 'network' | 'all'` in API
- Space is marked as p2pmentor if ANY entity has matching `signer_wallet`

**By Activity:**
- Filter by `minEntities` to show only spaces with minimum entity count
- Filter by `recentDays` to show only spaces with activity in last N days
- Sort by total entity count (descending), then most recent activity (descending)

**Frontend Filtering Behavior:**
- When filter is "all": Merge network results with localStorage (backward compatibility)
- When filter is "p2pmentor" or "network": Show only filtered results (no localStorage merge)
- Current `spaceId` is always included in dropdown even if not in filtered list (UX)
- localStorage only updated when filter is "all" to avoid cache pollution

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
