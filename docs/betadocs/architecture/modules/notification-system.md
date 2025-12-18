# Arkiv-Native Notification System

## Overview

This document explains how we implement notifications with blockchain data for read/unread states in a serverless, decentralized architecture. This is a novel approach that we're solving together, building from day 1 with Arkiv as the decentralized database.

**Key Challenge:** Managing read/unread state in a decentralized, serverless environment where there's no centralized database to track user preferences.

**Solution:** Store notification preferences as Arkiv entities, using the immutable entity pattern to track state changes over time.

## Architecture

### Core Components

1. **Notification Entities** (`notification`)
   - Created by the system when events occur (meeting requests, feedback, etc.)
   - Immutable - each notification is a separate entity
   - Contains: type, wallet, source entity reference, message, metadata

2. **Notification Preference Entities** (`notification_preference`)
   - Created/updated by users to track read/unread state
   - Immutable updates - each state change creates a new entity
   - Contains: wallet, notificationId, read status, archived status
   - TTL: 1 year (31536000 seconds)

3. **Client-Side State Management**
   - Optimistic UI updates for immediate feedback
   - Ref-based state to prevent race conditions
   - Event-driven synchronization between components

## Entity Structure

### Notification Entity

```typescript
type Notification = {
  key: string;                    // Entity key
  wallet: string;                 // Recipient wallet
  type: NotificationType;         // Type of notification
  title: string;                  // Display title
  message: string;                // Display message
  sourceEntityType: string;       // e.g., 'session', 'app_feedback'
  sourceEntityKey: string;        // Reference to source entity
  link?: string;                  // Optional link to related page
  metadata?: Record<string, any>; // Additional context
  createdAt: string;              // ISO timestamp
  txHash?: string;               // Transaction hash
};
```

### Notification Preference Entity

```typescript
type NotificationPreference = {
  key: string;                    // Entity key
  wallet: string;                 // User wallet
  notificationId: string;         // Notification ID (e.g., "meeting_request_sessionKey123")
  notificationType: NotificationPreferenceType;
  read: boolean;                  // true = read, false = unread
  archived: boolean;             // true = deleted/hidden
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  txHash?: string;               // Transaction hash
};
```

## Read/Unread State Management

### The Challenge

In a centralized system, read/unread state is simple:
- User clicks notification → Update database row → Done

In a decentralized system:
- No centralized database
- State must be stored on-chain (Arkiv)
- Each state change creates a new entity (immutability)
- Need to query latest state efficiently
- Need to handle race conditions and optimistic updates

### Our Solution

**1. Immutable Update Pattern**

When a user marks a notification as read/unread:
- Query existing preference entities for that notificationId
- Find the most recent one (by `updatedAt`)
- Create a NEW entity with updated state
- Old entities remain (for history/audit)

**2. Query Pattern**

To get current state:
```typescript
// Query all preferences for wallet
const preferences = await listNotificationPreferences({ wallet });

// Deduplicate by notificationId, keeping most recent
const preferenceMap = new Map<string, NotificationPreference>();
preferences.forEach(pref => {
  const existing = preferenceMap.get(pref.notificationId);
  if (!existing || 
      new Date(pref.updatedAt).getTime() > 
      new Date(existing.updatedAt).getTime()) {
    preferenceMap.set(pref.notificationId, pref);
  }
});
```

**3. Client-Side State Management**

```typescript
// Use ref to store preferences (source of truth)
const notificationPreferences = useRef<Map<string, { read: boolean; archived: boolean }>>(new Map());

// Flag to prevent reloads during save operations
const isSavingPreferences = useRef<boolean>(false);

// Optimistic update pattern
const markAsRead = async (notificationId: string) => {
  // 1. Set save flag (prevents reloads)
  isSavingPreferences.current = true;
  
  // 2. Optimistic UI update
  setNotifications(prev => prev.map(n => 
    n.id === notificationId ? { ...n, read: true } : n
  ));
  
  // 3. Update ref immediately (source of truth)
  notificationPreferences.current.set(notificationId, { read: true, archived: false });
  
  // 4. Persist to Arkiv
  try {
    await fetch('/api/notifications/preferences', {
      method: 'POST',
      body: JSON.stringify({ wallet, notificationId, read: true })
    });
    
    // 5. Dispatch event to sync other components
    window.dispatchEvent(new CustomEvent('notification-preferences-updated'));
  } catch (err) {
    // Revert on error
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, read: false } : n
    ));
    notificationPreferences.current.set(notificationId, { read: false, archived: false });
  } finally {
    isSavingPreferences.current = false;
  }
};
```

## Synchronization Between Components

### The Problem

- Notifications page updates read/unread state
- Navbar badge needs to reflect the same count
- Both query from Arkiv, but timing can cause mismatches

### The Solution

**Event-Driven Synchronization:**

1. **Notifications Page** dispatches events when preferences change:
```typescript
// Wait for Arkiv to index preference updates before dispatching event
const indexingDelay = Math.max(1500, 500 + (unreadNotifications.length * 200));
await new Promise(resolve => setTimeout(resolve, indexingDelay));

window.dispatchEvent(new CustomEvent('notification-preferences-updated', {
  detail: { 
    wallet: userWallet,
    delay: indexingDelay, // Pass delay so sidebar knows to wait before querying
  }
}));
```

2. **Navbar Hook** listens for events and refreshes:
```typescript
useEffect(() => {
  const handlePreferenceUpdate = (event: Event) => {
    const customEvent = event as CustomEvent<{ wallet?: string; delay?: number }>;
    const currentWallet = localStorage.getItem('wallet_address')?.toLowerCase().trim();
    
    // Only refresh if update is for current wallet
    if (!customEvent.detail.wallet || 
        customEvent.detail.wallet.toLowerCase().trim() === currentWallet) {
      // Add delay to ensure Arkiv has indexed the preference updates
      // Use delay from event detail if provided, otherwise default to 500ms
      const delay = customEvent.detail.delay || 500;
      setTimeout(() => {
        loadCount(); // Refresh count after delay
      }, delay);
    }
  };
  
  window.addEventListener('notification-preferences-updated', handlePreferenceUpdate);
  return () => window.removeEventListener('notification-preferences-updated', handlePreferenceUpdate);
}, []);
```

3. **Polling as Fallback:**
- Still poll every 30 seconds for external changes
- Event-driven updates provide immediate synchronization

## Expected and Found Issues

### Issue 1: Race Conditions During Save Operations

**Problem:** When marking notifications as read/unread, a re-render (e.g., theme toggle) could trigger `loadNotificationPreferences`, which would fetch stale data from Arkiv and overwrite optimistic updates.

**Solution:** Introduced `isSavingPreferences` ref flag. `loadNotificationPreferences` checks this flag and returns early if a save is in progress.

```typescript
const loadNotificationPreferences = async (wallet: string) => {
  if (isSavingPreferences.current) {
    return; // Don't reload during active save
  }
  // ... load from Arkiv
};
```

**Status:** ✅ Solved

### Issue 2: Navbar Count Not Updating After Bulk Operations

**Problem:** When clicking "Mark all as read" or "Mark all as unread" on the notifications page, the page count updated but the navbar badge didn't update until the next poll (30 seconds).

**Solution:** Added event-driven synchronization. When preferences are updated, dispatch a custom event that the navbar hook listens to and immediately refreshes.

**Status:** ✅ Solved

**Update (2025-01-XX):** Enhanced event-driven synchronization to handle Arkiv indexing delays. The event now includes a `delay` parameter that tells the sidebar hook to wait before querying Arkiv, ensuring all preference updates are indexed before the count is refreshed. This prevents the sidebar from querying too early and getting stale data.

### Issue 3: Count Resets When Navigating Away

**Problem:** After marking notifications as unread, navigating away and back would reset the count to the previous state.

**Root Cause:** The preferences were being saved to Arkiv, but the count was being recalculated from stale cached data or the save hadn't completed yet.

**Solution:** 
- Ensure optimistic updates persist in ref (source of truth)
- Dispatch events to sync immediately
- Polling ensures eventual consistency

**Status:** ✅ Solved

**Update (2025-01-XX):** Added a 500ms delay on initial page load to ensure Arkiv has indexed any recent preference updates before querying. This is especially important when navigating back after marking notifications as read/unread, ensuring the page shows the correct read state.

### Issue 4: Loading States Showing When Data Already Available

**Problem:** "Loading feedback details..." and "Loading response details..." text was showing even when data was already loaded.

**Solution:** Changed condition from `isLoadingFeedback` to `isLoadingFeedback && !feedback` to only show loading when actively loading AND data not available.

**Status:** ✅ Solved (removed entirely per user request)

## Best Practices

### 1. Always Use Optimistic Updates

Update UI immediately, then persist to Arkiv. Revert on error.

### 2. Use Refs for Source of Truth

Store preferences in a ref to prevent race conditions and ensure consistency.

### 3. Prevent Reloads During Saves

Use flags to prevent `loadNotificationPreferences` from running during active save operations.

### 4. Event-Driven Synchronization

Dispatch events when state changes to keep components in sync. Include a `delay` parameter in the event detail to account for Arkiv indexing delays, ensuring components wait before querying Arkiv for updated preferences.

### 5. Polling as Fallback

Still poll periodically for external changes (other tabs, other devices).

### 6. Normalize Wallet Addresses

Always normalize wallet addresses to lowercase and trim for consistent querying.

### 7. Filter Archived Notifications

Always filter out archived notifications when counting unread.

## API Endpoints

### GET /api/notifications/preferences

Query notification preferences.

**Query Params:**
- `wallet`: User wallet address (required)
- `notificationId`: Specific notification ID (optional)
- `notificationType`: Filter by type (optional)
- `read`: Filter by read status (optional)
- `archived`: Filter by archived status (optional)

**Response:**
```json
{
  "ok": true,
  "preferences": [
    {
      "key": "...",
      "wallet": "0x...",
      "notificationId": "meeting_request_sessionKey123",
      "notificationType": "meeting_request",
      "read": true,
      "archived": false,
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T01:00:00Z"
    }
  ]
}
```

### POST /api/notifications/preferences

Create or update a single notification preference.

**Body:**
```json
{
  "wallet": "0x...",
  "notificationId": "meeting_request_sessionKey123",
  "notificationType": "meeting_request",
  "read": true,
  "archived": false
}
```

### PUT /api/notifications/preferences

Bulk update notification preferences.

**Body:**
```json
{
  "wallet": "0x...",
  "preferences": [
    {
      "notificationId": "meeting_request_sessionKey123",
      "notificationType": "meeting_request",
      "read": true,
      "archived": false
    },
    {
      "notificationId": "admin_response_responseKey456",
      "notificationType": "admin_response",
      "read": false,
      "archived": false
    }
  ]
}
```

## Query Patterns

### Get Unread Count

```typescript
// 1. Load all notifications for wallet
const notifications = await listNotifications({ wallet, status: 'active' });

// 2. Load all preferences for wallet
const preferences = await listNotificationPreferences({ wallet });

// 3. Build preference map (deduplicate by notificationId, keep most recent)
const prefMap = new Map<string, NotificationPreference>();
preferences.forEach(pref => {
  const existing = prefMap.get(pref.notificationId);
  if (!existing || new Date(pref.updatedAt) > new Date(existing.updatedAt)) {
    prefMap.set(pref.notificationId, pref);
  }
});

// 4. Count unread (filter archived, default to unread if no preference)
let unreadCount = 0;
notifications.forEach(n => {
  const pref = prefMap.get(n.key);
  if (pref?.archived) return; // Skip archived
  if (!pref?.read) { // Default to unread if no preference
    unreadCount++;
  }
});
```

### Mark All as Read

```typescript
// 1. Get all unread notifications
const unreadNotifications = notifications.filter(n => !n.read);

// 2. Bulk update preferences
await fetch('/api/notifications/preferences', {
  method: 'PUT',
  body: JSON.stringify({
    wallet: userWallet,
    preferences: unreadNotifications.map(n => ({
      notificationId: n.id,
      notificationType: n.type,
      read: true,
      archived: false
    }))
  })
});

// 3. Wait for Arkiv to index all preference updates
const indexingDelay = Math.max(1500, 500 + (unreadNotifications.length * 200));
await new Promise(resolve => setTimeout(resolve, indexingDelay));

// 4. Dispatch event to sync other components
// Include delay in event detail so components know to wait before querying Arkiv
window.dispatchEvent(new CustomEvent('notification-preferences-updated', {
  detail: { 
    wallet: userWallet,
    delay: indexingDelay,
  }
}));
```

## Future Considerations

### 1. Cross-Device Synchronization

Currently, preferences are wallet-based. If a user accesses from multiple devices, they'll see the same state (eventually consistent via polling). Consider:
- Real-time sync via WebSocket (if available)
- More frequent polling for active sessions
- Push notifications for new notifications

### 2. Performance Optimization

- Cache preferences in localStorage (with invalidation)
- Batch preference queries
- Use GraphQL for complex queries

### 3. Notification Expiration

- Notifications have TTL, but preferences don't
- Consider cleaning up preferences for expired notifications
- Or extend preference TTL to match notification TTL

### 4. Archive vs Delete

Currently using "archived" flag for soft delete. Consider:
- Hard delete option (remove entity)
- Archive expiration (auto-archive old read notifications)

## Related Documentation

- [Notification Preferences Entity](/docs/arkiv/additional-entities/notification-preferences)
- [Profile System](/docs/architecture/modules/profile-system)
- [Feedback System](/docs/architecture/modules/feedback-system)

## Summary

The Arkiv-native notification system uses immutable entities to track read/unread state in a decentralized environment. Key patterns:

1. **Immutable Updates:** Each state change creates a new entity
2. **Optimistic UI:** Update UI immediately, persist to Arkiv, revert on error
3. **Ref-Based State:** Use refs to prevent race conditions
4. **Event-Driven Sync:** Dispatch events to keep components synchronized
5. **Polling Fallback:** Poll periodically for external changes

This approach provides a robust, decentralized notification system that works without a centralized database.

