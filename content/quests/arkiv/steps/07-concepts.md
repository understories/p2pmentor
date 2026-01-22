# Understanding Arkiv Concepts

## Attributes vs Payload

Understanding the difference between **attributes** and **payload** is crucial for building efficient Arkiv apps.

### Attributes
- **Indexed** - Can be queried efficiently
- **Limited size** - Keep them small
- **Use for filtering** - `type`, `wallet`, `createdAt`, `status`
- **Examples**: `type: 'hello_world'`, `wallet: '0x123...'`, `createdAt: '2024-01-01'`

### Payload
- **Not indexed** - Can't query by payload content
- **Unlimited size** - Can store large data
- **Use for content** - Messages, descriptions, complex objects
- **Examples**: User messages, blog posts, image data

### Best Practice

```typescript
// ✅ Good: Queryable fields in attributes
attributes: [
  { key: 'type', value: 'message' },
  { key: 'wallet', value: wallet.toLowerCase() },
  { key: 'createdAt', value: new Date().toISOString() },
]

// ✅ Good: Content in payload
payload: enc.encode(JSON.stringify({
  message: 'This is a long message that doesn\'t need to be queried...',
  metadata: { ... }
}))
```

## Indexer Lag

**Indexer lag** is the delay between when you create an entity and when it appears in queries.

### Why It Happens
1. You submit a transaction to the blockchain
2. The transaction is confirmed (usually fast)
3. Indexers process the transaction (takes a few seconds)
4. The entity becomes queryable

### Handling Indexer Lag

**Optimistic UI Pattern:**
```typescript
// 1. Show "submitted" state immediately
setStatus('submitted');

// 2. Poll for confirmation
const pollForEntity = async () => {
  const result = await query.where(eq('type', 'my_entity')).fetch();
  if (result.entities.length > 0) {
    setStatus('indexed');
  } else {
    setTimeout(pollForEntity, 1000); // Try again in 1 second
  }
};
```

**Best Practices:**
- Show "submitted" state immediately after transaction
- Poll for indexer confirmation (with backoff)
- Handle gracefully - don't show errors during normal lag
- Use transaction hashes for immediate verification

## Entity Keys

Entity keys are unique identifiers for entities. Arkiv generates them automatically, but you can also use **stable keys** for predictable identifiers.

### Stable Keys (Pattern B)

```typescript
const entityKey = `message:${spaceId}:${wallet}:${messageId}`;
```

Benefits:
- Predictable - Same inputs = same key
- No query needed - You know the key before creating
- Idempotent - Safe to retry

Use when:
- You need to update entities later
- You want to prevent duplicates
- You need predictable keys

## TTL (Time To Live)

Entities can have an expiration time. After the TTL expires, the entity is automatically removed.

```typescript
expiresIn: 31536000 // 1 year in seconds
```

**Common TTL values:**
- `31536000` - 1 year (for persistent data)
- `2592000` - 30 days (for temporary data)
- `86400` - 1 day (for ephemeral data)

## Space Isolation

Each **space** is isolated. Entities in one space can't be queried from another space.

- Use `SPACE_ID` from your config
- Always include `spaceId` in attributes
- Queries should filter by `spaceId`

## Summary

- **Attributes** = Queryable, indexed fields
- **Payload** = Content, not indexed
- **Indexer lag** = Normal delay, handle with optimistic UI
- **Entity keys** = Unique identifiers (can be stable)
- **TTL** = Expiration time for entities
- **Space isolation** = Entities are scoped to spaces

These concepts are the foundation of building with Arkiv!
