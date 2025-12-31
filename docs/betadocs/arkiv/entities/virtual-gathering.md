# Virtual Gathering Entity

## Overview

Community virtual gatherings (public meetings). Anyone can suggest a gathering, anyone can RSVP. Jitsi video meeting is generated immediately upon creation (no confirmation needed).

**Entity Type:** `virtual_gathering`  
**TTL:** 1 year (31536000 seconds)  
**Immutability:** Immutable - updates create new entities

## Attributes

- `type`: `'virtual_gathering'` (required)
- `organizerWallet`: Organizer wallet address (required, lowercase)
- `community`: Community identifier (e.g., skill slug) (required)
- `spaceId`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) (required)
- `createdAt`: ISO timestamp (required)

## Payload

```typescript
{
  organizerWallet: string;      // Organizer wallet address
  community: string;             // Community identifier (e.g., skill slug)
  title: string;                // Gathering title
  description?: string;         // Gathering description
  sessionDate: string;           // ISO timestamp when gathering is scheduled
  duration: number;             // Duration in minutes
  videoProvider?: 'jitsi' | 'none' | 'custom';
  videoRoomName?: string;        // Jitsi room name
  videoJoinUrl?: string;        // Jitsi join URL
  videoJwtToken?: string;       // Jitsi JWT token (optional)
  createdAt: string;            // ISO timestamp
}
```

## Key Fields

- **organizerWallet**: Wallet address of gathering organizer
- **community**: Community identifier (typically skill slug)
- **title**: Gathering title
- **description**: Gathering description (optional)
- **sessionDate**: When gathering is scheduled (ISO timestamp)
- **duration**: Duration in minutes (default: 60)
- **videoProvider**: Video provider (default: `'jitsi'`)
- **videoRoomName**: Jitsi room name (generated)
- **videoJoinUrl**: Jitsi join URL (generated immediately)
- **videoJwtToken**: Jitsi JWT token (optional)

## Query Patterns

### Get All Gatherings

```typescript
import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient } from "@/lib/arkiv/client";

const publicClient = getPublicClient();
const result = await publicClient.buildQuery()
  .where(eq('type', 'virtual_gathering'))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

const gatherings = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .filter(g => new Date(g.sessionDate) >= new Date()) // Future only
  .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime());
```

### Get Gatherings by Community

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'virtual_gathering'))
  .where(eq('community', skillSlug))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

### Get Gatherings by Organizer

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'virtual_gathering'))
  .where(eq('organizerWallet', walletAddress.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

## Creation

```typescript
import { createVirtualGathering } from "@/lib/arkiv/virtualGathering";
import { getWalletClientFromMetaMask } from "@/lib/arkiv/client";

const walletClient = await getWalletClientFromMetaMask();
const { key, txHash } = await createVirtualGathering({
  organizerWallet: walletAddress,
  community: "spanish", // Skill slug
  title: "Spanish Conversation Practice",
  description: "Weekly Spanish conversation practice for learners",
  sessionDate: "2024-01-20T18:00:00Z",
  duration: 60, // 60 minutes
  privateKey: walletClient.account.privateKey,
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

## RSVP Tracking

Users RSVP by creating `session` entities with special handling:

```typescript
// RSVP to gathering
const session = await createSession({
  mentorWallet: gathering.organizerWallet,
  learnerWallet: userWallet,
  skill: 'virtual_gathering_rsvp',
  skill_id: gathering.key, // Reference to gathering
  sessionDate: gathering.sessionDate,
  duration: gathering.duration,
  gatheringKey: gathering.key,
  gatheringTitle: gathering.title,
  community: gathering.community,
  privateKey: userPrivateKey,
});
```

### Get RSVP Count

```typescript
async function getRSVPCount(gatheringKey: string): Promise<number> {
  const result = await publicClient.buildQuery()
    .where(eq('type', 'session'))
    .where(eq('gatheringKey', gatheringKey))
    .withAttributes(true)
    .limit(1000)
    .fetch();
  
  return result.entities.length;
}
```

## Transaction Hash Tracking

- `virtual_gathering_txhash`: Transaction hash tracking, linked via `gatheringKey` attribute

## Jitsi Integration

Jitsi meeting is generated immediately upon creation:

```typescript
// Inside createVirtualGathering
const jitsiMeeting = await generateJitsiMeeting({
  roomName: `gathering-${gatheringKey}`,
  userWallet: organizerWallet,
});

const gathering = {
  // ... other fields
  videoProvider: 'jitsi',
  videoRoomName: jitsiMeeting.roomName,
  videoJoinUrl: jitsiMeeting.joinUrl,
  videoJwtToken: jitsiMeeting.jwtToken,
};
```

## Example Use Cases

### Create Community Gathering

```typescript
await createVirtualGathering({
  organizerWallet: userWallet,
  community: "javascript",
  title: "JavaScript Study Group",
  description: "Weekly JavaScript study group for all levels",
  sessionDate: "2024-01-20T19:00:00Z",
  duration: 90,
  privateKey: userPrivateKey,
});
```

### List Upcoming Gatherings

```typescript
async function getUpcomingGatherings(community?: string) {
  const query = publicClient.buildQuery()
    .where(eq('type', 'virtual_gathering'))
    .withAttributes(true)
    .withPayload(true)
    .limit(100);
  
  if (community) {
    query.where(eq('community', community));
  }
  
  const result = await query.fetch();
  
  return result.entities
    .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
    .filter(g => new Date(g.sessionDate) >= new Date())
    .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime());
}
```

## Related Entities

- `session`: RSVPs to gatherings (via `gatheringKey`)
- `skill`: Community skills
- `learning_follow`: Skill follows for community discovery

## Notes

- **Immediate Jitsi**: Video meeting generated immediately (no confirmation)
- **Public**: Anyone can view and RSVP
- **Community-Based**: Organized by skill/community
- **RSVP via Session**: Users RSVP by creating session entities

