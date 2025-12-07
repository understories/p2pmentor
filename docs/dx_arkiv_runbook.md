# Arkiv DX Runbook

This document tracks developer experience (DX) with Arkiv integration. Every feature that uses Arkiv should be documented here.

## Purpose

- Track pain points and friction when working with Arkiv
- Document workarounds and temporary solutions
- Propose improvements for discussion with Arkiv team
- Help future developers understand Arkiv integration patterns

## Template for Each Feature

For every feature that uses Arkiv, document:

- **Feature name**: What feature this is
- **Arkiv entities used**: Which entity types (profile, skill, ask, etc.)
- **Queries used**: Query patterns and filters
- **SDK pain points**: What was confusing or difficult
- **Errors encountered**: Any errors and how they were resolved
- **Developer friction level**: Low / Medium / High
- **Proposed improvements**: Suggestions for better DX
- **UX team notes**: Any UX implications
- **Screenshots/recordings**: If helpful for context

---

## Features

### (Features will be added as they are implemented)

---

## General Notes

### Arkiv SDK Version

- Current: `@arkiv-network/sdk@^0.4.4`
- Source: Based on mentor-graph reference implementation

### Chain Configuration

- **Network**: Mendoza testnet
- **Chain ID**: From `@arkiv-network/sdk/chains`
- **RPC**: Provided by Arkiv SDK

### Common Patterns

#### Client-Side Entity Creation

```typescript
import { getWalletClientFromMetaMask } from '@/lib/arkiv/client';

const walletClient = getWalletClientFromMetaMask(account);
const { entityKey, txHash } = await walletClient.createEntity({
  payload: enc.encode(JSON.stringify(data)),
  contentType: 'application/json',
  attributes: [...],
  expiresIn: 31536000, // 1 year
});
```

#### Server-Side Entity Creation

```typescript
import { getWalletClientFromPrivateKey } from '@/lib/arkiv/client';

const walletClient = getWalletClientFromPrivateKey(privateKey);
// Same createEntity pattern as above
```

#### Querying Entities

```typescript
import { getPublicClient } from '@/lib/arkiv/client';
import { eq } from '@arkiv-network/sdk/query';

const publicClient = getPublicClient();
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', walletAddress))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

### Known Issues / TODOs

(Will be populated as issues are encountered)

