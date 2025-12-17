# Admin Response Entity

## Overview

Admin responses to user app feedback. Allows administrators to respond to user feedback and issues, creating a communication channel between users and builders.

**Entity Type:** `admin_response`  
**TTL:** 1 year (31536000 seconds)  
**Immutability:** Immutable - updates create new entities

## Attributes

- `type`: `'admin_response'` (required)
- `feedbackKey`: Reference to `app_feedback` entity key (required)
- `wallet`: Wallet address of user who gave feedback (required, lowercase)
- `adminWallet`: Wallet address of admin responding (required, lowercase)
- `spaceId`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) (required)
- `createdAt`: ISO timestamp (required)

## Payload

```typescript
{
  feedbackKey: string;      // Reference to app_feedback entity
  wallet: string;           // User wallet who gave feedback
  message: string;          // Admin's response message
  adminWallet: string;      // Admin wallet responding
  createdAt: string;        // ISO timestamp
}
```

## Key Fields

- **feedbackKey**: Links to the original `app_feedback` entity
- **wallet**: User wallet who submitted the feedback
- **message**: Admin's response text (required, non-empty)
- **adminWallet**: Admin wallet address responding
- **createdAt**: When the response was created

## Query Patterns

### Get All Responses for Feedback

```typescript
import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient } from "@/lib/arkiv/client";

const publicClient = getPublicClient();
const result = await publicClient.buildQuery()
  .where(eq('type', 'admin_response'))
  .where(eq('feedbackKey', feedbackKey))
  .withAttributes(true)
  .withPayload(true)
  .limit(10)
  .fetch();

// Sort by createdAt descending to get most recent first
const responses = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
```

### Check if Feedback Has Response

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'admin_response'))
  .where(eq('feedbackKey', feedbackKey))
  .withAttributes(true)
  .limit(1)
  .fetch();

const hasResponse = result.entities.length > 0;
```

## Creation

```typescript
import { createAdminResponse } from "@/lib/arkiv/adminResponse";
import { getPrivateKey } from "@/lib/config";

const { key, txHash } = await createAdminResponse({
  feedbackKey: "app_feedback:abc123",
  wallet: "0x1234...",
  message: "Thank you for the feedback! We're working on this.",
  adminWallet: "0xadmin...",
  privateKey: getPrivateKey(),
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

## Transaction Hash Tracking

- `admin_response_txhash`: Transaction hash tracking, linked via `responseKey` attribute

## Notes

- **One-to-many**: Multiple admin responses can exist for a single feedback
- **Latest response**: Query and sort by `createdAt` descending to get most recent
- **Validation**: Message must be non-empty
- **Notifications**: Admin responses can trigger notifications to users (implementation-specific)

## Related Entities

- `app_feedback`: Original feedback being responded to
- `github_issue_link`: Links feedback to GitHub issues

## Example Use Case

User submits feedback about slow network graph. Admin responds:

```typescript
// User feedback
const feedback = {
  key: "app_feedback:abc123",
  wallet: "0xuser...",
  page: "/network",
  message: "The network graph is slow to load",
  feedbackType: "issue"
};

// Admin response
const response = await createAdminResponse({
  feedbackKey: feedback.key,
  wallet: feedback.wallet,
  message: "Thank you for reporting this! We've identified the issue and are working on a fix. Expect improvements in the next release.",
  adminWallet: "0xadmin...",
  privateKey: getPrivateKey(),
});
```

