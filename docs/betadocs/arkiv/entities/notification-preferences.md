# Notification Preferences Entity

## Overview

Stores user notification preferences and read/unread state as Arkiv entities. Allows users to customize their notification experience while staying Arkiv-native. Tracks read/unread state for individual notifications.

**Entity Type:** `notification_preference`
**TTL:** 180 days (`notification_preference` lifetime in `lib/arkiv/schema.ts`)
**Update Pattern:** Pattern B (`replaceArkivEntity` / `patchEntity` with stable entity_key)
**Immutability:** Transactions are immutable, but entity state is mutable via updates

## Attributes

- `type`: `'notification_preference'` (required)
- `wallet`: Wallet address (required, lowercase)
- `notification_id`: Notification ID (e.g., `"meeting_request_sessionKey123"`) (required)
- `notification_type`: Notification type (required)
- `space_id`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) (required)
- `created_at`: `u64` epoch milliseconds (required)
- `updated_at`: `u64` epoch milliseconds (required)

## Payload

```typescript
{
  wallet: string; // Wallet address
  notificationId: string; // Notification ID
  notificationType: NotificationPreferenceType;
  read: boolean; // true = read, false = unread
  archived: boolean; // true = deleted/hidden
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
```

## Notification Types

```typescript
type NotificationPreferenceType =
  | 'meeting_request' // Meeting/session request
  | 'profile_match' // Profile match notification
  | 'ask_offer_match' // Ask/offer match
  | 'new_offer' // New offer available
  | 'admin_response'; // Admin response to feedback
```

## Key Fields

- **wallet**: User wallet address
- **notificationId**: Unique notification identifier
- **notificationType**: Type of notification
- **read**: Read/unread state - `true` for read, `false` for unread
- **archived**: Archived/deleted state - `true` for archived
- **createdAt**: When preference was created
- **updatedAt**: When preference was last updated

## Query Patterns

### Get Preferences for Wallet

```typescript
import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, attrsToRecord, parsePayload } from '@/lib/arkiv/read';

const result = await arkivSelect('notification_preference')
  .where(eqAttr('wallet', walletAddress.toLowerCase()))
  .limit(100)
  .fetch();

const preferences = result.entities.map((e) => ({
  ...attrsToRecord(e),
  ...parsePayload(e),
}));
```

### Get Unread Notifications

```typescript
const result = await fetchAll(arkivSelect('notification_preference')
  .where(eqAttr('wallet', walletAddress.toLowerCase())), 1000);

// Filter client-side
const unread = result.entities
  .map((e) => ({ ...attrsToRecord(e), ...parsePayload(e) }))
  .filter((p) => !p.read && !p.archived);
```

### Get Preference for Notification

```typescript
const result = await arkivSelect('notification_preference')
  .where(eqAttr('wallet', walletAddress.toLowerCase()))
  .where(eqAttr('notification_id', notificationId))
  .limit(1)
  .fetch();

// Get latest version
const preference = result.entities
  .map((e) => ({ ...attrsToRecord(e), ...parsePayload(e) }))
  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
```

## Creation/Update

**Direct Key Updates (Recommended):** For optimal performance and to avoid race conditions, store the preference entity key client-side and pass it for direct updates:

```typescript
import { upsertNotificationPreference } from '@/lib/arkiv/notificationPreferences';
import { getPrefKey, setPrefKey } from '@/lib/notifications/prefKeyStore';

// Get stored preference key (if exists)
const preferenceKey = getPrefKey(spaceId, walletAddress.toLowerCase(), notificationId);

// Update preference
const { key, txHash } = await upsertNotificationPreference({
  wallet: walletAddress,
  notificationId: 'meeting_request_sessionKey123',
  notificationType: 'meeting_request',
  read: false,
  archived: false,
  preferenceKey, // Direct update key (bypasses query-first pattern)
  privateKey: walletClient.account.privateKey,
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});

// Store returned key for future updates
if (key) {
  setPrefKey(spaceId, walletAddress.toLowerCase(), notificationId, key);
}
```

**Legacy Pattern (Fallback):** If `preferenceKey` is not provided, the function falls back to query-first pattern (for older clients).

## Mark as Read

```typescript
// Get current preference
const current = await getNotificationPreference(walletAddress, notificationId);

// Update to read
await upsertNotificationPreference({
  wallet: walletAddress,
  notificationId: notificationId,
  notificationType: current.notificationType,
  read: true,
  archived: current.archived,
  privateKey: userPrivateKey,
});
```

## Archive Notification

```typescript
await upsertNotificationPreference({
  wallet: walletAddress,
  notificationId: notificationId,
  notificationType: notificationType,
  read: true,
  archived: true, // Archive
  privateKey: userPrivateKey,
});
```

## Transaction Hash Tracking

No separate `notification_preference_txhash` entity - transaction hash stored directly in entity metadata.

## Example Use Cases

### Mark Notification as Read

```typescript
async function markAsRead(wallet: string, notificationId: string) {
  const current = await getNotificationPreference(wallet, notificationId);

  if (!current || current.read) {
    return; // Already read or doesn't exist
  }

  await upsertNotificationPreference({
    wallet,
    notificationId,
    notificationType: current.notificationType,
    read: true,
    archived: current.archived,
    privateKey: userPrivateKey,
  });
}
```

### Get Unread Count

```typescript
async function getUnreadCount(wallet: string) {
  const preferences = await getNotificationPreferences(wallet);
  return preferences.filter((p) => !p.read && !p.archived).length;
}
```

## Related Entities

- `session`: For meeting_request notifications
- `app_feedback`: For admin_response notifications
- `user_profile`: For profile_match notifications

## Notes

- **Update Pattern**: Uses Pattern B (`replaceArkivEntity` / `patchEntity` with stable entity_key)
- **Stable Identity**: Entity key is stable per (wallet, notificationId) tuple
- **Direct Key Updates**: Store preference entity keys client-side (localStorage) and pass `preferenceKey` parameter for direct updates, bypassing query-first pattern and eliminating race conditions
- **Full Replacement**: `replaceArkivEntity()` patches with `set` + `unset` so the result replaces all attributes and payload (fetch-merge-write pattern required). Patches do not change expiry, owner or flags.
- **Soft Delete**: Archived notifications are hidden but not deleted
- **Read State**: Tracks read/unread state per notification
- **Transaction History**: All updates create new immutable transactions, preserving full audit trail
- **Race Condition Prevention**: Direct key updates eliminate read-modify-write race conditions that can occur with query-first patterns
