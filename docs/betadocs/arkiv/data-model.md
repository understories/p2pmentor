# Arkiv Data Model

## Core entity types

### user_profile

**Attributes:**
- `type`: 'user_profile'
- `wallet`: Wallet address (lowercase)
- `spaceId`: 'local-dev'

**Payload:**
- `displayName`: Display name
- `bio`: Short bio
- `skills`: Array of skill strings
- `availabilityWindow`: Text description of availability
- `mentorRoles`: Array of mentor role strings

**Notes:**
- Immutable: updates create new entities
- Latest version selected via query filtering by wallet and selecting most recent

### ask

**Attributes:**
- `type`: 'ask'
- `wallet`: Wallet address (lowercase)
- `skill`: Skill name
- `spaceId`: 'local-dev'
- `createdAt`: ISO timestamp
- `status`: 'open'
- `ttlSeconds`: TTL in seconds (default: 3600)

**Payload:**
- `message`: Ask description

**Supporting entity:**
- `ask_txhash`: Transaction hash tracking, linked via `askKey` attribute

### offer

**Attributes:**
- `type`: 'offer'
- `wallet`: Wallet address (lowercase)
- `skill`: Skill name
- `spaceId`: 'local-dev'
- `createdAt`: ISO timestamp
- `status`: 'active'
- `ttlSeconds`: TTL in seconds (default: 7200)

**Payload:**
- `message`: Offer description
- `availabilityWindow`: Availability description

**Supporting entity:**
- `offer_txhash`: Transaction hash tracking, linked via `offerKey` attribute

### session

**Attributes:**
- `type`: 'session'
- `mentorWallet`: Mentor wallet address (lowercase)
- `learnerWallet`: Learner wallet address (lowercase)
- `skill`: Skill name
- `spaceId`: 'local-dev'
- `createdAt`: ISO timestamp

**Payload:**
- `sessionDate`: ISO timestamp when session is/was scheduled
- `duration`: Duration in minutes (default: 60)
- `notes`: Optional notes
- `requiresPayment`: Boolean
- `paymentAddress`: Payment receiving address (if paid)
- `cost`: Cost amount (if paid)

**Supporting entities:**
- `session_txhash`: Transaction hash tracking, linked via `sessionKey`
- `session_confirmation`: Confirmation from mentor or learner, linked via `sessionKey`
- `session_rejection`: Rejection/cancellation, linked via `sessionKey`
- `session_jitsi`: Jitsi room info (name, joinUrl), linked via `sessionKey`
- `session_payment_submission`: Payment txHash from learner, linked via `sessionKey`
- `session_payment_validation`: Payment validation from mentor, linked via `sessionKey`

**Status computation:**
- `pending`: Created but not confirmed by both parties
- `scheduled`: Both parties confirmed
- `in-progress`: Session time has started
- `completed`: Session time has ended
- `cancelled`: Rejected by either party

**Expiration:**
- `sessionDate + duration + 1 hour buffer`

## Supporting entities

### session_feedback

**Attributes:**
- `type`: 'session_feedback'
- `sessionKey`: Session entity key
- `wallet`: Feedback author wallet

**Payload:**
- Feedback data (rating, comments, tags)

### app_feedback

**Attributes:**
- `type`: 'app_feedback'
- `wallet`: Feedback author wallet

**Payload:**
- General UX feedback

### dx_metric

**Attributes:**
- `type`: 'dx_metric'
- Operation name, source ('arkiv' vs 'graphql'), timestamps

**Payload:**
- Performance metrics, pain points, errors

## Query patterns

All queries use Arkiv SDK query builder:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', walletAddress))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

See [`docs/dx_arkiv_runbook.md`](../../../dx_arkiv_runbook.md) for detailed query patterns and examples.
