# Customize Your App

## Making It Your Own

Now that you understand the basics, let's customize the starter to create something unique.

## Step 1: Define Your Entity Type

Think about what data you want to store. Examples:
- **Blog posts** - `type: 'blog_post'`
- **User notes** - `type: 'note'`
- **Bookmarks** - `type: 'bookmark'`
- **Tasks** - `type: 'task'`

## Step 2: Create a Custom Entity

Modify the entity creation code:

```typescript
// Example: Creating a note entity
const result = await walletClient.createEntity({
  payload: enc.encode(JSON.stringify({
    title: 'My First Note',
    content: 'This is stored on Arkiv!',
    tags: ['learning', 'arkiv'],
  })),
  contentType: 'application/json',
  attributes: [
    { key: 'type', value: 'note' },
    { key: 'wallet', value: wallet.toLowerCase() },
    { key: 'spaceId', value: SPACE_ID },
    { key: 'createdAt', value: new Date().toISOString() },
  ],
  expiresIn: 31536000, // 1 year
});
```

## Step 3: Query Your Custom Entities

Add a query function:

```typescript
const query = publicClient.buildQuery();

const result = await query
  .where(eq('type', 'note'))
  .where(eq('wallet', wallet.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(10)
  .fetch();

result.entities.forEach((entity) => {
  const note = JSON.parse(new TextDecoder().decode(entity.payload));
  console.log('Note:', note.title);
});
```

## Step 4: Build a UI

Create a simple interface:
- **Form** to create new entities
- **List** to display existing entities
- **Details view** to show entity content

## Design Considerations

**Attributes (Queryable):**
- `type` - Entity type
- `wallet` - Owner wallet
- `createdAt` - Timestamp
- `status` - Current state (if applicable)

**Payload (Content):**
- User-generated content
- Large text fields
- Complex nested objects
- Binary data

## Example: Note-Taking App

```typescript
// Create note
attributes: [
  { key: 'type', value: 'note' },
  { key: 'wallet', value: wallet },
  { key: 'createdAt', value: timestamp },
  { key: 'tags', value: 'learning,arkiv' }, // Comma-separated for querying
]

payload: {
  title: 'My Note',
  content: 'Full note content here...',
  metadata: { wordCount: 150 }
}
```

## Testing Your Customization

1. **Create a few entities** of your custom type
2. **Query them back** to verify they're stored
3. **Check the Explorer** to see them on-chain
4. **Stop your server** and verify they still exist (walkaway test!)

## Best Practices

- **Use consistent entity types** - `type: 'note'` not `type: 'Note'` or `type: 'notes'`
- **Normalize wallet addresses** - Always use `.toLowerCase()`
- **Include timestamps** - `createdAt` helps with sorting
- **Keep attributes small** - Large data goes in payload
- **Use stable keys** - If you need to update entities later

## Next Steps

Once you've customized the app and created your own entity types, you're ready to deploy it to production. This proves your app works independently of your local machine!
