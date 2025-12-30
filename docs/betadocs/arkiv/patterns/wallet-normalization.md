# Wallet Normalization + Canonical Form

**Pattern ID:** PAT-IDENTITY-001  
**Status:** ✅ Documented  
**Related:** [Query Optimization](./query-optimization.md) | [Arkiv Patterns Catalog](../arkiv-patterns-catalog.md)

## Overview

Wallet addresses must be normalized to lowercase for storage and query operations to prevent entire classes of bugs. Ethereum addresses are case-insensitive, but string comparisons are case-sensitive. This pattern ensures consistent identity representation across the application.

## When to Use

**Always apply this pattern when:**
- Storing wallet addresses in entity attributes
- Querying entities by wallet address
- Comparing wallet addresses for equality
- Using wallet addresses as keys or identifiers

**Display formatting:**
- Display can use checksum formatting (EIP-55) for user-facing UI
- Never use display formatting as key material or in queries

## Invariants

- Always lowercase for storage and query (canonical form)
- Display can use checksum formatting but never as key material
- All wallet comparisons use normalized form
- Wallet attributes in entities are always lowercase
- Normalization is applied consistently across create, update, and query operations

## Threat Model / Failure Modes

- **Case sensitivity bugs:** `0xABC` vs `0xabc` treated as different wallets, causing duplicate entities
- **Duplicate entities:** Same wallet creates multiple profiles due to case mismatch
- **Broken relationships:** References fail due to case mismatch
- **Query failures:** Queries miss entities if wallet case doesn't match stored case
- **Inconsistent state:** Entities created with different cases appear as separate users

## Arkiv Primitives Used

- Entity attributes: `wallet` attribute stores normalized address
- Query filters: `where(eq('wallet', normalizedWallet))` uses normalized form
- Indexed attributes: `wallet` is indexed, normalization ensures consistent indexing

## Canonical Algorithm

1. Accept wallet address as input (may be mixed case)
2. Normalize: `const normalizedWallet = wallet.trim().toLowerCase()`
3. Store normalized wallet in entity attributes
4. Use normalized wallet in all queries
5. For display: optionally format with checksum (EIP-55) for UI only

## Implementation Hooks

**Primary implementation:** ✅ Verified in repo
- `lib/arkiv/profile.ts` - `getProfileByWallet()` normalizes: `wallet.trim().toLowerCase()`
- `lib/identity/rootIdentity.ts` - `normalizeIdentity()` helper function
- All entity creation functions normalize wallet in attributes
- All query functions normalize wallet before querying

**Code examples:**
```typescript
// Entity creation
attributes: [
  { key: 'wallet', value: wallet.toLowerCase() },
  // ...
]

// Querying
const normalizedWallet = wallet.toLowerCase();
const result = await publicClient.buildQuery()
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', normalizedWallet))
  .fetch();

// Helper function
export function normalizeIdentity(identity: string): string {
  return identity.toLowerCase().trim();
}
```

## Debug Recipe

- Check entity attributes: verify `wallet` attribute is lowercase
- Query with normalized wallet: `query({ type, wallet: wallet.toLowerCase() })`
- Check for duplicates: query all entities, group by normalized wallet
- Verify relationships: ensure all wallet references use normalized form
- Check query logs: verify normalization is applied before query execution

## Anti-Patterns

- ❌ Storing wallet addresses without normalization (mixed case causes bugs)
- ❌ Using display formatting (checksum) in queries or as keys
- ❌ Normalizing only in some places but not others (inconsistent state)
- ❌ Case-sensitive wallet comparisons (use normalized form)
- ❌ Assuming wallet addresses are already lowercase (always normalize)

## Known Tradeoffs

- **Consistency:** Normalization ensures consistent identity representation
- **Display:** Requires separate formatting step for checksum display (EIP-55)
- **Performance:** Minimal overhead (single `.toLowerCase()` call)
- **Compatibility:** Works with all Ethereum address formats

## Related Patterns

- [Query Optimization](./query-optimization.md) - Wallet normalization is required for indexed queries
- [PAT-SPACE-001: Space ID as Environment Boundary](../arkiv-patterns-catalog.md#pat-space-001-space-id-as-environment-boundary) - Both use normalized attributes
- [PAT-REF-001: Relationship References](../arkiv-patterns-catalog.md#pat-ref-001-relationship-references-that-survive-updates) - Normalized wallets ensure stable references

