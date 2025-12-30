# Session Entity Schema

## Entity Type
`session`

## Patterns Used

- [PAT-SESSION-001: Session State Machine](./session-state-machine.md) - Status computed from supporting entities, not stored attribute
- [PAT-QUERY-001: Indexer-Friendly Query Shapes](./patterns/query-optimization.md) - Queries use indexed attributes (type, mentorWallet, learnerWallet, spaceId)
- [PAT-REF-001: Relationship References That Survive Updates](./patterns/reference-integrity.md) - References to Skill entities via skill_id attribute
- [PAT-SPACE-001: Space ID as Environment Boundary](./patterns/space-isolation.md) - spaceId attribute for data isolation

## Field Table

| Field Name | Type | Required | Location | Description |
|------------|------|----------|----------|-------------|
| type | string | Yes | Attribute | Always "session" |
| mentorWallet | string | Yes | Attribute | Mentor wallet address (lowercase) |
| learnerWallet | string | Yes | Attribute | Learner wallet address (lowercase) |
| skill | string | Yes | Attribute | Skill name (legacy, kept for backward compatibility) |
| skill_id | string | No | Attribute | Skill entity key (preferred for beta) |
| spaceId | string | Yes | Attribute | Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) |
| createdAt | string | Yes | Attribute | ISO timestamp |
| sessionDate | string | Yes | Attribute | ISO timestamp when session is scheduled |
| status | string | Yes | Attribute | "pending" | "scheduled" | "in-progress" | "completed" | "cancelled" |
| requiresPayment | string | No | Attribute | "true" if paid session |
| paymentAddress | string | No | Attribute | Payment receiving address (if paid) |
| cost | string | No | Attribute | Cost amount (if paid) |
| sessionDate | string | Yes | Payload | ISO timestamp when session is scheduled |
| duration | number | No | Payload | Duration in minutes (default: 60) |
| notes | string | No | Payload | Optional notes |
| requiresPayment | boolean | No | Payload | Whether session requires payment |
| paymentAddress | string | No | Payload | Payment receiving address (if paid) |
| cost | string | No | Payload | Cost amount (if paid) |
| gatheringKey | string | No | Payload | Virtual gathering entity key (for community sessions) |
| gatheringTitle | string | No | Payload | Virtual gathering title |
| community | string | No | Payload | Skill slug/community name (for virtual gatherings) |

## State Machine Diagram

For the detailed session state machine diagram, see [Session State Machine](./session-state-machine.md).

## Implementation Details

### Key Implementation Points

1. **Status is Computed, Not Stored**: The session entity has a `status` attribute, but the actual status is computed dynamically from supporting entities (`session_confirmation`, `session_rejection`). The code explicitly states: "Don't trust the entity's status attribute - recalculate based on confirmations."

2. **Auto-Confirmation of Requester**: When a session is created, the requester is automatically confirmed by creating a `session_confirmation` entity for them. This means:
   - If learner requests from offer: learner is auto-confirmed
   - If mentor offers to help on ask: mentor is auto-confirmed
   - Only the other party needs to confirm

3. **Both Parties Must Confirm**: Status transitions from `pending` to `scheduled` only when BOTH parties have `session_confirmation` entities. This is checked in the `confirmSession` function.

4. **Jitsi Generation Timing**: The Jitsi meeting URL is generated when BOTH parties confirm (not on first confirmation). The `confirmSession` function checks if both confirmations exist, and only then creates the `session_jitsi` entity.

5. **Rejection Creates Entity**: Rejection doesn't update the session entity directly. Instead, it creates a `session_rejection` entity, and the status is computed as `declined` when this entity exists.

6. **Supporting Entities**:
   - `session_confirmation`: Links to session via `sessionKey`, contains `confirmedBy` (mentorWallet or learnerWallet)
   - `session_rejection`: Links to session via `sessionKey`, contains `rejectedBy` (mentorWallet or learnerWallet)
   - `session_jitsi`: Links to session via `sessionKey`, contains `videoJoinUrl` in payload
   - `session_txhash`: Tracks transaction hash for session creation (separate entity)

7. **Status Computation Logic** (from `listSessions`):
   ```typescript
   if (mentorRejected || learnerRejected) {
     finalStatus = 'declined';
   } else if (mentorConfirmed && learnerConfirmed) {
     // Both confirmed - mark as scheduled only if currently pending
     // Preserve 'completed' and 'in-progress' statuses (don't overwrite)
     if (entityStatus === 'pending') {
       finalStatus = 'scheduled';
     } else if (entityStatus === 'completed' || entityStatus === 'in-progress') {
       // Preserve completed/in-progress status
       finalStatus = entityStatus;
     } else {
       // For scheduled or other statuses, ensure it's scheduled
       finalStatus = 'scheduled';
     }
   } else if (entityStatus === 'scheduled' && (!mentorConfirmed || !learnerConfirmed)) {
     finalStatus = 'pending'; // Revert if status doesn't match confirmations
   }
   ```
   
   **Critical Fix**: The status computation now preserves `'completed'` and `'in-progress'` statuses when both parties have confirmed. Previously, these statuses were being overwritten to `'scheduled'`, causing completed sessions to disappear from profile stats, notifications, and past filters.

8. **Future States**: 
   - `in-progress`: Manual status update (future feature)
   - `completed`: Manual status update after session ends
   - `cancelled`: Reserved for canceling already-scheduled sessions (not yet implemented)

9. **Expiration**: Session entities expire at `sessionDate + duration + 1 hour buffer`. Supporting entities (confirmations, rejections, Jitsi) use the same expiration.

10. **Payment Flow** (not shown in diagram):
    - `session_payment_submission`: Created when learner submits payment txHash
    - `session_payment_validation`: Created when mentor validates payment
    - These are separate entities linked via `sessionKey`

## Files Referenced

- `lib/arkiv/sessions.ts` - Session creation, confirmation, rejection, and status computation
- `app/api/sessions/route.ts` - API route for session operations
- `app/me/sessions/page.tsx` - Frontend UI for viewing and managing sessions
- `components/RequestMeetingModal.tsx` - Modal for requesting meetings

## State Transitions and Who Can Trigger Them

Session state is computed from session entity plus confirmation/rejection entities:

### Initial State: "pending"
- Created when learner requests meeting from offer, or mentor offers to help on ask
- Created by: Learner (from offer) or Mentor (from ask)

### Transition to "scheduled": "confirmed"
- Triggered by: Both mentor and learner must confirm
- Mechanism: Create `session_confirmation` entity with `sessionKey` and `confirmedBy` (mentorWallet or learnerWallet)
- Status computed: If both `session_confirmation` entities exist, status is "scheduled"
- Jitsi URL generated: When both parties confirm, `session_jitsi` entity created with room name and join URL

### Transition to "in-progress"
- Triggered by: Manual status update (future feature) or time-based (sessionDate reached)
- Current implementation: Status remains "scheduled" until manually updated

### Transition to "completed"
- Triggered by: Manual status update after session ends
- Current implementation: Status updated via API route

### Transition to "cancelled": "declined"
- Triggered by: Mentor or learner rejects/declines
- Mechanism: Create `session_rejection` entity with `sessionKey` and `rejectedBy` (mentorWallet or learnerWallet)
- Status computed: If `session_rejection` entity exists, status is "cancelled"

## Supporting Entities

### session_confirmation
- `type`: "session_confirmation"
- `sessionKey`: Session entity key
- `confirmedBy`: Wallet address of confirmer (mentorWallet or learnerWallet)
- `spaceId`: "local-dev"
- `createdAt`: ISO timestamp

### session_rejection
- `type`: "session_rejection"
- `sessionKey`: Session entity key
- `rejectedBy`: Wallet address of rejector (mentorWallet or learnerWallet)
- `reason`: Optional rejection reason
- `spaceId`: "local-dev"
- `createdAt`: ISO timestamp

### session_jitsi
- `type`: "session_jitsi"
- `sessionKey`: Session entity key
- `roomName`: Jitsi room name (matches session ID)
- `joinUrl`: Jitsi join URL
- `spaceId`: "local-dev"
- `createdAt`: ISO timestamp

### session_payment_submission
- `type`: "session_payment_submission"
- `sessionKey`: Session entity key
- `paymentTxHash`: Transaction hash of payment
- `submittedBy`: Learner wallet address
- `spaceId`: "local-dev"
- `createdAt`: ISO timestamp

### session_payment_validation
- `type`: "session_payment_validation"
- `sessionKey`: Session entity key
- `paymentTxHash`: Transaction hash being validated
- `validatedBy`: Mentor wallet address
- `validated`: "true" | "false"
- `spaceId`: "local-dev"
- `createdAt`: ISO timestamp

## Query Pattern

Fetch sessions for a wallet (as mentor or learner):

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'session'))
  .where(eq('mentorWallet', wallet.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

// Also query as learner
const learnerResult = await query
  .where(eq('type', 'session'))
  .where(eq('learnerWallet', wallet.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

Fetch confirmations/rejections for session:

```typescript
const confirmations = await query
  .where(eq('type', 'session_confirmation'))
  .where(eq('sessionKey', sessionKey))
  .withAttributes(true)
  .limit(10)
  .fetch();

const rejections = await query
  .where(eq('type', 'session_rejection'))
  .where(eq('sessionKey', sessionKey))
  .withAttributes(true)
  .limit(10)
  .fetch();
```

Implementation: `lib/arkiv/sessions.ts` - `listSessions()`, `getSessionByKey()`, `confirmSession()`, `rejectSession()`

## Expiration

Session entities expire after sessionDate + duration + 1 hour buffer. Calculated dynamically:

```typescript
const sessionStartTime = new Date(sessionDate).getTime();
const sessionDurationMs = durationMinutes * 60 * 1000;
const bufferMs = 60 * 60 * 1000; // 1 hour
const expirationTime = sessionStartTime + sessionDurationMs + bufferMs;
const expiresInSeconds = Math.floor((expirationTime - now) / 1000);
```

## Transaction Hash Tracking

Separate `session_txhash` entity (optional) tracks transaction hash:
- `type`: "session_txhash"
- `sessionKey`: Entity key of session
- `mentorWallet`: Mentor wallet address
- `learnerWallet`: Learner wallet address
- `spaceId`: "local-dev"

