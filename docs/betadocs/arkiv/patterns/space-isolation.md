# Space ID as Environment Boundary

**Pattern ID:** PAT-SPACE-001  
**Status:** ✅ Documented  
**Related:** [Environments](../environments.md) | [Query Optimization](./query-optimization.md) | [Arkiv Patterns Catalog](../arkiv-patterns-catalog.md)

## Overview

`spaceId` provides data isolation between environments (test/beta/prod). Every write must include the correct `spaceId` from configuration; every read must scope by `spaceId` to prevent cross-environment data leaks. This pattern ensures "works on my machine" bugs don't leak data across environments.

## When to Use

**Always apply this pattern when:**
- Creating entities (include `spaceId` attribute)
- Querying entities (filter by `spaceId`)
- Setting up different environments (dev, staging, prod)
- Creating seed or test data (use separate `spaceId`)

**Configuration:**
- Use `SPACE_ID` from `lib/config.ts` (never hardcode)
- Override via `BETA_SPACE_ID` environment variable when needed
- Default: `'beta-launch'` in production, `'local-dev'` in development

## Invariants

- Every write includes correct `spaceId` (from config, not hardcoded)
- Every read scopes by `spaceId` (no cross-space mixing)
- Test/beta/prod data is completely isolated
- `spaceId` is an indexed attribute for efficient queries
- Configuration uses `SPACE_ID` from `lib/config.ts`, never hardcoded values

## Threat Model / Failure Modes

- **"Works on my machine":** Data leak across spaces if `spaceId` is missing or wrong
- **Hardcoded spaceId:** Breaks when deploying to different environments
- **Missing scope:** Queries without `spaceId` filter may return wrong data
- **Configuration drift:** Different parts of app use different `spaceId` sources
- **Builder mode:** Must handle multiple `spaceIds` when querying across environments

## Arkiv Primitives Used

- Entity attributes: `spaceId` attribute on every entity
- Indexed attributes: `spaceId` is indexed for efficient filtering
- Query filters: `where(eq('spaceId', spaceId))` for scoping
- Configuration: `SPACE_ID` from `lib/config.ts` provides default

## Canonical Algorithm

1. Import `SPACE_ID` from `lib/config.ts`
2. For entity creation: use `spaceId || SPACE_ID` (allow override, fallback to config)
3. For queries: always filter by `spaceId` (use `SPACE_ID` if not provided)
4. For builder mode: query all, filter client-side by `spaceIds` array
5. Never hardcode `'local-dev'` or `'beta-launch'` in code

## Implementation Hooks

**Primary implementation:** ✅ Verified in repo
- `lib/config.ts` - `SPACE_ID` configuration with environment-based defaults
- All entity creation functions: `spaceId = SPACE_ID` as default parameter
- All query functions: filter by `spaceId` or use `SPACE_ID` as default
- API routes: extract `spaceId` from query params or use `SPACE_ID`

**Code examples:**
```typescript
// Configuration (lib/config.ts)
export const SPACE_ID = process.env.BETA_SPACE_ID ||
  (process.env.NODE_ENV === 'production' ? 'beta-launch' : 'local-dev');

// Entity creation
export async function createEntity({
  wallet,
  privateKey,
  spaceId = SPACE_ID, // Default to config, allow override
}: {
  wallet: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}) {
  const finalSpaceId = spaceId || SPACE_ID; // Always fallback to config
  // ...
  attributes: [
    { key: 'spaceId', value: finalSpaceId },
    // ...
  ],
}

// Querying
let queryBuilder = publicClient.buildQuery()
  .where(eq('type', 'entity_type'));

if (spaceId) {
  queryBuilder = queryBuilder.where(eq('spaceId', spaceId));
} else {
  queryBuilder = queryBuilder.where(eq('spaceId', SPACE_ID));
}

// Builder mode (multiple spaceIds)
if (spaceIds && spaceIds.length > 0) {
  // Query all, filter client-side (Arkiv doesn't support OR)
  const result = await queryBuilder.limit(limit).fetch();
  return result.entities.filter(e => spaceIds.includes(e.spaceId));
}
```

## Debug Recipe

- Check entity attributes: verify `spaceId` matches expected environment
- Verify configuration: check `SPACE_ID` value matches environment
- Query with spaceId: verify queries filter by correct `spaceId`
- Check for leaks: query without `spaceId` filter to detect cross-space data
- Verify API routes: ensure they use `SPACE_ID` from config, not hardcoded values

## Anti-Patterns

- ❌ Hardcoding `spaceId = 'local-dev'` (breaks in production)
- ❌ Missing `spaceId` in entity attributes (data leaks across environments)
- ❌ Queries without `spaceId` filter (returns wrong environment data)
- ❌ Using different `spaceId` sources in different parts of app (configuration drift)
- ❌ Assuming `spaceId` is optional (always include, always filter)

## Known Tradeoffs

- **Isolation:** Complete data isolation between environments
- **Configuration:** Requires consistent use of `SPACE_ID` from config
- **Builder mode:** Requires client-side filtering for multiple `spaceIds`
- **Performance:** Indexed `spaceId` attribute enables efficient filtering

## Related Patterns

- [Environments](../environments.md) - Complete environment setup guide
- [Query Optimization](./query-optimization.md) - `spaceId` is an indexed attribute
- [PAT-IDENTITY-001: Wallet Normalization](./wallet-normalization.md) - Both use normalized attributes
- [PAT-WRITE-AUTHZ-001: Server-Signed Writes](../arkiv-patterns-catalog.md#pat-write-authz-001-server-signed-writes-phase-0) - Signing wallet vs `spaceId` isolation

