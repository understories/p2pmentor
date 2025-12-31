# Feedback Entity Schema

## Status
- Canonical for p2pmentor: Yes
- Mutability: Pattern A
- Pattern dependencies: PAT-QUERY-001, PAT-REF-001, PAT-SPACE-001

## Entity Type
`session_feedback`

## Field Table

| Field Name | Type | Required | Location | Description |
|------------|------|----------|----------|-------------|
| type | string | Yes | Attribute | Always "session_feedback" |
| sessionKey | string | Yes | Attribute | Session entity key |
| mentorWallet | string | Yes | Attribute | Mentor wallet address (lowercase) |
| learnerWallet | string | Yes | Attribute | Learner wallet address (lowercase) |
| feedbackFrom | string | Yes | Attribute | Wallet address of person giving feedback |
| feedbackTo | string | Yes | Attribute | Wallet address of person receiving feedback |
| spaceId | string | Yes | Attribute | Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) |
| createdAt | string | Yes | Attribute | ISO timestamp |
| rating | string | No | Attribute | Rating 1-5 (stored as string) |
| rating | number | No | Payload | Rating 1-5 |
| notes | string | No | Payload | Qualitative feedback text |
| technicalDxFeedback | string | No | Payload | Technical developer experience feedback |
| createdAt | string | Yes | Payload | ISO timestamp |

## Linking to Sessions and Profiles

### Session Link
- `sessionKey` attribute: Direct reference to Session entity key
- `mentorWallet` and `learnerWallet` attributes: Wallet addresses from session
- Validation: `feedbackFrom` must be either `mentorWallet` or `learnerWallet`
- Validation: `feedbackTo` must be the other participant (not self)

### Profile Link
- `feedbackTo` attribute: Wallet address of profile receiving feedback
- Query pattern: Fetch all feedback for a profile by querying `feedbackTo` attribute
- Average rating: Calculated on-demand by querying all feedback for wallet and computing mean

Query pattern for profile feedback:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'session_feedback'))
  .where(eq('feedbackTo', wallet.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

// Calculate average rating
const ratings = result.entities
  .map(e => e.payload.rating)
  .filter(r => r !== undefined && r > 0);
const avgRating = ratings.length > 0
  ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
  : 0;
```

Implementation: `app/profiles/[wallet]/page.tsx` - Calculates average rating on-demand from feedback entities.

## Validation Rules

1. **Session Participants Only**: `feedbackFrom` must be either `mentorWallet` or `learnerWallet`
2. **Cannot Give to Self**: `feedbackFrom` cannot equal `feedbackTo`
3. **Session Must Be Confirmed**: Both `mentorConfirmed` and `learnerConfirmed` must be true
4. **Session Status**: Session status must be "scheduled", "in-progress", or "completed" (not "pending" or "cancelled")
5. **No Duplicate Feedback**: User cannot give feedback twice for same session (checked via `hasUserGivenFeedbackForSession()`)

Implementation: `lib/arkiv/feedback.ts` - `createFeedback()` validates all rules before creating entity.

## Query Pattern

Fetch feedback for a session:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'session_feedback'))
  .where(eq('sessionKey', sessionKey))
  .withAttributes(true)
  .withPayload(true)
  .limit(10)
  .fetch();
```

Fetch feedback received by a profile:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'session_feedback'))
  .where(eq('feedbackTo', wallet.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

Implementation: `lib/arkiv/feedback.ts` - `listFeedbackForSession()`, `listFeedbackForWallet()`

## Expiration

Feedback entities expire after 1 year (31536000 seconds). This is effectively permanent for beta, as feedback is historical data.

## Entity Relationships

- Links to Session entity via `sessionKey` attribute
- Links to Profile entities via `feedbackTo` and `feedbackFrom` attributes (wallet addresses)

