# Query Examples

## Overview

Complete query examples for common use cases.

## Basic Queries

### Get Entity by Type and Wallet

```typescript
import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient } from "@/lib/arkiv/client";

const publicClient = getPublicClient();
const result = await publicClient.buildQuery()
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', walletAddress.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

// Get latest version
const profiles = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

const latestProfile = profiles[0];
```

### Get Entities by Type

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'ask'))
  .withAttributes(true)
  .withPayload(true)
  .limit(50)
  .fetch();

const asks = result.entities.map(e => ({
  ...e.attributes,
  ...JSON.parse(e.payload)
}));
```

## Filtered Queries

### Get Active Asks

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'ask'))
  .where(eq('status', 'open'))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

// Filter expired asks client-side
const now = Date.now();
const activeAsks = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .filter(ask => {
    const createdAt = new Date(ask.createdAt).getTime();
    const ttlSeconds = ask.ttlSeconds || 3600;
    return (createdAt + ttlSeconds * 1000) > now;
  });
```

### Get Sessions by Status

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'session'))
  .where(eq('mentorWallet', walletAddress.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

// Filter by status client-side
const scheduledSessions = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .filter(session => {
    // Compute status from session state
    const status = computeSessionStatus(session);
    return status === 'scheduled';
  });
```

## Complex Queries

### Get Profile with Skills

```typescript
// 1. Get profile
const profile = await getProfileByWallet(walletAddress);

// 2. Get skills
if (profile.skill_ids && profile.skill_ids.length > 0) {
  const skillResults = await Promise.all(
    profile.skill_ids.map(skillId => 
      publicClient.buildQuery()
        .where(eq('type', 'skill'))
        .where(eq('key', skillId))
        .withAttributes(true)
        .withPayload(true)
        .limit(1)
        .fetch()
    )
  );
  
  const skills = skillResults
    .flatMap(r => r.entities)
    .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }));
  
  profile.skills = skills;
}
```

### Get Sessions with Feedback

```typescript
// 1. Get sessions
const sessions = await listSessions({ wallet: walletAddress });

// 2. Get feedback for each session
const sessionsWithFeedback = await Promise.all(
  sessions.map(async (session) => {
    const feedbacks = await listFeedbackForSession(session.key);
    return {
      ...session,
      feedbacks,
    };
  })
);
```

## Pagination

### Cursor-Based Pagination

```typescript
async function getAsksPaginated(
  cursor?: string,
  limit: number = 20
): Promise<{ asks: Ask[], nextCursor?: string }> {
  const result = await publicClient.buildQuery()
    .where(eq('type', 'ask'))
    .where(eq('status', 'open'))
    .withAttributes(true)
    .withPayload(true)
    .limit(limit + 1) // Fetch one extra to check for next page
    .fetch();
  
  const asks = result.entities
    .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const hasNext = asks.length > limit;
  const pageAsks = hasNext ? asks.slice(0, limit) : asks;
  const nextCursor = hasNext ? pageAsks[pageAsks.length - 1].key : undefined;
  
  return {
    asks: pageAsks,
    nextCursor,
  };
}
```

## Aggregation Queries

### Count Entities

```typescript
async function countAsks(): Promise<number> {
  const result = await publicClient.buildQuery()
    .where(eq('type', 'ask'))
    .where(eq('status', 'open'))
    .withAttributes(true)
    .limit(1000) // Max limit
    .fetch();
  
  return result.entities.length;
}
```

### Average Rating

```typescript
async function getAverageRating(wallet: string): Promise<number> {
  const feedbacks = await listFeedbackForWallet(wallet);
  
  const ratings = feedbacks
    .filter(f => f.rating !== undefined)
    .map(f => f.rating!);
  
  if (ratings.length === 0) return 0;
  
  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
}
```

## Transaction Hash Queries

### Get Transaction Hash for Entity

```typescript
async function getTransactionHash(entityKey: string, entityType: string): Promise<string | null> {
  const result = await publicClient.buildQuery()
    .where(eq('type', `${entityType}_txhash`))
    .where(eq('entityKey', entityKey))
    .withAttributes(true)
    .withPayload(true)
    .limit(1)
    .fetch();
  
  if (result.entities.length === 0) {
    return null;
  }
  
  const txHashEntity = result.entities[0];
  const payload = JSON.parse(txHashEntity.payload);
  return payload.txHash || null;
}
```

## Best Practices

1. **Always Filter by Type**: Use `type` filter first (indexed)
2. **Use Limits**: Always use `.limit()` to avoid unbounded queries
3. **Client-Side Filtering**: Use for complex filters not supported by indexes
4. **Sort Client-Side**: Sort results client-side after fetching
5. **Handle Empty Results**: Always check for empty results

