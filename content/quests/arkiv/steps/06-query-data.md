# Query Your Data

## Reading from Arkiv

Creating entities is only half the story. You also need to **read** them back. Arkiv provides a query API to find entities based on their attributes.

## Basic Query Pattern

```typescript
import { getPublicClient } from '@arkiv-network/sdk/client';
import { eq } from '@arkiv-network/sdk/query';

async function queryEntities() {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();

  const result = await query
    .where(eq('type', 'hello_world'))
    .where(eq('spaceId', SPACE_ID))
    .withAttributes(true)
    .withPayload(true)
    .limit(10)
    .fetch();

  console.log('Found entities:', result.entities.length);
  result.entities.forEach((entity) => {
    const payload = JSON.parse(new TextDecoder().decode(entity.payload));
    console.log('Message:', payload.message);
  });
}

queryEntities();
```

## Understanding Queries

- **`where(eq('type', 'hello_world'))`** - Filter by attribute
- **`withAttributes(true)`** - Include attributes in results
- **`withPayload(true)`** - Include payload in results
- **`limit(10)`** - Maximum number of results
- **`fetch()`** - Execute the query

## Query Patterns

### Find by Type
```typescript
.where(eq('type', 'hello_world'))
```

### Find by Wallet
```typescript
.where(eq('wallet', walletAddress.toLowerCase()))
```

### Find by Multiple Attributes
```typescript
.where(eq('type', 'hello_world'))
.where(eq('spaceId', SPACE_ID))
.where(eq('createdAt', '2024-01-01'))
```

## Handling Results

Query results include:
- **`entities`** - Array of matching entities
- Each entity has:
  - `key` - Entity key
  - `attributes` - Array of attribute key-value pairs
  - `payload` - The payload data (may need decoding)
  - `txHash` - Transaction hash

## Try It Yourself

1. Create a few entities with `type: 'hello_world'`
2. Use the query code above to find them
3. Decode and display the payload data
4. Experiment with different query filters

## Important Notes

- **Attributes are indexed** - Queries on attributes are fast
- **Payload is not indexed** - Can't query by payload content
- **Indexer lag** - New entities may take a few seconds to appear in queries
- **Always normalize wallets** - Use `.toLowerCase()` for wallet addresses

## Next Steps

Now that you can create and query entities, you understand the basics of Arkiv! The next step covers important concepts like indexer lag and best practices.
