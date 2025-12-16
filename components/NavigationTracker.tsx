/**
 * Navigation Tracker Component
 *
 * Privacy-preserving click and navigation tracking.
 * Aggregates data locally before submission (no individual tracking).
 * Stores aggregated metrics as Arkiv entities.
 *
 * Reference: refs/click-navigation-tracking-plan.md
 */

'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface NavigationAggregate {
  pattern: string; // e.g., "/network→/profiles" or "click:/network:button"
  count: number;
}

export function NavigationTracker() {
  const pathname = usePathname();
  const previousPath = useRef<string>('');
  const localAggregates = useRef<Map<string, number>>(new Map());
  const clickCount = useRef<number>(0);

  useEffect(() => {
    // Only track in production or when explicitly enabled
    const shouldTrack = process.env.NODE_ENV === 'production' ||
                       process.env.NEXT_PUBLIC_ENABLE_NAV_TRACKING === 'true';

    if (!shouldTrack) {
      return;
    }

    // Track page navigation
    if (previousPath.current && previousPath.current !== pathname) {
      const navigationKey = `${previousPath.current}→${pathname}`;
      const currentCount = localAggregates.current.get(navigationKey) || 0;
      localAggregates.current.set(navigationKey, currentCount + 1);
    }
    previousPath.current = pathname;

    // Track clicks via event delegation
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Only track interactive elements
      const tagName = target.tagName.toLowerCase();
      const isButton = tagName === 'button';
      const isLink = tagName === 'a' && target.getAttribute('href');
      const isSubmit = tagName === 'input' && (target as HTMLInputElement).type === 'submit';

      if (isButton || isLink || isSubmit) {
        clickCount.current += 1;
        const clickKey = `click:${pathname}:${tagName}`;
        const currentCount = localAggregates.current.get(clickKey) || 0;
        localAggregates.current.set(clickKey, currentCount + 1);
      }
    };

    // Use capture phase to catch all clicks
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [pathname]);

  // Batch submit aggregated data every 30 seconds
  useEffect(() => {
    const shouldTrack = process.env.NODE_ENV === 'production' ||
                       process.env.NEXT_PUBLIC_ENABLE_NAV_TRACKING === 'true';

    if (!shouldTrack) {
      return;
    }

    const interval = setInterval(() => {
      if (localAggregates.current.size > 0) {
        const aggregates: NavigationAggregate[] = Array.from(localAggregates.current.entries()).map(([pattern, count]) => ({
          pattern,
          count,
        }));

        // Submit to API (fire and forget - non-blocking)
        fetch('/api/navigation-metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            aggregates,
            page: pathname || 'unknown',
            createdAt: new Date().toISOString(),
          }),
        }).catch(() => {
          // Silently fail - metrics are non-critical
          console.debug('[NavigationTracker] Failed to submit metrics');
        });

        // Clear aggregates after submission
        localAggregates.current.clear();
        clickCount.current = 0;
      }
    }, 30000); // 30 seconds

    // Also submit on page unload (before user leaves)
    const handleBeforeUnload = () => {
      if (localAggregates.current.size > 0) {
        const aggregates: NavigationAggregate[] = Array.from(localAggregates.current.entries()).map(([pattern, count]) => ({
          pattern,
          count,
        }));

        // Use sendBeacon for reliable submission on page unload
        if (navigator.sendBeacon) {
          const data = JSON.stringify({
            aggregates,
            page: pathname || 'unknown',
            createdAt: new Date().toISOString(),
          });
          navigator.sendBeacon('/api/navigation-metrics', new Blob([data], { type: 'application/json' }));
        } else {
          // Fallback to fetch (may not complete on unload)
          fetch('/api/navigation-metrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              aggregates,
              page: pathname || 'unknown',
              createdAt: new Date().toISOString(),
            }),
            keepalive: true,
          }).catch(() => {
            // Silently fail
          });
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pathname]);

  return null; // This component doesn't render anything
}

