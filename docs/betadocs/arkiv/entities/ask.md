# Ask Entity Schema

## Entity Type
`ask`

## Patterns Used

- [PAT-QUERY-001: Indexer-Friendly Query Shapes](./patterns/query-optimization.md) - Queries use indexed attributes (type, wallet, skill_id, spaceId)
- [PAT-REF-001: Relationship References That Survive Updates](./patterns/reference-integrity.md) - References to Skill entities via skill_id attribute
- [PAT-SPACE-001: Space ID as Environment Boundary](./patterns/space-isolation.md) - spaceId attribute for data isolation

## Field Table

| Field Name | Type | Required | Location | Description |
|------------|------|----------|----------|-------------|
| type | string | Yes | Attribute | Always "ask" |
| wallet | string | Yes | Attribute | Wallet address of asker (lowercase) |
| skill | string | No | Attribute | Skill name (legacy, kept for backward compatibility) |
| skill_id | string | No | Attribute | Skill entity key (preferred for beta) |
| skill_label | string | No | Attribute | Skill display name (derived from Skill entity) |
| spaceId | string | Yes | Attribute | Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) |
| createdAt | string | Yes | Attribute | ISO timestamp |
| status | string | Yes | Attribute | Always "open" |
| ttlSeconds | string | Yes | Attribute | TTL in seconds (default: 3600) |
| message | string | Yes | Payload | Ask description |

Note: Either `skill` (legacy) or `skill_id` (beta) must be provided.

## TTL/Expiration Handling

TTL uses a dual approach: client-side filtering for application logic, and Arkiv-level expiration for cleanup.

1. **Default TTL**: 3600 seconds (1 hour)
2. **Custom TTL**: Can be specified via `expiresIn` parameter (must be integer, BigInt requirement)
3. **Client-Side Filtering**: Application filters expired asks by checking `createdAt + ttlSeconds < now` (allows `includeExpired` option)
4. **Arkiv-Level Expiration**: `expiresIn` parameter tells Arkiv when to remove entity from network (hard deletion for cleanup)

Implementation: `lib/arkiv/asks.ts` - `createAsk()` stores `ttlSeconds` in attributes for client-side filtering and passes `expiresIn: ttl` to Arkiv for network cleanup.

Query pattern (client-side filtering):

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'ask'))
  .where(eq('status', 'open'))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

// Client-side filtering based on createdAt + ttlSeconds
const now = Date.now();
const activeAsks = result.entities.filter(ask => {
  const created = new Date(ask.createdAt).getTime();
  const expires = created + (ask.ttlSeconds * 1000);
  return expires > now;
});
```

## Query Pattern

Fetch asks by wallet:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'ask'))
  .where(eq('wallet', wallet.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

Fetch asks by skill:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'ask'))
  .where(eq('skill_id', skillId))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

Implementation: `lib/arkiv/asks.ts` - `listAsks()`, `listAsksForWallet()`

## Entity Relationships

- Links to Skill entity via `skill_id` attribute (preferred) or `skill` attribute (legacy)
- Links to Session entities via `learnerWallet` attribute (learner's wallet matches ask wallet)

## Expiration

Default: 3600 seconds (1 hour). Can be customized via `expiresIn` parameter.

## Transaction Hash Tracking

Separate `ask_txhash` entity (optional) tracks transaction hash:
- `type`: "ask_txhash"
- `askKey`: Entity key of ask
- `wallet`: Wallet address
- `spaceId`: "local-dev"


