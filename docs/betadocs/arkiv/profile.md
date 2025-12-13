# Profile Entity Schema

## Entity Type
`user_profile`

## Field Table

| Field Name | Type | Required | Location | Description |
|------------|------|----------|----------|-------------|
| type | string | Yes | Attribute | Always "user_profile" |
| wallet | string | Yes | Attribute | Wallet address (lowercase, primary identifier) |
| displayName | string | Yes | Attribute | User's display name |
| username | string | No | Attribute | Unique username (optional, client-side uniqueness check only) |
| timezone | string | Yes | Attribute | IANA timezone (e.g., "America/New_York") |
| spaceId | string | Yes | Attribute | Currently "local-dev" |
| createdAt | string | Yes | Attribute | ISO timestamp |
| identity_seed | string | No | Attribute | Emoji Identity Seed (EIS) for UI |
| bio | string | No | Attribute | Legacy bio field |
| skills | string | No | Attribute | Legacy comma-separated skills string |
| seniority | string | No | Attribute | "beginner" | "intermediate" | "advanced" | "expert" |
| skill_0, skill_1, ... | string | No | Attribute | Individual skill attributes (for querying) |
| displayName | string | Yes | Payload | User's display name |
| username | string | No | Payload | Unique username |
| profileImage | string | No | Payload | Profile image URL |
| identity_seed | string | No | Payload | Emoji Identity Seed |
| exploringStatement | string | No | Payload | "What are you exploring?" one-liner |
| bio | string | No | Payload | Legacy bio |
| bioShort | string | No | Payload | Short bio |
| bioLong | string | No | Payload | Long bio |
| skills | string | No | Payload | Comma-separated skills (legacy) |
| skillsArray | string[] | No | Payload | Array of skill names |
| skill_ids | string[] | No | Payload | Array of Skill entity keys |
| skillExpertise | Record<string, number> | No | Payload | Map of skillId to expertise level (0-5) |
| timezone | string | Yes | Payload | IANA timezone |
| languages | string[] | No | Payload | Array of language codes |
| contactLinks | object | No | Payload | { twitter?, github?, telegram?, discord? } |
| seniority | string | No | Payload | "beginner" | "intermediate" | "advanced" | "expert" |
| domainsOfInterest | string[] | No | Payload | Array of domain strings |
| mentorRoles | string[] | No | Payload | Array of mentor role strings |
| learnerRoles | string[] | No | Payload | Array of learner role strings |
| availabilityWindow | string | No | Payload | Text description of availability |
| sessionsCompleted | number | No | Payload | Total sessions completed (default: 0) |
| sessionsGiven | number | No | Payload | Sessions given as mentor (default: 0) |
| sessionsReceived | number | No | Payload | Sessions received as learner (default: 0) |
| avgRating | number | No | Payload | Average rating (default: 0, calculated on-demand) |
| npsScore | number | No | Payload | Net Promoter Score (default: 0) |
| topSkillsUsage | Array<{skill: string, count: number}> | No | Payload | Top skills usage stats |
| peerTestimonials | Array<{text: string, timestamp: string, fromWallet: string}> | No | Payload | Peer testimonials |
| trustEdges | Array<{toWallet: string, strength: number, createdAt: string}> | No | Payload | Trust network edges |
| communityAffiliations | string[] | No | Payload | Array of community identifiers |
| reputationScore | number | No | Payload | Reputation score (default: 0) |
| lastActiveTimestamp | string | No | Payload | ISO timestamp of last activity |
| spaceId | string | Yes | Payload | Currently "local-dev" |
| createdAt | string | Yes | Payload | ISO timestamp |

## Update Handling

Profile updates create new entities. Arkiv entities are immutable. To update a profile:

1. Create new `user_profile` entity with updated fields
2. Query all profiles for wallet address
3. Select latest by sorting `createdAt` descending
4. Previous entities remain on-chain for history

Implementation: `lib/arkiv/profile.ts` - `createUserProfile()` and `createUserProfileClient()` both create new entities. `getProfileByWallet()` queries and returns the most recent.

## Query Pattern

Fetch profile by wallet address:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', wallet.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

// Select most recent
profiles.sort((a, b) => 
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
);
const latestProfile = profiles[0];
```

Implementation: `lib/arkiv/profile.ts` - `listUserProfilesForWallet()` and `getProfileByWallet()`

## Indexing Strategy for Username Uniqueness

Username uniqueness is not enforced at Arkiv entity level. Current implementation:

1. Client-side check before creation: Query all profiles for username
2. If username exists, show error "Username already taken"
3. Race condition possible: Two users could create profiles with same username simultaneously

Query pattern for username check:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'user_profile'))
  .where(eq('username', username))
  .withAttributes(true)
  .limit(1)
  .fetch();
```

Note: This is a limitation for beta. Future enhancement could add uniqueness constraint at indexer level or use separate username registry entity.

## Entity Relationships

- Links to Skill entities via `skill_ids` array (preferred) or `skillsArray` (legacy)
- Links to Availability entities via wallet address (separate query)
- Links to Session entities via `mentorWallet` or `learnerWallet` attributes
- Links to Feedback entities via `feedbackTo` attribute

## Expiration

Profile entities expire after 1 year (31536000 seconds). This is effectively permanent for beta.

## Transaction Hash Tracking

Separate `user_profile_txhash` entity (optional) tracks transaction hash:
- `type`: "user_profile_txhash"
- `profileKey`: Entity key of profile
- `wallet`: Wallet address
- `spaceId`: "local-dev"

