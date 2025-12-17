# Performance Snapshot Entity

## Overview

Stores aggregated performance snapshots as Arkiv entities for historical tracking. Enables comparison of performance over time as query methods evolve. Captures comprehensive performance data at a point in time.

**Entity Type:** `perf_snapshot`  
**TTL:** 1 year (31536000 seconds)  
**Immutability:** Immutable - updates create new entities

## Attributes

- `type`: `'perf_snapshot'` (required)
- `operation`: Operation name (e.g., `'buildNetworkGraphData'`) (required)
- `method`: `'arkiv'` | `'graphql'` | `'both'` (required)
- `spaceId`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) (required)
- `createdAt`: ISO timestamp (required)

## Payload

```typescript
{
  timestamp: string;              // ISO timestamp of snapshot
  operation: string;              // Operation name
  method: 'arkiv' | 'graphql' | 'both';
  arkivMetadata?: {
    blockHeight?: number;         // Arkiv block height
    chainId?: number;             // Chain ID
    timestamp: string;           // ISO timestamp
  };
  graphql?: {
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    avgPayloadBytes?: number;
    avgHttpRequests?: number;
    samples: number;
    pages?: Record<string, number>;  // Page -> query count
  };
  arkiv?: {
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    avgPayloadBytes?: number;
    avgHttpRequests?: number;
    samples: number;
    pages?: Record<string, number>;  // Page -> query count
  };
  pageLoadTimes?: {
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    total: number;
    successful: number;
  };
  createdAt: string;            // ISO timestamp
}
```

## Key Fields

- **timestamp**: When snapshot was taken (ISO timestamp)
- **operation**: Operation being snapshotted
- **method**: Which method(s) were tested
- **arkivMetadata**: Arkiv blockchain metadata (optional)
- **graphql**: GraphQL performance data (optional)
- **arkiv**: JSON-RPC performance data (optional)
- **pageLoadTimes**: Page load time data (optional)

## Query Patterns

### Get All Snapshots

```typescript
import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient } from "@/lib/arkiv/client";

const publicClient = getPublicClient();
const result = await publicClient.buildQuery()
  .where(eq('type', 'perf_snapshot'))
  .where(eq('operation', 'buildNetworkGraphData'))
  .withAttributes(true)
  .withPayload(true)
  .limit(20)
  .fetch();

const snapshots = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
```

### Get Latest Snapshot

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'perf_snapshot'))
  .where(eq('operation', 'buildNetworkGraphData'))
  .withAttributes(true)
  .withPayload(true)
  .limit(1)
  .fetch();

const latest = result.entities[0]
  ? { ...result.entities[0].attributes, ...JSON.parse(result.entities[0].payload) }
  : null;
```

### Compare Snapshots

```typescript
async function compareSnapshots(operation: string) {
  const snapshots = await getPerfSnapshots(operation, 2);
  
  if (snapshots.length < 2) {
    return null; // Need at least 2 snapshots
  }
  
  const [latest, previous] = snapshots;
  
  return {
    graphql: {
      avgChange: latest.graphql?.avgDurationMs - previous.graphql?.avgDurationMs,
      improvement: ((previous.graphql?.avgDurationMs - latest.graphql?.avgDurationMs) / previous.graphql?.avgDurationMs) * 100,
    },
    arkiv: {
      avgChange: latest.arkiv?.avgDurationMs - previous.arkiv?.avgDurationMs,
      improvement: ((previous.arkiv?.avgDurationMs - latest.arkiv?.avgDurationMs) / previous.arkiv?.avgDurationMs) * 100,
    },
  };
}
```

## Creation

```typescript
import { createPerfSnapshot } from "@/lib/arkiv/perfSnapshots";
import { getPrivateKey } from "@/lib/config";

const { key, txHash } = await createPerfSnapshot({
  operation: 'buildNetworkGraphData',
  method: 'both',
  graphql: {
    avgDurationMs: 234.5,
    minDurationMs: 120,
    maxDurationMs: 450,
    avgPayloadBytes: 12589,
    avgHttpRequests: 1,
    samples: 45,
    pages: {
      '/network': 15,
      '/me': 18,
    },
  },
  arkiv: {
    avgDurationMs: 456.2,
    minDurationMs: 230,
    maxDurationMs: 890,
    avgPayloadBytes: 8912,
    avgHttpRequests: 3.2,
    samples: 32,
    pages: {
      '/asks': 12,
      '/offers': 8,
    },
  },
  pageLoadTimes: {
    avgDurationMs: 342,
    minDurationMs: 120,
    maxDurationMs: 890,
    total: 10,
    successful: 8,
  },
  privateKey: getPrivateKey(),
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

## Auto-Snapshot Check

Check if snapshot should be created (e.g., if > 12 hours since last):

```typescript
import { checkAutoSnapshot } from "@/lib/arkiv/perfSnapshots";

const check = await checkAutoSnapshot('buildNetworkGraphData');
if (check.shouldCreateSnapshot) {
  // Create snapshot
  await createPerfSnapshot({ ... });
}
```

## Transaction Hash Tracking

- `perf_snapshot_txhash`: Transaction hash tracking, linked via `snapshotKey` attribute

## Related Entities

- `dx_metric`: Raw performance metrics used for snapshots
- `client_perf_metric`: Client-side metrics
- `metric_aggregate`: Daily aggregates

## Notes

- **Historical Tracking**: Enables performance trend analysis
- **Comprehensive**: Captures both server and client performance
- **Comparison**: Enables before/after comparisons
- **Auto-Snapshot**: Can be created automatically on schedule

## Example Use Case

Admin dashboard performance monitoring:

```typescript
async function createPerformanceSnapshot() {
  // 1. Collect performance data
  const graphqlData = await collectGraphQLMetrics('buildNetworkGraphData');
  const arkivData = await collectArkivMetrics('buildNetworkGraphData');
  const pageLoadData = await measurePageLoadTimes();
  
  // 2. Create snapshot
  await createPerfSnapshot({
    operation: 'buildNetworkGraphData',
    method: 'both',
    graphql: graphqlData,
    arkiv: arkivData,
    pageLoadTimes: pageLoadData,
    privateKey: getPrivateKey(),
  });
  
  // 3. Compare with previous
  const comparison = await compareSnapshots('buildNetworkGraphData');
  console.log('Performance change:', comparison);
}
```

