# Query Examples

## Overview

Complete query examples for common use cases.

## Basic Queries

### Get Entity by Type and Wallet

```typescript
import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, attrsToRecord, fetchAll, getEntityByKey, parsePayload } from '@/lib/arkiv/read';

const result = await arkivSelect('user_profile')
  .where(eqAttr('wallet', walletAddress.toLowerCase()))
  .limit(100)
  .fetch();

// Get latest version
const profiles = result.entities
  .map((e) => ({ ...attrsToRecord(e), ...parsePayload(e) }))
  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

const latestProfile = profiles[0];
```

### Get Entities by Type

```typescript
const result = await arkivSelect('ask').limit(50).fetch();

const asks = result.entities.map((e) => ({
  ...attrsToRecord(e),
  ...parsePayload(e),
}));
```

## Filtered Queries

### Get Active Asks

```typescript
const result = await arkivSelect('ask').where(eqAttr('status', 'open')).limit(100).fetch();

// Filter expired asks client-side
const now = Date.now();
const activeAsks = result.entities
  .map((e) => ({ ...attrsToRecord(e), ...parsePayload(e) }))
  .filter((ask) => {
    const createdAt = new Date(ask.created_at).getTime(); // getAttr/attrsToRecord return ISO
    const ttlSeconds = Number(ask.ttl_seconds) || 604800;
    return createdAt + ttlSeconds * 1000 > now;
  });
```

### Get Sessions by Status

```typescript
const result = await arkivSelect('session')
  .where(eqAttr('mentor_wallet', walletAddress.toLowerCase()))
  .limit(100)
  .fetch();

// Filter by status client-side
const scheduledSessions = result.entities
  .map((e) => ({ ...attrsToRecord(e), ...parsePayload(e) }))
  .filter((session) => {
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
  // Look entities up by key with getEntityByKey: `key` is a reserved name,
  // so there is no `key` attribute to filter on
  const skillEntities = await Promise.all(
    profile.skill_ids.map((skillId) => getEntityByKey(skillId))
  );

  const skills = skillEntities
    .filter((e) => e !== null)
    .map((e) => ({ key: e.key, ...attrsToRecord(e), ...parsePayload(e) }));

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

The node returns at most 200 entities per page. A fetched page has `hasNextPage()` and `next()`; pin the query to one block so pages stay consistent.

```typescript
async function getAsksPaginated(limit: number = 20) {
  const block = await getPublicClient().getBlockNumber();
  const page = await arkivSelect('ask')
    .where(eqAttr('status', 'open'))
    .atBlock(block)
    .limit(limit) // max 200
    .fetch();

  const asks = page.entities.map((e) => ({ key: e.key, ...attrsToRecord(e), ...parsePayload(e) }));

  return {
    asks, // newest-created first (node order); sort client-side if needed
    next: page.hasNextPage() ? () => page.next() : undefined,
  };
}
```

To read everything up to a maximum, use `fetchAll(builder, max)` from `lib/arkiv/read.ts`, which does this paging for you.

## Aggregation Queries

### Count Entities

```typescript
async function countAsks(): Promise<number> {
  // .limit() is capped at 200 per page; fetchAll pages up to the max
  const { entities } = await fetchAll(arkivSelect('ask').where(eqAttr('status', 'open')), 1000);

  return entities.length;
}
```

### Average Rating

```typescript
async function getAverageRating(wallet: string): Promise<number> {
  const feedbacks = await listFeedbackForWallet(wallet);

  const ratings = feedbacks.filter((f) => f.rating !== undefined).map((f) => f.rating!);

  if (ratings.length === 0) return 0;

  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
}
```

## Transaction Hash Queries

### Get Transaction Hash for Entity

```typescript
async function getTransactionHash(entityKey: string, entityType: string): Promise<string | null> {
  const result = await arkivSelect(`${entityType}_txhash`)
    .where(eqAttr('entity_key', entityKey))
    .limit(1)
    .fetch();

  if (result.entities.length === 0) {
    return null;
  }

  const txHashEntity = result.entities[0];
  const payload = parsePayload(txHashEntity);
  return payload.txHash || null;
}
```

## Best Practices

1. **Always Filter by Type**: Start from `arkivSelect(type)` (adds `project` and `type` filters)
2. **Use Limits**: Always use `.limit()` (max 200 per page); use `fetchAll(builder, max)` for more
3. **Typed Predicates**: Use `eqAttr` with snake_case names so values are typed like the written attributes
4. **Client-Side Filtering**: Use for complex filters not supported by indexes (`ne`, `exists` and `hasType` are rejected by the node)
5. **Sort Client-Side**: The node has no ordering; sort results client-side after fetching
6. **Handle Empty Results**: Always check for empty results
