# Offer Entity Schema

## Entity Type
`offer`

## Field Table

| Field Name | Type | Required | Location | Description |
|------------|------|----------|----------|-------------|
| type | string | Yes | Attribute | Always "offer" |
| wallet | string | Yes | Attribute | Wallet address of offerer (lowercase) |
| skill | string | No | Attribute | Skill name (legacy, kept for backward compatibility) |
| skill_id | string | No | Attribute | Skill entity key (preferred for beta) |
| skill_label | string | No | Attribute | Skill display name (derived from Skill entity) |
| spaceId | string | Yes | Attribute | Currently "local-dev" |
| createdAt | string | Yes | Attribute | ISO timestamp |
| status | string | Yes | Attribute | Always "active" |
| ttlSeconds | string | Yes | Attribute | TTL in seconds (default: 7200) |
| isPaid | string | Yes | Attribute | "true" | "false" |
| cost | string | No | Attribute | Cost amount (required if isPaid is "true") |
| paymentAddress | string | No | Attribute | Payment receiving address (required if isPaid is "true") |
| availabilityKey | string | No | Attribute | Reference to Availability entity key |
| message | string | Yes | Payload | Offer description |
| availabilityWindow | string | No | Payload | Availability description (text or WeeklyAvailability JSON) |
| isPaid | boolean | Yes | Payload | Free/paid flag |
| cost | string | No | Payload | Cost amount (required if isPaid is true) |
| paymentAddress | string | No | Payload | Payment receiving address (required if isPaid is true) |

Note: Either `skill` (legacy) or `skill_id` (beta) must be provided.

## Free vs Paid Offer Handling

### Free Offers
- `isPaid`: false (attribute and payload)
- `cost`: not set
- `paymentAddress`: not set
- No payment flow required

### Paid Offers
- `isPaid`: true (attribute and payload)
- `cost`: Required, string (e.g., "0.01 ETH per session")
- `paymentAddress`: Required, wallet address to receive payment
- Payment flow:
  1. Learner requests meeting from paid offer
  2. Session created with `requiresPayment: true`, `paymentAddress`, `cost`
  3. Mentor confirms session
  4. Learner submits payment via `session_payment_submission` entity
  5. Mentor validates payment via `session_payment_validation` entity

Implementation: `lib/arkiv/offers.ts` - `createOffer()` validates that `cost` and `paymentAddress` are provided if `isPaid` is true.

## TTL/Expiration Handling

TTL uses a dual approach: client-side filtering for application logic, and Arkiv-level expiration for cleanup.

1. **Default TTL**: 7200 seconds (2 hours)
2. **Custom TTL**: Can be specified via `expiresIn` parameter (must be integer, BigInt requirement)
3. **Client-Side Filtering**: Application filters expired offers by checking `createdAt + ttlSeconds < now` (allows `includeExpired` option)
4. **Arkiv-Level Expiration**: `expiresIn` parameter tells Arkiv when to remove entity from network (hard deletion for cleanup)

Implementation: `lib/arkiv/offers.ts` - `createOffer()` stores `ttlSeconds` in attributes for client-side filtering and passes `expiresIn: ttl` to Arkiv for network cleanup.

## Query Pattern

Fetch offers by wallet:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'offer'))
  .where(eq('wallet', wallet.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

Fetch offers by skill:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'offer'))
  .where(eq('skill_id', skillId))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

Implementation: `lib/arkiv/offers.ts` - `listOffers()`, `listOffersForWallet()`

## Entity Relationships

- Links to Skill entity via `skill_id` attribute (preferred) or `skill` attribute (legacy)
- Links to Availability entity via `availabilityKey` attribute (optional)
- Links to Session entities via `mentorWallet` attribute (mentor's wallet matches offer wallet)

## Expiration

Default: 7200 seconds (2 hours). Can be customized via `expiresIn` parameter.

## Transaction Hash Tracking

Separate `offer_txhash` entity (optional) tracks transaction hash:
- `type`: "offer_txhash"
- `offerKey`: Entity key of offer
- `wallet`: Wallet address
- `spaceId`: "local-dev"


