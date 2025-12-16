/**
 * Action Completion Tracking
 *
 * Tracks clicks leading to on-chain entity creation.
 * Privacy-preserving: aggregated metrics only, no individual tracking.
 *
 * Reference: refs/click-navigation-tracking-plan.md Phase 2
 */

export type ActionType =
  | 'profile_created'
  | 'ask_created'
  | 'offer_created'
  | 'session_created'
  | 'skill_created'
  | 'community_joined';

/**
 * Track action completion with click count
 *
 * Submits aggregated metric for action completion.
 * Fire-and-forget, non-blocking.
 */
export function trackActionCompletion(
  actionType: ActionType,
  clicksToComplete?: number
): void {
  // Only track in production or when explicitly enabled
  const shouldTrack = process.env.NODE_ENV === 'production' ||
                     process.env.NEXT_PUBLIC_ENABLE_NAV_TRACKING === 'true';

  if (!shouldTrack) {
    return;
  }

  // Get click count from NavigationTracker if not provided
  let finalClickCount = clicksToComplete;
  if (finalClickCount === undefined && typeof window !== 'undefined') {
    const getClickCount = (window as any).__getPageClickCount;
    if (typeof getClickCount === 'function') {
      finalClickCount = getClickCount();
    }
  }

  // Default to 1 if still undefined
  if (finalClickCount === undefined) {
    finalClickCount = 1;
  }

  // Submit aggregated metric (fire and forget)
  fetch('/api/navigation-metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actionType,
      clicksToComplete: finalClickCount,
      page: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      createdAt: new Date().toISOString(),
    }),
  }).catch(() => {
    // Silently fail - metrics are non-critical
    console.debug('[trackActionCompletion] Failed to submit metric');
  });
}

