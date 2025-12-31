# Notification Entity

## Overview

The `notification` entity type stores notifications as first-class Arkiv entities. Notifications are created server-side when events occur (e.g., meeting requests, admin responses) and queried directly from Arkiv, replacing client-side detection with an Arkiv-native approach.

## Entity Type

```
type: 'notification'
```

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | Yes | Always `'notification'` |
| `wallet` | string | Yes | Recipient wallet address (lowercase) |
| `notificationType` | string | Yes | Type of notification: `'meeting_request'`, `'profile_match'`, `'ask_offer_match'`, `'new_offer'`, `'admin_response'`, `'issue_resolved'`, `'app_feedback_submitted'` |
| `sourceEntityType` | string | Yes | Type of source entity: `'session'`, `'ask'`, `'offer'`, `'user_profile'`, `'admin_response'`, `'app_feedback'` |
| `sourceEntityKey` | string | Yes | Key of the source entity that triggered this notification |
| `status` | string | Yes | `'active'` or `'archived'` (for soft delete) |
| `spaceId` | string | Yes | Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) |
| `createdAt` | string | Yes | ISO timestamp when notification was created |

## Payload

The payload is a JSON object with the following structure:

```typescript
{
  title: string;           // Notification title
  message: string;          // Notification message
  link?: string;           // Optional link (e.g., '/me/sessions')
  metadata?: {             // Optional metadata
    [key: string]: any;    // Additional context (e.g., sessionKey, skill, etc.)
  };
}
```

## Related Entities

- **`notification_txhash`**: Stores transaction hash for reliable querying
  - Attributes: `type: 'notification_txhash'`, `notificationKey`, `wallet`, `spaceId`
  - Payload: `{ txHash: string }`

- **`notification_preference`**: Stores read/unread/archived state
  - See [notification-preferences.md](./notification-preferences.md)

## Query Patterns

### List all notifications for a wallet

```typescript
import { listNotifications } from '@/lib/arkiv/notifications';

const notifications = await listNotifications({
  wallet: userWallet,
  status: 'active', // Exclude archived
  limit: 100,
});
```

### Filter by notification type

```typescript
const meetingRequests = await listNotifications({
  wallet: userWallet,
  notificationType: 'meeting_request',
  status: 'active',
});
```

### Filter by source entity type

```typescript
const sessionNotifications = await listNotifications({
  wallet: userWallet,
  sourceEntityType: 'session',
  status: 'active',
});
```

## Creation Examples

### Meeting Request Notification

Created when a session is created:

```typescript
import { createNotification } from '@/lib/arkiv/notifications';

await createNotification({
  wallet: mentorWallet.toLowerCase(),
  notificationType: 'meeting_request',
  sourceEntityType: 'session',
  sourceEntityKey: sessionKey,
  title: 'New Meeting Request',
  message: `You have a new meeting request for ${skill}`,
  link: '/me/sessions',
  metadata: {
    sessionKey,
    skill,
    skill_id: skill_id || undefined,
    otherWallet: learnerWallet.toLowerCase(),
  },
  privateKey: getPrivateKey(),
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

### Admin Response Notification

Created when an admin responds to user feedback:

```typescript
await createNotification({
  wallet: userWallet.toLowerCase(),
  notificationType: 'admin_response',
  sourceEntityType: 'admin_response',
  sourceEntityKey: responseKey,
  title: 'Admin Response',
  message: message.trim().length > 100 
    ? message.trim().substring(0, 100) + '...' 
    : message.trim(),
  link: '/notifications',
  metadata: {
    feedbackKey,
    responseKey,
    adminWallet: adminWallet.toLowerCase(),
  },
  privateKey: getPrivateKey(),
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

### App Feedback Submitted Notification

Created when a user submits feedback or reports an issue:

```typescript
import { privateKeyToAccount } from '@arkiv-network/sdk/accounts';

const adminWallet = privateKeyToAccount(getPrivateKey()).address.toLowerCase();

await createNotification({
  wallet: adminWallet, // Use signing wallet as admin/system wallet
  notificationType: 'app_feedback_submitted',
  sourceEntityType: 'app_feedback',
  sourceEntityKey: feedbackKey,
  title: feedbackType === 'issue' ? 'New Issue Reported' : 'New Feedback Submitted',
  message: message.trim().length > 100 
    ? message.trim().substring(0, 100) + '...' 
    : message.trim() || `Rating: ${rating}/5`,
  link: '/admin/feedback',
  metadata: {
    feedbackKey,
    userWallet: wallet.toLowerCase(),
    page,
    message: message || undefined,
    rating: rating || undefined,
    feedbackType,
    createdAt,
    txHash,
  },
  privateKey: getPrivateKey(),
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

### Issue Resolved Notification

Created when an app feedback issue is marked as resolved:

```typescript
await createNotification({
  wallet: userWallet.toLowerCase(),
  notificationType: 'issue_resolved',
  sourceEntityType: 'app_feedback',
  sourceEntityKey: feedbackKey,
  title: 'Issue Resolved',
  message: 'Your reported issue has been resolved',
  link: '/notifications',
  metadata: {
    feedbackKey,
    resolutionKey,
    resolvedBy: resolvedByWallet.toLowerCase(),
  },
  privateKey: getPrivateKey(),
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

## Notification Types

| Type | Description | Source Entity | When Created |
|------|-------------|--------------|--------------|
| `meeting_request` | New session/meeting request | `session` | When session is created with status='pending' |
| `profile_match` | Profile match found | `user_profile` | When new profile matches user's interests (future) |
| `ask_offer_match` | Ask/offer match found | `ask` or `offer` | When ask/offer matches user's asks/offers (future) |
| `new_offer` | New offer available | `offer` | When new offer is created (future) |
| `admin_response` | Admin responded to feedback | `admin_response` | When admin_response entity is created |
| `app_feedback_submitted` | User submitted feedback/issue | `app_feedback` | When app_feedback entity is created |
| `issue_resolved` | Reported issue resolved | `app_feedback` | When app_feedback is marked as resolved |

## Archiving (Soft Delete)

Notifications are archived by creating a new entity with `status='archived'`:

```typescript
import { archiveNotification } from '@/lib/arkiv/notifications';

await archiveNotification({
  notificationKey: notificationKey,
  wallet: userWallet,
  privateKey: getPrivateKey(),
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

## Read/Unread State

Read/unread state is stored separately in `notification_preference` entities, not in the notification entity itself. This allows multiple users to have different read states for the same notification (if shared) and follows the separation of concerns principle.

See [Notification Preferences](/docs/arkiv/entities/notification-preferences) for details.

## TTL (Time To Live)

Notifications use a 1-year TTL (31536000 seconds) for beta. This effectively makes them permanent for the beta period.

## Best Practices

1. **Create notifications server-side**: Always create notifications in API routes or server-side functions, never client-side
2. **Use server signing wallet**: All notification creation uses the server-side `ARKIV_PRIVATE_KEY`
3. **Include metadata**: Store relevant context in `metadata` for easy access without additional queries
4. **Link to relevant pages**: Always provide a `link` attribute to direct users to the relevant page
5. **Query with preferences**: When displaying notifications, query preferences separately and merge for read/unread state
6. **Archive, don't delete**: Use `archiveNotification()` for soft delete, maintaining audit trail

## Migration from Client-Side Detection

The Arkiv-native notification system replaces the previous client-side detection approach:

**Before (Client-Side Detection)**:
- Notifications detected client-side from raw data (sessions, asks, offers)
- Detection logic runs on every poll
- Refs stored in memory (lost on remount)
- Read state stored in `notification_preference` entities

**After (Arkiv-Native)**:
- Notifications created server-side when events occur
- Notifications queried directly from Arkiv entities
- No client-side detection logic needed
- Read state still stored in `notification_preference` entities
- Persistent across page reloads
- Fully queryable and filterable

## Implementation Files

- **CRUD Helpers**: `lib/arkiv/notifications.ts`
- **API Route**: `app/api/notifications/route.ts`
- **Client Component**: `app/notifications/page.tsx`
- **Notification Creation**: Integrated into entity creation flows:
  - `lib/arkiv/sessions.ts` (meeting requests)
  - `lib/arkiv/adminResponse.ts` (admin responses)
  - `lib/arkiv/appFeedback.ts` (feedback submissions and issue resolutions)

