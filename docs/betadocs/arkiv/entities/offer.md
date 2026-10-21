# Offer Entity Schema

## Entity Type

`offer`

## Patterns Used

- [PAT-QUERY-001: Indexer-Friendly Query Shapes](../patterns/query-optimization.md) - Queries use indexed attributes (type, wallet, skill_id, space_id)
- [PAT-REF-001: Relationship References That Survive Updates](../patterns/reference-integrity.md) - References to Skill entities via skill_id attribute, Availability entities via availabilityKey
- [PAT-SPACE-001: Space ID as Environment Boundary](../patterns/space-isolation.md) - space_id attribute for data isolation

## Field Table

| Field Name         | Type    | Required | Location  | Description                                                                                                |
| ------------------ | ------- | -------- | --------- | ---------------------------------------------------------------------------------------------------------- | ------- |
| type               | string  | Yes      | Attribute | Always "offer"                                                                                             |
| wallet             | addr    | Yes      | Attribute | Wallet address of offerer (lowercase)                                                                      |
| skill              | string  | No       | Attribute | Skill name (legacy, kept for backward compatibility)                                                       |
| skill_id           | string  | No       | Attribute | Skill entity key (preferred for beta)                                                                      |
| skill_label        | string  | No       | Attribute | Skill display name (derived from Skill entity)                                                             |
| space_id           | string  | Yes      | Attribute | Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) |
| created_at         | u64     | Yes      | Attribute | Epoch ms                                                                                              |
| status             | string  | Yes      | Attribute | Always "active"                                                                                            |
| ttl_seconds        | string  | Yes      | Attribute | TTL in seconds (default: 604800)                                                                           |
| is_paid            | string  | Yes      | Attribute | "true"                                                                                                     | "false" |
| cost               | string  | No       | Attribute | Cost amount (required if isPaid is "true")                                                                 |
| payment_address    | string  | No       | Attribute | Payment receiving address (required if isPaid is "true")                                                   |
| availability_key   | string  | No       | Attribute | Reference to Availability entity key                                                                       |
| message            | string  | Yes      | Payload   | Offer description                                                                                          |
| availabilityWindow | string  | No       | Payload   | Availability description (text or WeeklyAvailability JSON)                                                 |
| isPaid             | boolean | Yes      | Payload   | Free/paid flag                                                                                             |
| cost               | string  | No       | Payload   | Cost amount (required if isPaid is true)                                                                   |
| paymentAddress     | string  | No       | Payload   | Payment receiving address (required if isPaid is true)                                                     |

Note: Either `skill` (legacy) or `skill_id` (beta) must be provided.

## Free vs Paid Offer Handling

### Free Offers

- `is_paid`: false (attribute and payload)
- `cost`: not set
- `payment_address`: not set
- No payment flow required

### Paid Offers

- `is_paid`: true (attribute and payload)
- `cost`: Required, string (e.g., "0.01 ETH per session")
- `payment_address`: Required, wallet address to receive payment
- Payment flow:
  1. Learner requests meeting from paid offer
  2. Session created with `requires_payment: true`, `payment_address`, `cost`
  3. Mentor confirms session
  4. Learner submits payment via `session_payment_submission` entity
  5. Mentor validates payment via `session_payment_validation` entity

Implementation: `lib/arkiv/offers.ts` - `createOffer()` validates that `cost` and `payment_address` are provided if `is_paid` is true.

## TTL/Expiration Handling

TTL uses a dual approach: client-side filtering for application logic, and Arkiv-level expiration for cleanup.

1. **Default TTL**: 604800 seconds (1 week, `OFFER_TTL_SECONDS`)
2. **Custom TTL**: Can be specified via the `createOffer()` `expiresIn` parameter (seconds, floored to an integer)
3. **Client-Side Filtering**: Application filters expired offers by checking `created_at + ttl_seconds < now` (allows `includeExpired` option)
4. **Arkiv-Level Expiration**: the entity's `expires` (`ExpirationTime`) tells Arkiv when to remove the entity from the network (hard deletion for cleanup)

Implementation: `lib/arkiv/offers.ts` - `createOffer()` stores `ttl_seconds` in attributes for client-side filtering and passes `lifetimeSeconds: ttl` to `createArkivEntity()`, which sets `expires: lifetimeFor('offer', ttl)` for network cleanup.

## Query Pattern

Fetch offers by wallet:

```typescript
const result = await arkivSelect('offer')
  .where(eqAttr('wallet', wallet.toLowerCase()))
  .limit(100)
  .fetch();
```

Fetch offers by skill:

```typescript
const result = await arkivSelect('offer')
  .where(eqAttr('skill_id', skillId))
  .limit(100)
  .fetch();
```

Implementation: `lib/arkiv/offers.ts` - `listOffers()`, `listOffersForWallet()`

## Entity Relationships

- Links to Skill entity via `skill_id` attribute (preferred) or `skill` attribute (legacy)
- Links to Availability entity via `availability_key` attribute (optional)
- Links to Session entities via `mentor_wallet` attribute (mentor's wallet matches offer wallet)

## Expiration

Default: 604800 seconds (1 week). Can be customized via the `createOffer()` `expiresIn` parameter, which becomes the entity lifetime (`lifetimeFor('offer', seconds)`).

## Transaction Hash Tracking

Separate `offer_txhash` entity (optional) tracks transaction hash:

- `type`: "offer_txhash"
- `offer_key`: Entity key of offer
- `wallet`: Wallet address
- `space_id`: "local-dev"
