# Feedback Entity Schema

## Status

- Canonical for p2pmentor: Yes
- Mutability: Pattern A
- Pattern dependencies: PAT-QUERY-001, PAT-REF-001, PAT-SPACE-001

## Entity Type

`session_feedback`

## Field Table

| Field Name          | Type   | Required | Location  | Description                                                                                                |
| ------------------- | ------ | -------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| type                | string | Yes      | Attribute | Always "session_feedback"                                                                                  |
| session_key         | string | Yes      | Attribute | Session entity key                                                                                         |
| mentor_wallet       | addr   | Yes      | Attribute | Mentor wallet address (lowercase)                                                                          |
| learner_wallet      | addr   | Yes      | Attribute | Learner wallet address (lowercase)                                                                         |
| feedback_from       | string | Yes      | Attribute | Wallet address of person giving feedback                                                                   |
| feedback_to         | string | Yes      | Attribute | Wallet address of person receiving feedback                                                                |
| space_id            | string | Yes      | Attribute | Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) |
| created_at          | u64    | Yes      | Attribute | Epoch ms                                                                                              |
| rating              | string | No       | Attribute | Rating 1-5 (stored as string)                                                                              |
| rating              | number | No       | Payload   | Rating 1-5                                                                                                 |
| notes               | string | No       | Payload   | Qualitative feedback text                                                                                  |
| technicalDxFeedback | string | No       | Payload   | Technical developer experience feedback                                                                    |
| createdAt           | string | Yes      | Payload   | ISO timestamp                                                                                              |

## Linking to Sessions and Profiles

### Session Link

- `session_key` attribute: Direct reference to Session entity key
- `mentor_wallet` and `learner_wallet` attributes: Wallet addresses from session
- Validation: `feedback_from` must be either `mentor_wallet` or `learner_wallet`
- Validation: `feedback_to` must be the other participant (not self)

### Profile Link

- `feedback_to` attribute: Wallet address of profile receiving feedback
- Query pattern: Fetch all feedback for a profile by querying `feedback_to` attribute
- Average rating: Calculated on-demand by querying all feedback for wallet and computing mean

Query pattern for profile feedback:

```typescript
const result = await arkivSelect('session_feedback')
  .where(eqAttr('feedback_to', wallet.toLowerCase()))
  .limit(100)
  .fetch();

// Calculate average rating
const ratings = result.entities
  .map((e) => e.payload.rating)
  .filter((r) => r !== undefined && r > 0);
const avgRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0;
```

Implementation: `app/profiles/[wallet]/page.tsx` - Calculates average rating on-demand from feedback entities.

## Validation Rules

1. **Session Participants Only**: `feedback_from` must be either `mentor_wallet` or `learner_wallet`
2. **Cannot Give to Self**: `feedback_from` cannot equal `feedback_to`
3. **Session Must Be Confirmed**: Both `mentorConfirmed` and `learnerConfirmed` must be true
4. **Session Status**: Session status must be "scheduled", "in-progress", or "completed" (not "pending" or "cancelled")
5. **No Duplicate Feedback**: User cannot give feedback twice for same session (checked via `hasUserGivenFeedbackForSession()`)

Implementation: `lib/arkiv/feedback.ts` - `createFeedback()` validates all rules before creating entity.

## Query Pattern

Fetch feedback for a session:

```typescript
const result = await arkivSelect('session_feedback')
  .where(eqAttr('session_key', sessionKey))
  .limit(10)
  .fetch();
```

Fetch feedback received by a profile:

```typescript
const result = await arkivSelect('session_feedback')
  .where(eqAttr('feedback_to', wallet.toLowerCase()))
  .limit(100)
  .fetch();
```

Implementation: `lib/arkiv/feedback.ts` - `listFeedbackForSession()`, `listFeedbackForWallet()`

## Expiration

Feedback entities use the default lifetime from `lib/arkiv/schema.ts` (180 days).

## Entity Relationships

- Links to Session entity via `session_key` attribute
- Links to Profile entities via `feedback_to` and `feedback_from` attributes (wallet addresses)
