/**
 * Client-side performance tracking
 *
 * Privacy-preserving client-side performance metrics using Performance Observer API.
 * Tracks TTFB, TTI, render times, and other Web Vitals.
 *
 * All metrics stored as Arkiv entities for transparency and verifiability.
 * No PII collected: no IP, no wallet, no fingerprinting.
 *
 * Reference: refs/doc/beta_metrics_QUESTIONS.md Question 5
 */

'use client';

export type ClientPerfMetric = {
  ttfb?: number; // Time to First Byte (ms)
  fcp?: number; // First Contentful Paint (ms)
  lcp?: number; // Largest Contentful Paint (ms)
  fid?: number; // First Input Delay (ms)
  cls?: number; // Cumulative Layout Shift
  tti?: number; // Time to Interactive (ms)
  renderTime?: number; // Total render time (ms)
  page: string; // Page route (e.g., '/network')
  userAgent?: string; // Browser user agent (anonymized)
  createdAt: string; // ISO timestamp
};

/**
 * Collect client-side performance metrics
 *
 * Uses Performance Observer API to track Web Vitals and page load metrics.
 * Privacy-preserving: only collects performance data, no PII.
 */
export function collectClientPerfMetrics(): ClientPerfMetric | null {
  if (typeof window === 'undefined' || !window.performance) {
    return null;
  }

  try {
    const perf = window.performance;
    const navigation = perf.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    const paint = perf.getEntriesByType('paint');

    const metric: ClientPerfMetric = {
      page: window.location.pathname,
      createdAt: new Date().toISOString(),
    };

    // Time to First Byte (TTFB)
    if (navigation) {
      metric.ttfb = Math.round(navigation.responseStart - navigation.requestStart);
    }

    // First Contentful Paint (FCP)
    const fcpEntry = paint.find((entry) => entry.name === 'first-contentful-paint');
    if (fcpEntry) {
      metric.fcp = Math.round(fcpEntry.startTime);
    }

    // Render time (DOMContentLoaded)
    if (navigation) {
      metric.renderTime = Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart);
    }

    // Time to Interactive (TTI) - approximate using DOMContentLoaded
    if (navigation) {
      metric.tti = Math.round(navigation.domInteractive - navigation.fetchStart);
    }

    // User agent (for browser detection, not fingerprinting)
    if (navigator.userAgent) {
      // Anonymize: only keep browser name, not full user agent
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('chrome')) metric.userAgent = 'chrome';
      else if (ua.includes('firefox')) metric.userAgent = 'firefox';
      else if (ua.includes('safari')) metric.userAgent = 'safari';
      else if (ua.includes('edge')) metric.userAgent = 'edge';
      else metric.userAgent = 'other';
    }

    return metric;
  } catch (error) {
    console.error('[clientPerf] Error collecting metrics:', error);
    return null;
  }
}

/**
 * Observe Web Vitals (LCP, FID, CLS) using Performance Observer
 *
 * These metrics require observation over time, not just at page load.
 */
export function observeWebVitals(
  onMetric: (metric: Partial<ClientPerfMetric>) => void
): () => void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return () => {}; // No-op cleanup
  }

  const observers: PerformanceObserver[] = [];

  try {
    // Observe Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lastEntry = entries[entries.length - 1] as any;
          if (lastEntry?.renderTime || lastEntry?.loadTime) {
            onMetric({
              lcp: Math.round(lastEntry.renderTime || lastEntry.loadTime),
            });
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        observers.push(lcpObserver);
      } catch {
        // LCP not supported
      }
    }

    // Observe First Input Delay (FID)
    if ('PerformanceObserver' in window) {
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          entries.forEach((entry: any) => {
            if (entry.processingStart && entry.startTime) {
              onMetric({
                fid: Math.round(entry.processingStart - entry.startTime),
              });
            }
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        observers.push(fidObserver);
      } catch {
        // FID not supported
      }
    }

    // Observe Cumulative Layout Shift (CLS)
    if ('PerformanceObserver' in window) {
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput && entry.value) {
              clsValue += entry.value;
            }
          });
          onMetric({ cls: Math.round(clsValue * 1000) / 1000 }); // Round to 3 decimals
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        observers.push(clsObserver);
      } catch {
        // CLS not supported
      }
    }
  } catch (error) {
    console.error('[clientPerf] Error setting up observers:', error);
  }

  // Return cleanup function
  return () => {
    observers.forEach((observer) => observer.disconnect());
  };
}
