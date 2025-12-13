# Client Performance Metric Entity

## Overview

Stores client-side performance metrics (Web Vitals) as Arkiv entities. Privacy-preserving: no PII, only performance data. Enables on-chain verification of performance claims.

**Entity Type:** `client_perf_metric`  
**TTL:** 90 days (7776000 seconds)  
**Immutability:** Immutable - updates create new entities

## Attributes

- `type`: `'client_perf_metric'` (required)
- `page`: Page path where metric was collected (e.g., `/network`) (required)
- `spaceId`: `'local-dev'` (required)
- `createdAt`: ISO timestamp (required)

## Payload

```typescript
{
  ttfb?: number;           // Time to First Byte (ms)
  fcp?: number;            // First Contentful Paint (ms)
  lcp?: number;            // Largest Contentful Paint (ms)
  fid?: number;            // First Input Delay (ms)
  cls?: number;            // Cumulative Layout Shift (score)
  tti?: number;            // Time to Interactive (ms)
  renderTime?: number;     // Render time (ms)
  page: string;            // Page path
  userAgent?: string;      // User agent string (optional, privacy-preserving)
  createdAt: string;        // ISO timestamp
}
```

## Key Fields

- **ttfb**: Time to First Byte (milliseconds)
- **fcp**: First Contentful Paint (milliseconds)
- **lcp**: Largest Contentful Paint (milliseconds)
- **fid**: First Input Delay (milliseconds)
- **cls**: Cumulative Layout Shift (score, typically 0-1)
- **tti**: Time to Interactive (milliseconds)
- **renderTime**: Total render time (milliseconds)
- **page**: Page path where metric was collected
- **userAgent**: User agent string (optional, for debugging)

## Query Patterns

### Get Metrics for Page

```typescript
import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient } from "@/lib/arkiv/client";

const publicClient = getPublicClient();
const result = await publicClient.buildQuery()
  .where(eq('type', 'client_perf_metric'))
  .where(eq('page', '/network'))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

const metrics = result.entities.map(e => ({
  ...e.attributes,
  ...JSON.parse(e.payload)
}));
```

### Get Recent Metrics

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'client_perf_metric'))
  .withAttributes(true)
  .withPayload(true)
  .limit(50)
  .fetch();

const recent = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
```

### Calculate Averages

```typescript
const metrics = await getClientPerfMetrics('/network', 100);

const avgTtfb = metrics
  .filter(m => m.ttfb)
  .reduce((sum, m) => sum + m.ttfb, 0) / metrics.filter(m => m.ttfb).length;

const avgLcp = metrics
  .filter(m => m.lcp)
  .reduce((sum, m) => sum + m.lcp, 0) / metrics.filter(m => m.lcp).length;
```

## Creation

```typescript
import { createClientPerfMetric } from "@/lib/arkiv/clientPerfMetric";
import { getPrivateKey } from "@/lib/config";

const { key, txHash } = await createClientPerfMetric({
  metric: {
    ttfb: 234,
    fcp: 890,
    lcp: 1200,
    fid: 45,
    cls: 0.01,
    tti: 1500,
    page: '/network',
    createdAt: new Date().toISOString(),
  },
  privateKey: getPrivateKey(),
  spaceId: 'local-dev',
});
```

## Transaction Hash Tracking

- `client_perf_metric_txhash`: Transaction hash tracking, linked via `metricKey` attribute

## Privacy Considerations

- **No PII**: No wallet addresses, user IDs, or personal information
- **Optional User Agent**: User agent stored optionally for debugging
- **Aggregate Analysis**: Metrics analyzed in aggregate, not per-user
- **Public Data**: Performance metrics are public on-chain

## Example Use Case

Collect Web Vitals from client:

```typescript
// Client-side collection
if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
  // Collect LCP
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    const lcp = lastEntry.renderTime || lastEntry.loadTime;
    
    // Send to server for storage
    fetch('/api/client-perf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lcp,
        page: window.location.pathname,
      }),
    });
  }).observe({ entryTypes: ['largest-contentful-paint'] });
}
```

## Related Entities

- `dx_metric`: Server-side performance metrics
- `perf_snapshot`: Aggregated performance snapshots
- `metric_aggregate`: Daily aggregated metrics

## Notes

- **Web Vitals**: Follows Google Web Vitals standard
- **Optional Fields**: Not all metrics may be available on all pages
- **Client-Side**: Collected in browser, sent to server for storage
- **Verifiability**: On-chain storage enables verification of performance claims

