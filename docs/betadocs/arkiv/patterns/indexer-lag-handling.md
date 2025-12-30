# Read-Your-Writes Under Indexer Lag

**Pattern ID:** PAT-INDEXER-001  
**Status:** ✅ Documented  
**Related:** [Optimistic UI + Reconciliation](./optimistic-ui-reconciliation.md) | [Transaction Timeouts](./transaction-timeouts.md) | [Arkiv Patterns Catalog](../arkiv-patterns-catalog.md)

## Overview

Indexer lag means writes may not be immediately queryable. This pattern handles the state machine: pending → confirmed (receipt) → indexed (queryable), without conflating receipt vs indexer visibility. It ensures read-your-writes consistency even when the indexer hasn't caught up.

## When to Use

**Always apply this pattern when:**
- Reading immediately after writing (read-your-writes)
- Optimistic UI needs reconciliation
- Transaction confirmation doesn't guarantee queryability
- Polling for entity visibility after creation

**State machine:**
1. **Pending:** Transaction submitted, no receipt yet
2. **Confirmed:** Transaction confirmed on blockchain (receipt available)
3. **Indexed:** Entity queryable via indexer (read-your-writes works)

## Invariants

- Receipt confirmation ≠ indexer visibility (distinct states)
- Read-your-writes requires polling until indexed
- Polling uses exponential backoff to avoid rate limits
- Stale-while-revalidate: Show optimistic state while polling
- Timeout after max retries (entity may be confirmed but not yet indexed)

## Threat Model / Failure Modes

- **Indexer lag:** Writes confirmed but not yet queryable (polling required)
- **Polling exhaustion:** Max retries reached, entity still not visible (timeout)
- **Rate limits:** Too aggressive polling hits rate limits (use backoff)
- **Stale data:** Showing stale data while waiting for indexer (use stale-while-revalidate)

## Arkiv Primitives Used

- Transaction confirmation: `txHash` indicates transaction confirmed
- Query polling: `buildQuery().where(eq(...)).fetch()` checks indexer visibility
- Exponential backoff: Increasing delays between retries
- Stale-while-revalidate: Show optimistic state, refresh when indexed

## Canonical Algorithm

1. **Submit transaction:** Get `txHash` from `createEntity()` or `updateEntity()`
2. **Transaction confirmed:** `txHash` indicates transaction on blockchain
3. **Poll for indexer visibility:** Query for entity with exponential backoff
4. **Retry with backoff:** Wait `retryDelay * 2^attempt` between retries
5. **Max retries:** After max retries, return pending status (entity confirmed but not yet indexed)
6. **Stale-while-revalidate:** Show optimistic state while polling, refresh when indexed

## Implementation Hooks

**Primary implementation:** ✅ Verified in repo
- `app/api/skills/route.ts` - Retry logic with exponential backoff for read-your-writes
- `app/notifications/page.tsx` - Delay before refresh to wait for indexer
- `lib/arkiv/skill-helpers.ts` - Comment about waiting for Arkiv to index

**Code examples:**
```typescript
// Strategy 1: Retry with exponential backoff (read-your-writes)
async function createSkillAndWaitForIndexer(name: string) {
  // 1. Create skill
  const { key, txHash } = await createSkill({ name, ... });
  
  // 2. Poll for indexer visibility with exponential backoff
  const maxRetries = 5;
  const retryDelay = 1000; // Start with 1 second
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const skill = await getSkillBySlug(name);
    if (skill) {
      return skill; // Indexed, return immediately
    }
    
    // Wait before retrying (exponential backoff)
    if (attempt < maxRetries - 1) {
      const delay = retryDelay * Math.pow(2, attempt);
      console.log(`Skill not yet indexed, retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // 3. Max retries reached, return pending status
  return {
    key,
    txHash,
    pending: true,
    message: 'Skill created successfully. It may take a moment to appear in queries.',
  };
}

// Strategy 2: Simple delay (for reconciliation)
async function markAsReadAndRefresh(notificationId: string) {
  // 1. Update optimistically
  setNotifications(prev => prev.map(...));
  
  // 2. Submit transaction
  await fetch('/api/notifications/state', { method: 'PATCH', ... });
  
  // 3. Wait for indexer (simple delay)
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 4. Refresh from indexer
  await loadNotifications(userWallet);
}

// Strategy 3: Stale-while-revalidate
async function getProfileWithStaleWhileRevalidate(wallet: string) {
  // 1. Return cached/optimistic state immediately
  const cached = getCachedProfile(wallet);
  if (cached) {
    // Return stale data immediately
    return cached;
  }
  
  // 2. Fetch fresh data in background
  const fresh = await fetchProfileFromIndexer(wallet);
  
  // 3. Update cache and return fresh
  setCachedProfile(wallet, fresh);
  return fresh;
}
```

## Debug Recipe

- Check transaction confirmation: Verify `txHash` indicates transaction confirmed
- Check indexer visibility: Query for entity to verify it's queryable
- Check polling: Verify exponential backoff is used (not too aggressive)
- Check max retries: Verify timeout after max retries (don't poll forever)
- Check stale-while-revalidate: Verify optimistic state shown while polling

## Anti-Patterns

- ❌ Assuming receipt = queryable (indexer lag exists)
- ❌ Polling too aggressively (hits rate limits)
- ❌ Polling forever (no max retries, hangs indefinitely)
- ❌ Not using backoff (wasteful, may hit rate limits)
- ❌ Not showing pending state (users don't know entity is confirmed but not yet visible)

## Known Tradeoffs

- **Consistency:** Read-your-writes requires polling (adds latency)
- **Performance:** Exponential backoff prevents rate limits but adds delay
- **UX:** Stale-while-revalidate shows optimistic state (good UX, eventual consistency)
- **Complexity:** Polling logic adds complexity (but necessary for correctness)

## Related Patterns

- [Optimistic UI + Reconciliation](./optimistic-ui-reconciliation.md) - Reconciliation uses indexer polling
- [Transaction Timeouts](./transaction-timeouts.md) - Timeout handling for pending states
- [PAT-ERROR-001: Error Handling](../arkiv-patterns-catalog.md#pat-error-001-error-handling) - Error handling for polling failures

