# Beta Code Entity

## Overview

Tracks beta code usage on Arkiv to enforce limits. Each beta code has a usage limit (e.g., 50 uses). When a code is used, the usage count is incremented. This entity is updated (new entity created) each time usage count changes.

**Entity Type:** `beta_code_usage`  
**TTL:** 1 year (31536000 seconds)  
**Immutability:** Immutable - updates create new entities (usage count increments)

## Attributes

- `type`: `'beta_code_usage'` (required)
- `code`: Beta code string (required, lowercase, trimmed)
- `spaceId`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) (required)
- `createdAt`: ISO timestamp (required)

## Payload

```typescript
{
  code: string;            // Beta code (lowercase, trimmed)
  usageCount: number;      // Current usage count
  limit: number;          // Usage limit for this code
  lastUsedAt?: string;    // ISO timestamp of last use (optional)
  createdAt: string;       // ISO timestamp when entity was created
}
```

## Key Fields

- **code**: Beta code string (normalized to lowercase, trimmed)
- **usageCount**: Current number of unique wallets that have used this code (synced with `beta_access` entities)
- **limit**: Maximum number of unique wallets allowed (default: 50)
- **lastUsedAt**: When the code was last used (optional)
- **createdAt**: When this entity version was created

## Query Patterns

### Get Beta Code Usage

```typescript
import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient } from "@/lib/arkiv/client";

const publicClient = getPublicClient();
const normalizedCode = code.toLowerCase().trim();

const result = await publicClient.buildQuery()
  .where(eq('type', 'beta_code_usage'))
  .where(eq('code', normalizedCode))
  .withAttributes(true)
  .withPayload(true)
  .limit(10)
  .fetch();

// Get latest version (highest usageCount or most recent createdAt)
const latest = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .sort((a, b) => {
    // Sort by usageCount descending, then createdAt descending
    if (a.usageCount !== b.usageCount) {
      return b.usageCount - a.usageCount;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })[0];

const usage = latest || null;
```

### Check if Code is Available

```typescript
const usage = await getBetaCodeUsage(code);
const isAvailable = usage && usage.usageCount < usage.limit;
```

## Creation/Update

```typescript
import { trackBetaCodeUsage } from "@/lib/arkiv/betaCode";

// Create new code or increment existing
const { key, txHash } = await trackBetaCodeUsage(
  code,      // Beta code string
  50         // Usage limit (default: 50)
);
```

## Transaction Hash Tracking

- `beta_code_usage_txhash`: Transaction hash tracking, linked via `betaCodeKey` attribute

**Note:** Entity type is `beta_code_usage`, not `beta_code`.

## Update Pattern

Since entities are immutable, updating usage count creates a new entity:

```typescript
// 1. Get current usage
const current = await getBetaCodeUsage(code);

// 2. Create new entity with incremented count
const newUsageCount = (current?.usageCount || 0) + 1;
await trackBetaCodeUsage(code, current?.limit || 50);

// New entity has:
// - usageCount: newUsageCount
// - limit: same as before
// - lastUsedAt: current timestamp
```

## Example Use Case

Beta code validation and usage tracking:

```typescript
async function validateAndUseBetaCode(code: string, wallet: string) {
  // 1. Get current usage
  const betaCode = await getBetaCodeUsage(code);
  
  if (!betaCode) {
    // First use - create initial entity
    await trackBetaCodeUsage(code, 50);
  } else if (betaCode.usageCount >= betaCode.limit) {
    throw new Error('Beta code limit reached');
  }
  
  // 2. Check if wallet already used this code
  const existingAccess = await getBetaAccess(wallet, code);
  if (existingAccess) {
    throw new Error('Wallet already has access via this code');
  }
  
  // 3. Grant access
  await createBetaAccess({ wallet, code, privateKey: getPrivateKey() });
  
  // 4. Increment usage count
  await trackBetaCodeUsage(code, betaCode?.limit || 50);
}
```

## Related Entities

- `beta_access`: Tracks which wallets were granted access via which codes

## Notes

- **Immutability**: Each usage increment creates a new entity
- **Latest Version**: Query and sort to get current usage count
- **Code Normalization**: Codes normalized to lowercase and trimmed
- **Default Limit**: 50 uses if not specified
- **Audit Trail**: Complete history of usage count changes

## Security Considerations

- **Public Data**: Beta codes and usage counts are public on-chain
- **Code Privacy**: Consider implications of storing codes on-chain
- **Rate Limiting**: Usage limits enforced client-side (verify on-chain)

