# Arkiv-Native User Feedback System

## Overview

This document explains how we implement user feedback with blockchain data in a serverless, decentralized architecture. The feedback system handles both app feedback (user feedback about the app itself) and session feedback (peer-to-peer feedback after sessions).

**Key Challenge:** Managing feedback, responses, and resolution state in a decentralized environment where entities are immutable. Each state change creates a new entity, requiring efficient querying to get the latest state.

**Solution:** Store feedback as Arkiv entities with immutable updates. Use separate entities for resolutions and admin responses, querying them in parallel to build complete feedback state.

## Architecture

### Core Components

1. **App Feedback Entities** (`app_feedback`)
   - Created when users submit feedback or report issues
   - Immutable - each feedback is a separate entity
   - Contains: wallet, page, message, rating, feedbackType
   - TTL: 1 year (31536000 seconds)

2. **App Feedback Resolution Entities** (`app_feedback_resolution`)
   - Created when admins resolve feedback/issues
   - Immutable - each resolution is a separate entity
   - Contains: feedbackKey, resolvedBy, resolvedAt
   - TTL: 1 year (31536000 seconds)

3. **Admin Response Entities** (`admin_response`)
   - Created when admins respond to feedback
   - Immutable - each response is a separate entity
   - Contains: feedbackKey, message, adminWallet
   - TTL: 1 year (31536000 seconds)

4. **Session Feedback Entities** (`session_feedback`)
   - Created when users give feedback after sessions
   - Immutable - each feedback is a separate entity
   - Contains: sessionKey, feedbackFrom, feedbackTo, rating, notes
   - TTL: 1 year (31536000 seconds)

## Entity Structure

### App Feedback Entity

```typescript
type AppFeedback = {
  key: string;                    // Entity key
  wallet: string;                 // User wallet (normalized to lowercase)
  page: string;                   // Page where feedback was given
  message: string;                // Feedback message
  rating?: number;                // Optional 1-5 stars
  feedbackType?: 'feedback' | 'issue'; // Type of feedback
  spaceId: string;
  createdAt: string;             // ISO timestamp
  txHash?: string;               // Transaction hash
  // Resolution tracking (arkiv-native: query resolution entities)
  resolved?: boolean;            // Whether resolved
  resolvedAt?: string;           // When resolved
  resolvedBy?: string;           // Admin wallet that resolved
  // Response tracking (arkiv-native: query admin_response entities)
  hasResponse?: boolean;         // Whether admin responded
  responseAt?: string;          // When response was created
};
```

### Admin Response Entity

```typescript
type AdminResponse = {
  key: string;                    // Entity key
  feedbackKey: string;          // Reference to app_feedback entity
  wallet: string;                // User wallet (from feedback)
  message: string;               // Response message
  adminWallet: string;           // Admin wallet that responded
  spaceId: string;
  createdAt: string;            // ISO timestamp
  txHash?: string;               // Transaction hash
};
```

### Session Feedback Entity

```typescript
type Feedback = {
  key: string;                    // Entity key
  sessionKey: string;            // Reference to session entity
  mentorWallet: string;          // Mentor wallet
  learnerWallet: string;         // Learner wallet
  feedbackFrom: string;          // Wallet giving feedback
  feedbackTo: string;            // Wallet receiving feedback
  rating?: number;               // 1-5 stars
  notes?: string;                // Qualitative feedback
  technicalDxFeedback?: string;  // Technical DX feedback
  spaceId: string;
  createdAt: string;             // ISO timestamp
  txHash?: string;               // Transaction hash
};
```

## Immutable Update Pattern

### The Challenge

In a centralized system, feedback resolution is simple:
- Admin resolves feedback → Update database row → Done

In a decentralized system:
- No centralized database
- Entities are immutable (cannot be modified)
- Resolution creates a new entity
- Need to query resolution entities separately
- Need to combine feedback + resolution + response data

### Our Solution

**1. Separate Entities for State**

Feedback, resolution, and response are separate entities:
- `app_feedback`: The original feedback/issue
- `app_feedback_resolution`: Resolution state (created when resolved)
- `admin_response`: Admin response (created when admin responds)

**2. Parallel Query Pattern**

To get complete feedback state:
```typescript
// Query feedback, resolutions, and responses in parallel
const [feedbackResult, resolutionResult, responseResult] = await Promise.all([
  publicClient.buildQuery()
    .where(eq('type', 'app_feedback'))
    .withAttributes(true)
    .withPayload(true)
    .fetch(),
  publicClient.buildQuery()
    .where(eq('type', 'app_feedback_resolution'))
    .withAttributes(true)
    .withPayload(true)
    .fetch(),
  publicClient.buildQuery()
    .where(eq('type', 'admin_response'))
    .withAttributes(true)
    .withPayload(true)
    .fetch(),
]);

// Build maps for efficient lookup
const resolutionMap: Record<string, Resolution> = {};
resolutionResult.entities.forEach(entity => {
  const feedbackKey = getAttr('feedbackKey');
  resolutionMap[feedbackKey] = {
    resolvedAt: payload.resolvedAt,
    resolvedBy: getAttr('resolvedBy'),
  };
});

const responseMap: Record<string, Response> = {};
responseResult.entities.forEach(entity => {
  const feedbackKey = getAttr('feedbackKey');
  responseMap[feedbackKey] = {
    responseAt: payload.createdAt,
  };
});

// Combine feedback with resolution and response data
const feedbacks = feedbackResult.entities.map(entity => ({
  key: entity.key,
  wallet: getAttr('wallet'),
  message: payload.message,
  resolved: !!resolutionMap[entity.key],
  resolvedAt: resolutionMap[entity.key]?.resolvedAt,
  resolvedBy: resolutionMap[entity.key]?.resolvedBy,
  hasResponse: !!responseMap[entity.key],
  responseAt: responseMap[entity.key]?.responseAt,
}));
```

**3. Resolution Creation**

```typescript
// Create resolution entity (immutable update pattern)
const { key, txHash } = await resolveAppFeedback({
  feedbackKey,
  resolvedByWallet: adminWallet.toLowerCase(), // Normalize!
  privateKey,
});

// This creates a new app_feedback_resolution entity
// The original app_feedback entity remains unchanged
```

## Wallet Normalization

### Critical Pattern

**Rule:** Always normalize wallet addresses to lowercase when storing and querying.

**Implementation:**
```typescript
// ✅ Correct: Normalize when storing
attributes: [
  { key: 'wallet', value: wallet.toLowerCase() },
  { key: 'resolvedBy', value: resolvedByWallet.toLowerCase() },
  // ...
]

// ✅ Correct: Normalize when querying
if (wallet) {
  const normalizedWallet = wallet.toLowerCase();
  feedbacks = feedbacks.filter(f => f.wallet.toLowerCase() === normalizedWallet);
}
```

## Query Patterns

### List App Feedback

```typescript
export async function listAppFeedback({
  page,
  wallet,
  limit = 100,
  since,
  feedbackType,
}: {
  page?: string;
  wallet?: string;
  limit?: number;
  since?: string;
  feedbackType?: 'feedback' | 'issue';
} = {}): Promise<AppFeedback[]> {
  const publicClient = getPublicClient();
  
  // Fetch feedback, txHash, resolution, and response entities in parallel
  const [result, txHashResult, resolutionResult, responseResult] = await Promise.all([
    publicClient.buildQuery()
      .where(eq('type', 'app_feedback'))
      .withAttributes(true)
      .withPayload(true)
      .limit(limit || 100)
      .fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'app_feedback_txhash'))
      .withAttributes(true)
      .withPayload(true)
      .fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'app_feedback_resolution'))
      .withAttributes(true)
      .withPayload(true)
      .fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'admin_response'))
      .withAttributes(true)
      .withPayload(true)
      .fetch(),
  ]);
  
  // Build maps for efficient lookup
  const txHashMap: Record<string, string> = {};
  // ... build txHash map
  
  const resolutionMap: Record<string, Resolution> = {};
  // ... build resolution map
  
  const responseMap: Record<string, Response> = {};
  // ... build response map
  
  // Combine feedback with resolution and response data
  let feedbacks = result.entities.map(entity => {
    const feedbackKey = entity.key;
    const resolution = resolutionMap[feedbackKey];
    const response = responseMap[feedbackKey];
    
    return {
      key: feedbackKey,
      wallet: getAttr('wallet'),
      page: getAttr('page'),
      message: payload.message || '',
      rating: payload.rating,
      feedbackType: getAttr('feedbackType') || 'feedback',
      resolved: !!resolution,
      resolvedAt: resolution?.resolvedAt,
      resolvedBy: resolution?.resolvedBy,
      hasResponse: !!response,
      responseAt: response?.responseAt,
      txHash: txHashMap[feedbackKey],
    };
  });
  
  // Apply filters
  if (page) {
    feedbacks = feedbacks.filter(f => f.page === page);
  }
  if (wallet) {
    const normalizedWallet = wallet.toLowerCase();
    feedbacks = feedbacks.filter(f => f.wallet.toLowerCase() === normalizedWallet);
  }
  if (feedbackType) {
    feedbacks = feedbacks.filter(f => f.feedbackType === feedbackType);
  }
  if (since) {
    const sinceTime = new Date(since).getTime();
    feedbacks = feedbacks.filter(f => new Date(f.createdAt).getTime() >= sinceTime);
  }
  
  return feedbacks.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
```

### Get App Feedback by Key

```typescript
export async function getAppFeedbackByKey(key: string): Promise<AppFeedback | null> {
  const publicClient = getPublicClient();
  
  // Query feedback by key
  const result = await publicClient.buildQuery()
    .where(eq('type', 'app_feedback'))
    .where(eq('key', key))
    .withAttributes(true)
    .withPayload(true)
    .limit(1)
    .fetch();
  
  if (!result || !result.entities || result.entities.length === 0) {
    return null;
  }
  
  // Fetch txHash, resolution, and response in parallel
  const [txHashResult, resolutionResult, responseResult] = await Promise.all([
    publicClient.buildQuery()
      .where(eq('type', 'app_feedback_txhash'))
      .where(eq('feedbackKey', key))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'app_feedback_resolution'))
      .where(eq('feedbackKey', key))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'admin_response'))
      .where(eq('feedbackKey', key))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch(),
  ]);
  
  // Build complete feedback object
  const entity = result.entities[0];
  const resolution = resolutionResult.entities[0];
  const response = responseResult.entities[0];
  
  return {
    key: entity.key,
    wallet: getAttr('wallet'),
    page: getAttr('page'),
    message: payload.message || '',
    rating: payload.rating,
    feedbackType: getAttr('feedbackType') || 'feedback',
    resolved: !!resolution,
    resolvedAt: resolution ? (payload.resolvedAt || getAttr('createdAt')) : undefined,
    resolvedBy: resolution ? getAttr('resolvedBy') : undefined,
    hasResponse: !!response,
    responseAt: response ? getAttr('createdAt') : undefined,
    txHash: txHashResult.entities[0] ? decodeTxHash(txHashResult.entities[0]) : undefined,
  };
}
```

## Entity Creation Patterns

### Create App Feedback

```typescript
export async function createAppFeedback({
  wallet,
  page,
  message,
  rating,
  feedbackType = 'feedback',
  privateKey,
  spaceId = 'local-dev', // Default in library functions; API routes use SPACE_ID from config
}: {
  wallet: string;
  page: string;
  message: string;
  rating?: number;
  feedbackType?: 'feedback' | 'issue';
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();
  
  // Validate: either message OR rating must be provided
  const hasMessage = message && message.trim().length > 0;
  const hasRating = rating !== undefined && rating >= 1 && rating <= 5;
  if (!hasMessage && !hasRating) {
    throw new Error('Either a rating or feedback message is required');
  }
  
  // Create feedback entity
  const { entityKey, txHash } = await walletClient.createEntity({
    payload: enc.encode(JSON.stringify({
      message: hasMessage ? message.trim() : undefined,
      rating: hasRating ? rating : undefined,
      createdAt,
    })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'app_feedback' },
      { key: 'wallet', value: wallet.toLowerCase() }, // Normalize!
      { key: 'page', value: page },
      { key: 'feedbackType', value: feedbackType },
      { key: 'spaceId', value: spaceId },
      { key: 'createdAt', value: createdAt },
      ...(rating ? [{ key: 'rating', value: String(rating) }] : []),
    ],
    expiresIn: 31536000, // 1 year
  });
  
  // Create txHash entity for reliable querying
  await walletClient.createEntity({
    payload: enc.encode(JSON.stringify({ txHash })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'app_feedback_txhash' },
      { key: 'feedbackKey', value: entityKey },
      { key: 'wallet', value: wallet.toLowerCase() }, // Normalize!
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn: 31536000,
  });
  
  // Create notification for user
  await createNotification({
    wallet: wallet.toLowerCase(),
    notificationType: 'app_feedback_submitted',
    sourceEntityType: 'app_feedback',
    sourceEntityKey: entityKey,
    title: feedbackType === 'issue' ? 'Issue Reported' : 'Feedback Submitted',
    message: hasMessage ? message.substring(0, 100) : `Rating: ${rating}/5`,
    link: '/notifications',
    privateKey,
  });
  
  return { key: entityKey, txHash };
}
```

### Resolve App Feedback

```typescript
export async function resolveAppFeedback({
  feedbackKey,
  resolvedByWallet,
  privateKey,
  spaceId = 'local-dev', // Default in library functions; API routes use SPACE_ID from config
}: {
  feedbackKey: string;
  resolvedByWallet: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const resolvedAt = new Date().toISOString();
  
  // Create resolution entity (immutable update pattern)
  const { entityKey, txHash } = await walletClient.createEntity({
    payload: enc.encode(JSON.stringify({
      resolvedAt,
    })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'app_feedback_resolution' },
      { key: 'feedbackKey', value: feedbackKey },
      { key: 'resolvedBy', value: resolvedByWallet.toLowerCase() }, // Normalize!
      { key: 'spaceId', value: spaceId },
      { key: 'createdAt', value: resolvedAt },
    ],
    expiresIn: 31536000, // 1 year
  });
  
  // Create notification for user
  const feedback = await getAppFeedbackByKey(feedbackKey);
  if (feedback) {
    await createNotification({
      wallet: feedback.wallet.toLowerCase(),
      notificationType: 'issue_resolved',
      sourceEntityType: 'app_feedback',
      sourceEntityKey: feedbackKey,
      title: 'Issue Resolved',
      message: 'Your reported issue has been resolved',
      link: '/notifications',
      privateKey,
    });
  }
  
  return { key: entityKey, txHash };
}
```

### Create Session Feedback

```typescript
export async function createFeedback({
  sessionKey,
  mentorWallet,
  learnerWallet,
  feedbackFrom,
  feedbackTo,
  rating,
  notes,
  technicalDxFeedback,
  privateKey,
  spaceId = 'local-dev', // Default in library functions; API routes use SPACE_ID from config
}: {
  sessionKey: string;
  mentorWallet: string;
  learnerWallet: string;
  feedbackFrom: string;
  feedbackTo: string;
  rating?: number;
  notes?: string;
  technicalDxFeedback?: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();
  
  // Validate: cannot give feedback to yourself
  if (feedbackFrom.toLowerCase() === feedbackTo.toLowerCase()) {
    throw new Error('Cannot give feedback to yourself');
  }
  
  // Validate: check for duplicate feedback
  const hasGivenFeedback = await hasUserGivenFeedbackForSession(sessionKey, feedbackFrom);
  if (hasGivenFeedback) {
    throw new Error('You have already given feedback for this session');
  }
  
  // Create feedback entity
  const { entityKey, txHash } = await walletClient.createEntity({
    payload: enc.encode(JSON.stringify({
      rating: rating || undefined,
      notes: notes || undefined,
      technicalDxFeedback: technicalDxFeedback || undefined,
      createdAt,
    })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'session_feedback' },
      { key: 'sessionKey', value: sessionKey },
      { key: 'mentorWallet', value: mentorWallet.toLowerCase() }, // Normalize!
      { key: 'learnerWallet', value: learnerWallet.toLowerCase() }, // Normalize!
      { key: 'feedbackFrom', value: feedbackFrom.toLowerCase() }, // Normalize!
      { key: 'feedbackTo', value: feedbackTo.toLowerCase() }, // Normalize!
      { key: 'spaceId', value: spaceId },
      { key: 'createdAt', value: createdAt },
      ...(rating ? [{ key: 'rating', value: String(rating) }] : []),
    ],
    expiresIn: 31536000, // 1 year
  });
  
  return { key: entityKey, txHash };
}
```

## Attribute vs Payload

### Attributes (Queryable)

Use for fields that need to be queried:
- `type`: Entity type ('app_feedback', 'app_feedback_resolution', 'admin_response', 'session_feedback')
- `wallet`: User wallet (normalized to lowercase)
- `page`: Page where feedback was given
- `feedbackType`: 'feedback' or 'issue'
- `rating`: Rating (1-5) as string attribute
- `feedbackKey`: Reference to app_feedback entity (for resolutions/responses)
- `sessionKey`: Reference to session entity (for session feedback)
- `resolvedBy`: Admin wallet that resolved (normalized to lowercase)
- `spaceId`: Space ID
- `createdAt`: ISO timestamp

### Payload (Content)

Use for user-facing content:
- `message`: Feedback message text
- `rating`: Rating as number (also in attributes for querying)
- `notes`: Session feedback notes
- `technicalDxFeedback`: Technical DX feedback
- `resolvedAt`: Resolution timestamp

## Expected and Found Issues

### Issue 1: Feedback Details Not Loading

**Problem:** When loading feedback details by key, the query was inefficient and sometimes failed.

**Solution:** Added `getAppFeedbackByKey` function that queries by entity key directly, and fetches resolution/response entities in parallel.

**Status:** ✅ Solved

### Issue 2: Resolution State Not Visible

**Problem:** Resolution state was stored in separate entities but not being queried and combined with feedback.

**Solution:** Query resolution and response entities in parallel, build maps, and combine with feedback data when listing or getting feedback.

**Status:** ✅ Solved

### Issue 3: Admin Response Not Loading

**Problem:** Admin responses were not being loaded when displaying feedback details.

**Solution:** Query `admin_response` entities in parallel with feedback, build response map, and include response data in feedback objects.

**Status:** ✅ Solved

### Issue 4: Wallet Case Sensitivity

**Problem:** Wallet addresses stored with mixed case would not match queries using different case.

**Solution:** Always normalize wallet addresses to lowercase in both storage and queries.

**Status:** ✅ Solved

## Best Practices

### 1. Always Normalize Wallet Addresses

Normalize to lowercase in both storage and queries to prevent case-sensitivity bugs.

### 2. Query Related Entities in Parallel

When building complete feedback state, query feedback, resolution, and response entities in parallel for efficiency.

### 3. Build Maps for Efficient Lookup

Build maps (feedbackKey -> resolution, feedbackKey -> response) for O(1) lookup when combining data.

### 4. Validate Before Creating

Check for duplicate feedback, validate session state, and ensure feedback is allowed before creating entities.

### 5. Create Notifications

Create notifications when feedback is submitted, resolved, or responded to, so users are informed of state changes.

### 6. Handle Transaction Timeouts

Use `handleTransactionWithTimeout` for all entity creation to handle testnet timeouts gracefully.

### 7. Defensive Querying

Always validate result structure before processing. Return empty arrays or null on query failures.

## API Endpoints

### GET /api/app-feedback

List app feedback.

**Query Params:**
- `wallet`: User wallet address (optional)
- `page`: Page where feedback was given (optional)
- `feedbackType`: 'feedback' or 'issue' (optional)
- `since`: ISO timestamp to filter by (optional)
- `limit`: Maximum number of results (optional)
- `key`: Specific feedback key (optional, returns single feedback)

**Response:**
```json
{
  "ok": true,
  "feedbacks": [
    {
      "key": "...",
      "wallet": "0x...",
      "page": "/network",
      "message": "Great feature!",
      "rating": 5,
      "feedbackType": "feedback",
      "resolved": false,
      "hasResponse": true,
      "createdAt": "2025-01-01T00:00:00Z",
      "txHash": "0x..."
    }
  ]
}
```

### POST /api/app-feedback

Create app feedback.

**Body:**
```json
{
  "wallet": "0x...",
  "page": "/network",
  "message": "Great feature!",
  "rating": 5,
  "feedbackType": "feedback"
}
```

### GET /api/admin/response

Get admin response by feedback key or response key.

**Query Params:**
- `feedbackKey`: Feedback entity key (optional)
- `key`: Response entity key (optional)

**Response:**
```json
{
  "ok": true,
  "responses": [
    {
      "key": "...",
      "feedbackKey": "...",
      "wallet": "0x...",
      "message": "Thank you for your feedback!",
      "adminWallet": "0x...",
      "createdAt": "2025-01-01T00:00:00Z",
      "txHash": "0x..."
    }
  ]
}
```

## Query Patterns

### Get Feedback with Resolution and Response

```typescript
// 1. Query feedback by key
const feedback = await getAppFeedbackByKey(feedbackKey);

// 2. Query resolution and response in parallel (done internally)
// Returns complete feedback object with resolved, resolvedAt, resolvedBy,
// hasResponse, and responseAt fields populated
```

### List Feedback with Filters

```typescript
// 1. Query all feedback, resolution, and response entities in parallel
const feedbacks = await listAppFeedback({
  wallet: userWallet.toLowerCase(),
  feedbackType: 'issue',
  since: '2025-01-01T00:00:00Z',
  limit: 50,
});

// 2. Feedback objects include resolved, resolvedAt, resolvedBy,
// hasResponse, and responseAt fields
```

### Check for Duplicate Session Feedback

```typescript
// Check if user has already given feedback for a session
const hasGivenFeedback = await hasUserGivenFeedbackForSession(sessionKey, feedbackFrom);

if (hasGivenFeedback) {
  throw new Error('You have already given feedback for this session');
}
```

## Future Considerations

### 1. Feedback Aggregation

Currently, feedback is stored individually. Consider:
- Aggregate feedback by page or feature
- Calculate average ratings per page
- Track feedback trends over time

### 2. Feedback Threading

Currently, admin responses are single responses. Consider:
- Multiple response support
- Response threading
- User follow-up capability

### 3. Feedback Analytics

Consider:
- Feedback volume tracking
- Resolution time metrics
- Response rate tracking
- User satisfaction trends

### 4. Feedback Expiration

Feedback has 1 year TTL. Consider:
- Auto-renewal for unresolved issues
- Archival for resolved feedback
- Graceful degradation for expired feedback

## Related Documentation

- [App Feedback Entity](/docs/arkiv/additional-entities/app-feedback)
- [Admin Response Entity](/docs/arkiv/additional-entities/admin-response)
- [Notification System](/docs/architecture/modules/notification-system)

## Summary

The Arkiv-native feedback system uses immutable entities to track feedback, resolutions, and responses in a decentralized environment. Key patterns:

1. **Separate Entities:** Feedback, resolution, and response are separate entities
2. **Parallel Queries:** Query related entities in parallel for efficiency
3. **Map-Based Lookup:** Build maps for O(1) lookup when combining data
4. **Wallet Normalization:** Always normalize wallet addresses to lowercase
5. **Immutable Updates:** Resolution and response create new entities, original feedback unchanged
6. **Notification Integration:** Create notifications for feedback submission, resolution, and responses

This approach provides a robust, decentralized feedback system that works without a centralized database, preserving full history for audit and allowing admins to track and respond to user feedback effectively.

