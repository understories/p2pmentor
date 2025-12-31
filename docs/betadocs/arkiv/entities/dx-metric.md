# DX Metric Entity

## Overview

Stores performance metrics (server-side) as Arkiv entities for verifiable, on-chain tracking. Enables demonstration of real performance differences between JSON-RPC and GraphQL query methods.

**Entity Type:** `dx_metric`  
**TTL:** 90 days (7776000 seconds)  
**Immutability:** Immutable - updates create new entities

## Attributes

- `type`: `'dx_metric'` (required)
- `source`: `'arkiv'` | `'graphql'` (required)
- `operation`: Operation name (e.g., `'buildNetworkGraphData'`) (required)
- `route`: API route (optional, e.g., `/network`)
- `spaceId`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) (required)
- `createdAt`: ISO timestamp (required)

## Payload

```typescript
{
  source: 'arkiv' | 'graphql';    // Query method used
  operation: string;                // Operation name
  route?: string;                   // API route (optional)
  durationMs: number;              // Duration in milliseconds
  payloadBytes?: number;           // Payload size in bytes (optional)
  httpRequests?: number;            // Number of HTTP requests (optional)
  status?: 'success' | 'failure';  // Operation status (optional)
  errorType?: string;              // Error type if failed (optional)
  usedFallback?: boolean;          // Whether fallback was used (optional)
  createdAt: string;                // ISO timestamp
}
```

## Key Fields

- **source**: Query method - `'arkiv'` for JSON-RPC, `'graphql'` for GraphQL
- **operation**: Operation name (e.g., `'buildNetworkGraphData'`, `'listAsks'`)
- **route**: API route where operation was performed (optional)
- **durationMs**: Operation duration in milliseconds
- **payloadBytes**: Response payload size in bytes (optional)
- **httpRequests**: Number of HTTP requests made (optional)
- **status**: Operation status - `'success'` or `'failure'` (optional)
- **errorType**: Error type if operation failed (optional)
- **usedFallback**: Whether fallback mechanism was used (optional)

## Query Patterns

### Get Metrics by Operation

```typescript
import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient } from "@/lib/arkiv/client";

const publicClient = getPublicClient();
const result = await publicClient.buildQuery()
  .where(eq('type', 'dx_metric'))
  .where(eq('operation', 'buildNetworkGraphData'))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

const metrics = result.entities.map(e => ({
  ...e.attributes,
  ...JSON.parse(e.payload)
}));
```

### Compare JSON-RPC vs GraphQL

```typescript
// Get JSON-RPC metrics
const arkivMetrics = await publicClient.buildQuery()
  .where(eq('type', 'dx_metric'))
  .where(eq('source', 'arkiv'))
  .where(eq('operation', 'buildNetworkGraphData'))
  .withAttributes(true)
  .withPayload(true)
  .limit(50)
  .fetch();

// Get GraphQL metrics
const graphqlMetrics = await publicClient.buildQuery()
  .where(eq('type', 'dx_metric'))
  .where(eq('source', 'graphql'))
  .where(eq('operation', 'buildNetworkGraphData'))
  .withAttributes(true)
  .withPayload(true)
  .limit(50)
  .fetch();

// Calculate averages
const arkivAvg = arkivMetrics.entities
  .map(e => JSON.parse(e.payload).durationMs)
  .reduce((sum, d) => sum + d, 0) / arkivMetrics.entities.length;

const graphqlAvg = graphqlMetrics.entities
  .map(e => JSON.parse(e.payload).durationMs)
  .reduce((sum, d) => sum + d, 0) / graphqlMetrics.entities.length;
```

### Get Metrics by Route

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'dx_metric'))
  .where(eq('route', '/network'))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

## Creation

```typescript
import { createDxMetric } from "@/lib/arkiv/dxMetrics";
import { getPrivateKey } from "@/lib/config";

const { key, txHash } = await createDxMetric({
  sample: {
    source: 'graphql',
    operation: 'buildNetworkGraphData',
    route: '/network',
    durationMs: 234,
    payloadBytes: 12589,
    httpRequests: 1,
    status: 'success',
    createdAt: new Date().toISOString(),
  },
  privateKey: getPrivateKey(),
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

## Transaction Hash Tracking

- `dx_metric_txhash`: Transaction hash tracking, linked via `metricKey` attribute

## Performance Comparison

DX metrics enable verifiable performance comparisons:

```typescript
async function comparePerformance(operation: string) {
  // Get samples for both methods
  const arkivSamples = await getDxMetrics({ source: 'arkiv', operation, limit: 50 });
  const graphqlSamples = await getDxMetrics({ source: 'graphql', operation, limit: 50 });
  
  // Calculate statistics
  const arkivStats = {
    avg: arkivSamples.reduce((sum, s) => sum + s.durationMs, 0) / arkivSamples.length,
    min: Math.min(...arkivSamples.map(s => s.durationMs)),
    max: Math.max(...arkivSamples.map(s => s.durationMs)),
  };
  
  const graphqlStats = {
    avg: graphqlSamples.reduce((sum, s) => sum + s.durationMs, 0) / graphqlSamples.length,
    min: Math.min(...graphqlSamples.map(s => s.durationMs)),
    max: Math.max(...graphqlSamples.map(s => s.durationMs)),
  };
  
  return { arkiv: arkivStats, graphql: graphqlStats };
}
```

## Related Entities

- `client_perf_metric`: Client-side performance metrics
- `perf_snapshot`: Aggregated performance snapshots
- `metric_aggregate`: Daily aggregated metrics

## Notes

- **Verifiability**: On-chain storage enables verification of performance claims
- **Comparison**: Enables objective comparison of query methods
- **Fallback Tracking**: Tracks when fallback mechanisms are used
- **Error Tracking**: Records error types for failure analysis

## Example Use Case

Track performance during query execution:

```typescript
async function buildNetworkGraphData() {
  const startTime = Date.now();
  
  try {
    // Execute query
    const data = await fetchNetworkOverview();
    
    const durationMs = Date.now() - startTime;
    const payloadBytes = JSON.stringify(data).length;
    
    // Store metric
    await createDxMetric({
      sample: {
        source: 'graphql',
        operation: 'buildNetworkGraphData',
        route: '/network',
        durationMs,
        payloadBytes,
        httpRequests: 1,
        status: 'success',
        createdAt: new Date().toISOString(),
      },
      privateKey: getPrivateKey(),
    });
    
    return data;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    // Store failure metric
    await createDxMetric({
      sample: {
        source: 'graphql',
        operation: 'buildNetworkGraphData',
        route: '/network',
        durationMs,
        status: 'failure',
        errorType: error.name,
        createdAt: new Date().toISOString(),
      },
      privateKey: getPrivateKey(),
    });
    
    throw error;
  }
}
```

