# Admin Dashboard Architecture

## Overview

The Admin Dashboard (`/admin`) provides a comprehensive view of application performance, user feedback, and system metrics. It's designed for internal use by builders and administrators to monitor the health and usage of p2pmentor.

**Access**: Requires authentication via `/admin/login` (simple password-based auth for beta; proper authentication required before public release).

## Dashboard Structure

The dashboard is organized into three main sections:

1. **Performance Metrics** (Engineering Dashboard) - Default collapsed
2. **Beta Metrics** (Engineering Dashboard) - Default collapsed
3. **User Feedback** (Customer Support) - Default expanded

---

## Section 1: Performance Metrics

### Visual Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ⚙️ Performance Metrics  [Engineering Dashboard]            │
│                                                              │
│ [▶ Expand] [Test Method: Both ▼] [Test Query Performance]  │
│                              [Create Snapshot]              │
└─────────────────────────────────────────────────────────────┘
```

When expanded, this section contains:

### 1.1 GraphQL Migration Status

**Visual Example:**

```
┌─────────────────────────────────────────────────────────────┐
│ 🚀 GraphQL Migration Status                                  │
│                                                              │
│ Migration Progress                                           │
│ 3 / 5 pages                                                  │
│ 60% migrated                                                 │
│                                                              │
│ [Progress Circle: 60%]                                       │
│                                                              │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│ │ /network │ │ /me │ │ /profile │ │ /asks │ │ /offers │    │
│ │   ✓      │ │   ✓  │ │   ✓      │ │   ○   │ │   ○     │    │
│ │ GraphQL  │ │GraphQL│ │ GraphQL  │ │JSON-RPC│ │JSON-RPC│    │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘              │
└─────────────────────────────────────────────────────────────┘
```

**API Endpoint:**

```
GET /api/admin/graphql-flags
```

**Example Response:**

```json
{
  "ok": true,
  "flags": {
    "network": true,
    "me": true,
    "profile": true,
    "asks": false,
    "offers": false
  },
  "summary": {
    "enabled": 3,
    "total": 5,
    "percentage": 60
  }
}
```

### 1.2 Query Performance Comparison

**Visual Example:**

```
┌─────────────────────────────────────────────────────────────┐
│ Query Performance (JSON-RPC vs GraphQL)                      │
│                                                              │
│ ┌──────────────────────┐  ┌──────────────────────┐         │
│ │ GraphQL (n=45)       │  │ JSON-RPC (n=32)      │         │
│ │                      │  │                      │         │
│ │ Avg Duration: 234ms  │  │ Avg Duration: 456ms   │         │
│ │ Avg Payload: 12.3 KB │  │ Avg Payload: 8.7 KB  │         │
│ │ HTTP Requests: 1    │  │ HTTP Requests: 3.2   │         │
│ │                      │  │                      │         │
│ │ Pages Using GraphQL: │  │ Pages Using JSON-RPC:│         │
│ │ /network: 15 queries │  │ /asks: 12 queries   │         │
│ │ /me: 18 queries      │  │ /offers: 8 queries   │         │
│ │ /profile: 12 queries  │  │ /network: 12 queries │         │
│ └──────────────────────┘  └──────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

**API Endpoints:**

**Get Performance Summary:**

```
GET /api/admin/perf-samples?summary=true
```

**Example Response:**

```json
{
  "graphql": {
    "avgDurationMs": 234.5,
    "minDurationMs": 120,
    "maxDurationMs": 450,
    "avgPayloadBytes": 12589,
    "avgHttpRequests": 1,
    "samples": 45,
    "pages": {
      "/network": 15,
      "/me": 18,
      "/profile": 12
    }
  },
  "arkiv": {
    "avgDurationMs": 456.2,
    "minDurationMs": 230,
    "maxDurationMs": 890,
    "avgPayloadBytes": 8912,
    "avgHttpRequests": 3.2,
    "samples": 32,
    "pages": {
      "/asks": 12,
      "/offers": 8,
      "/network": 12
    }
  }
}
```

**Get Recent Performance Samples:**

```
GET /api/admin/perf-samples?limit=20
```

**Example Response:**

```json
{
  "ok": true,
  "samples": [
    {
      "source": "graphql",
      "operation": "buildNetworkGraphData",
      "durationMs": 234,
      "payloadBytes": 12589,
      "httpRequests": 1,
      "txHash": "0xabc123...",
      "page": "/network"
    },
    {
      "source": "arkiv",
      "operation": "listAsks",
      "durationMs": 456,
      "payloadBytes": 8912,
      "httpRequests": 3,
      "txHash": null,
      "page": "/asks"
    }
  ],
  "note": "Loaded from Arkiv entities"
}
```

**Test Query Performance (Generate Real Data):**

```
GET /api/admin/perf-samples?seed=true&method=both
```

This endpoint makes actual API calls to generate real performance metrics. The `method` parameter can be:

- `arkiv` - Test JSON-RPC path only
- `graphql` - Test GraphQL path only
- `both` - Test both paths (default)

**Example Response:**

```json
{
  "success": true,
  "entitiesCreated": 6,
  "note": "Created 3 GraphQL metrics and 3 JSON-RPC metrics"
}
```

### 1.3 Page Load Times

**Visual Example:**

```
┌─────────────────────────────────────────────────────────────┐
│ Page Load Times                                              │
│                                                              │
│ Avg Load Time: 342ms  │  Fastest: 120ms  │  Slowest: 890ms │
│ Success Rate: 8/10                                          │
│                                                              │
│ /network           234ms  [GraphQL: 15 queries]             │
│ /me                189ms  [GraphQL: 18 queries]              │
│ /asks              456ms  [JSON-RPC: 12 queries]            │
│ /offers            389ms  [JSON-RPC: 8 queries]              │
│ /profiles/0x...    567ms  [No query data]                    │
└─────────────────────────────────────────────────────────────┘
```

**API Endpoint:**

```
GET /api/admin/page-load-times?baseUrl=http://localhost:3000
```

**Example Response:**

```json
{
  "ok": true,
  "results": [
    {
      "page": "/network",
      "durationMs": 234,
      "status": 200
    },
    {
      "page": "/me",
      "durationMs": 189,
      "status": 200
    },
    {
      "page": "/asks",
      "durationMs": 456,
      "status": 200
    }
  ],
  "summary": {
    "total": 10,
    "successful": 8,
    "failed": 2,
    "avgDurationMs": 342,
    "minDurationMs": 120,
    "maxDurationMs": 890
  },
  "measuredAt": "2024-01-15T10:30:00Z"
}
```

### 1.4 Recent Performance Samples

**Visual Example:**

```
┌─────────────────────────────────────────────────────────────┐
│ Recent Performance Samples                                   │
│                                                              │
│ Source    │ Operation              │ Duration │ Payload │   │
│           │                        │          │         │   │
│ graphql   │ buildNetworkGraphData  │ 234ms    │ 12.3 KB │ 🔗│
│ arkiv     │ listAsks               │ 456ms    │ 8.7 KB  │ N/A │
│ graphql   │ fetchNetworkOverview   │ 189ms    │ 15.2 KB │ 🔗│
│ arkiv     │ listOffers             │ 389ms    │ 7.1 KB  │ N/A │
└─────────────────────────────────────────────────────────────┘
```

**API Endpoint:**

```
GET /api/admin/perf-samples?limit=20&source=graphql
```

### 1.5 Historical Performance Snapshots

**Visual Example:**

```
┌─────────────────────────────────────────────────────────────┐
│ Historical Performance Snapshots                             │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 2024-01-15 10:30:00                                    │  │
│ │ Method: both • Operation: buildNetworkGraphData        │  │
│ │ Block: 12345                                           │  │
│ │ [🔗 Verify]                                            │  │
│ │                                                         │  │
│ │ ┌──────────────┐  ┌──────────────┐                    │  │
│ │ │ JSON-RPC     │  │ GraphQL      │                    │  │
│ │ │ (n=32)       │  │ (n=45)       │                    │  │
│ │ │              │  │              │                    │  │
│ │ │ Avg: 456ms   │  │ Avg: 234ms   │                    │  │
│ │ │ Range: 230-  │  │ Range: 120-  │                    │  │
│ │ │       890ms  │  │       450ms  │                    │  │
│ │ │              │  │              │                    │  │
│ │ │ Pages:       │  │ Pages:       │                    │  │
│ │ │ /asks: 12    │  │ /network: 15 │                    │  │
│ │ │ /offers: 8   │  │ /me: 18      │                    │  │
│ │ └──────────────┘  └──────────────┘                    │  │
│ │                                                         │  │
│ │ Page Load: Avg 342ms (8/10 successful)                │  │
│ └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**API Endpoints:**

**Get Snapshots:**

```
GET /api/admin/perf-snapshots?limit=20
```

**Example Response:**

```json
{
  "ok": true,
  "snapshots": [
    {
      "key": "perf_snapshot:2024-01-15T10:30:00Z",
      "timestamp": "2024-01-15T10:30:00Z",
      "operation": "buildNetworkGraphData",
      "method": "both",
      "arkivMetadata": {
        "blockHeight": 12345,
        "chainId": 5001,
        "timestamp": "2024-01-15T10:30:00Z"
      },
      "graphql": {
        "avgDurationMs": 234.5,
        "minDurationMs": 120,
        "maxDurationMs": 450,
        "samples": 45,
        "pages": {
          "/network": 15,
          "/me": 18
        }
      },
      "arkiv": {
        "avgDurationMs": 456.2,
        "minDurationMs": 230,
        "maxDurationMs": 890,
        "samples": 32,
        "pages": {
          "/asks": 12,
          "/offers": 8
        }
      },
      "pageLoadTimes": {
        "avgDurationMs": 342,
        "minDurationMs": 120,
        "total": 10,
        "successful": 8
      },
      "txHash": "0xabc123..."
    }
  ]
}
```

**Create Snapshot:**

```
POST /api/admin/perf-snapshots?operation=buildNetworkGraphData&method=both
```

**Example Response:**

```json
{
  "ok": true,
  "snapshot": {
    "key": "perf_snapshot:2024-01-15T10:30:00Z",
    "txHash": "0xabc123...",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Check Auto-Snapshot Status:**

```
GET /api/admin/perf-snapshots?checkAuto=true&operation=buildNetworkGraphData
```

**Example Response:**

```json
{
  "ok": true,
  "shouldCreateSnapshot": false,
  "lastSnapshot": {
    "key": "perf_snapshot:2024-01-15T10:30:00Z",
    "timestamp": "2024-01-15T10:30:00Z",
    "hoursAgo": 2.5
  }
}
```

---

## Section 2: Beta Metrics

### 2.1 Client Performance (Web Vitals)

**Visual Example:**

```
┌─────────────────────────────────────────────────────────────┐
│ Client Performance (Web Vitals)                              │
│                                                              │
│ Total Samples: 150  │  Avg TTFB: 234ms  │  Avg LCP: 1.2s   │
│ Avg FCP: 890ms                                               │
│                                                              │
│ Page      │ TTFB │ FCP  │ LCP  │ FID  │ CLS  │ Date         │
│ /network  │ 234  │ 890  │ 1200 │ 45   │ 0.01 │ 2024-01-15  │
│ /me       │ 189  │ 756  │ 980  │ 32   │ 0.00 │ 2024-01-15  │
│ /asks     │ 456  │ 1234 │ 2100 │ 78   │ 0.05 │ 2024-01-14  │
└─────────────────────────────────────────────────────────────┘
```

**API Endpoint:**

```
GET /api/client-perf?limit=50
```

**Example Response:**

```json
{
  "ok": true,
  "metrics": [
    {
      "key": "client_perf:abc123",
      "page": "/network",
      "ttfb": 234,
      "fcp": 890,
      "lcp": 1200,
      "fid": 45,
      "cls": 0.01,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### 2.2 Retention Cohorts

**Visual Example:**

```
┌─────────────────────────────────────────────────────────────┐
│ Retention Cohorts                                            │
│                                                              │
│ Cohort Date │ Day 0 │ Day 1 │ Day 7 │ Day 14 │ Day 30 │ % │
│ 2024-01-08  │  25   │  18   │  12   │   8    │   5    │20%│
│ 2024-01-01  │  30   │  22   │  15   │  10    │   7    │23%│
│ 2023-12-25  │  20   │  15   │   9   │   6    │   4    │20%│
└─────────────────────────────────────────────────────────────┘
```

**API Endpoint:**

```
GET /api/admin/retention-cohorts?limit=20&period=weekly
```

**Example Response:**

```json
{
  "ok": true,
  "cohorts": [
    {
      "key": "retention_cohort:2024-01-08",
      "cohortDate": "2024-01-08",
      "day0": 25,
      "day1": 18,
      "day7": 12,
      "day14": 8,
      "day30": 5
    }
  ]
}
```

### 2.3 Daily Aggregates (Percentiles)

**Visual Example:**

```
┌─────────────────────────────────────────────────────────────┐
│ Daily Aggregates (Percentiles)                              │
│                                                              │
│ Date       │ Operation          │ Source │ p50 │ p90 │ p95 │ │
│            │                    │        │     │     │     │ │
│ 2024-01-15 │ buildNetworkGraph  │ graphql│ 234 │ 350 │ 450│ │
│ 2024-01-15 │ listAsks           │ arkiv  │ 456 │ 678 │ 890│ │
│ 2024-01-14 │ buildNetworkGraph  │ graphql│ 245 │ 365 │ 470│ │
└─────────────────────────────────────────────────────────────┘
```

**API Endpoint:**

```
GET /api/admin/metric-aggregates?limit=50&period=daily
```

**Example Response:**

```json
{
  "ok": true,
  "aggregates": [
    {
      "key": "metric_aggregate:2024-01-15:buildNetworkGraph:graphql",
      "date": "2024-01-15",
      "operation": "buildNetworkGraphData",
      "source": "graphql",
      "percentiles": {
        "p50": 234,
        "p90": 350,
        "p95": 450,
        "p99": 520,
        "avg": 245,
        "sampleCount": 45
      },
      "errorRate": 0.02
    }
  ]
}
```

---

## Section 3: User Feedback

### Visual Layout

```
┌─────────────────────────────────────────────────────────────┐
│ 💬 User Feedback  [Customer Support]                       │
│                                                              │
│ [▶ Expand]                                    [View All]    │
└─────────────────────────────────────────────────────────────┘
```

When expanded, shows recent feedback with action buttons:

### 3.1 Feedback Display

**Visual Example:**

```
┌─────────────────────────────────────────────────────────────┐
│ 💬 User Feedback                                             │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ /network  [issue]  ★★★★☆                              │  │
│ │                                                         │  │
│ │ "The network graph is slow to load. It takes about 5   │  │
│ │  seconds to see the connections. Also, the layout is   │  │
│ │  confusing on mobile."                                  │  │
│ │                                                         │  │
│ │ 2024-01-15                                              │  │
│ │                                                         │  │
│ │ [Respond] [Add to GitHub] [Mark Resolved]              │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ /me  [feedback]  ★★★★★                                │  │
│ │                                                         │  │
│ │ "Love the new profile page! The skills section is      │  │
│ │  really well designed."                                  │  │
│ │                                                         │  │
│ │ 2024-01-14                                              │  │
│ │                                                         │  │
│ │ [Respond]                                               │  │
│ └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Feedback Actions

Each feedback item has three action buttons (visual examples):

#### Button 1: Respond

**Visual:**

```
┌──────────┐
│ Respond  │  (Blue button, white text)
└──────────┘
```

**Behavior:**

- Opens a modal with the original feedback
- Shows textarea for admin response
- If response already exists, shows "View Response" instead
- Button changes to gray "View Response" after responding

**API Endpoint:**

```
POST /api/admin/response
Content-Type: application/json

{
  "feedbackKey": "app_feedback:abc123",
  "wallet": "0x1234...",
  "message": "Thank you for the feedback! We're working on improving the network graph performance.",
  "adminWallet": "0xadmin..."
}
```

**Example Response:**

```json
{
  "ok": true,
  "key": "admin_response:def456",
  "txHash": "0x789..."
}
```

**Get Existing Response:**

```
GET /api/admin/response?feedbackKey=app_feedback:abc123
```

**Example Response:**

```json
{
  "ok": true,
  "responses": [
    {
      "key": "admin_response:def456",
      "message": "Thank you for the feedback! We're working on improving the network graph performance.",
      "createdAt": "2024-01-15T11:00:00Z",
      "adminWallet": "0xadmin..."
    }
  ]
}
```

#### Button 2: Add to GitHub

**Visual:**

```
┌──────────────┐
│ Add to GitHub│  (Purple button, white text)
└──────────────┘
```

**Behavior:**

- Only shown for `issue` type feedback (not regular feedback)
- Creates a GitHub issue from the feedback
- After creation, button changes to "View Issue #123" (gray button)
- Opens GitHub issue in new tab

**API Endpoint:**

```
POST /api/github/create-issue
Content-Type: application/json

{
  "feedbackKey": "app_feedback:abc123",
  "page": "/network",
  "message": "The network graph is slow to load...",
  "rating": 4,
  "feedbackType": "issue",
  "wallet": "0x1234..."
}
```

**Example Response:**

```json
{
  "ok": true,
  "issueNumber": 123,
  "issueUrl": "https://github.com/org/repo/issues/123"
}
```

**Get GitHub Issue Links:**

```
GET /api/github/issue-links
```

**Example Response:**

```json
{
  "ok": true,
  "links": [
    {
      "feedbackKey": "app_feedback:abc123",
      "issueNumber": 123,
      "issueUrl": "https://github.com/org/repo/issues/123"
    }
  ]
}
```

#### Button 3: Mark Resolved

**Visual:**

```
┌──────────────┐
│Mark Resolved │  (Green button, white text)
└──────────────┘
```

**Behavior:**

- Only shown for `issue` type feedback that is not yet resolved
- Opens a modal asking for optional resolution note
- Marks feedback as resolved on Arkiv
- If GitHub issue exists, also closes it with resolution note
- Button disappears after resolution (shows "✓ Resolved" badge instead)

**API Endpoint:**

```
POST /api/app-feedback
Content-Type: application/json

{
  "action": "resolveFeedback",
  "feedbackKey": "app_feedback:abc123",
  "resolvedByWallet": "0xadmin..."
}
```

**Example Response:**

```json
{
  "ok": true,
  "key": "app_feedback_resolution:xyz789",
  "txHash": "0x456..."
}
```

**Close GitHub Issue:**

```
PATCH /api/github/close-issue
Content-Type: application/json

{
  "issueNumber": 123,
  "resolutionNote": "Fixed by optimizing network graph data loading. Performance improved by 60%."
}
```

**Example Response:**

```json
{
  "ok": true,
  "issueUrl": "https://github.com/org/repo/issues/123"
}
```

### 3.3 Feedback List API

**Get All Feedback:**

```
GET /api/app-feedback?limit=100&page=/network&since=2024-01-01&feedbackType=issue
```

**Query Parameters:**

- `limit`: Number of feedback items to return (default: all)
- `page`: Filter by page path (e.g., `/network`)
- `wallet`: Filter by user wallet address
- `since`: Filter by date (ISO timestamp or YYYY-MM-DD)
- `feedbackType`: Filter by type (`feedback` or `issue`)

**Example Response:**

```json
{
  "ok": true,
  "feedbacks": [
    {
      "key": "app_feedback:abc123",
      "wallet": "0x1234...",
      "page": "/network",
      "message": "The network graph is slow to load...",
      "rating": 4,
      "feedbackType": "issue",
      "createdAt": "2024-01-15T10:30:00Z",
      "txHash": "0x789...",
      "resolved": false,
      "hasResponse": true,
      "responseAt": "2024-01-15T11:00:00Z"
    }
  ]
}
```

### 3.4 Response Modal

**Visual Example:**

```
┌─────────────────────────────────────────────────────────────┐
│ Respond to Feedback                              [×]        │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Original Feedback:                                      │ │
│ │                                                         │ │
│ │ "The network graph is slow to load. It takes about 5   │ │
│ │  seconds to see the connections."                        │ │
│ │                                                         │ │
│ │ From: 0x1234... | Page: /network | 🐛 Issue            │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ Your Response *                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │                                                         │ │
│ │ [Textarea for response message]                         │ │
│ │                                                         │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Cancel]                                    [Send Response] │
└─────────────────────────────────────────────────────────────┘
```

When viewing an existing response:

```
┌─────────────────────────────────────────────────────────────┐
│ View Response                                    [×]        │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Original Feedback:                                      │ │
│ │                                                         │ │
│ │ "The network graph is slow to load..."                  │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Admin Response:                                         │ │
│ │                                                         │ │
│ │ "Thank you for the feedback! We're working on improving │ │
│ │  the network graph performance. Expect improvements in  │ │
│ │  the next release."                                      │ │
│ │                                                         │ │
│ │ Responded: 2024-01-15 11:00:00                         │ │
│ │ By: 0xadmin...                                          │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Close]                                                      │
└─────────────────────────────────────────────────────────────┘
```

### 3.5 Resolution Modal

**Visual Example:**

```
┌─────────────────────────────────────────────────────────────┐
│ Resolve Issue                                    [×]        │
│                                                              │
│ This will mark the issue as resolved on Arkiv and close the │
│ GitHub issue.                                               │
│                                                              │
│ Resolution Note (optional)                                   │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Fixed by optimizing network graph data loading.         │ │
│ │ Performance improved by 60%.                           │ │
│ │                                                         │ │
│ │ [This note will be added as a comment to the GitHub    │ │
│ │  issue.]                                                │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Cancel]                                    [Mark Resolved] │
└─────────────────────────────────────────────────────────────┘
```

---

## Full Feedback Page

The dashboard links to a dedicated feedback page at `/admin/feedback` that shows:

- Full table of all feedback with filters
- Columns: Date, Type, Wallet, Page, Rating, Message, Status, Transaction, Actions
- Filter by page path and date range
- All the same action buttons (Respond, Add to GitHub, Mark Resolved)

**Visual Example:**

```
┌─────────────────────────────────────────────────────────────┐
│ App Feedback                                                 │
│                                                              │
│ [Page Filter: /network] [Since: 2024-01-01] [Clear]        │
│                                                              │
│ Date      │ Type │ Wallet │ Page │ Rating │ Message │ ... │ │
│ 2024-01-15│ issue│ 0x1234 │/netw │ ★★★★☆ │ "Slow..."│ ...│ │
│ 2024-01-14│ feed │ 0x5678 │ /me  │ ★★★★★ │ "Love..." │ ...│ │
│                                                              │
│ Showing 2 feedback entries                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## API Summary

### Performance Metrics APIs

| Endpoint                                                 | Method | Purpose                        |
| -------------------------------------------------------- | ------ | ------------------------------ |
| `/api/admin/graphql-flags`                               | GET    | Get GraphQL migration status   |
| `/api/admin/perf-samples?summary=true`                   | GET    | Get performance summary        |
| `/api/admin/perf-samples?limit=20`                       | GET    | Get recent performance samples |
| `/api/admin/perf-samples?seed=true&method=both`          | GET    | Generate real performance data |
| `/api/admin/page-load-times?baseUrl=...`                 | GET    | Measure page load times        |
| `/api/admin/perf-snapshots?limit=20`                     | GET    | Get historical snapshots       |
| `/api/admin/perf-snapshots?operation=...&method=both`    | POST   | Create performance snapshot    |
| `/api/admin/perf-snapshots?checkAuto=true&operation=...` | GET    | Check if auto-snapshot needed  |

### Beta Metrics APIs

| Endpoint                                              | Method | Purpose                        |
| ----------------------------------------------------- | ------ | ------------------------------ |
| `/api/client-perf?limit=50`                           | GET    | Get client performance metrics |
| `/api/admin/retention-cohorts?limit=20&period=weekly` | GET    | Get retention cohort data      |
| `/api/admin/metric-aggregates?limit=50&period=daily`  | GET    | Get daily metric aggregates    |

### Feedback APIs

| Endpoint                                         | Method | Purpose                           |
| ------------------------------------------------ | ------ | --------------------------------- |
| `/api/app-feedback?limit=100&page=...&since=...` | GET    | Get app feedback list             |
| `/api/app-feedback`                              | POST   | Create or resolve feedback        |
| `/api/admin/response?feedbackKey=...`            | GET    | Get admin response to feedback    |
| `/api/admin/response`                            | POST   | Create admin response             |
| `/api/github/create-issue`                       | POST   | Create GitHub issue from feedback |
| `/api/github/issue-links`                        | GET    | Get GitHub issue links            |
| `/api/github/close-issue`                        | PATCH  | Close GitHub issue                |

---

## Authentication

The admin dashboard uses simple password-based authentication for beta. Access is controlled via:

1. Login page at `/admin/login`
2. Session stored in `sessionStorage` as `admin_authenticated`
3. Redirects to login if not authenticated

**⚠️ Security Note:** This is not production-ready authentication. Proper authentication (passkey/wallet allowlist) required before public release.

---

## Data Storage

All metrics and feedback are stored as **Arkiv entities** on-chain:

- Performance metrics → `DxMetric` entities
- Performance snapshots → `PerfSnapshot` entities
- App feedback → `AppFeedback` entities
- Admin responses → `AdminResponse` entities
- Client performance → `ClientPerf` entities
- Retention cohorts → `RetentionCohort` entities
- Metric aggregates → `MetricAggregate` entities

This ensures:

- **Transparency**: All data is verifiable on-chain
- **Immutability**: Historical data cannot be altered
- **Privacy**: User wallets are hashed for retention metrics
- **Auditability**: All admin actions are recorded with transaction hashes

---

## Usage Examples

### Example 1: Check Performance After Deployment

```bash
# 1. Test query performance to generate fresh metrics
curl "http://localhost:3000/api/admin/perf-samples?seed=true&method=both"

# 2. Get performance summary
curl "http://localhost:3000/api/admin/perf-samples?summary=true"

# 3. Create a snapshot for historical comparison
curl -X POST "http://localhost:3000/api/admin/perf-snapshots?operation=buildNetworkGraphData&method=both"
```

### Example 2: Respond to User Feedback

```bash
# 1. Get recent feedback
curl "http://localhost:3000/api/app-feedback?limit=5&feedbackType=issue"

# 2. Respond to feedback
curl -X POST "http://localhost:3000/api/admin/response" \
  -H "Content-Type: application/json" \
  -d '{
    "feedbackKey": "app_feedback:abc123",
    "wallet": "0x1234...",
    "message": "Thank you for reporting this! We are investigating.",
    "adminWallet": "0xadmin..."
  }'

# 3. Create GitHub issue for tracking
curl -X POST "http://localhost:3000/api/github/create-issue" \
  -H "Content-Type: application/json" \
  -d '{
    "feedbackKey": "app_feedback:abc123",
    "page": "/network",
    "message": "The network graph is slow...",
    "feedbackType": "issue"
  }'
```

### Example 3: Monitor Daily Performance

```bash
# 1. Get daily aggregates
curl "http://localhost:3000/api/admin/metric-aggregates?period=daily&limit=7"

# 2. Get retention metrics
curl "http://localhost:3000/api/admin/retention-cohorts?period=weekly&limit=4"

# 3. Get client performance metrics
curl "http://localhost:3000/api/client-perf?limit=100"
```

---

## Future Enhancements

- Real-time metrics updates via WebSocket
- Performance alerts when thresholds are exceeded
- Automated GitHub issue creation for critical issues
- Email notifications for high-priority feedback
- Performance trend charts and visualizations
- Export metrics to CSV/JSON for analysis
- Custom date range filtering for all metrics
- Comparison view between different time periods
