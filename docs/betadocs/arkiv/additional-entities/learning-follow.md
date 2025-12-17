# Learning Follow Entity

## Overview

Tracks which skills (topics) a user is following for learning communities. Enables users to follow skills they're interested in learning or teaching, supporting community features.

**Entity Type:** `learning_follow`  
**TTL:** 1 year (31536000 seconds)  
**Immutability:** Immutable - updates create new entities (soft delete via `active` flag)

## Attributes

- `type`: `'learning_follow'` (required)
- `profile_wallet`: Wallet address (reference to Profile.wallet) (required, lowercase)
- `skill_id`: Skill entity key (reference to Skill.key) (required)
- `active`: Boolean flag for soft delete (required, default: `true`)
- `spaceId`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) (required)
- `createdAt`: ISO timestamp (required)

## Payload

```typescript
{
  profile_wallet: string;    // Wallet address
  skill_id: string;          // Skill entity key
  mode: 'learning' | 'teaching' | 'both';  // Follow mode
  active: boolean;          // Active flag (soft delete)
  createdAt: string;         // ISO timestamp
}
```

## Key Fields

- **profile_wallet**: Wallet address of user following the skill
- **skill_id**: Skill entity key being followed
- **mode**: Follow mode - `'learning'` (want to learn), `'teaching'` (can teach), or `'both'`
- **active**: Active flag - `false` for soft delete (unfollow)

## Query Patterns

### Get All Follows for Profile

```typescript
import { eq, and } from "@arkiv-network/sdk/query";
import { getPublicClient } from "@/lib/arkiv/client";

const publicClient = getPublicClient();
const result = await publicClient.buildQuery()
  .where(eq('type', 'learning_follow'))
  .where(eq('profile_wallet', walletAddress.toLowerCase()))
  .where(eq('active', 'true'))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

const follows = result.entities.map(e => ({
  ...e.attributes,
  ...JSON.parse(e.payload)
}));
```

### Get All Followers for Skill

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'learning_follow'))
  .where(eq('skill_id', skillId))
  .where(eq('active', 'true'))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

const followers = result.entities.map(e => ({
  ...e.attributes,
  ...JSON.parse(e.payload)
}));
```

### Get Follows by Mode

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'learning_follow'))
  .where(eq('profile_wallet', walletAddress.toLowerCase()))
  .where(eq('active', 'true'))
  .withAttributes(true)
  .withPayload(true)
  .limit(1000)
  .fetch();

// Filter client-side by mode
const learningFollows = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .filter(f => f.mode === 'learning' || f.mode === 'both');

const teachingFollows = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .filter(f => f.mode === 'teaching' || f.mode === 'both');
```

## Creation

```typescript
import { createLearningFollow } from "@/lib/arkiv/learningFollow";
import { getWalletClientFromMetaMask } from "@/lib/arkiv/client";

const walletClient = await getWalletClientFromMetaMask();
const { key, txHash } = await createLearningFollow({
  profile_wallet: walletAddress,
  skill_id: skillKey,
  mode: 'learning', // or 'teaching' or 'both'
  privateKey: walletClient.account.privateKey,
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

## Unfollow (Soft Delete)

To unfollow, create a new entity with `active: false`:

```typescript
// Get existing follow
const existing = await getLearningFollow(walletAddress, skillId);

if (existing && existing.active) {
  // Create new entity with active: false
  await createLearningFollow({
    profile_wallet: walletAddress,
    skill_id: skillId,
    mode: existing.mode,
    active: false, // Soft delete
    privateKey: userPrivateKey,
  });
}
```

## Transaction Hash Tracking

- `learning_follow_txhash`: Transaction hash tracking, linked via `followKey` attribute

## Example Use Cases

### Follow Skill for Learning

```typescript
await createLearningFollow({
  profile_wallet: userWallet,
  skill_id: spanishSkill.key,
  mode: 'learning',
  privateKey: userPrivateKey,
});
```

### Follow Skill for Teaching

```typescript
await createLearningFollow({
  profile_wallet: userWallet,
  skill_id: javascriptSkill.key,
  mode: 'teaching',
  privateKey: userPrivateKey,
});
```

### Follow Skill for Both

```typescript
await createLearningFollow({
  profile_wallet: userWallet,
  skill_id: pythonSkill.key,
  mode: 'both',
  privateKey: userPrivateKey,
});
```

## Related Entities

- `skill`: Skill being followed
- `user_profile`: Profile of user following
- `virtual_gathering`: Community gatherings for followed skills

## Notes

- **Soft Delete**: Unfollow creates new entity with `active: false`
- **Latest Version**: Query and filter by `active: true` to get current follows
- **Multi-Mode**: Supports learning, teaching, or both
- **Community Features**: Used for learning community features

## Use in Learning Communities

Learning follows enable:
- Skill-based community discovery
- Virtual gathering organization by skill
- Personalized content recommendations
- Skill interest tracking

