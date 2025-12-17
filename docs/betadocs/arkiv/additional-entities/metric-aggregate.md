# Metric Aggregate Entity

## Overview

Pre-computed daily aggregates with percentiles (p50/p90/p95/p99), error rates, and fallback rates. Computed daily via Vercel Cron for efficient querying of historical performance data.

**Entity Type:** `metric_aggregate`  
**TTL:** 1 year (31536000 seconds)  
**Immutability:** Immutable - updates create new entities

## Attributes

- `type`: `'metric_aggregate'` (required)
- `date`: Date string (YYYY-MM-DD format) (required)
- `operation`: Operation name (e.g., `'buildNetworkGraphData'`) (required)
- `source`: `'arkiv'` | `'graphql'` (required)
- `route`: API route (optional)
- `period`: `'daily'` | `'weekly'` (required)
- `spaceId`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) (required)
- `createdAt`: ISO timestamp (required)

## Payload

```typescript
{
  date: string;                    // YYYY-MM-DD
  operation: string;                // Operation name
  source: 'arkiv' | 'graphql';     // Query method
  route?: string;                   // API route (optional)
  period: 'daily' | 'weekly';      // Aggregation period
  percentiles: {
    p50: number;                    // 50th percentile (median)
    p90: number;                    // 90th percentile
    p95: number;                    // 95th percentile
    p99: number;                    // 99th percentile
    avg: number;                    // Average
    min: number;                    // Minimum
    max: number;                    // Maximum
    sampleCount: number;            // Number of samples
  };
  errorRate?: number;               // Error rate (0-1)
  fallbackRate?: number;            // Fallback rate (0-1)
  createdAt: string;                // ISO timestamp
}
```

## Key Fields

- **date**: Date of aggregation (YYYY-MM-DD format)
- **operation**: Operation name being aggregated
- **source**: Query method - `'arkiv'` or `'graphql'`
- **route**: API route (optional)
- **period**: Aggregation period - `'daily'` or `'weekly'`
- **percentiles**: Statistical percentiles and averages
- **errorRate**: Error rate (0-1, optional)
- **fallbackRate**: Fallback rate (0-1, optional)

## Query Patterns

### Get Aggregates by Date

```typescript
import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient } from "@/lib/arkiv/client";

const publicClient = getPublicClient();
const result = await publicClient.buildQuery()
  .where(eq('type', 'metric_aggregate'))
  .where(eq('date', '2024-01-15'))
  .where(eq('period', 'daily'))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

const aggregates = result.entities.map(e => ({
  ...e.attributes,
  ...JSON.parse(e.payload)
}));
```

### Get Aggregates by Operation

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'metric_aggregate'))
  .where(eq('operation', 'buildNetworkGraphData'))
  .where(eq('source', 'graphql'))
  .where(eq('period', 'daily'))
  .withAttributes(true)
  .withPayload(true)
  .limit(30)
  .fetch();

// Sort by date
const sorted = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .sort((a, b) => a.date.localeCompare(b.date));
```

### Get Recent Aggregates

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'metric_aggregate'))
  .where(eq('period', 'daily'))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

// Filter and sort by date
const recent = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .filter(a => {
    const date = new Date(a.date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return date >= weekAgo;
  })
  .sort((a, b) => b.date.localeCompare(a.date));
```

## Creation

```typescript
import { createMetricAggregate } from "@/lib/arkiv/metricAggregates";
import { getPrivateKey } from "@/lib/config";

const { key, txHash } = await createMetricAggregate({
  date: '2024-01-15',
  operation: 'buildNetworkGraphData',
  source: 'graphql',
  route: '/network',
  period: 'daily',
  percentiles: {
    p50: 234,
    p90: 350,
    p95: 450,
    p99: 520,
    avg: 245,
    min: 120,
    max: 890,
    sampleCount: 45,
  },
  errorRate: 0.02,
  fallbackRate: 0.0,
  privateKey: getPrivateKey(),
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

## Computation

Aggregates are computed from raw `dx_metric` entities:

```typescript
async function computeDailyAggregate(date: string, operation: string, source: string) {
  // Get all metrics for date
  const startOfDay = new Date(`${date}T00:00:00Z`);
  const endOfDay = new Date(`${date}T23:59:59Z`);
  
  const metrics = await getDxMetrics({
    operation,
    source,
    since: startOfDay.toISOString(),
    until: endOfDay.toISOString(),
  });
  
  if (metrics.length === 0) return null;
  
  // Calculate percentiles
  const durations = metrics.map(m => m.durationMs).sort((a, b) => a - b);
  const percentiles = {
    p50: durations[Math.floor(durations.length * 0.5)],
    p90: durations[Math.floor(durations.length * 0.9)],
    p95: durations[Math.floor(durations.length * 0.95)],
    p99: durations[Math.floor(durations.length * 0.99)],
    avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
    min: durations[0],
    max: durations[durations.length - 1],
    sampleCount: durations.length,
  };
  
  // Calculate error rate
  const errors = metrics.filter(m => m.status === 'failure').length;
  const errorRate = errors / metrics.length;
  
  // Calculate fallback rate
  const fallbacks = metrics.filter(m => m.usedFallback).length;
  const fallbackRate = fallbacks / metrics.length;
  
  // Create aggregate
  return await createMetricAggregate({
    date,
    operation,
    source,
    period: 'daily',
    percentiles,
    errorRate,
    fallbackRate,
    privateKey: getPrivateKey(),
  });
}
```

## Transaction Hash Tracking

- `metric_aggregate_txhash`: Transaction hash tracking, linked via `aggregateKey` attribute

## Related Entities

- `dx_metric`: Raw performance metrics used for aggregation
- `perf_snapshot`: Performance snapshots for comparison

## Notes

- **Pre-computed**: Aggregates computed daily via cron job
- **Efficient Querying**: Enables fast historical queries without processing raw metrics
- **Percentiles**: Provides statistical distribution insights
- **Error Tracking**: Tracks error and fallback rates
- **Date Format**: Uses YYYY-MM-DD format for easy sorting

## Example Use Case

Admin dashboard performance trends:

```typescript
async function getPerformanceTrends(operation: string, days: number = 7) {
  const endDate = new Date();
  const aggregates = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date(endDate);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Get aggregates for both sources
    const [arkiv, graphql] = await Promise.all([
      getMetricAggregate({ date: dateStr, operation, source: 'arkiv' }),
      getMetricAggregate({ date: dateStr, operation, source: 'graphql' }),
    ]);
    
    aggregates.push({ date: dateStr, arkiv, graphql });
  }
  
  return aggregates.reverse(); // Oldest first
}
```

