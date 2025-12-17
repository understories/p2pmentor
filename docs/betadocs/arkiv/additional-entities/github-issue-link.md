# GitHub Issue Link Entity

## Overview

Links app feedback entities to GitHub issues. Stores GitHub issue number and URL for tracking. Enables bidirectional linking between user feedback and GitHub issue tracking.

**Entity Type:** `github_issue_link`  
**TTL:** 1 year (31536000 seconds)  
**Immutability:** Immutable - updates create new entities

## Attributes

- `type`: `'github_issue_link'` (required)
- `feedbackKey`: Reference to `app_feedback` entity key (required)
- `spaceId`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) (required)
- `createdAt`: ISO timestamp (required)

## Payload

```typescript
{
  feedbackKey: string;      // Reference to app_feedback entity
  issueNumber: number;      // GitHub issue number
  issueUrl: string;         // Full GitHub issue URL
  repository: string;        // Repository identifier (e.g., "understories/p2pmentor")
  createdAt: string;        // ISO timestamp
}
```

## Key Fields

- **feedbackKey**: Links to the original `app_feedback` entity
- **issueNumber**: GitHub issue number
- **issueUrl**: Full GitHub issue URL
- **repository**: Repository identifier (format: `owner/repo`)

## Query Patterns

### Get Issue Link for Feedback

```typescript
import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient } from "@/lib/arkiv/client";

const publicClient = getPublicClient();
const result = await publicClient.buildQuery()
  .where(eq('type', 'github_issue_link'))
  .where(eq('feedbackKey', feedbackKey))
  .withAttributes(true)
  .withPayload(true)
  .limit(1)
  .fetch();

const link = result.entities[0] 
  ? { ...result.entities[0].attributes, ...JSON.parse(result.entities[0].payload) }
  : null;
```

### Get All Issue Links

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'github_issue_link'))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

const links = result.entities.map(e => ({
  ...e.attributes,
  ...JSON.parse(e.payload)
}));
```

### Get Links by Repository

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'github_issue_link'))
  .withAttributes(true)
  .withPayload(true)
  .limit(1000)
  .fetch();

// Filter client-side by repository
const repoLinks = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .filter(l => l.repository === 'understories/p2pmentor');
```

## Creation

```typescript
import { createGitHubIssueLink } from "@/lib/arkiv/githubIssueLink";
import { getPrivateKey } from "@/lib/config";

const { key, txHash } = await createGitHubIssueLink({
  feedbackKey: "app_feedback:abc123",
  issueNumber: 123,
  issueUrl: "https://github.com/understories/p2pmentor/issues/123",
  repository: "understories/p2pmentor",
  privateKey: getPrivateKey(),
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

## Transaction Hash Tracking

- `github_issue_link_txhash`: Transaction hash tracking, linked via `linkKey` attribute

## Workflow

Typical workflow for linking feedback to GitHub issues:

```typescript
// 1. User submits feedback
const feedback = await createAppFeedback({
  wallet: userWallet,
  page: "/network",
  message: "Network graph is slow",
  feedbackType: "issue",
  privateKey: userPrivateKey,
});

// 2. Admin creates GitHub issue
const githubIssue = await createGitHubIssue({
  title: `[Feedback] Network graph is slow`,
  body: `User feedback: ${feedback.message}\n\nPage: ${feedback.page}\nWallet: ${feedback.wallet}`,
  labels: ['feedback', 'performance'],
});

// 3. Link feedback to issue
await createGitHubIssueLink({
  feedbackKey: feedback.key,
  issueNumber: githubIssue.number,
  issueUrl: githubIssue.html_url,
  repository: "understories/p2pmentor",
  privateKey: adminPrivateKey,
});
```

## Related Entities

- `app_feedback`: Original feedback being linked
- `admin_response`: Admin responses to feedback

## Example Use Case

Admin dashboard workflow:

```typescript
async function linkFeedbackToGitHub(feedbackKey: string) {
  // 1. Get feedback
  const feedback = await getAppFeedback(feedbackKey);
  
  // 2. Create GitHub issue
  const issue = await createGitHubIssue({
    title: `[${feedback.feedbackType}] ${feedback.page}`,
    body: `**Feedback:**\n${feedback.message}\n\n**Page:** ${feedback.page}\n**Wallet:** ${feedback.wallet}`,
    labels: [feedback.feedbackType],
  });
  
  // 3. Create link
  await createGitHubIssueLink({
    feedbackKey: feedback.key,
    issueNumber: issue.number,
    issueUrl: issue.html_url,
    repository: "understories/p2pmentor",
    privateKey: getPrivateKey(),
  });
  
  return issue;
}
```

## Notes

- **One-to-One**: Typically one link per feedback (but multiple links possible)
- **Bidirectional**: Links feedback to GitHub and enables tracking
- **Repository Format**: `owner/repo` format (e.g., `understories/p2pmentor`)
- **URL Format**: Full GitHub issue URL (e.g., `https://github.com/owner/repo/issues/123`)

## Integration

Used in admin dashboard for:
- Creating GitHub issues from user feedback
- Tracking which feedback has been converted to issues
- Linking resolved issues back to feedback

