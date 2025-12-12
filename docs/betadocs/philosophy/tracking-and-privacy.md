# What We Track: Transparency & Privacy

This document describes **exactly** what p2pmentor tracks about users and usage, where the data lives, and why we collect it. Everything is verifiable on-chain via Arkiv.

---

## 1. First-principles for metrics in a trustless dapp

Before picking charts, decide what's *allowed*:

1. **User owns data; we only borrow aggregates**

   * Prefer metrics that can be computed from **Arkiv / on-chain / subgraph data**.
   * Store only **aggregated stats**, not raw behavioral logs, wherever possible.

2. **No third-party tracking, no dark patterns**

   * If we need web analytics, use **self-hosted, privacy-preserving tools** (Umami, Plausible, etc.) that avoid cookies and don't store personal data.

3. **Minimal necessary telemetry**

   * For infra & API health: latency, error rates, throughput, uptime.
   * For product: counts and funnels for **on-chain entities** (profiles, asks, offers, sessions, feedback).

4. **Wallets as pseudo-identities, not customers**

   * Retention & funnel metrics are computed per wallet **cohort**, but stored as **counts/percentages**, not per-wallet history. This follows emerging Web3 analytics practice (wallet-cohort retention, activity per wallet, etc.).

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
- ❌ Wallet addresses (not included in client performance metrics)
- ❌ Full user agent strings
- ❌ Device fingerprints
- ❌ Screen resolution
- ❌ Location data
- ❌ Any personally identifiable information (PII)

**Note:** Wallet addresses are **public on Arkiv** in core entities (profiles, asks, offers, sessions, feedback). We simply don't include them in client performance metrics to keep those metrics privacy-preserving.

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
- Only **aggregated counts** are stored (never per-wallet history in retention cohorts)
- Hash function: `keccak256("p2pmentor-retention-v1:" + wallet.toLowerCase())`
- Cannot reverse hashes to get original wallet addresses

**Important Note:**
- Wallet addresses are **already public on Arkiv** in core entities (profiles, asks, offers, sessions)
- We don't store wallet addresses in retention cohorts to keep those metrics privacy-preserving
- But wallet addresses themselves are publicly queryable from Arkiv entities

**What We DON'T Store in Retention Cohorts:**
- ❌ Individual wallet addresses (we hash them)
- ❌ Per-wallet activity history (only aggregated counts)
- ❌ Any way to identify specific users from retention data alone

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

### 2.6 Beta Code Usage Tracking

**What:** Tracking of beta invite code usage to enforce limits and prevent abuse.

**Data Collected:**
- `code` - Beta code string (normalized to lowercase)
- `usageCount` - Number of times the code has been used
- `limit` - Maximum number of uses allowed (default: 50)
- `createdAt` - ISO timestamp when code was first used
- `lastUsedAt` - ISO timestamp when code was last used
- `txHash` - Transaction hash for entity creation/update

**Beta Access Records:**
- `wallet` - Wallet address that used the code (after authentication)
- `code` - Beta code used
- `grantedAt` - ISO timestamp when access was granted
- `txHash` - Transaction hash for access record

**What We DON'T Collect:**
- ❌ IP addresses (not stored in beta code entities)
- ❌ Browser fingerprints
- ❌ Device information
- ❌ Any data beyond code usage and wallet binding (post-auth)

**Example Data:**
```json
{
  "code": "beta2025",
  "usageCount": 23,
  "limit": 50,
  "createdAt": "2024-12-11T10:00:00.000Z",
  "lastUsedAt": "2024-12-11T15:30:00.000Z",
  "txHash": "0xabc123..."
}
```

**Where It Lives:**
- Stored as Arkiv entities with type `beta_code_usage`
- Beta access records stored as type `beta_access` (links wallet to code)
- Verifiable on-chain via transaction hash
- Expires after 1 year
- Queryable via `/api/beta-code`

**Why:**
- Enforce beta invite code limits (prevent code sharing abuse)
- Track beta access grants per wallet (for audit trail)
- All data is transparent and verifiable on-chain
- No hidden tracking - all access records are public on Arkiv

**Privacy Considerations:**
- Beta codes themselves are not PII (they're shared invite codes)
- Wallet addresses are already public on Arkiv in core entities
- Beta access records link wallet to code for audit purposes
- This is necessary for enforcing beta limits and preventing abuse

**How Beta Code Gating Works:**
1. User enters beta code on `/beta` page
2. Code is validated against Arkiv `beta_code_usage` entity
3. Usage count is checked against limit
4. If valid, usage count is incremented and `beta_access` entity is created
5. Access is stored in cookies and localStorage for session persistence
6. All routes (client and server) verify beta access before allowing access
7. Wallet address is linked to beta access after authentication (for audit)

**What This Means for Users:**
- Beta codes are rate-limited (e.g., 50 uses per code)
- Your wallet address is linked to the beta code you used (for audit)
- All beta access records are public on Arkiv (transparent)
- You can verify your beta access on Arkiv Explorer
- Beta access persists across sessions via cookies/localStorage

**What This Does NOT Change:**
- ✅ All existing tracking remains the same (client perf, retention, etc.)
- ✅ Wallet addresses were already public on Arkiv (no change)
- ✅ No new behavioral tracking is added
- ✅ Beta code tracking is only for access control, not analytics
- ✅ All data remains transparent and verifiable on-chain

---

### 2.7 On-Chain Entity Counts

**What:** Counts of on-chain entities (profiles, asks, offers, sessions).

**Data Collected:**
- Counts are computed from Arkiv entities, not stored separately
- No per-wallet tracking in our metrics, only aggregate counts

**Entities Tracked:**
- User profiles (wallet addresses are public in these entities)
- Asks (mentorship requests - wallet addresses are public)
- Offers (mentorship offers - wallet addresses are public)
- Sessions (completed mentorship sessions - mentor/learner wallets are public)

**What's Public on Arkiv:**
- ✅ Wallet addresses in all core entities (profiles, asks, offers, sessions, feedback)
- ✅ Authentication wallet addresses (they're the wallet addresses in the entities)
- ✅ All entity data and transaction hashes
- ✅ Anyone can query Arkiv to see wallet addresses associated with any entity

**What We DON'T Track in Our Metrics:**
- ❌ Individual wallet activity patterns (we only compute aggregate counts)
- ❌ Cross-wallet relationships beyond what's already on-chain
- ❌ Any off-chain behavioral data
- ❌ We don't create separate tracking entities that add wallet addresses to behavioral metrics

**Where It Lives:**
- Computed on-demand from Arkiv entities
- No separate storage needed (all data is on-chain)
- Wallet addresses are already public in the source entities

**Why:**
- Understand product usage
- Measure growth
- All data is public and verifiable on-chain
- We don't need to track wallet addresses separately - they're already public in Arkiv entities

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

### 4.1.1 What's Public on Arkiv

**Core entities (publicly visible on Arkiv):**
- **Profiles** (`user_profile`): Wallet address, display name, bio, skills, availability
- **Asks** (`ask`): Wallet address, skill, message, status
- **Offers** (`offer`): Wallet address, skill, message, availability
- **Sessions** (`session`): Mentor wallet, learner wallet, skill, session details
- **Feedback** (`app_feedback`): Wallet address, page, message, rating
- **All transaction hashes**: Every entity creation has a verifiable transaction hash

**What this means:**
- Wallet addresses are **publicly visible** in these core entities
- Anyone can query Arkiv to see wallet addresses associated with profiles, asks, offers, sessions, and feedback
- This is by design - Arkiv is a public blockchain
- Authentication wallet addresses are also public (they're the wallet addresses in the entities above)

**What we don't add to metrics:**
- We don't include wallet addresses in client performance metrics (to keep those privacy-preserving)
- We don't create separate tracking entities that link wallet addresses to behavioral data
- We use hashed wallets for retention calculations (one-way, cannot reverse)

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
- ❌ **No per-wallet activity history in our metrics** (only aggregates)
- ❌ **No hidden tracking pixels**
- ❌ **No data sharing with third parties**

**Important Clarification:**
- Wallet addresses **are public on Arkiv** in core entities (profiles, asks, offers, sessions, feedback)
- We don't add wallet addresses to our metrics (client perf, retention cohorts, aggregates)
- But wallet addresses themselves are publicly queryable from Arkiv - this is by design
- Authentication wallet addresses are also public (they're the wallet addresses in the entities)

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

