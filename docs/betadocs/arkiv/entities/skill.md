# Skill Entity Schema

## Entity Type

`skill`

## Field Table

| Field Name         | Type   | Required | Location  | Description                                                                                                |
| ------------------ | ------ | -------- | --------- | ---------------------------------------------------------------------------------------------------------- | ---------- |
| type               | string | Yes      | Attribute | Always "skill"                                                                                             |
| name_canonical     | string | Yes      | Attribute | Display name (e.g., "Spanish")                                                                             |
| slug               | string | Yes      | Attribute | Normalized key (e.g., "spanish")                                                                           |
| status             | string | Yes      | Attribute | "active"                                                                                                   | "archived" |
| space_id           | string | Yes      | Attribute | Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) |
| created_at         | u64    | Yes      | Attribute | Epoch ms                                                                                              |
| created_by_profile | string | No       | Attribute | Wallet address of creator (null for curated)                                                               |
| description        | string | No       | Payload   | Skill description                                                                                          |

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
const result = await arkivSelect('skill')
  .where(eqAttr('slug', slug))
  .where(eqAttr('status', 'active'))
  .limit(1)
  .fetch();
```

Fetch all active skills:

```typescript
const result = await arkivSelect('skill')
  .where(eqAttr('status', 'active'))
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

Skill entities expire after 365 days (`skill` lifetime in `lib/arkiv/schema.ts`). Curated skills are reseeded or renewed rather than made permanent.

## Transaction Hash Tracking

Separate `skill_txhash` entity (optional) tracks transaction hash:

- `type`: "skill_txhash"
- `skill_key`: Entity key of skill
- `slug`: Skill slug
- `space_id`: "local-dev"
