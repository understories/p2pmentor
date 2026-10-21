# App Feedback Entity

## Overview

User feedback about the application itself (for builders/admin). Separate from session feedback (peer-to-peer). Allows users to report issues, provide general feedback, and rate their experience.

**Entity Type:** `app_feedback`  
**TTL:** 90 days (`app_feedback` lifetime in `lib/arkiv/schema.ts`)  
**Immutability:** Immutable - updates create new entities. Created with the `readonly` flag, so it can never be patched

## Attributes

- `type`: `'app_feedback'` (required)
- `wallet`: Wallet address of feedback author (required, lowercase)
- `page`: Page where feedback was given (e.g., `/network`, `/me`) (required)
- `feedback_type`: `'feedback'` | `'issue'` (required)
- `rating`: Rating 1-5 (optional, stored as string)
- `space_id`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) (required)
- `created_at`: `u64` epoch milliseconds (required)

## Payload

```typescript
{
  message: string;          // Feedback message (required if no rating)
  rating?: number;          // Rating 1-5 (optional, required if no message)
  createdAt: string;        // ISO timestamp
}
```

## Key Fields

- **wallet**: User wallet submitting feedback
- **page**: Page path where feedback was given (e.g., `/network`, `/me/profile`)
- **message**: Feedback text (required if no rating provided)
- **rating**: 1-5 star rating (optional, required if no message)
- **feedbackType**: `'feedback'` for general feedback, `'issue'` for bug reports
- **createdAt**: When feedback was submitted

## Validation

- Either `message` OR `rating` must be provided (at least one)
- If `rating` is provided, must be between 1 and 5
- `message` must be non-empty if provided

## Query Patterns

### Get All Feedback

```typescript
import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, attrsToRecord, parsePayload } from '@/lib/arkiv/read';

const result = await arkivSelect('app_feedback')
  .limit(100)
  .fetch();
```

### Filter by Page

```typescript
const result = await arkivSelect('app_feedback')
  .where(eqAttr('page', '/network'))
  .limit(100)
  .fetch();
```

### Filter by Feedback Type

```typescript
const result = await arkivSelect('app_feedback')
  .where(eqAttr('feedback_type', 'issue'))
  .limit(100)
  .fetch();
```

### Filter by Wallet

```typescript
const result = await arkivSelect('app_feedback')
  .where(eqAttr('wallet', walletAddress.toLowerCase()))
  .limit(100)
  .fetch();
```

### Filter by Date Range

```typescript
// Get feedback since a date
const since = '2024-01-01T00:00:00Z';
const result = await arkivSelect('app_feedback')
  .limit(100)
  .fetch();

// Filter client-side
const feedbacks = result.entities
  .map((e) => ({ ...attrsToRecord(e), ...parsePayload(e) }))
  .filter((f) => new Date(f.createdAt) >= new Date(since))
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
```

## Creation

```typescript
import { createAppFeedback } from '@/lib/arkiv/appFeedback';
import { getWalletClientFromPrivateKey } from '@/lib/arkiv/client';

const walletClient = getWalletClientFromPrivateKey(privateKey);
const { key, txHash } = await createAppFeedback({
  wallet: '0x1234...',
  page: '/network',
  message: 'The network graph is slow to load',
  rating: 3,
  feedbackType: 'issue',
  privateKey: privateKey,
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

## Resolution Tracking

App feedback can be resolved via separate resolution entities:

```typescript
import { resolveAppFeedback } from '@/lib/arkiv/appFeedback';

const { key, txHash } = await resolveAppFeedback({
  feedbackKey: 'app_feedback:abc123',
  resolvedByWallet: '0xadmin...',
  privateKey: getPrivateKey(),
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

Resolution creates a separate entity that marks the feedback as resolved. Query for resolution status:

```typescript
// Check if feedback is resolved
const resolutionResult = await arkivSelect('app_feedback_resolution')
  .where(eqAttr('feedback_key', feedbackKey))
  .limit(1)
  .fetch();

const isResolved = resolutionResult.entities.length > 0;
```

## Transaction Hash Tracking

- `app_feedback_txhash`: Transaction hash tracking, linked via `feedback_key` attribute

## Related Entities

- `admin_response`: Admin responses to feedback
- `github_issue_link`: Links feedback to GitHub issues
- `app_feedback_resolution`: Marks feedback as resolved

## Example Use Cases

### User Reports Issue

```typescript
const feedback = await createAppFeedback({
  wallet: userWallet,
  page: '/network',
  message: 'The network graph takes 5 seconds to load',
  feedbackType: 'issue',
  privateKey: userPrivateKey,
});
```

### User Provides Rating

```typescript
const feedback = await createAppFeedback({
  wallet: userWallet,
  page: '/me',
  rating: 5,
  feedbackType: 'feedback',
  privateKey: userPrivateKey,
});
```

### Admin Resolves Issue

```typescript
// Mark as resolved
await resolveAppFeedback({
  feedbackKey: feedback.key,
  resolvedByWallet: adminWallet,
  privateKey: adminPrivateKey,
});
```

## Notes

- **Privacy**: Feedback is public on-chain (wallet addresses visible)
- **Immutability**: Cannot edit or delete feedback once created
- **Resolution**: Separate resolution entities track resolution status
- **GitHub Integration**: Can be linked to GitHub issues via `github_issue_link` entity
