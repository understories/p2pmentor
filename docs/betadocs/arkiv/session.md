# Session Entity Schema

## Entity Type
`session`

## Field Table

| Field Name | Type | Required | Location | Description |
|------------|------|----------|----------|-------------|
| type | string | Yes | Attribute | Always "session" |
| mentorWallet | string | Yes | Attribute | Mentor wallet address (lowercase) |
| learnerWallet | string | Yes | Attribute | Learner wallet address (lowercase) |
| skill | string | Yes | Attribute | Skill name (legacy, kept for backward compatibility) |
| skill_id | string | No | Attribute | Skill entity key (preferred for beta) |
| spaceId | string | Yes | Attribute | Currently "local-dev" |
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

## State Transitions and Who Can Trigger Them

Session state is computed from session entity plus confirmation/rejection entities:

### Initial State: "pending"
- Created when learner requests meeting from offer, or mentor offers to help on ask
- Created by: Learner (from offer) or Mentor (from ask)

### Transition to "scheduled": "confirmed"
- Triggered by: Both mentor and learner must confirm
- Mechanism: Create `session_confirmation` entity with `sessionKey` and `confirmedBy` (mentorWallet or learnerWallet)
- Status computed: If both `session_confirmation` entities exist, status is "scheduled"
- Jitsi URL generated: On first confirmation, `session_jitsi` entity created with room name and join URL

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

