# What We Track: Transparency & Privacy

This document describes **exactly** what p2pmentor tracks about users and usage, where the data lives, and why we collect it. Everything is verifiable on-chain via Arkiv.

---

## 1. First-principles for metrics in a trustless dapp

Before picking charts, decide what's *allowed*:

1. **User owns data; we only borrow aggregates**

   * Prefer metrics that can be computed from **Arkiv / on-chain / subgraph data**.
   * Store only **aggregated stats**, not raw behavioral logs, wherever possible.

2. **No third-party tracking, no dark patterns**

   * If we need web analytics, use **self-hosted, privacy-preserving tools** (Umami, Plausible, etc.) that avoid cookies and don't store personal data. ([Plausible Analytics][1])

3. **Minimal necessary telemetry**

   * For infra & API health: latency, error rates, throughput, uptime. ([OpenObserve][2])
   * For product: counts and funnels for **on-chain entities** (profiles, asks, offers, sessions, feedback).

4. **Wallets as pseudo-identities, not customers**

   * Retention & funnel metrics are computed per wallet **cohort**, but stored as **counts/percentages**, not per-wallet history. This follows emerging Web3 analytics practice (wallet-cohort retention, activity per wallet, etc.). ([formo.so][3])

5. **Everything explainable to the user**

   * If a user asks, you can point to a public doc: *"Here's exactly what metrics we track, where the data lives, and why."*

---

## 2. What We Track

### 2.1 Client Performance Metrics (Web Vitals)

**What:** Browser performance metrics collected client-side using the Performance Observer API.

**Data Collected:**
- `ttfb` (Time to First Byte) - milliseconds
- `fcp` (First Contentful Paint) - milliseconds
- `lcp` (Largest Contentful Paint) - milliseconds
- `fid` (First Input Delay) - milliseconds
- `cls` (Cumulative Layout Shift) - decimal score
- `tti` (Time to Interactive) - milliseconds
- `renderTime` - milliseconds
- `page` - page route (e.g., `/network`, `/profile`)
- `userAgent` - anonymized browser name only (`chrome`, `firefox`, `safari`, `edge`, or `other`)
- `createdAt` - ISO timestamp

**What We DON'T Collect:**
- ❌ IP addresses
- ❌ Wallet addresses
- ❌ Full user agent strings
- ❌ Device fingerprints
- ❌ Screen resolution
- ❌ Location data
- ❌ Any personally identifiable information (PII)

**Example Data:**
```json
{
  "ttfb": 145,
  "fcp": 892,
  "lcp": 1234,
  "fid": 12,
  "cls": 0.023,
  "tti": 2100,
  "renderTime": 1800,
  "page": "/network",
  "userAgent": "chrome",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

**Where It Lives:**
- Stored as Arkiv entities with type `client_perf_metric`
- Verifiable on-chain via transaction hash
- Expires after 90 days
- Queryable via `/api/client-perf`

**Why:**
- Understand real-world performance across different browsers and pages
- Identify performance regressions
- Optimize slow pages
- All data is public and verifiable (no hidden tracking)

---

### 2.2 Retention Cohorts

**What:** Privacy-preserving retention analysis showing how many users from a cohort date remain active over time.

**Data Collected:**
- `cohortDate` - Date when users first appeared (YYYY-MM-DD)
- `period` - `daily`, `weekly`, or `monthly`
- `day0` - Number of users active on cohort date
- `day1` - Number of users active 1 day later (optional)
- `day7` - Number of users active 7 days later (optional)
- `day14` - Number of users active 14 days later (optional)
- `day30` - Number of users active 30 days later (optional)
- `createdAt` - ISO timestamp

**Privacy Protection:**
- Wallets are **one-way hashed** using `keccak256` before any calculations
- Only **aggregated counts** are stored (never per-wallet history)
- Hash function: `keccak256("p2pmentor-retention-v1:" + wallet.toLowerCase())`
- Cannot reverse hashes to get original wallet addresses

**What We DON'T Store:**
- ❌ Individual wallet addresses
- ❌ Per-wallet activity history
- ❌ Any way to identify specific users

**Example Data:**
```json
{
  "cohortDate": "2024-01-08",
  "period": "weekly",
  "day0": 42,
  "day1": 38,
  "day7": 28,
  "day14": 22,
  "day30": 15,
  "createdAt": "2024-01-15T00:00:00.000Z"
}
```

**Where It Lives:**
- Stored as Arkiv entities with type `retention_cohort`
- Computed weekly via Vercel Cron (`/api/cron/weekly-retention`)
- Verifiable on-chain via transaction hash
- Expires after 1 year
- Queryable via `/api/admin/retention-cohorts`

**Why:**
- Understand user retention patterns
- Measure product health over time
- Privacy-preserving: no individual tracking, only aggregates

---

### 2.3 Daily Metric Aggregates (Percentiles)

**What:** Pre-computed daily aggregates of performance metrics with percentiles, error rates, and fallback rates.

**Data Collected:**
- `date` - Date of aggregation (YYYY-MM-DD)
- `period` - `daily` or `weekly`
- `operation` - Operation name (e.g., `buildNetworkGraphData`)
- `source` - `graphql` or `arkiv`
- `route` - Route where operation occurred (optional)
- `percentiles` - Object containing:
  - `p50` - 50th percentile (median)
  - `p90` - 90th percentile
  - `p95` - 95th percentile
  - `p99` - 99th percentile
  - `avg` - Average
  - `min` - Minimum
  - `max` - Maximum
  - `sampleCount` - Number of samples
- `errorRate` - Percentage of failures (0.0 to 1.0)
- `fallbackRate` - Percentage of fallbacks (0.0 to 1.0)
- `totalRequests` - Total number of requests
- `successfulRequests` - Number of successful requests
- `failedRequests` - Number of failed requests
- `createdAt` - ISO timestamp

**Example Data:**
```json
{
  "date": "2024-01-14",
  "period": "daily",
  "operation": "buildNetworkGraphData",
  "source": "graphql",
  "route": "/network",
  "percentiles": {
    "p50": 234,
    "p90": 456,
    "p95": 567,
    "p99": 890,
    "avg": 287,
    "min": 120,
    "max": 1200,
    "sampleCount": 142
  },
  "errorRate": 0.02,
  "fallbackRate": 0.05,
  "totalRequests": 150,
  "successfulRequests": 147,
  "failedRequests": 3,
  "createdAt": "2024-01-15T00:00:00.000Z"
}
```

**Where It Lives:**
- Stored as Arkiv entities with type `metric_aggregate`
- Computed daily via Vercel Cron (`/api/cron/daily-aggregates`)
- Verifiable on-chain via transaction hash
- Queryable via `/api/admin/metric-aggregates`

**Why:**
- Fast dashboard loading (pre-computed aggregates)
- Understand performance distributions (not just averages)
- Track error and fallback rates
- Compare GraphQL vs JSON-RPC performance

---

### 2.4 Developer Experience (DX) Metrics

**What:** Performance metrics for API operations (JSON-RPC vs GraphQL comparison).

**Data Collected:**
- `source` - `graphql` or `arkiv`
- `operation` - Operation name (e.g., `listAsks`, `listOffers`, `buildNetworkGraphData`)
- `route` - Route where operation occurred (optional)
- `durationMs` - Operation duration in milliseconds
- `payloadBytes` - Response payload size in bytes
- `httpRequests` - Number of HTTP requests made
- `status` - `success` or `failure`
- `errorType` - Error type if failed (optional)
- `usedFallback` - Whether fallback was used (boolean)
- `createdAt` - ISO timestamp

**Example Data:**
```json
{
  "source": "graphql",
  "operation": "buildNetworkGraphData",
  "route": "/network",
  "durationMs": 234,
  "payloadBytes": 45678,
  "httpRequests": 1,
  "status": "success",
  "usedFallback": false,
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

**Where It Lives:**
- Stored as Arkiv entities with type `dx_metric`
- Verifiable on-chain via transaction hash
- Expires after 90 days
- Queryable via `/api/admin/perf-samples`

**Why:**
- Measure real performance differences between GraphQL and JSON-RPC
- Identify slow operations
- Track fallback usage
- All data verifiable on-chain (no hidden metrics)

---

### 2.5 User Feedback

**What:** Feedback submitted by users about the app.

**Data Collected:**
- `wallet` - Wallet address of user submitting feedback
- `page` - Page where feedback was submitted
- `message` - Feedback message (optional, user-provided)
- `rating` - Rating 1-5 (optional, user-provided)
- `feedbackType` - `feedback` or `issue`
- `createdAt` - ISO timestamp

**What We DON'T Collect:**
- ❌ IP addresses
- ❌ Browser fingerprints
- ❌ Any data not explicitly provided by user

**Example Data:**
```json
{
  "wallet": "0x1234...5678",
  "page": "/network",
  "message": "Great feature!",
  "rating": 5,
  "feedbackType": "feedback",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

**Where It Lives:**
- Stored as Arkiv entities with type `app_feedback`
- Verifiable on-chain via transaction hash
- Queryable via `/api/app-feedback`

**Why:**
- Understand user satisfaction
- Identify issues and bugs
- Improve product based on user input
- Users explicitly submit this data (not tracked automatically)

---

### 2.6 On-Chain Entity Counts

**What:** Counts of on-chain entities (profiles, asks, offers, sessions).

**Data Collected:**
- Counts are computed from Arkiv entities, not stored separately
- No per-wallet tracking, only aggregate counts

**Entities Tracked:**
- User profiles
- Asks (mentorship requests)
- Offers (mentorship offers)
- Sessions (completed mentorship sessions)

**What We DON'T Track:**
- ❌ Individual wallet activity patterns
- ❌ Cross-wallet relationships (beyond what's on-chain)
- ❌ Any off-chain behavioral data

**Where It Lives:**
- Computed on-demand from Arkiv entities
- No separate storage needed (all data is on-chain)

**Why:**
- Understand product usage
- Measure growth
- All data is public and verifiable on-chain

---

## 3. Live Data Examples

> **Note:** This section can be enhanced with live API calls to show real-time examples. For now, we show the structure.

### 3.1 View Live Client Performance Metrics

Visit: `/api/client-perf?limit=10`

This returns the most recent client performance metrics collected from real users.

### 3.2 View Live Retention Cohorts

Visit: `/api/admin/retention-cohorts?limit=5&period=weekly`

This returns the most recent retention cohort data.

### 3.3 View Live Metric Aggregates

Visit: `/api/admin/metric-aggregates?limit=10&period=daily`

This returns the most recent daily metric aggregates.

---

## 4. Data Storage & Verification

### 4.1 All Data is On-Chain

All metrics are stored as **Arkiv entities** on-chain. This means:

- ✅ **Transparent:** Anyone can verify the data
- ✅ **Immutable:** Data cannot be altered after creation
- ✅ **Verifiable:** Each entity has a transaction hash
- ✅ **Public:** All data is publicly accessible

### 4.2 How to Verify

Every metric entity includes a `txHash` field. You can:

1. Query the entity from Arkiv
2. Get the transaction hash
3. Verify it on the Mendoza explorer
4. Confirm the data matches what we claim

### 4.3 Data Expiration

- **Client Performance Metrics:** 90 days
- **DX Metrics:** 90 days
- **Retention Cohorts:** 1 year
- **Metric Aggregates:** Permanent (aggregates, not raw data)
- **User Feedback:** Permanent (user-submitted data)

---

## 5. What We DON'T Track

To be explicit about what we **don't** do:

- ❌ **No IP address tracking**
- ❌ **No cookie-based tracking**
- ❌ **No third-party analytics** (Google Analytics, etc.)
- ❌ **No device fingerprinting**
- ❌ **No cross-site tracking**
- ❌ **No behavioral profiling**
- ❌ **No location tracking**
- ❌ **No per-wallet activity history** (only aggregates)
- ❌ **No hidden tracking pixels**
- ❌ **No data sharing with third parties**

---

## 6. Privacy & Consent

### 6.1 Client Performance Metrics

- **Automatic collection:** Yes, but only performance data (no PII)
- **Opt-out:** Not currently supported (performance metrics are non-identifying)
- **Data retention:** 90 days, then automatically deleted

### 6.2 Retention Cohorts

- **Automatic computation:** Yes, but wallets are hashed (one-way, cannot reverse)
- **Opt-out:** Not currently supported (only aggregates, no individual tracking)
- **Data retention:** 1 year

### 6.3 User Feedback

- **Automatic collection:** No, users explicitly submit feedback
- **Opt-out:** Users simply don't submit feedback
- **Data retention:** Permanent (user-submitted data)

---

## 7. Questions & Concerns

If you have questions or concerns about what we track:

1. **Check this document** - We aim to be transparent about everything
2. **Verify on-chain** - All data is verifiable via Arkiv transaction hashes
3. **Contact us** - Reach out if you have concerns or suggestions

---

## 8. Changes to This Policy

If we add new tracking or change existing tracking:

1. We will update this document
2. We will document the change clearly
3. We will maintain the same privacy-first principles

---

## References

- [Plausible Analytics][1] - Privacy-preserving web analytics
- [OpenObserve][2] - Self-hosted observability platform
- [formo.so][3] - Web3 analytics best practices

[1]: https://plausible.io/
[2]: https://openobserve.ai/
[3]: https://formo.so/
