# Revocation via Marker Entities

**Pattern ID:** PAT-REVOKE-001  
**Status:** ✅ Documented  
**Related:** [Access Grants](../access-grants.md) | [Privacy Consent](../privacy-consent.md) | [Arkiv Patterns Catalog](../arkiv-patterns-catalog.md)

## Overview

Arkiv has no built-in revocation. To revoke grants, consent, invites, or any capability-like entity, create a revocation marker entity that indicates the original entity is revoked. Queries must check for revocation markers before granting access.

## When to Use

**Always apply this pattern when:**
- Revoking access grants (review mode grants, beta access)
- Revoking privacy consent
- Revoking invites or capability-like entities
- Any entity that needs revocation semantics

**Revocation marker schema:**
- Entity type: `{original_type}_revocation` (e.g., `review_mode_grant_revocation`)
- References original entity via `entity_key` or logical ID
- Includes revocation timestamp and reason
- Same TTL as original entity (or longer)

## Invariants

- Revocation is implemented via marker entities (not entity deletion)
- Revocation markers reference the original entity (via `entity_key` or logical ID)
- Queries check for revocation markers before granting access
- Revocation is queryable and auditable
- Revocation markers have same TTL as original entity (or longer)

## Threat Model / Failure Modes

- **Missing revocation check:** If queries don't check revocation markers, revoked grants still work
- **Revocation timing:** Revocation markers may not be immediately queryable (indexer lag)
- **TTL mismatch:** Revocation markers with shorter TTL than original entity expire first
- **Race conditions:** Revocation marker may not be indexed when query runs

## Arkiv Primitives Used

- Marker entity creation: `createEntity()` for revocation markers
- Query for revocation: `buildQuery().where(eq('type', '{type}_revocation')).where(eq('entityKey', originalKey)).fetch()`
- Indexer lag handling: Poll for revocation marker visibility (see PAT-INDEXER-001)

## Canonical Algorithm

1. **Identify entity to revoke:** Get `entity_key` or logical ID of entity to revoke
2. **Create revocation marker:** Create `{type}_revocation` entity with reference to original
3. **Store revocation metadata:** Include revocation timestamp, reason, revoked by wallet
4. **Set TTL:** Use same TTL as original entity (or longer to ensure marker outlives original)
5. **Query pattern:** Before granting access, query for revocation marker
6. **Handle indexer lag:** Poll for revocation marker if not immediately visible (see PAT-INDEXER-001)

## Implementation Hooks

**Primary implementation:** ✅ Verified in repo
- `lib/arkiv/revocation.ts` - Generic revocation marker creation and checking
- `lib/arkiv/grant-revocation.ts` - Grant-specific revocation helpers
- `lib/arkiv/reviewModeGrant.ts` - `getLatestValidReviewModeGrant()` checks for revocation markers
- Applies to: grants (PAT-ACCESS-001), consent (PAT-CONSENT-001), invites

**Code examples:**
```typescript
// Revocation marker schema
interface RevocationMarker {
  type: string; // e.g., 'review_mode_grant_revocation'
  entityKey: string; // Reference to original entity
  revokedAt: string; // ISO timestamp
  revokedBy: string; // Wallet that revoked
  reason?: string; // Optional reason
  spaceId: string;
}

// Create revocation marker
async function revokeGrant(grantKey: string, revokedBy: string) {
  const revocationMarker = {
    type: 'review_mode_grant_revocation',
    entityKey: grantKey,
    revokedAt: new Date().toISOString(),
    revokedBy: revokedBy.toLowerCase(),
    reason: 'Manual revocation',
    spaceId: SPACE_ID,
  };
  
  const { key, txHash } = await createEntity({
    type: 'review_mode_grant_revocation',
    attributes: [
      { key: 'type', value: 'review_mode_grant_revocation' },
      { key: 'entityKey', value: grantKey },
      { key: 'revokedAt', value: revocationMarker.revokedAt },
      { key: 'revokedBy', value: revocationMarker.revokedBy },
      { key: 'spaceId', value: SPACE_ID },
    ],
    payload: enc.encode(JSON.stringify(revocationMarker)),
    expiresIn: 15768000, // 6 months (same as grant)
    privateKey,
  });
  
  return { key, txHash };
}

// Query pattern: Check for revocation before granting access
async function isGrantRevoked(grantKey: string): Promise<boolean> {
  const result = await publicClient.buildQuery()
    .where(eq('type', 'review_mode_grant_revocation'))
    .where(eq('entityKey', grantKey))
    .where(eq('spaceId', SPACE_ID))
    .withAttributes(true)
    .limit(1)
    .fetch();
  
  return result.entities.length > 0;
}

// Grant check with revocation
async function checkGrantAccess(wallet: string): Promise<boolean> {
  // 1. Query for grant
  const grants = await queryGrants(wallet);
  if (grants.length === 0) return false;
  
  const grant = grants[0];
  
  // 2. Check for revocation marker
  const isRevoked = await isGrantRevoked(grant.key);
  if (isRevoked) return false;
  
  // 3. Check expiration
  if (grant.expiresAt && new Date(grant.expiresAt) < new Date()) {
    return false;
  }
  
  return true;
}
```

## Debug Recipe

- Check revocation marker: Query for revocation marker by `entityKey`
- Check TTL alignment: Verify revocation marker TTL >= original entity TTL
- Check query pattern: Verify queries check for revocation before granting access
- Check indexer lag: Poll for revocation marker if not immediately visible
- Check audit trail: Query revocation history for audit purposes

## Anti-Patterns

- ❌ Not checking for revocation markers (revoked grants still work)
- ❌ Shorter TTL on revocation markers (marker expires before original)
- ❌ Not handling indexer lag (revocation may not be immediately visible)
- ❌ Not storing revocation metadata (no audit trail)
- ❌ Using entity deletion for revocation (immutable history is lost)

## Known Tradeoffs

- **Auditability:** Revocation markers provide complete audit trail
- **Complexity:** Queries must check for revocation (adds query overhead)
- **Indexer lag:** Revocation may not be immediately visible (polling required)
- **TTL management:** Must ensure revocation markers outlive original entities

## Related Patterns

- [Access Grants](../access-grants.md) - Grants use revocation markers
- [Privacy Consent](../privacy-consent.md) - Consent uses revocation markers
- [Read-Your-Writes Under Indexer Lag](./indexer-lag-handling.md) - Polling for revocation visibility
- [PAT-ACCESS-001: Arkiv-Native Access Grants](../arkiv-patterns-catalog.md#pat-access-001-arkiv-native-access-grants) - Grants are revocable

