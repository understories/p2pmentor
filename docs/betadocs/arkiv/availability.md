# Availability Entity Schema

## Entity Type
`availability`

## Field Table

| Field Name | Type | Required | Location | Description |
|------------|------|----------|----------|-------------|
| type | string | Yes | Attribute | Always "availability" |
| wallet | string | Yes | Attribute | Wallet address (lowercase) |
| spaceId | string | Yes | Attribute | Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) |
| createdAt | string | Yes | Attribute | ISO timestamp |
| timezone | string | Yes | Attribute | IANA timezone (e.g., "America/New_York") |
| availabilityVersion | string | Yes | Attribute | "1.0" (structured) | "legacy" (text) |
| timeBlocks | string | Yes | Payload | JSON string (WeeklyAvailability) or legacy text |
| timezone | string | Yes | Payload | IANA timezone |
| createdAt | string | Yes | Payload | ISO timestamp |

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

Implementation: `lib/arkiv/availability.ts` - `createAvailability()` detects format and sets `availabilityVersion` attribute accordingly.

## Query Pattern

Fetch availability for a wallet:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'availability'))
  .where(eq('wallet', wallet.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

// Filter out deleted availability (arkiv-native deletion pattern)
const deletionQuery = publicClient.buildQuery();
const deletions = await deletionQuery
  .where(eq('type', 'availability_deletion'))
  .where(eq('wallet', wallet.toLowerCase()))
  .withAttributes(true)
  .limit(100)
  .fetch();

const deletedKeys = new Set(deletions.entities.map(e => e.attributes.availabilityKey));
const activeAvailability = result.entities.filter(e => !deletedKeys.has(e.key));
```

Implementation: `lib/arkiv/availability.ts` - `listAvailabilityForWallet()` handles deletion filtering.

## Deletion Pattern

Arkiv entities are immutable. To delete availability:

1. Create `availability_deletion` entity with `availabilityKey` reference
2. Query filters out deleted availability by checking for deletion markers
3. Original availability entity remains on-chain (not actually deleted)

Deletion entity:
- `type`: "availability_deletion"
- `availabilityKey`: Entity key of availability being deleted
- `wallet`: Wallet address
- `spaceId`: "local-dev"
- `createdAt`: ISO timestamp

Implementation: `lib/arkiv/availability.ts` - `deleteAvailability()` creates deletion marker.

## Expiration

Availability entities expire after 30 days (2592000 seconds). This matches mentor-graph pattern.

## Entity Relationships

- Links to Profile entity via `wallet` attribute
- Links to Offer entities via `availabilityKey` attribute (optional reference)

## Transaction Hash Tracking

Separate `availability_txhash` entity (optional) tracks transaction hash:
- `type`: "availability_txhash"
- `availabilityKey`: Entity key of availability
- `wallet`: Wallet address
- `spaceId`: "local-dev"

