# Deletion Patterns

## Overview

Arkiv entities are immutable - they cannot be deleted or modified. To implement "deletion" functionality, we use marker entities that indicate an entity should be treated as deleted.

## Pattern: Deletion Marker Entities

Create a separate entity type that marks another entity as deleted:

```typescript
// Deletion marker entity
{
  type: 'entity_type_deletion',
  entity_key: 'original_entity_key',  // Reference to deleted entity
  deleted_by: 'wallet_address',       // Who deleted it (addr)
  deleted_at: 1705314600000,          // When deleted (u64 epoch ms)
  space_id: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
}
```

## Implementation

### Mark Entity as Deleted

```typescript
async function deleteEntity(entityKey: string, wallet: string) {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const deletedAt = new Date().toISOString();

  await createArkivEntity(walletClient, {
    type: 'entity_type_deletion',
    attributes: {
      entity_key: entityKey,
      deleted_by: wallet.toLowerCase(),
      space_id: SPACE_ID,
    },
    payload: { entityKey, deletedBy: wallet, deletedAt },
    // lifetime: type default from lib/arkiv/schema.ts
  });
}
```

### Query with Deletion Filtering

```typescript
async function getActiveEntities() {
  // 1. Get all entities
  const entities = await fetchAll(arkivSelect('entity_type'), 1000);

  // 2. Get all deletion markers
  const deletions = await fetchAll(arkivSelect('entity_type_deletion'), 1000);

  // 3. Filter out deleted entities
  const deletedKeys = new Set(deletions.entities.map((e) => getAttr(e, 'entity_key')));

  return entities.entities.filter((e) => !deletedKeys.has(e.key));
}
```

## Examples

### Availability Deletion

```typescript
// Mark availability as deleted
await createAvailabilityDeletion({
  availabilityKey: availability.key,
  deletedBy: wallet,
  privateKey: userPrivateKey,
});

// Query active availabilities
const availabilities = await listAvailabilities(wallet);
// Internally filters out deleted ones
```

### Learning Follow Unfollow

```typescript
// Unfollow (soft delete)
await createLearningFollow({
  profile_wallet: wallet,
  skill_id: skillId,
  active: false, // Soft delete flag
  privateKey: userPrivateKey,
});

// Query active follows
const follows = await getLearningFollows(wallet);
// Filters by active: true
```

## Best Practices

1. **Consistent Naming**: Use `*_deletion` pattern for deletion markers
2. **Reference Original**: Always include reference to original entity key
3. **Audit Trail**: Include `deletedBy` and `deletedAt` for audit
4. **Query Filtering**: Always filter deleted entities in queries
5. **TTL**: Deletion markers should have same TTL as original entity

## Trade-offs

**Pros:**

- Maintains complete audit trail
- Enables "undelete" functionality
- Immutable history

**Cons:**

- Requires additional query for deletion markers
- More complex query logic
- Storage overhead

## Alternative: Soft Delete Flag

For entities that support it, use a boolean flag instead:

```typescript
// Entity with active flag
{
  type: 'learning_follow',
  active: false, // Soft delete
  // ... other fields
}
```

**When to use:**

- Simple boolean state
- No need for deletion metadata
- Frequent delete/undelete operations
