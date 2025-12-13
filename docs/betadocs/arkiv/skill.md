# Skill Entity Schema

## Entity Type
`skill`

## Field Table

| Field Name | Type | Required | Location | Description |
|------------|------|----------|----------|-------------|
| type | string | Yes | Attribute | Always "skill" |
| name_canonical | string | Yes | Attribute | Display name (e.g., "Spanish") |
| slug | string | Yes | Attribute | Normalized key (e.g., "spanish") |
| status | string | Yes | Attribute | "active" | "archived" |
| spaceId | string | Yes | Attribute | Currently "local-dev" |
| createdAt | string | Yes | Attribute | ISO timestamp |
| created_by_profile | string | No | Attribute | Wallet address of creator (null for curated) |
| description | string | No | Payload | Skill description |

## Skill-to-Profile Linking Strategy

Skills are first-class entities. Profiles link to skills via:

1. **Preferred (Beta)**: `skill_ids` array in profile payload contains Skill entity keys
2. **Legacy**: `skillsArray` in profile payload contains skill names (strings)
3. **Query Pattern**: Query profiles by skill using `skill_id` attribute or `skill_0`, `skill_1`, etc. attributes

Profile references skill:
- Profile payload: `skill_ids: ["skill_entity_key_1", "skill_entity_key_2"]`
- Profile payload: `skillExpertise: {"skill_entity_key_1": 3, "skill_entity_key_2": 5}` (expertise level 0-5)

Ask/Offer references skill:
- `skill_id` attribute: Skill entity key (preferred)
- `skill` attribute: Skill name (legacy, for backward compatibility)

Implementation: `lib/arkiv/skill.ts` - Skills are separate entities. Profiles, Asks, and Offers reference them via `skill_id` attribute.

## Query Pattern

Fetch skill by slug:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'skill'))
  .where(eq('slug', slug))
  .where(eq('status', 'active'))
  .withAttributes(true)
  .withPayload(true)
  .limit(1)
  .fetch();
```

Fetch all active skills:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'skill'))
  .where(eq('status', 'active'))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

Implementation: `lib/arkiv/skill.ts` - `getSkillBySlug()` and `listSkills()`

## Slug Normalization

Slug is generated from `name_canonical`:
- Convert to lowercase
- Remove special characters
- Replace spaces with hyphens
- Collapse multiple hyphens
- Remove leading/trailing hyphens

Implementation: `lib/arkiv/skill.ts` - `normalizeSkillSlug()`

## Expiration

Skill entities expire after 1 year (31536000 seconds). This is effectively permanent for beta.

## Transaction Hash Tracking

Separate `skill_txhash` entity (optional) tracks transaction hash:
- `type`: "skill_txhash"
- `skillKey`: Entity key of skill
- `slug`: Skill slug
- `spaceId`: "local-dev"

