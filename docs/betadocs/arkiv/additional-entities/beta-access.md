# Beta Access Entity

## Overview

Tracks wallet-to-beta-code binding on Arkiv. Creates an immutable audit trail of which wallets were granted access via which beta codes. Used for access control and audit purposes.

**Entity Type:** `beta_access`  
**TTL:** 1 year (31536000 seconds)  
**Immutability:** Immutable - updates create new entities

## Attributes

- `type`: `'beta_access'` (required)
- `wallet`: Wallet address granted access (required, lowercase)
- `code`: Beta code used (required, lowercase, trimmed)
- `spaceId`: `'local-dev'` (required)
- `createdAt`: ISO timestamp (required, stored as `grantedAt` in payload)

## Payload

```typescript
{
  wallet: string;          // Wallet address (lowercase)
  code: string;            // Beta code (lowercase, trimmed)
  grantedAt: string;       // ISO timestamp when access was granted
}
```

## Key Fields

- **wallet**: Wallet address that was granted access
- **code**: Beta code that was used (normalized to lowercase, trimmed)
- **grantedAt**: When access was granted (ISO timestamp)

## Query Patterns

### Check if Wallet Has Access

```typescript
import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient } from "@/lib/arkiv/client";

const publicClient = getPublicClient();
const result = await publicClient.buildQuery()
  .where(eq('type', 'beta_access'))
  .where(eq('wallet', walletAddress.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(1)
  .fetch();

const hasAccess = result.entities.length > 0;
```

### Get All Access Grants for Code

```typescript
const normalizedCode = code.toLowerCase().trim();
const result = await publicClient.buildQuery()
  .where(eq('type', 'beta_access'))
  .where(eq('code', normalizedCode))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

const grants = result.entities.map(e => ({
  ...e.attributes,
  ...JSON.parse(e.payload)
}));
```

### Get Access Grant for Wallet and Code

```typescript
const normalizedCode = code.toLowerCase().trim();
const result = await publicClient.buildQuery()
  .where(eq('type', 'beta_access'))
  .where(eq('wallet', walletAddress.toLowerCase()))
  .where(eq('code', normalizedCode))
  .withAttributes(true)
  .withPayload(true)
  .limit(1)
  .fetch();

const grant = result.entities[0] 
  ? { ...result.entities[0].attributes, ...JSON.parse(result.entities[0].payload) }
  : null;
```

## Creation

```typescript
import { createBetaAccess } from "@/lib/arkiv/betaAccess";
import { getPrivateKey } from "@/lib/config";

const { key, txHash } = await createBetaAccess({
  wallet: "0x1234...",
  code: "BETA2024",
  privateKey: getPrivateKey(),
  spaceId: 'local-dev',
});
```

## Transaction Hash Tracking

- `beta_access_txhash`: Transaction hash tracking, linked via `accessKey` attribute

## Related Entities

- `beta_code_usage`: Beta code usage tracking (tracks usage count)

## Example Use Case

User enters beta code during onboarding:

```typescript
// 1. Validate beta code (check usage limits)
const betaCode = await getBetaCodeUsage(code);
if (!betaCode || betaCode.usageCount >= betaCode.limit) {
  throw new Error('Beta code invalid or limit reached');
}

// 2. Grant access (create beta_access entity)
await createBetaAccess({
  wallet: userWallet,
  code: code,
  privateKey: getPrivateKey(),
});

// 3. Increment usage count (update beta_code_usage entity)
await trackBetaCodeUsage(code, betaCode.limit);
```

## Notes

- **Audit Trail**: Immutable record of all access grants
- **Code Normalization**: Codes are normalized to lowercase and trimmed
- **Wallet Normalization**: Wallet addresses normalized to lowercase
- **One-to-Many**: Multiple wallets can use the same code (up to limit)
- **One Grant Per Wallet**: Each wallet-code combination creates one entity

## Security Considerations

- **Public Data**: Beta access grants are public on-chain
- **Code Privacy**: Beta codes are stored on-chain (consider for production)
- **Access Control**: Used in conjunction with `beta_code_usage` entity for usage limits

