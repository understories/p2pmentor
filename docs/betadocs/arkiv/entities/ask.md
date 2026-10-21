# Ask Entity Schema

## Entity Type

`ask`

## Patterns Used

- [PAT-QUERY-001: Indexer-Friendly Query Shapes](../patterns/query-optimization.md) - Queries use indexed attributes (type, wallet, skill_id, space_id)
- [PAT-REF-001: Relationship References That Survive Updates](../patterns/reference-integrity.md) - References to Skill entities via skill_id attribute
- [PAT-SPACE-001: Space ID as Environment Boundary](../patterns/space-isolation.md) - space_id attribute for data isolation

## Field Table

| Field Name  | Type   | Required | Location  | Description                                                                                                |
| ----------- | ------ | -------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| type        | string | Yes      | Attribute | Always "ask"                                                                                               |
| wallet      | addr   | Yes      | Attribute | Wallet address of asker (lowercase)                                                                        |
| skill       | string | No       | Attribute | Skill name (legacy, kept for backward compatibility)                                                       |
| skill_id    | string | No       | Attribute | Skill entity key (preferred for beta)                                                                      |
| skill_label | string | No       | Attribute | Skill display name (derived from Skill entity)                                                             |
| space_id    | string | Yes      | Attribute | Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) |
| created_at  | u64    | Yes      | Attribute | Epoch ms                                                                                              |
| status      | string | Yes      | Attribute | Always "open"                                                                                              |
| ttl_seconds | string | Yes      | Attribute | TTL in seconds (default: 604800)                                                                           |
| message     | string | Yes      | Payload   | Ask description                                                                                            |

Note: Either `skill` (legacy) or `skill_id` (beta) must be provided.

## TTL/Expiration Handling

TTL uses a dual approach: client-side filtering for application logic, and Arkiv-level expiration for cleanup.

1. **Default TTL**: 604800 seconds (1 week, `ASK_TTL_SECONDS`)
2. **Custom TTL**: Can be specified via the `createAsk()` `expiresIn` parameter (seconds, floored to an integer)
3. **Client-Side Filtering**: Application filters expired asks by checking `created_at + ttl_seconds < now` (allows `includeExpired` option)
4. **Arkiv-Level Expiration**: the entity's `expires` (`ExpirationTime`) tells Arkiv when to remove the entity from the network (hard deletion for cleanup)

Implementation: `lib/arkiv/asks.ts` - `createAsk()` stores `ttl_seconds` in attributes for client-side filtering and passes `lifetimeSeconds: ttl` to `createArkivEntity()`, which sets `expires: lifetimeFor('ask', ttl)` for network cleanup.

Query pattern (client-side filtering):

```typescript
const result = await arkivSelect('ask')
  .where(eqAttr('status', 'open'))
  .limit(100)
  .fetch();

// Client-side filtering based on created_at + ttl_seconds
const now = Date.now();
const activeAsks = result.entities.filter((entity) => {
  const created = new Date(getAttr(entity, 'created_at')).getTime();
  const expires = created + Number(getAttr(entity, 'ttl_seconds')) * 1000;
  return expires > now;
});
```

## Query Pattern

Fetch asks by wallet:

```typescript
const result = await arkivSelect('ask')
  .where(eqAttr('wallet', wallet.toLowerCase()))
  .limit(100)
  .fetch();
```

Fetch asks by skill:

```typescript
const result = await arkivSelect('ask')
  .where(eqAttr('skill_id', skillId))
  .limit(100)
  .fetch();
```

Implementation: `lib/arkiv/asks.ts` - `listAsks()`, `listAsksForWallet()`

## Entity Relationships

- Links to Skill entity via `skill_id` attribute (preferred) or `skill` attribute (legacy)
- Links to Session entities via `learner_wallet` attribute (learner's wallet matches ask wallet)

## Expiration

Default: 604800 seconds (1 week). Can be customized via the `createAsk()` `expiresIn` parameter, which becomes the entity lifetime (`lifetimeFor('ask', seconds)`).

## Transaction Hash Tracking

Separate `ask_txhash` entity (optional) tracks transaction hash:

- `type`: "ask_txhash"
- `ask_key`: Entity key of ask
- `wallet`: Wallet address
- `space_id`: "local-dev"
