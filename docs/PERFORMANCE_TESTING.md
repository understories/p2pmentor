# Performance Testing Guide

## Overview
This guide provides step-by-step instructions for running empirical performance tests to evaluate Arkiv JSON-RPC vs GraphQL implementation. Use this as a reference during Sprint 2 development.

## Prerequisites

1. **Admin Access**
   - Navigate to `/admin/login`
   - Password: Set via `ADMIN_PASSWORD` environment variable
   - Default (local): `plantingseeds`

2. **Environment Setup**
   - Ensure `ARKIV_PRIVATE_KEY` is configured
   - Ensure dev server is running (`pnpm dev`)
   - Ensure you're on the correct branch (`main` for production, `playground` for UX testing)

3. **Mendoza Explorer Access**
   - Bookmark: https://explorer.mendoza.hoodi.arkiv.network
   - You'll need this to verify on-chain data

## Testing Workflow

### Step 1: Baseline Measurement (Arkiv JSON-RPC)

**Purpose:** Establish baseline performance for current implementation

1. Navigate to `/admin`
2. Set **Test Method** to `Arkiv`
3. Click **"Test Query Performance"**
4. Wait for completion (check browser console for any errors)
5. Verify transaction appears in Mendoza explorer
6. **Repeat 5-10 times** to get multiple samples
   - Wait 2-3 seconds between tests
   - This gives you variance data

**What to Record:**
- Average duration (from "Query Performance Comparison" section)
- Min/Max duration
- Payload size
- HTTP request count
- Number of samples collected

**Expected Results:**
- Duration: 100-500ms (warm measurements)
- Payload: ~4.78 KB
- HTTP Requests: 4
- Variance: ±100-200ms is normal

### Step 2: GraphQL Measurement

**Purpose:** Measure GraphQL wrapper performance

1. Set **Test Method** to `GraphQL`
2. Click **"Test Query Performance"**
3. Wait for completion
4. Verify transaction in Mendoza explorer
5. **Repeat 5-10 times** for multiple samples

**What to Record:**
- Average duration
- Min/Max duration
- Payload size (should now show ~10-11 KB, not 0.00 KB)
- HTTP request count (should be 1)
- Number of samples

**Expected Results:**
- Duration: 50-500ms (warm measurements)
- Payload: ~10-11 KB (raw GraphQL response)
- HTTP Requests: 1
- Variance: May be higher initially (cold start excluded)

### Step 3: Side-by-Side Comparison

**Purpose:** Test both methods in same conditions

1. Set **Test Method** to `Both`
2. Click **"Test Query Performance"**
3. This tests both methods sequentially
4. Review results in dashboard
5. **Repeat 3-5 times** for comparison data

**What to Look For:**
- Duration comparison (which is faster on average?)
- Payload comparison (GraphQL may be larger due to response format)
- HTTP request comparison (GraphQL: 1, Arkiv: 4)
- Consistency (which has lower variance?)

### Step 4: Create Performance Snapshots

**Purpose:** Capture current state for historical tracking

1. After collecting samples, click **"Create Snapshot"**
2. Verify snapshot appears in "Historical Performance Data" section
3. Click the 🔗 link to verify on Mendoza explorer
4. Note the timestamp and method used

**When to Create Snapshots:**
- After significant code changes
- Before/after GraphQL optimizations
- Weekly during active development
- Before major releases

**Auto-Snapshots:**
- System automatically creates snapshots if last one is >12 hours old
- Check "Auto-snapshot status" indicator in dashboard

### Step 5: Analyze Results

**Purpose:** Make data-driven decisions

1. Review "Query Performance Comparison" section
2. Compare averages (not single measurements)
3. Consider all factors:
   - **Speed:** Which is faster on average?
   - **Consistency:** Which has lower variance?
   - **Efficiency:** HTTP requests (1 vs 4)
   - **Payload:** Size differences
   - **Developer Experience:** Code complexity, maintainability

4. Review historical snapshots to see trends
5. Document findings in sprint notes

## Interpreting Results

### Duration Analysis

**Single measurements are unreliable:**
- ❌ "GraphQL took 5356ms, it's slow!"
- ✅ "GraphQL average: 200ms, Arkiv average: 150ms"

**Look at:**
- **Average:** Most reliable indicator
- **Median:** Better for skewed data
- **Min/Max:** Shows variance range
- **Outliers:** Identify and explain (usually cold starts)

**Normal Variance:**
- ±50-200ms: Excellent consistency
- ±200-500ms: Good consistency
- ±500ms+: Investigate (may indicate issues)

### Payload Size

**What to expect:**
- Arkiv: ~4.78 KB (final graph data)
- GraphQL: ~10-11 KB (raw response, includes metadata)

**Why GraphQL might be larger:**
- Includes response metadata
- JSON structure differences
- Not necessarily a problem (network is fast)

**What matters more:**
- HTTP request count (1 vs 4)
- Total data transferred (GraphQL: 10KB in 1 request vs Arkiv: 4.78KB × 4 = 19KB)

### HTTP Request Count

**This is GraphQL's key advantage:**
- Arkiv: 4 requests (sequential or parallel)
- GraphQL: 1 request

**Impact:**
- Lower latency (fewer round trips)
- Simpler client code
- Better for mobile/slow networks

## Common Issues & Solutions

### Issue: "Payload shows 0.00 KB for GraphQL"

**Cause:** Measurement bug (fixed in latest code)
**Solution:** 
- Ensure you're on latest code
- Re-run tests
- Should now show ~10-11 KB

### Issue: "Very high duration (5000ms+)"

**Cause:** Cold start (first request after server restart)
**Solution:**
- This is expected and excluded in warm measurements
- Look at subsequent measurements
- If consistently high, investigate server/network issues

### Issue: "No data in dashboard after testing"

**Cause:** Dashboard not refreshing
**Solution:**
- Latest code auto-refreshes after "Test Query Performance"
- If still not showing, manually refresh page
- Check browser console for errors

### Issue: "Can't verify transaction on Mendoza"

**Cause:** Transaction not yet indexed
**Solution:**
- Wait 10-30 seconds
- Refresh explorer page
- Check transaction hash is correct

## Testing Checklist

Before making decisions:

- [ ] At least 10 samples for Arkiv baseline
- [ ] At least 10 samples for GraphQL
- [ ] At least 3 "Both" method tests
- [ ] Created snapshot after testing
- [ ] Verified transactions on Mendoza explorer
- [ ] Calculated averages (not just single measurements)
- [ ] Reviewed variance (min/max ranges)
- [ ] Compared HTTP request counts
- [ ] Documented findings
- [ ] Reviewed historical snapshots for trends

## Decision Framework

### When to Use GraphQL

**Choose GraphQL if:**
- HTTP request count matters (mobile, slow networks)
- You need query flexibility (request only needed fields)
- Type safety is important
- You're building complex queries
- Team prefers GraphQL DX

**Even if:**
- Duration is slightly slower (50-100ms difference is negligible)
- Payload is slightly larger (network is fast)

### When to Use Arkiv Direct

**Choose Arkiv if:**
- Simplicity is priority
- You need absolute minimum overhead
- Team prefers direct function calls
- Query patterns are simple and fixed

### Hybrid Approach

**Consider:**
- Use GraphQL for complex queries
- Use Arkiv direct for simple, high-frequency queries
- Feature flags allow easy switching

## Sprint 2 Integration

### During Development

1. **Before implementing GraphQL feature:**
   - Run baseline Arkiv test
   - Create snapshot
   - Document current performance

2. **After implementing GraphQL feature:**
   - Run GraphQL test
   - Run "Both" comparison
   - Create snapshot
   - Compare with baseline

3. **During optimization:**
   - Test after each optimization
   - Create snapshots to track progress
   - Review historical data

### Weekly Reviews

1. Review all snapshots from the week
2. Identify trends (improving? degrading?)
3. Document learnings
4. Adjust approach based on data

## Advanced Testing

### Load Testing

For more realistic testing:
1. Test with larger datasets (100+ asks/offers)
2. Test with concurrent requests
3. Test under different network conditions
4. Test with different query patterns

### Real-World Scenarios

Test actual user flows:
1. Network page load
2. Profile page load
3. Search/filter operations
4. Create/update operations

### Performance Budgets

Set targets:
- Page load: < 500ms (warm)
- API response: < 200ms (warm)
- Payload: < 50KB
- HTTP requests: Minimize

## Documentation

### Recording Results

Document in:
- Sprint notes (`refs/docs/sprint2.md`)
- Performance snapshots (on-chain, verifiable)
- Admin dashboard (visual comparison)

### Sharing Findings

1. Screenshot dashboard results
2. Link to Mendoza explorer transactions
3. Note any anomalies or outliers
4. Document decisions made based on data

## Quick Reference

### Admin Dashboard URLs
- Main: `/admin`
- Login: `/admin/login`
- Feedback: `/admin/feedback`

### API Endpoints
- Test Performance: `/api/admin/perf-samples?seed=true&method={arkiv|graphql|both}`
- Get Summary: `/api/admin/perf-samples?summary=true&summaryOperation=buildNetworkGraphData`
- Create Snapshot: `POST /api/admin/perf-snapshots?operation=buildNetworkGraphData&method={method}`

### Mendoza Explorer
- Base URL: https://explorer.mendoza.hoodi.arkiv.network
- Transaction: `/tx/{txHash}`
- Address: `/address/{address}?tab=txs`

## Next Steps

1. **Run baseline tests** (this week)
2. **Implement GraphQL features** (Sprint 2)
3. **Compare performance** (after each feature)
4. **Optimize based on data** (iterative)
5. **Document learnings** (ongoing)

Remember: **Empirical data > assumptions**. Let the numbers guide your decisions.

