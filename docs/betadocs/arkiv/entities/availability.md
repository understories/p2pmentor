# Availability Entity Schema

## Entity Type

`availability`

## Patterns Used

- [PAT-DELETE-001: Deletion Patterns](../patterns/deletion-patterns.md) - Deletion via marker entities (availability_deletion)
- [PAT-QUERY-001: Indexer-Friendly Query Shapes](../patterns/query-optimization.md) - Queries use indexed attributes (type, wallet, space_id)
- [PAT-SPACE-001: Space ID as Environment Boundary](../patterns/space-isolation.md) - space_id attribute for data isolation

## Field Table

| Field Name          | Type   | Required | Location  | Description                                                                                                |
| ------------------- | ------ | -------- | --------- | ---------------------------------------------------------------------------------------------------------- | --------------- |
| type                | string | Yes      | Attribute | Always "availability"                                                                                      |
| wallet              | addr   | Yes      | Attribute | Wallet address (lowercase)                                                                                 |
| space_id            | string | Yes      | Attribute | Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) |
| created_at          | u64    | Yes      | Attribute | Epoch ms                                                                                              |
| timezone            | string | Yes      | Attribute | IANA timezone (e.g., "America/New_York")                                                                   |
| availability_version | string | Yes      | Attribute | "1.0" (structured)                                                                                         | "legacy" (text) |
| timeBlocks          | string | Yes      | Payload   | JSON string (WeeklyAvailability) or legacy text                                                            |
| timezone            | string | Yes      | Payload   | IANA timezone                                                                                              |
| createdAt           | string | Yes      | Payload   | ISO timestamp                                                                                              |

## Timezone Storage and Conversion Approach

### Storage

- Timezone stored in both attribute and payload as IANA timezone string (e.g., "America/New_York")
- Availability time blocks stored in user's timezone (not converted to UTC)
- Conversion happens client-side when displaying to viewers in different timezones

### Conversion Logic

1. **Storage**: Availability stored in user's timezone (no conversion)
2. **Display**: Convert to viewer's timezone when displaying
3. **Validation**: When scheduling session, convert requested time to mentor's timezone and validate against availability

Implementation: `lib/arkiv/availability.ts` - `validateDateTimeAgainstAvailability()` converts requested time to availability timezone and checks against time slots.

Example conversion:

```typescript
// User sets availability: Monday 10:00-12:00 in Europe/Berlin
// Viewer in America/New_York (6 hours behind) sees: Monday 04:00-06:00
// Conversion happens client-side using timezone libraries
```

## Structured vs Legacy Format

### Structured Format (Version 1.0)

Stored as JSON string in `timeBlocks` payload:

```json
{
  "version": "1.0",
  "timezone": "America/New_York",
  "days": {
    "monday": {
      "available": true,
      "timeSlots": [{"start": "09:00", "end": "17:00"}]
    },
    "tuesday": {
      "available": true,
      "timeSlots": [{"start": "09:00", "end": "17:00"}]
    },
    ...
  }
}
```

### Legacy Format

Stored as plain text string in `timeBlocks` payload:

- Example: "Mon-Fri 9am-5pm EST"
- Less precise, cannot validate specific time slots
- Still supported for backward compatibility

Implementation: `lib/arkiv/availability.ts` - `createAvailability()` detects format and sets `availability_version` attribute accordingly.

## Query Pattern

Fetch availability for a wallet:

```typescript
const result = await arkivSelect('availability')
  .where(eqAttr('wallet', wallet.toLowerCase()))
  .limit(100)
  .fetch();

// Filter out deleted availability (arkiv-native deletion pattern)
const deletions = await arkivSelect('availability_deletion')
  .where(eqAttr('wallet', wallet.toLowerCase()))
  .limit(100)
  .fetch();

const deletedKeys = new Set(deletions.entities.map((e) => getAttr(e, 'availability_key')));
const activeAvailability = result.entities.filter((e) => !deletedKeys.has(e.key));
```

Implementation: `lib/arkiv/availability.ts` - `listAvailabilityForWallet()` handles deletion filtering.

## Deletion Pattern

Arkiv entities are immutable. To delete availability:

1. Create `availability_deletion` entity with `availability_key` reference
2. Query filters out deleted availability by checking for deletion markers
3. Original availability entity remains on-chain (not actually deleted)

Deletion entity:

- `type`: "availability_deletion"
- `availability_key`: Entity key of availability being deleted
- `wallet`: Wallet address
- `space_id`: "local-dev"
- `created_at`: `u64` epoch milliseconds

Implementation: `lib/arkiv/availability.ts` - `deleteAvailability()` creates deletion marker.

## Expiration

Availability entities expire after 180 days (`availability` lifetime in `lib/arkiv/schema.ts`).

## Entity Relationships

- Links to Profile entity via `wallet` attribute
- Links to Offer entities via `availability_key` attribute (optional reference)

## Transaction Hash Tracking

Separate `availability_txhash` entity (optional) tracks transaction hash:

- `type`: "availability_txhash"
- `availability_key`: Entity key of availability
- `wallet`: Wallet address
- `space_id`: "local-dev"
