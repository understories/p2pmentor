# Admin Notification Entity Architecture

## Overview

The `admin_notification` entity provides a notification system for administrators, allowing the platform to notify admins about important events (feedback responses, issue resolutions, system alerts).

## Entity Design

### Pattern: Update in Place (Pattern B)

- **Entity Type**: `admin_notification`
- **Update Pattern**: Pattern B (stable entity_key, update in place)
- **Key Derivation**: `admin_notification:{wallet}:{notificationId}`
- **State Management**: Uses `read` and `archived` boolean flags

### Entity Structure

```typescript
{
  type: 'admin_notification',
  wallet: string,              // Admin wallet (normalized)
  notificationId: string,       // Unique notification ID
  notificationType: 'feedback_response' | 'issue_resolved' | 'system_alert',
  title: string,
  message: string,
  link?: string,
  sourceEntityType?: string,    // e.g., 'app_feedback'
  sourceEntityKey?: string,     // Link to source entity
  read: boolean,                // Read/unread state
  archived: boolean,             // Archived/deleted state
  metadata?: Record<string, any>,
  spaceId: string,
  createdAt: string,
  updatedAt: string
}
```

## Admin Wallet Architecture

### Current State (Problem)

Currently, admin operations use:
- **Admin Wallet**: `localStorage.getItem('wallet_address') || 'admin'` (user's profile wallet)
- **Signing Wallet**: `ARKIV_PRIVATE_KEY` (server-side, for transaction signing)

**Issues:**
1. Admin wallet is tied to the logged-in user's profile wallet
2. Multiple admins would see different notifications (or miss notifications)
3. No consistent admin identity across sessions
4. Notifications are wallet-specific, so they won't aggregate properly

### Recommended Solution: Dedicated Admin Wallet

**Use a dedicated admin wallet address stored in environment variables:**

```typescript
// lib/config.ts
export const ADMIN_WALLET_ADDRESS = process.env.ADMIN_WALLET_ADDRESS as `0x${string}` | undefined;

// Default to signing wallet address if not set (backward compatible)
export const ADMIN_WALLET = ADMIN_WALLET_ADDRESS || 
  (ARKIV_PRIVATE_KEY ? privateKeyToAccount(ARKIV_PRIVATE_KEY).address : undefined);
```

**Benefits:**
1. **Consistent Identity**: All admins see the same notifications
2. **Separation of Concerns**: Admin identity separate from user profile wallets
3. **Auditability**: All admin actions tied to one wallet address
4. **Scalability**: Multiple admins can use the dashboard, all tied to same admin wallet

## How It Works

### 1. Creating Notifications

When an admin action occurs (e.g., responding to feedback), create a notification:

```typescript
import { createAdminNotification } from '@/lib/arkiv/adminNotification';
import { ADMIN_WALLET, getPrivateKey } from '@/lib/config';

await createAdminNotification({
  wallet: ADMIN_WALLET,  // Dedicated admin wallet
  notificationId: `feedback_response_${feedbackKey}_${Date.now()}`,
  notificationType: 'feedback_response',
  title: 'Response Sent',
  message: `You responded to feedback from ${userWallet}`,
  link: `/admin/feedback?feedbackKey=${feedbackKey}`,
  sourceEntityType: 'app_feedback',
  sourceEntityKey: feedbackKey,
  privateKey: getPrivateKey(),  // Server-side signing wallet
});
```

### 2. Querying Notifications

Query all notifications for the admin wallet:

```typescript
import { listAdminNotifications } from '@/lib/arkiv/adminNotification';
import { ADMIN_WALLET } from '@/lib/config';

const notifications = await listAdminNotifications({
  wallet: ADMIN_WALLET,
  includeArchived: false,  // Only show active notifications
});
```

### 3. Updating Notification State

Mark as read or archive:

```typescript
import { updateAdminNotificationState } from '@/lib/arkiv/adminNotification';
import { ADMIN_WALLET, getPrivateKey } from '@/lib/config';

// Mark as read
await updateAdminNotificationState({
  wallet: ADMIN_WALLET,
  notificationId: notificationId,
  read: true,
  privateKey: getPrivateKey(),
});

// Archive
await updateAdminNotificationState({
  wallet: ADMIN_WALLET,
  notificationId: notificationId,
  archived: true,
  privateKey: getPrivateKey(),
});
```

## Admin Dashboard Integration

### API Route: `/api/admin/notifications`

```typescript
// app/api/admin/notifications/route.ts
import { listAdminNotifications } from '@/lib/arkiv/adminNotification';
import { ADMIN_WALLET } from '@/lib/config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get('includeArchived') === 'true';
  
  const notifications = await listAdminNotifications({
    wallet: ADMIN_WALLET,
    includeArchived,
  });
  
  return NextResponse.json({ ok: true, notifications });
}
```

### Dashboard Component

Add a notifications section to `/app/admin/page.tsx`:

```typescript
const [notifications, setNotifications] = useState<AdminNotification[]>([]);
const [unreadCount, setUnreadCount] = useState(0);

useEffect(() => {
  const loadNotifications = async () => {
    const res = await fetch('/api/admin/notifications?includeArchived=false');
    const data = await res.json();
    if (data.ok) {
      setNotifications(data.notifications);
      setUnreadCount(data.notifications.filter((n: AdminNotification) => !n.read).length);
    }
  };
  loadNotifications();
}, []);
```

## Environment Variables

Add to `.env`:

```bash
# Admin wallet address (public address, not private key)
# This is the wallet address used for admin notifications and identity
# Defaults to the address derived from ARKIV_PRIVATE_KEY if not set
ADMIN_WALLET_ADDRESS=0x...

# Admin password (existing)
ADMIN_PASSWORD=...

# Signing wallet private key (existing)
ARKIV_PRIVATE_KEY=0x...
```

## Security Considerations

1. **Admin Wallet vs Signing Wallet**:
   - **Admin Wallet** (`ADMIN_WALLET_ADDRESS`): Public address, used for identity/notifications
   - **Signing Wallet** (`ARKIV_PRIVATE_KEY`): Private key, used for transaction signing
   - These can be the same wallet (default), or separate for better security

2. **Access Control**:
   - Admin dashboard still requires `ADMIN_PASSWORD`
   - Notifications are queryable by wallet address (public data)
   - Only server-side code can create/update notifications (requires private key)

3. **Multi-Admin Support**:
   - All admins share the same `ADMIN_WALLET_ADDRESS`
   - All see the same notifications
   - Password-based auth controls dashboard access
   - For production, consider passkey/wallet allowlist for individual admin identities

## Migration Path

1. **Phase 1**: Add `ADMIN_WALLET_ADDRESS` env var (optional, defaults to signing wallet)
2. **Phase 2**: Update admin operations to use `ADMIN_WALLET` instead of `localStorage.getItem('wallet_address')`
3. **Phase 3**: Create notifications when admin actions occur
4. **Phase 4**: Add notifications UI to admin dashboard

## Example Use Cases

### Feedback Response Notification

```typescript
// After admin responds to feedback
await createAdminNotification({
  wallet: ADMIN_WALLET,
  notificationId: `feedback_response_${feedbackKey}`,
  notificationType: 'feedback_response',
  title: 'Response Sent',
  message: `You responded to feedback from ${userWallet}`,
  link: `/admin/feedback?feedbackKey=${feedbackKey}`,
  sourceEntityType: 'app_feedback',
  sourceEntityKey: feedbackKey,
  privateKey: getPrivateKey(),
});
```

### Issue Resolution Notification

```typescript
// After admin resolves an issue
await createAdminNotification({
  wallet: ADMIN_WALLET,
  notificationId: `issue_resolved_${feedbackKey}`,
  notificationType: 'issue_resolved',
  title: 'Issue Resolved',
  message: `You resolved issue: ${feedback.message.slice(0, 50)}...`,
  link: `/admin/feedback?feedbackKey=${feedbackKey}`,
  sourceEntityType: 'app_feedback',
  sourceEntityKey: feedbackKey,
  privateKey: getPrivateKey(),
});
```

