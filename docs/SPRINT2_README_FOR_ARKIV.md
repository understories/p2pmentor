# Sprint 2: GraphQL Performance Evaluation for Arkiv

## Overview

This document provides Arkiv team members with a guide to verify and understand the performance tracking system we've built on top of Arkiv's JSON-RPC indexer.

## What We Built

We've created a **GraphQL API wrapper** over Arkiv's JSON-RPC indexer, along with comprehensive performance instrumentation to empirically evaluate the benefits of GraphQL vs direct JSON-RPC calls.

### Key Components

1. **GraphQL API Wrapper** (`/api/graphql`)
   - GraphQL schema and resolvers
   - All resolvers call real Arkiv functions (no mock data)
   - Performance instrumentation built-in

2. **Performance Tracking System**
   - All performance data stored as Arkiv entities (`dx_metric`)
   - Historical snapshots stored as Arkiv entities (`perf_snapshot`)
   - Verifiable on-chain via Mendoza explorer

3. **Admin Dashboard** (`/admin`)
   - Real-time performance comparison
   - Historical trend analysis
   - All data verifiable on-chain

## How to Verify Data On-Chain

### 1. Run a Performance Test

1. Navigate to: `https://p2pmentor.com/admin/login`
2. Login with admin password
3. Click **"Test Query Performance"**
4. Check response for `transactions` array with `txHash` values

### 2. Verify on Mendoza Explorer

Each performance sample is stored as an Arkiv entity with transaction hash:

```
https://explorer.mendoza.hoodi.arkiv.network/tx/{txHash}
```

**Entity Structure:**
- Type: `dx_metric`
- Attributes:
  - `source`: 'arkiv' or 'graphql'
  - `operation`: Operation name (e.g., 'buildNetworkGraphData')
  - `durationMs`: Actual measured duration
  - `payloadBytes`: Actual response size
  - `httpRequests`: Number of HTTP requests
- Payload: Full performance sample as JSON

### 3. Verify Performance Snapshots

Snapshots aggregate performance data over time:

1. Click **"Create Snapshot"** in admin dashboard
2. Get `txHash` from response
3. Verify on Mendoza explorer

**Snapshot Entity Structure:**
- Type: `perf_snapshot`
- Attributes:
  - `operation`: Operation name
  - `method`: 'arkiv', 'graphql', or 'both'
  - `timestamp`: When snapshot was created
- Payload: Aggregated performance data including:
  - Average/min/max duration
  - Payload sizes
  - HTTP request counts
  - Arkiv metadata (block height, chain ID)

## Performance Comparison

### What We're Measuring

1. **Duration (ms):** Time from request start to response complete
2. **Payload Size (bytes):** Actual response payload size
3. **HTTP Requests:** Number of round trips required

### Current Findings (Preliminary)

**Arkiv JSON-RPC:**
- Duration: 100-500ms (warm measurements)
- Payload: ~4.78 KB
- HTTP Requests: 4 (listAsks × 2 + listOffers × 2)

**GraphQL Wrapper:**
- Duration: 50-500ms (warm measurements)
- Payload: ~10-11 KB (includes GraphQL metadata)
- HTTP Requests: 1 (single GraphQL query)

**Key Insight:** GraphQL reduces HTTP requests from 4 to 1, which can significantly reduce latency, especially on slower networks.

## Running the Comparison Yourself

### Step 1: Access Admin Dashboard

1. Visit: `https://p2pmentor.com/admin/login`
2. Enter admin password (contact us for access)

### Step 2: Run Performance Tests

1. Set **Test Method** to `Arkiv`
2. Click **"Test Query Performance"**
3. Repeat 5-10 times for baseline
4. Set **Test Method** to `GraphQL`
5. Click **"Test Query Performance"**
6. Repeat 5-10 times for comparison

### Step 3: Create Snapshots

1. Click **"Create Snapshot"** after each test method
2. View results in **"Historical Performance Data"** section
3. Click 🔗 links to verify on Mendoza explorer

### Step 4: Analyze Results

Compare:
- Average duration (lower is better)
- Payload size (consider network efficiency)
- HTTP request count (GraphQL: 1 vs Arkiv: 4)
- Consistency (variance in measurements)

## Data Integrity Guarantees

### ✅ All Data is Real

- Every measurement comes from actual API calls
- No fabricated or approximated data
- All data stored on-chain for verification

### ✅ All Data is Verifiable

- Every sample has `txHash` for Mendoza explorer verification
- Every snapshot has `txHash` for verification
- All queries prioritize Arkiv entities (on-chain) over in-memory

### ✅ All Data is Traceable

- Timestamps for all measurements
- Operation names match actual code paths
- Source ('arkiv' vs 'graphql') clearly marked
- Arkiv metadata (block height, chain ID) included in snapshots

## Technical Architecture

### GraphQL Wrapper

```
Client Request
  ↓
GraphQL API (/api/graphql)
  ↓
GraphQL Resolvers (lib/graphql/resolvers.ts)
  ↓
Arkiv JSON-RPC Functions (lib/arkiv/*)
  ↓
Arkiv Indexer
```

**Key Point:** GraphQL wrapper is a thin layer. All resolvers call the same Arkiv functions that direct JSON-RPC uses.

### Performance Instrumentation

```
API Call
  ↓
Measure: duration, payload, HTTP requests
  ↓
Store: Arkiv entity (dx_metric)
  ↓
Aggregate: Performance summary
  ↓
Snapshot: Historical tracking (perf_snapshot)
```

## Admin Dashboard Screenshot

The admin dashboard provides:

- **Real-time Performance Comparison:** Side-by-side Arkiv vs GraphQL metrics
- **Page Load Times:** Actual page load measurements
- **Historical Snapshots:** Performance trends over time
- **Verification Links:** Direct links to Mendoza explorer for on-chain verification

## What This Demonstrates

1. **Arkiv as Data Layer:** All data comes from Arkiv entities
2. **On-Chain Verification:** Performance claims are verifiable on-chain
3. **Empirical Evaluation:** Real measurements, not assumptions
4. **Developer Experience:** GraphQL can improve DX while maintaining Arkiv as source of truth

## Next Steps (Sprint 2)

1. **Enable GraphQL for Network Page:** Feature flag rollout
2. **Collect Baseline Data:** 10+ samples for each method
3. **Compare Performance:** Empirical evaluation
4. **Optimize Based on Data:** Iterative improvement
5. **Document Findings:** Share results with Arkiv team

## Questions or Feedback?

This system is designed to be:
- **Transparent:** All code is open source
- **Verifiable:** All data is on-chain
- **Empirical:** Real measurements, not assumptions

We welcome feedback from the Arkiv team on:
- Performance measurement methodology
- Data storage patterns
- Integration approaches
- Any improvements or optimizations

---

**Built with:** Arkiv Protocol, Next.js, GraphQL  
**Verifiable on:** Mendoza Testnet Explorer  
**Repository:** https://github.com/understories/p2pmentor

