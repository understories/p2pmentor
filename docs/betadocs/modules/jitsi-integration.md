# Jitsi Integration (Session Bridge)

Location: `lib/jitsi.ts`

## Purpose

Simple bridge from Arkiv sessions to live video rooms.

## Behavior

When both participants confirm a session, a Jitsi room is generated. Room name generated from session key. Room info stored in `session_jitsi` entity linked via `sessionKey`. Join URL format: `${JITSI_BASE_URL}/${roomName}`.

## Design intent

No external database needed. Easy to reuse in other Arkiv-based apps that need ephemeral rooms.

## Usage

```typescript
import { generateJitsiMeeting } from '@/lib/jitsi';

const { roomName, joinUrl } = generateJitsiMeeting(sessionKey);
```

Room information is automatically stored in a `session_jitsi` entity on Arkiv.
