/**
 * Client Performance Tracker Component
 * 
 * Automatically collects and submits client-side performance metrics.
 * Privacy-preserving: no PII, only performance data.
 * 
 * Reference: refs/doc/beta_metrics_QUESTIONS.md Question 5
 */

'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { collectClientPerfMetrics, observeWebVitals, type ClientPerfMetric } from '@/lib/metrics/clientPerf';

export function ClientPerfTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Only track in production or when explicitly enabled
    const shouldTrack = process.env.NODE_ENV === 'production' || 
                       process.env.NEXT_PUBLIC_ENABLE_CLIENT_PERF === 'true';
    
    if (!shouldTrack) {
      return;
    }

    // Collect initial page load metrics after a delay (to capture all metrics)
    const timeoutId = setTimeout(async () => {
      const metric = collectClientPerfMetrics();
      if (metric) {
        try {
          // Submit to API (fire and forget - don't block UI)
          fetch('/api/client-perf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metric),
          }).catch(err => {
            // Silently fail - metrics are non-critical
            console.debug('[ClientPerf] Failed to submit metric:', err);
          });
        } catch (err) {
          // Silently fail
          console.debug('[ClientPerf] Error submitting metric:', err);
        }
      }
    }, 3000); // Wait 3 seconds to capture LCP, FID, CLS

    // Observe Web Vitals (LCP, FID, CLS) - these update over time
    const webVitals: Partial<ClientPerfMetric> = {};
    const cleanup = observeWebVitals((vitalMetric) => {
      Object.assign(webVitals, vitalMetric);
      
      // Submit when we have meaningful data (after 5 seconds)
      setTimeout(async () => {
        if (Object.keys(webVitals).length > 0) {
          const fullMetric = collectClientPerfMetrics();
          if (fullMetric) {
            const combinedMetric = { ...fullMetric, ...webVitals };
            try {
              fetch('/api/client-perf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(combinedMetric),
              }).catch(() => {
                // Silently fail
              });
            } catch (err) {
              // Silently fail
            }
          }
        }
      }, 5000);
    });

    return () => {
      clearTimeout(timeoutId);
      cleanup();
    };
  }, [pathname]); // Re-run when route changes

  return null; // This component doesn't render anything
}
