# Create Your First Entity

## Using the Starter App

The arkiv-nextjs-starter includes example code for creating entities. Let's use it to create your first entity.

## Step 1: Find the Create Button

1. **Open your running app** at `http://localhost:3000`
2. **Look for a "Create Entity" or "Create Record" button**
3. **Click it** to see the entity creation form

## Step 2: Create an Entity

1. **Fill in the form** (if there is one)
   - Or use the default example values
2. **Click "Submit" or "Create"**
3. **Watch the console** - You should see:
   - Transaction hash
   - Entity key
   - Success message

## Understanding What Happened

When you clicked create, the app:
1. **Built an entity** with attributes and payload
2. **Signed a transaction** with your private key
3. **Submitted to Arkiv** network
4. **Received confirmation** with entity key and txHash

## Step 3: Examine the Code

Look at the entity creation code in the starter:

```typescript
// Example from starter app
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
```

## Key Concepts

- **`payload`** - The actual data (your message)
- **`attributes`** - Queryable fields (type, spaceId, createdAt)
- **`expiresIn`** - How long the entity should exist (in seconds)
- **`result.entityKey`** - Unique identifier for your entity
- **`result.txHash`** - Transaction hash proving it was written

## Save Your Results

**Important:** Copy and save:
- The **entity key** - You'll use this to query the entity
- The **transaction hash** - You'll use this to verify on Explorer

## What Happens Next?

After creating your entity, you'll learn how to verify it on the Arkiv Explorer. This proves your data exists independently of any server and completes the trustless verification loop.
