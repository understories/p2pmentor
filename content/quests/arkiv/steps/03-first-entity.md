# Create Your First Entity

## What is an Entity?

An **entity** is a piece of data stored on Arkiv. Think of it like a database record, but instead of living in a company's database, it lives on the blockchain.

Every entity has:
- **Attributes** - Indexed, queryable fields (like `type`, `wallet`, `createdAt`)
- **Payload** - The actual content (can be JSON, text, or binary data)
- **Entity Key** - A unique identifier
- **Transaction Hash** - Proof that it was written to the blockchain

## Your First Entity

Let's create a simple "Hello World" entity:

```typescript
import { getWalletClientFromPrivateKey } from '@arkiv-network/sdk/client';
import { SPACE_ID } from './config'; // Your space ID

async function createHelloWorld() {
  const walletClient = getWalletClientFromPrivateKey(process.env.ARKIV_PRIVATE_KEY!);
  const enc = new TextEncoder();

  const result = await walletClient.createEntity({
    payload: enc.encode(JSON.stringify({
      message: 'Hello, Arkiv!',
      timestamp: new Date().toISOString(),
    })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'hello_world' },
      { key: 'spaceId', value: SPACE_ID },
      { key: 'createdAt', value: new Date().toISOString() },
    ],
    expiresIn: 31536000, // 1 year
  });

  console.log('Entity created!');
  console.log('Entity Key:', result.entityKey);
  console.log('Transaction Hash:', result.txHash);
  
  return result;
}

createHelloWorld();
```

## Understanding the Code

- **`payload`** - The actual data (your message)
- **`attributes`** - Queryable fields (type, spaceId, createdAt)
- **`expiresIn`** - How long the entity should exist (in seconds)
- **`result.entityKey`** - Unique identifier for your entity
- **`result.txHash`** - Transaction hash proving it was written

## Try It Yourself

1. Copy the code above into a file `create-entity.ts`
2. Replace `SPACE_ID` with your actual space ID
3. Run it: `npx tsx create-entity.ts`
4. Save the entity key and transaction hash - you'll need them next!

## What Happens Next?

After creating your entity, you'll learn how to verify it on the Arkiv Explorer. This proves your data exists independently of any server.
