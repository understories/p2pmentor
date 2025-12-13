# Garden Note Entity

## Overview

Public Garden Bulletin - short, playful messages pinned to the shared "garden wall". Public by design, on-chain, educational (shows data publishing, not DMs).

**Entity Type:** `garden_note`  
**TTL:** 1 year (31536000 seconds) or no TTL for permanent  
**Immutability:** Immutable - updates create new entities

## Attributes

- `type`: `'garden_note'` (required)
- `authorWallet`: Wallet address of author (required, lowercase)
- `targetWallet`: Target wallet (optional, for "note to a specific profile")
- `channel`: Channel identifier (default: `'public_garden_board'`) (required)
- `visibility`: Visibility level (default: `'public'`) (required)
- `spaceId`: `'local-dev'` (required)
- `createdAt`: ISO timestamp (required)

## Payload

```typescript
{
  authorWallet: string;        // Author wallet address
  targetWallet?: string;       // Target wallet (optional)
  message: string;             // Note message (max 500 chars)
  tags: string[];              // Array of tag strings (e.g., ["#gratitude", "#looking-for-mentor"])
  channel: string;             // Channel identifier
  visibility: string;           // Visibility level
  publishConsent: boolean;     // Explicit consent (must be true)
  moderationState?: string;   // "active" | "hidden_by_moderator"
  replyToNoteId?: string;      // Optional: for threaded comments
  createdAt: string;           // ISO timestamp
}
```

## Key Fields

- **authorWallet**: Wallet address of note author
- **targetWallet**: Optional target wallet (for directed notes)
- **message**: Note message (max 500 characters)
- **tags**: Array of tag strings for categorization
- **channel**: Channel identifier (default: `'public_garden_board'`)
- **visibility**: Visibility level (default: `'public'`)
- **publishConsent**: Must be `true` - explicit consent required
- **moderationState**: Moderation state - `'active'` or `'hidden_by_moderator'`
- **replyToNoteId**: Optional reference to parent note for threading

## Constraints

- **Message Length**: Maximum 500 characters
- **Daily Limit**: Maximum 10 notes per profile per day
- **Consent**: `publishConsent` must be `true`

## Query Patterns

### Get All Public Notes

```typescript
import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient } from "@/lib/arkiv/client";

const publicClient = getPublicClient();
const result = await publicClient.buildQuery()
  .where(eq('type', 'garden_note'))
  .where(eq('channel', 'public_garden_board'))
  .where(eq('visibility', 'public'))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

const notes = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .filter(n => n.moderationState !== 'hidden_by_moderator')
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
```

### Get Notes by Author

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'garden_note'))
  .where(eq('authorWallet', walletAddress.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

### Get Notes by Tag

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'garden_note'))
  .withAttributes(true)
  .withPayload(true)
  .limit(1000)
  .fetch();

// Filter client-side by tag
const notesWithTag = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .filter(n => n.tags && n.tags.includes('#gratitude'));
```

### Get Threaded Replies

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'garden_note'))
  .withAttributes(true)
  .withPayload(true)
  .limit(1000)
  .fetch();

// Filter client-side for replies
const replies = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .filter(n => n.replyToNoteId === parentNoteId);
```

## Creation

```typescript
import { createGardenNote } from "@/lib/arkiv/gardenNote";
import { getWalletClientFromMetaMask } from "@/lib/arkiv/client";

const walletClient = await getWalletClientFromMetaMask();
const { key, txHash } = await createGardenNote({
  authorWallet: walletAddress,
  message: "Excited to start my mentorship journey! 🌱",
  tags: ["#gratitude", "#new-member"],
  channel: "public_garden_board",
  visibility: "public",
  publishConsent: true,
  privateKey: walletClient.account.privateKey,
  spaceId: 'local-dev',
});
```

## Transaction Hash Tracking

- `garden_note_txhash`: Transaction hash tracking, linked via `gardenNoteKey` attribute

## Moderation

Notes can be hidden by moderators:

```typescript
// Hidden notes are filtered out in queries
const activeNotes = notes.filter(n => n.moderationState !== 'hidden_by_moderator');
```

## Example Use Cases

### Post Public Note

```typescript
await createGardenNote({
  authorWallet: userWallet,
  message: "Just completed my first mentorship session! So grateful for this community.",
  tags: ["#gratitude", "#first-session"],
  publishConsent: true,
  privateKey: userPrivateKey,
});
```

### Reply to Note

```typescript
await createGardenNote({
  authorWallet: userWallet,
  message: "Congratulations! Welcome to the community!",
  tags: ["#welcome"],
  replyToNoteId: parentNote.key,
  publishConsent: true,
  privateKey: userPrivateKey,
});
```

### Note to Specific Profile

```typescript
await createGardenNote({
  authorWallet: userWallet,
  targetWallet: targetWallet,
  message: "Thanks for the great session yesterday!",
  tags: ["#gratitude"],
  publishConsent: true,
  privateKey: userPrivateKey,
});
```

## Related Entities

- `user_profile`: Author and target profiles

## Notes

- **Public by Design**: All notes are public on-chain
- **Educational**: Shows users they're publishing data, not sending DMs
- **Threading**: Supports threaded conversations via `replyToNoteId`
- **Moderation**: Supports moderation via `moderationState`
- **Tags**: Free-form tags for categorization
- **Daily Limit**: 10 notes per profile per day (enforced client-side)

## Privacy Considerations

- **Public Data**: All notes are public on-chain
- **Wallet Visibility**: Author and target wallets are visible
- **No Encryption**: Messages are stored in plain text
- **Permanent**: Notes persist on-chain (1 year TTL or permanent)

