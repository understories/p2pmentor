# Optimistic UI + Reconciliation

**Pattern ID:** PAT-OPTIMISTIC-001  
**Status:** ✅ Documented  
**Related:** [Transaction Timeouts](./transaction-timeouts.md) | [Error Handling](./error-handling.md) | [Read-Your-Writes Under Indexer Lag](./indexer-lag-handling.md) | [Arkiv Patterns Catalog](../arkiv-patterns-catalog.md)

## Overview

Blockchain writes have latency (seconds to minutes). The UI should update optimistically on user action, then reconcile with indexer truth when available. This pattern provides immediate feedback while ensuring eventual consistency with blockchain state.

## When to Use

**Always apply this pattern when:**
- User actions trigger blockchain writes (entity creation, updates)
- UI needs immediate feedback (notifications, preferences, session confirmations)
- Transaction latency would degrade user experience
- State changes are reversible (can rollback on failure)

**State machine:**
1. **Pending:** User action triggers optimistic update
2. **Submitted:** Transaction submitted, `txHash` received
3. **Confirmed:** Transaction confirmed on blockchain (receipt)
4. **Indexed:** Entity queryable via indexer (reconciliation complete)
5. **Failed:** Transaction failed, rollback optimistic update

## Invariants

- UI updates immediately on user action (optimistic)
- Background reconciliation checks indexer for truth
- UI shows "pending" state until reconciliation confirms
- Errors are surfaced when reconciliation fails
- Optimistic updates are reversible (rollback on failure)
- `txHash` is stored for reconciliation tracking

## Threat Model / Failure Modes

- **Transaction failures:** Optimistic update may not match reality (must rollback)
- **Indexer lag:** Reconciliation may take time (polling required)
- **Race conditions:** Multiple optimistic updates may conflict (use transaction ordering)
- **Stale state:** Reconciliation may return stale data (use polling with backoff)
- **Network failures:** Reconciliation may fail (retry with exponential backoff)

## Arkiv Primitives Used

- Transaction submission: `createEntity()` or `updateEntity()` returns `txHash`
- Query reconciliation: `buildQuery().where(eq(...)).fetch()` checks indexer
- Transaction timeouts: `handleTransactionWithTimeout()` handles pending states
- Event-driven sync: Custom events for immediate UI updates across components

## Canonical Algorithm

1. **User action:** User triggers write operation (e.g., mark notification as read)
2. **Optimistic update:** Update UI state immediately (e.g., `setNotifications(prev => prev.map(...))`)
3. **Submit transaction:** Call API route, get `txHash` from response
4. **Store pending state:** Track `txHash` and pending operation
5. **Poll for reconciliation:** Poll indexer query until entity appears (or timeout)
6. **Confirm or rollback:** If found, confirm optimistic update; if timeout/failure, rollback

## Implementation Hooks

**Primary implementation:** ✅ Verified in repo
- `app/notifications/page.tsx` - `markAsRead()`, `markAllAsRead()` with optimistic updates
- `lib/arkiv/transaction-utils.ts` - `handleTransactionWithTimeout()` handles pending states
- `app/admin/feedback/page.tsx` - Optimistic feedback resolution
- `lib/arkiv/sessions.ts` - Session confirmation with reconciliation

**Code examples:**
```typescript
// Optimistic update pattern
const markAsRead = async (notificationId: string) => {
  if (!userWallet) return;

  // 1. Optimistic update
  setNotifications(prev =>
    prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
  );

  // 2. Submit transaction
  try {
    const res = await fetch('/api/notifications/state', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: userWallet.toLowerCase(),
        notificationId,
        read: true,
      }),
    });

    if (!res.ok) {
      // 3. Rollback on failure
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: false } : n)
      );
      throw new Error('Failed to update notification');
    }

    // 4. Reconciliation (polling handled by loadNotifications)
    await loadNotifications(userWallet);

    // 5. Event-driven sync for other components
    window.dispatchEvent(new CustomEvent('notification-preferences-updated', {
      detail: { wallet: userWallet.toLowerCase() },
    }));
  } catch (err) {
    // Rollback on error
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: false } : n)
    );
    console.error('Error marking as read:', err);
  }
};

// Transaction with timeout handling
const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
  return await walletClient.createEntity({
    attributes: [...],
    payload: enc.encode(JSON.stringify({...})),
  });
});

// Reconciliation polling (with delay for indexer lag)
setTimeout(async () => {
  await loadNotifications(userWallet);
}, 500); // Wait for indexer to catch up
```

## Debug Recipe

- Check optimistic state: Verify UI updates immediately before transaction
- Verify `txHash`: Check transaction was submitted successfully
- Check reconciliation: Query indexer to verify entity appears
- Check rollback: Verify optimistic update reverts on failure
- Check event dispatch: Verify custom events fire for cross-component sync
- Check polling: Verify reconciliation polling completes within timeout

## Anti-Patterns

- ❌ Waiting for transaction before updating UI (poor UX)
- ❌ Not rolling back optimistic updates on failure (stale state)
- ❌ Not polling for reconciliation (may never confirm)
- ❌ Polling too aggressively (wasteful, may hit rate limits)
- ❌ Not handling race conditions (multiple updates conflict)
- ❌ Not using `txHash` for tracking (can't reconcile)

## Known Tradeoffs

- **UX:** Immediate feedback improves perceived performance
- **Complexity:** Requires state management for pending operations
- **Consistency:** Eventual consistency (not immediate)
- **Rollback:** Must handle failure cases gracefully
- **Polling:** Requires polling strategy (backoff, timeout)

## Related Patterns

- [Transaction Timeouts](./transaction-timeouts.md) - Handling pending transaction states
- [Error Handling](./error-handling.md) - Rollback and error recovery
- [Read-Your-Writes Under Indexer Lag](./indexer-lag-handling.md) - Reconciliation polling strategy
- [PAT-SESSION-001: Session State Machine](../arkiv-patterns-catalog.md#pat-session-001-session-state-machine) - State machine for pending states

