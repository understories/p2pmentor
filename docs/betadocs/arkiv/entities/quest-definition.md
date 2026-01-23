# Quest Definition Entity Schema

## Status
- Canonical for p2pmentor: Yes
- Mutability: Pattern A
- Pattern dependencies: PAT-VERSION-001, PAT-QUERY-001, PAT-SPACE-001

## Entity Type
`quest_definition`

## Patterns Used

- [PAT-VERSION-001: Entity Versioning](../patterns/entity-versioning.md) - Each quest version creates a new entity (immutable versions)
- [PAT-QUERY-001: Indexer-Friendly Query Shapes](../patterns/query-optimization.md) - Queries use indexed attributes (type, questId, track, version, spaceId)
- [PAT-SPACE-001: Space ID as Environment Boundary](../patterns/space-isolation.md) - spaceId attribute for data isolation (defaults to 'global' for network-wide quests)

## Field Table

| Field Name | Type | Required | Location | Description |
|------------|------|----------|----------|-------------|
| type | string | Yes | Attribute | Always "quest_definition" |
| questId | string | Yes | Attribute | Unique quest identifier (e.g., "arkiv_builder", "mandarin_starter") |
| track | string | Yes | Attribute | Quest track (e.g., "arkiv", "mandarin", "spanish") |
| version | string | Yes | Attribute | Quest version (e.g., "1", "2") |
| language | string | No | Attribute | Language code (e.g., "zh", "es") - only for language learning quests |
| spaceId | string | Yes | Attribute | Space ID (defaults to "global" for network-wide quests, or specific space for space-specific quests) |
| status | string | Yes | Attribute | "active" | "archived" |
| createdAt | string | Yes | Attribute | ISO timestamp |
| creatorWallet | string | No | Attribute | Wallet address of quest creator (optional, for attribution) |
| questId | string | Yes | Payload | Quest identifier (matches attribute) |
| version | string | Yes | Payload | Quest version (matches attribute) |
| track | string | Yes | Payload | Quest track (matches attribute) |
| title | string | Yes | Payload | Quest title |
| description | string | Yes | Payload | Quest description |
| source | string | No | Payload | Attribution URL |
| estimatedDuration | string | Yes | Payload | Estimated completion time (e.g., "60 minutes") |
| difficulty | string | Yes | Payload | "beginner" | "intermediate" | "advanced" |
| steps | QuestStepDefinition[] | Yes | Payload | Array of quest step definitions (with inline markdown content) |
| rubrics | Record<string, QuizRubric> | No | Payload | Quiz rubrics referenced by stepId |
| badge | BadgeConfig | No | Payload | Badge configuration for quest completion |

## Versioning Strategy

Quest definitions use Pattern A (immutable versions). Each version creates a new entity with a new entity key.

**Entity Key Format:** `quest_definition:${track}:v${version}`

**Example:**
- Version 1: `quest_definition:arkiv:v1`
- Version 2: `quest_definition:arkiv:v2`

**Latest Version Selection:**
- Query all versions for a questId
- Sort by `createdAt` descending
- Select first result as latest version

**Rationale:**
- Preserves historical quest definitions
- Allows progress validation against specific versions
- Enables quest evolution without breaking existing progress
- Aligns with Arkiv's immutable history model

## Update Handling

Quest definitions are immutable. To update a quest:

1. Increment version in quest JSON file
2. Run sync script to create new entity
3. Old version remains queryable for progress validation
4. New users see latest version, existing progress references old version

Implementation: `lib/arkiv/questDefinition.ts` - `createQuestDefinition()` creates new entity per version.

## Query Pattern

Fetch latest version of a quest:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'quest_definition'))
  .where(eq('questId', 'arkiv_builder'))
  .where(eq('spaceId', 'global'))
  .where(eq('status', 'active'))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

// Sort by createdAt DESC, take first (latest version)
const latestQuest = result.entities
  .sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
```

Fetch quest by specific version:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'quest_definition'))
  .where(eq('questId', 'arkiv_builder'))
  .where(eq('version', '1'))
  .where(eq('spaceId', 'global'))
  .where(eq('status', 'active'))
  .withAttributes(true)
  .withPayload(true)
  .limit(1)
  .fetch();
```

List all quests by track:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'quest_definition'))
  .where(eq('track', 'arkiv'))
  .where(eq('spaceId', 'global'))
  .where(eq('status', 'active'))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

// Get latest version per questId
const questMap = new Map<string, QuestDefinitionEntity>();
result.entities.forEach((entity) => {
  const quest = parseQuestDefinitionEntity(entity);
  if (!quest) return;
  const existing = questMap.get(quest.questId);
  if (!existing || new Date(quest.createdAt) > new Date(existing.createdAt)) {
    questMap.set(quest.questId, quest);
  }
});
```

Implementation: `lib/arkiv/questDefinition.ts` - `getLatestQuestDefinition()`, `getQuestDefinition()`, `listQuestDefinitions()`

## Entity Relationships

- Links to `quest_step_progress` entities via `questId` attribute (progress stores questId string)
- Links to `proof_of_skill_badge` entities via `questId` attribute (badges store questId string and questVersion)
- Quest steps are stored in payload (not separate entities)

## Space Isolation

**Network-Wide Quests (Default):**
- Use `spaceId: 'global'` for quests available in all spaces
- Most quests are network-wide (educational content, tutorials)
- Progress entities use `spaceId` for isolation (user progress is space-specific)

**Space-Specific Quests:**
- Use specific `spaceId` for space-only quests
- Example: Custom onboarding for a specific space
- Query with `spaceId` filter to discover space-specific quests

## Content Storage

**Markdown Content:**
- Step markdown content is stored inline in quest payload
- Sync script (`scripts/sync-quest-entities.ts`) inlines markdown files into `quest.steps[].content`
- Fully Arkiv-native: all quest content is verifiable on-chain
- No external dependencies or URL breakage

**Payload Structure:**
```json
{
  "questId": "arkiv_builder",
  "version": "1",
  "track": "arkiv",
  "title": "Arkiv Builder Track",
  "steps": [
    {
      "stepId": "intro",
      "type": "READ",
      "title": "Welcome to Arkiv",
      "content": "# Welcome to Arkiv\n\n## What You'll Learn...",
      "order": 1,
      "required": true
    }
  ]
}
```

## Expiration

Quest definition entities expire after 10 years (315360000 seconds). This is effectively permanent for curated educational content.

## Transaction Hash Tracking

Separate `quest_definition_txhash` entity (optional) tracks transaction hash:
- `type`: "quest_definition_txhash"
- `questKey`: Entity key of quest definition
- `txHash`: Transaction hash
- `spaceId`: Space ID (matches quest definition)
- `createdAt`: ISO timestamp

## Authoring Workflow

1. **Authoring Phase (File-Based):**
   - Author edits `content/quests/<track>/quest.json`
   - Author edits `content/quests/<track>/steps/*.md` files
   - Changes committed to git

2. **Publishing Phase (Entity Sync):**
   - CI/CD runs sync script on merge to main
   - Script: `scripts/sync-quest-entities.ts`
   - Reads quest files, inlines markdown content
   - Creates/updates quest definition entities on Arkiv
   - Increments version if quest definition changed

3. **Distribution:**
   - Quest definitions served from Arkiv entities (entity-first mode)
   - Fallback to files during transition (dual mode)
   - Files become authoring-only (not served directly)

## Files Referenced

- `lib/arkiv/questDefinition.ts` - Quest definition entity CRUD operations
- `scripts/sync-quest-entities.ts` - Sync script for files → entities
- `lib/quests/questFormat.ts` - Quest definition JSON schema types
- `app/api/quests/route.ts` - API route for quest discovery
