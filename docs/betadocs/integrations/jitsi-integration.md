# Jitsi Integration

Location: `lib/jitsi.ts`

## Purpose

Bridge from Arkiv sessions to live video rooms. Provides ephemeral video meeting rooms for mentorship sessions.

## Implementation

When both participants confirm a session, a Jitsi room is generated. Room name is deterministic from session key using format `mg-{sessionKey}-{hash}`. Room info is stored in `session_jitsi` entity on Arkiv, linked via `sessionKey`.

## Arkiv Integration

The `session_jitsi` entity is created when both parties confirm a session. Entity includes:
- `sessionKey` (reference to session entity)
- `videoProvider: 'jitsi'`
- `videoRoomName` (generated room name)
- `videoJoinUrl` (full join URL)

Join URL format: `${JITSI_BASE_URL}/${roomName}`

Entities are queryable via `sessionKey` attribute.

## Usage

```typescript
import { generateJitsiMeeting } from '@/lib/jitsi';

const { roomName, joinUrl } = generateJitsiMeeting(sessionKey);
```

Room information is automatically stored in a `session_jitsi` entity on Arkiv.

## Design Intent

No external database needed. Easy to reuse in other Arkiv-based apps that need ephemeral rooms. Room name is deterministic from session key for stability while remaining opaque.

