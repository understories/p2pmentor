# Retention Metric Entity

## Overview

Privacy-preserving retention and cohort analysis. Uses one-way hashed wallets for internal calculations. Stores only aggregated results (no per-wallet history). Computed weekly via Vercel Cron.

**Entity Type:** `retention_cohort`  
**TTL:** 1 year (31536000 seconds)  
**Immutability:** Immutable - updates create new entities

## Attributes

- `type`: `'retention_cohort'` (required)
- `cohortDate`: Date string (YYYY-MM-DD format) (required)
- `period`: `'daily'` | `'weekly'` | `'monthly'` (required)
- `spaceId`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) (required)
- `createdAt`: ISO timestamp (required)

## Payload

```typescript
{
  cohortDate: string;        // YYYY-MM-DD - when users first appeared
  period: 'daily' | 'weekly' | 'monthly';
  day0: number;             // Users active on cohort date
  day1?: number;             // Users active 1 day later
  day7?: number;             // Users active 7 days later
  day14?: number;            // Users active 14 days later
  day30?: number;            // Users active 30 days later
  createdAt: string;         // ISO timestamp
}
```

## Key Fields

- **cohortDate**: Date when cohort was formed (YYYY-MM-DD)
- **period**: Aggregation period
- **day0**: Users active on cohort date
- **day1**: Users active 1 day later (optional)
- **day7**: Users active 7 days later (optional)
- **day14**: Users active 14 days later (optional)
- **day30**: Users active 30 days later (optional)

## Privacy-Preserving Hash

Wallets are hashed using one-way hash for privacy:

```typescript
import { keccak256, toBytes } from "viem";

function hashWalletForRetention(wallet: string): string {
  const normalized = wallet.toLowerCase().trim();
  return keccak256(toBytes(`p2pmentor-retention-v1:${normalized}`));
}
```

**Properties:**
- **One-way**: Cannot reverse to get original wallet
- **Deterministic**: Same wallet always produces same hash
- **Privacy-preserving**: No wallet addresses in retention data

## Query Patterns

### Get Cohorts

```typescript
import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient } from "@/lib/arkiv/client";

const publicClient = getPublicClient();
const result = await publicClient.buildQuery()
  .where(eq('type', 'retention_cohort'))
  .where(eq('period', 'weekly'))
  .withAttributes(true)
  .withPayload(true)
  .limit(20)
  .fetch();

const cohorts = result.entities
  .map(e => ({ ...e.attributes, ...JSON.parse(e.payload) }))
  .sort((a, b) => b.cohortDate.localeCompare(a.cohortDate));
```

### Calculate Retention Rate

```typescript
function calculateRetentionRate(cohort: RetentionCohort, days: number): number {
  const day0 = cohort.day0 || 0;
  const dayN = days === 1 ? cohort.day1 : 
               days === 7 ? cohort.day7 : 
               days === 14 ? cohort.day14 : 
               days === 30 ? cohort.day30 : 0;
  
  if (day0 === 0) return 0;
  return (dayN / day0) * 100;
}

// Example: 7-day retention
const retention7d = calculateRetentionRate(cohort, 7);
```

## Creation

```typescript
import { createRetentionCohort } from "@/lib/arkiv/retentionMetrics";
import { getPrivateKey } from "@/lib/config";

const { key, txHash } = await createRetentionCohort({
  cohortDate: '2024-01-08',
  period: 'weekly',
  day0: 25,
  day1: 18,
  day7: 12,
  day14: 8,
  day30: 5,
  privateKey: getPrivateKey(),
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

## Computation

Cohorts are computed from activity data:

```typescript
async function computeWeeklyCohort(cohortDate: string) {
  // 1. Get active wallets for cohort date (day 0)
  const day0Wallets = await getActiveWalletsForDate(cohortDate);
  const day0 = day0Wallets.length;
  
  // 2. Hash wallets for privacy
  const hashedDay0 = day0Wallets.map(hashWalletForRetention);
  
  // 3. Check activity on subsequent days
  const day1Date = addDays(cohortDate, 1);
  const day1Wallets = await getActiveWalletsForDate(day1Date);
  const hashedDay1 = day1Wallets.map(hashWalletForRetention);
  const day1 = hashedDay1.filter(h => hashedDay0.includes(h)).length;
  
  // Similar for day7, day14, day30...
  
  // 4. Create cohort
  return await createRetentionCohort({
    cohortDate,
    period: 'weekly',
    day0,
    day1,
    day7,
    day14,
    day30,
    privateKey: getPrivateKey(),
  });
}
```

## Transaction Hash Tracking

- `retention_cohort_txhash`: Transaction hash tracking, linked via `cohortKey` attribute

## Related Entities

- `user_profile`: User profiles (for activity detection)
- `ask`: Asks (for activity detection)
- `offer`: Offers (for activity detection)
- `session`: Sessions (for activity detection)

## Notes

- **Privacy-Preserving**: Uses one-way hashed wallets
- **Aggregated Only**: No per-wallet history stored
- **Weekly Computation**: Computed weekly via cron
- **Cohort Analysis**: Tracks user retention over time

## Example Use Case

Admin dashboard retention analysis:

```typescript
async function getRetentionReport() {
  const cohorts = await getRetentionCohorts('weekly', 4);
  
  return cohorts.map(cohort => ({
    cohortDate: cohort.cohortDate,
    day0: cohort.day0,
    day7: cohort.day7,
    day14: cohort.day14,
    day30: cohort.day30,
    retention7d: calculateRetentionRate(cohort, 7),
    retention30d: calculateRetentionRate(cohort, 30),
  }));
}
```

