# Query Optimization

## Overview

Efficient querying is critical for good performance. This document covers best practices for optimizing Arkiv queries.

## Indexed Attributes

These attributes are indexed and should be used in queries:

- `type`: Entity type (always use first)
- `wallet`: Wallet address (normalized to lowercase)
- `spaceId`: Space identifier
- Custom indexed attributes (varies by entity type)

## Query Patterns

### Always Filter by Type First

```typescript
// ✅ Good: Type first (indexed)
const result = await publicClient.buildQuery()
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', wallet))
  .fetch();

// ❌ Bad: Wallet first
const result = await publicClient.buildQuery()
  .where(eq('wallet', wallet))
  .where(eq('type', 'user_profile'))
  .fetch();
```

### Use Limit Defensively

```typescript
// ✅ Good: Always use limit
const result = await publicClient.buildQuery()
  .where(eq('type', 'ask'))
  .limit(100)
  .fetch();

// ❌ Bad: No limit (unbounded)
const result = await publicClient.buildQuery()
  .where(eq('type', 'ask'))
  .fetch();
```

### Normalize Wallet Addresses

```typescript
// ✅ Good: Normalize to lowercase
const wallet = userWallet.toLowerCase();
const result = await publicClient.buildQuery()
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', wallet))
  .fetch();

// ❌ Bad: Case-sensitive
const result = await publicClient.buildQuery()
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', userWallet))
  .fetch();
```

## Client-Side Filtering

For complex filters, query broadly and filter client-side:

```typescript
// 1. Query indexed attributes
const result = await publicClient.buildQuery()
  .where(eq('type', 'session'))
  .where(eq('mentorWallet', wallet))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

// 2. Filter client-side
const activeSessions = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .filter(s => s.status === 'scheduled' && new Date(s.sessionDate) >= new Date());
```

## Pagination

For large result sets, use pagination:

```typescript
async function getSessionsPaginated(wallet: string, page: number = 0, pageSize: number = 20) {
  const offset = page * pageSize;
  
  const result = await publicClient.buildQuery()
    .where(eq('type', 'session'))
    .where(eq('mentorWallet', wallet))
    .withAttributes(true)
    .withPayload(true)
    .limit(pageSize)
    .fetch();
  
  // Note: Arkiv doesn't support offset, so pagination is approximate
  // For exact pagination, use cursor-based approach
  return result.entities.map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }));
}
```

## Caching Strategies

### Cache Latest Version

```typescript
// Cache latest profile client-side
let cachedProfile: Profile | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60000; // 1 minute

async function getProfileCached(wallet: string): Promise<Profile> {
  const now = Date.now();
  
  if (cachedProfile && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedProfile;
  }
  
  cachedProfile = await getLatestProfile(wallet);
  cacheTimestamp = now;
  return cachedProfile;
}
```

## Performance Monitoring

Track query performance:

```typescript
async function queryWithMetrics<T>(
  queryFn: () => Promise<T>,
  operation: string
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    const durationMs = Date.now() - startTime;
    
    // Store metric
    await createDxMetric({
      sample: {
        source: 'arkiv',
        operation,
        durationMs,
        status: 'success',
        createdAt: new Date().toISOString(),
      },
      privateKey: getPrivateKey(),
    });
    
    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    await createDxMetric({
      sample: {
        source: 'arkiv',
        operation,
        durationMs,
        status: 'failure',
        errorType: error.name,
        createdAt: new Date().toISOString(),
      },
      privateKey: getPrivateKey(),
    });
    
    throw error;
  }
}
```

## Best Practices

1. **Type First**: Always filter by `type` first (indexed)
2. **Use Limits**: Always use `.limit()` to avoid unbounded queries
3. **Normalize**: Normalize wallet addresses to lowercase
4. **Client-Side Filtering**: Use for complex filters not supported by indexes
5. **Monitor Performance**: Track query performance for optimization

