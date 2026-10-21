# Onboarding Event Entity

## Overview

Tracks onboarding progress events (e.g., `network_explored`, `onboarding_started`, `onboarding_completed`). Used to determine onboarding level without creating a dedicated onboarding entity. Enables progressive onboarding experiences.

**Entity Type:** `onboarding_event`  
**TTL:** 90 days (`onboarding_event` lifetime in `lib/arkiv/schema.ts`)  
**Immutability:** Immutable - updates create new entities. Created with the `readonly` flag, so it can never be patched

## Attributes

- `type`: `'onboarding_event'` (required)
- `wallet`: Wallet address (required, lowercase)
- `event_type`: Event type (required)
- `space_id`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) (required)
- `created_at`: `u64` epoch milliseconds (required)

## Payload

```typescript
{
  wallet: string; // Wallet address
  eventType: OnboardingEventType;
  createdAt: string; // ISO timestamp
}
```

## Event Types

```typescript
type OnboardingEventType =
  | 'network_explored' // User explored network view
  | 'onboarding_started' // User started onboarding
  | 'onboarding_completed'; // User completed onboarding
```

## Key Fields

- **wallet**: User wallet address
- **eventType**: Type of onboarding event
- **createdAt**: When event occurred

## Query Patterns

### Get All Events for Wallet

```typescript
import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, attrsToRecord, parsePayload } from '@/lib/arkiv/read';

const result = await arkivSelect('onboarding_event')
  .where(eqAttr('wallet', walletAddress.toLowerCase()))
  .limit(100)
  .fetch();

const events = result.entities
  .map((e) => ({ ...attrsToRecord(e), ...parsePayload(e) }))
  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
```

### Check if Event Occurred

```typescript
async function hasEventOccurred(wallet: string, eventType: OnboardingEventType): Promise<boolean> {
  const result = await arkivSelect('onboarding_event')
    .where(eqAttr('wallet', wallet.toLowerCase()))
    .where(eqAttr('event_type', eventType))
    .limit(1)
    .fetch();

  return result.entities.length > 0;
}
```

### Get Onboarding Level

```typescript
async function getOnboardingLevel(wallet: string): Promise<number> {
  const events = await getOnboardingEvents(wallet);

  if (events.some((e) => e.eventType === 'onboarding_completed')) {
    return 3; // Completed
  }

  if (events.some((e) => e.eventType === 'onboarding_started')) {
    return 2; // In progress
  }

  if (events.some((e) => e.eventType === 'network_explored')) {
    return 1; // Explored
  }

  return 0; // Not started
}
```

## Creation

```typescript
import { createOnboardingEvent } from '@/lib/arkiv/onboardingEvent';
import { getWalletClientFromMetaMask } from '@/lib/arkiv/client';

const walletClient = await getWalletClientFromMetaMask();
const { key, txHash } = await createOnboardingEvent({
  wallet: walletAddress,
  eventType: 'network_explored',
  privateKey: walletClient.account.privateKey,
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

## Transaction Hash Tracking

- `onboarding_event_txhash`: Transaction hash tracking, linked via `event_key` attribute

## Example Use Cases

### Track Network Exploration

```typescript
// When user visits network page for first time
if (!(await hasEventOccurred(wallet, 'network_explored'))) {
  await createOnboardingEvent({
    wallet,
    eventType: 'network_explored',
    privateKey: userPrivateKey,
  });
}
```

### Track Onboarding Start

```typescript
// When user starts onboarding flow
await createOnboardingEvent({
  wallet,
  eventType: 'onboarding_started',
  privateKey: userPrivateKey,
});
```

### Track Onboarding Completion

```typescript
// When user completes onboarding
await createOnboardingEvent({
  wallet,
  eventType: 'onboarding_completed',
  privateKey: userPrivateKey,
});
```

## Related Entities

- `user_profile`: User profile linked via wallet address

## Notes

- **Event-Based**: Uses events instead of state entity
- **Progressive**: Enables progressive onboarding experiences
- **Level Calculation**: Onboarding level computed from events
- **Idempotent**: Creating same event multiple times is safe (creates multiple entities)

## Onboarding Flow

Typical onboarding flow:

1. **Network Explored**: User visits network page → `network_explored` event
2. **Onboarding Started**: User clicks "Get Started" → `onboarding_started` event
3. **Onboarding Completed**: User completes profile → `onboarding_completed` event

## Level Determination

```typescript
function determineOnboardingLevel(events: OnboardingEvent[]): number {
  const eventTypes = new Set(events.map((e) => e.eventType));

  if (eventTypes.has('onboarding_completed')) return 3;
  if (eventTypes.has('onboarding_started')) return 2;
  if (eventTypes.has('network_explored')) return 1;
  return 0;
}
```
