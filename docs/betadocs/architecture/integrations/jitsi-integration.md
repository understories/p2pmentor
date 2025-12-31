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
- `mentorWallet` (normalized to lowercase)
- `learnerWallet` (normalized to lowercase)
- `spaceId` (from `SPACE_ID` config)
- `createdAt` (ISO timestamp)

Join URL format: `${JITSI_BASE_URL}/${roomName}`

Entities are queryable via `sessionKey` attribute.

## Room Name Generation

Room names are generated deterministically from session keys:

```typescript
function buildJitsiRoomName(sessionKey: string): string {
  const prefix = 'mg';
  const hash = crypto
    .createHash('sha256')
    .update(sessionKey)
    .digest('hex')
    .slice(0, 16);
  return `${prefix}-${sessionKey}-${hash}`;
}
```

Format: `mg-{sessionKey}-{hash}`

- Prefix `mg` identifies p2pmentor rooms
- Session key provides stability (same session = same room)
- Hash provides opacity (prevents predictable patterns)

## Usage

```typescript
import { generateJitsiMeeting } from '@/lib/jitsi';

const { roomName, joinUrl } = generateJitsiMeeting(sessionKey);
```

Room information is automatically stored in a `session_jitsi` entity on Arkiv when both parties confirm the session.

## Entity Creation

The `session_jitsi` entity is created automatically in `confirmSession()` when both mentor and learner have confirmed:

```typescript
if (mentorConfirmed && learnerConfirmed) {
  const jitsiInfo = generateJitsiMeeting(sessionKey, JITSI_BASE_URL);
  
  await walletClient.createEntity({
    payload: {
      videoProvider: jitsiInfo.videoProvider,
      videoRoomName: jitsiInfo.videoRoomName,
      videoJoinUrl: jitsiInfo.videoJoinUrl,
      generatedAt: createdAt,
    },
    attributes: [
      { key: 'type', value: 'session_jitsi' },
      { key: 'sessionKey', value: sessionKey },
      { key: 'mentorWallet', value: mentorWallet.toLowerCase() },
      { key: 'learnerWallet', value: learnerWallet.toLowerCase() },
      { key: 'spaceId', value: spaceId },
      { key: 'createdAt', value: createdAt },
    ],
    expiresIn: sessionExpiration, // Matches session expiration
  });
}
```

## Design Intent

No external database needed. Easy to reuse in other Arkiv-based apps that need ephemeral rooms. Room name is deterministic from session key for stability while remaining opaque.

## Related Documentation

- [Session Entity](/docs/arkiv/entities/session)
- [Session Confirmation Flow](/docs/user-flows/sessions)
