# Entity Versioning

## Overview

Since Arkiv entities are immutable, updates create new entities. To get the "current" version, we query all entities for an identifier and select the latest one.

## Pattern: Latest Version Selection

### Query All Versions

```typescript
async function getLatestProfile(wallet: string) {
  const result = await publicClient.buildQuery()
    .where(eq('type', 'user_profile'))
    .where(eq('wallet', wallet.toLowerCase()))
    .withAttributes(true)
    .withPayload(true)
    .limit(100)
    .fetch();
  
  // Sort by createdAt descending, get first
  const profiles = result.entities
    .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  return profiles[0] || null;
}
```

### Update Creates New Entity

```typescript
async function updateProfile(wallet: string, updates: Partial<Profile>) {
  // 1. Get current profile
  const current = await getLatestProfile(wallet);
  
  // 2. Create new entity with updates
  const updated = {
    ...current,
    ...updates,
    createdAt: new Date().toISOString(),
  };
  
  // 3. Create new entity (immutable)
  return await createProfile({
    wallet,
    ...updated,
    privateKey: userPrivateKey,
  });
}
```

## Version History

All versions are preserved, enabling history tracking:

```typescript
async function getProfileHistory(wallet: string) {
  const result = await publicClient.buildQuery()
    .where(eq('type', 'user_profile'))
    .where(eq('wallet', wallet.toLowerCase()))
    .withAttributes(true)
    .withPayload(true)
    .limit(100)
    .fetch();
  
  return result.entities
    .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
```

## Conflict Resolution

When multiple updates occur simultaneously:

### Last-Write-Wins

```typescript
// Multiple updates create multiple entities
// Latest by createdAt wins
const latest = profiles.sort((a, b) => 
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
)[0];
```

### Optimistic Locking

```typescript
async function updateProfileWithLock(wallet: string, updates: Partial<Profile>, expectedVersion: string) {
  const current = await getLatestProfile(wallet);
  
  // Check version matches
  if (current.key !== expectedVersion) {
    throw new Error('Profile was updated by another process');
  }
  
  // Create new version
  return await updateProfile(wallet, updates);
}
```

## Best Practices

1. **Always Sort**: Sort by `createdAt` descending to get latest
2. **Limit Queries**: Use `.limit()` to avoid unbounded queries
3. **Version Tracking**: Track entity key as "version" if needed
4. **History Access**: Preserve ability to access version history

## Performance Considerations

- **Indexing**: `wallet` and `type` attributes are indexed
- **Limit**: Use reasonable limits (e.g., 100) for version queries
- **Caching**: Cache latest version client-side when appropriate

