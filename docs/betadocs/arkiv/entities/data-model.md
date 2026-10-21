# Arkiv Data Model

## Schema rules (all entity types)

Since the move to the Tiramisu testnet and SDK 0.8 (see [Tiramisu Migration](../operations/tiramisu-migration.md)), every entity follows the same on-chain rules, enforced by `lib/arkiv/schema.ts` and the write helpers in `lib/arkiv/write.ts`:

- **Namespace:** every entity carries `project: 'p2pmentor'`, `type` and `schema_version: i32(1)`. `entityAttributes(type, record)` adds them; `arkivSelect(type)` filters on them.
- **Names:** lowercase `snake_case` only (`space_id`, `created_at`, `mentor_wallet`, ...). Tiramisu rejects uppercase attribute names.
- **Types:** wallet-like names (`wallet`, `*_wallet`, `*_by`) are `addr`; `*_at` names are `u64` epoch milliseconds (read back as ISO strings by `getAttr`); everything else is `str`.
- **Limits:** a string attribute is at most 128 bytes and an entity has at most 30 attributes. Writes throw on longer values; long text lives in the JSON payload.
- **Lifetimes:** chosen per type (`lifetimeFor(type, seconds?)`): 365 days for identity and curated content, 180 days for activity (and the default), 90 days for operational records. Product-specific lifetimes (ask/offer TTLs, sessions, gatherings) are passed explicitly.
- **Flags:** append-only types (revocations, assessment results, tx events, onboarding events, app feedback, review grants, beta code usage, quest completions) are created `readonly`.

The lists below name each type's attributes (queryable) and payload fields (JSON).

## Core entity types

### user_profile

**Attributes:**

- `type`: 'user_profile'
- `wallet`: Wallet address (`addr`)
- `space_id`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development)

**Payload:**

- `displayName`: Display name
- `username`: Unique username (optional)
- `profileImage`: Profile image URL
- `identity_seed`: Emoji Identity Seed (EIS)
- `exploringStatement`: "What are you exploring?" one-liner
- `bio`: Legacy bio
- `bioShort`: Short bio
- `bioLong`: Long bio
- `skills`: Comma-separated skills string (legacy)
- `skillsArray`: Array of skill names (legacy)
- `skill_ids`: Array of Skill entity keys (preferred, beta)
- `skillExpertise`: Map of skillId → expertise level (0-5)
- `timezone`: IANA timezone
- `languages`: Array of language codes
- `contactLinks`: { twitter?, github?, telegram?, discord? }
- `seniority`: 'beginner' | 'intermediate' | 'advanced' | 'expert'
- `domainsOfInterest`: Array of domain strings
- `mentorRoles`: Array of mentor role strings
- `learnerRoles`: Array of learner role strings
- `availabilityWindow`: Text description of availability
- `sessionsCompleted`: Total sessions completed
- `sessionsGiven`: Sessions given as mentor
- `sessionsReceived`: Sessions received as learner
- `avgRating`: Average rating (calculated on-demand)
- `npsScore`: Net Promoter Score
- `topSkillsUsage`: Array of {skill, count}
- `peerTestimonials`: Array of testimonials
- `trustEdges`: Array of trust network edges
- `communityAffiliations`: Array of community identifiers
- `reputationScore`: Reputation score
- `lastActiveTimestamp`: ISO timestamp of last activity

**Notes:**

- Updates use Pattern B (`replaceArkivEntity` / `patchEntity` with stable entity_key)
- Skills, bio and other long text live in the payload, not in attributes
- Same entity_key is reused for all updates, preserving identity
- Full transaction history is preserved on-chain
- See [Editable Entities](/docs/arkiv/overview/editable-entities) for details

### ask

**Attributes:**

- `type`: 'ask'
- `wallet`: Wallet address (`addr`)
- `skill`: Skill name
- `space_id`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development)
- `created_at`: `u64` epoch milliseconds
- `status`: 'open'
- `ttl_seconds`: TTL in seconds (default: 604800)

**Payload:**

- `message`: Ask description

**Additional fields (beta):**

- `skill_id`: Skill entity key (preferred over `skill` attribute)
- `skill_label`: Skill display name (derived, readonly)

**Supporting entity:**

- `ask_txhash`: Transaction hash tracking, linked via `ask_key` attribute

### offer

**Attributes:**

- `type`: 'offer'
- `wallet`: Wallet address (`addr`)
- `skill`: Skill name
- `space_id`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development)
- `created_at`: `u64` epoch milliseconds
- `status`: 'active'
- `ttl_seconds`: TTL in seconds (default: 7200)

**Payload:**

- `message`: Offer description
- `availabilityWindow`: Availability description

**Additional fields (beta):**

- `skill_id`: Skill entity key (preferred over `skill` attribute)
- `skill_label`: Skill display name (derived, readonly)
- `availability_key`: Reference to Availability entity key (optional)
- `is_paid`: 'true' | 'false' (free vs paid offer)
- `cost`: Cost amount (required if paid)
- `payment_address`: Payment receiving address (required if paid)

**Supporting entity:**

- `offer_txhash`: Transaction hash tracking, linked via `offer_key` attribute

### session

**Attributes:**

- `type`: 'session'
- `mentor_wallet`: Mentor wallet address (`addr`)
- `learner_wallet`: Learner wallet address (`addr`)
- `skill`: Skill name
- `space_id`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development)
- `created_at`: `u64` epoch milliseconds

**Payload:**

- `sessionDate`: ISO timestamp when session is/was scheduled
- `duration`: Duration in minutes (default: 60)
- `notes`: Optional notes
- `requiresPayment`: Boolean
- `paymentAddress`: Payment receiving address (if paid)
- `cost`: Cost amount (if paid)

**Supporting entities:**

- `session_txhash`: Transaction hash tracking, linked via `session_key`
- `session_confirmation`: Confirmation from mentor or learner, linked via `session_key`
- `session_rejection`: Rejection/cancellation, linked via `session_key`
- `session_jitsi`: Jitsi room info (name, joinUrl), linked via `session_key`
- `session_payment_submission`: Payment txHash from learner, linked via `session_key`
- `session_payment_validation`: Payment validation from mentor, linked via `session_key`

**Additional fields (beta):**

- `skill_id`: Skill entity key (preferred over `skill` attribute)
- `gatheringKey`: Virtual gathering entity key (for community sessions)
- `gatheringTitle`: Virtual gathering title
- `community`: Skill slug/community name (for virtual gatherings)

**Status computation:**

- `pending`: Created but not confirmed by both parties
- `scheduled`: Both parties confirmed
- `in-progress`: Session time has started
- `completed`: Session time has ended
- `cancelled`: Rejected by either party

**Expiration:**

- `sessionDate + duration + 1 hour buffer`

## Supporting entities

### skill

**Attributes:**

- `type`: 'skill'
- `name_canonical`: Display name (e.g., "Spanish")
- `slug`: Normalized key (e.g., "spanish")
- `status`: 'active' | 'archived'
- `space_id`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development)
- `created_at`: `u64` epoch milliseconds
- `created_by_profile`: Wallet address of creator (optional)

**Payload:**

- `description`: Skill description (optional)

**Notes:**

- First-class entity for beta
- Profiles reference skills via `skill_ids` array (entity keys)
- Expires after 365 days (`skill` lifetime)

### availability

**Attributes:**

- `type`: 'availability'
- `wallet`: Wallet address (`addr`)
- `timezone`: IANA timezone (e.g., "America/New_York")
- `availability_version`: '1.0' (structured) | 'legacy' (text)
- `space_id`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development)
- `created_at`: `u64` epoch milliseconds

**Payload:**

- `timeBlocks`: JSON string (WeeklyAvailability) or legacy text
- `timezone`: IANA timezone
- `createdAt`: ISO timestamp

**Notes:**

- Supports structured (v1.0) and legacy text formats
- Expires after 180 days (`availability` lifetime)
- Deletion via `availability_deletion` marker entity

### session_feedback

**Attributes:**

- `type`: 'session_feedback'
- `session_key`: Session entity key
- `mentor_wallet`: Mentor wallet address
- `learner_wallet`: Learner wallet address
- `feedback_from`: Wallet of person giving feedback
- `feedback_to`: Wallet of person receiving feedback
- `space_id`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development)
- `created_at`: `u64` epoch milliseconds
- `rating`: Rating 1-5 (optional, stored as string)

**Payload:**

- `rating`: Rating 1-5 (optional)
- `notes`: Qualitative feedback text
- `technicalDxFeedback`: Technical developer experience feedback
- `createdAt`: ISO timestamp

**Notes:**

- Expires after 180 days (default lifetime)
- Validation: Only session participants can give feedback

### app_feedback

**Attributes:**

- `type`: 'app_feedback'
- `wallet`: Feedback author wallet
- `page`: Page where feedback was given
- `feedback_type`: 'feedback' | 'issue'
- `space_id`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development)
- `created_at`: `u64` epoch milliseconds
- `rating`: Rating 1-5 (optional, stored as string)

**Payload:**

- `message`: Feedback message
- `rating`: Rating 1-5 (optional)
- `createdAt`: ISO timestamp

**Notes:**

- Expires after 90 days (`app_feedback` lifetime); created `readonly`

### virtual_gathering

**Attributes:**

- `type`: 'virtual_gathering'
- `organizer_wallet`: Organizer wallet address
- `community`: Community identifier (e.g., skill slug)
- `space_id`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development)
- `created_at`: `u64` epoch milliseconds

**Payload:**

- `title`: Gathering title
- `description`: Gathering description
- `sessionDate`: ISO timestamp when gathering is scheduled
- `duration`: Duration in minutes
- `videoJoinUrl`: Jitsi join URL (generated immediately)

**Notes:**

- Jitsi URL generated immediately (no confirmation needed)
- RSVP via session entities with special handling

### dx_metric

**Attributes:**

- `type`: 'dx_metric'
- `source`: 'arkiv' | 'graphql'
- `operation`: Operation name
- `route`: API route (optional)
- `space_id`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development)
- `created_at`: `u64` epoch milliseconds

**Payload:**

- `durationMs`: Duration in milliseconds
- `payloadBytes`: Payload size in bytes (optional)
- `httpRequests`: Number of HTTP requests (optional)
- `status`: 'success' | 'failure' (optional)
- `errorType`: Error type (optional)
- `usedFallback`: Whether fallback was used (optional)

**Notes:**

- Performance metrics stored on-chain for verifiability
- Expires after 180 days (default lifetime)

### Other Supporting Entities

- `learning_follow`: Skill following relationships
- `beta_code_usage`: Beta code usage tracking
- `auth_identity`: Passkey credentials (passkey and backup wallet)
- `github_issue_link`: Links app feedback to GitHub issues
- `admin_response`: Admin responses to feedback
- `notification_preferences`: User notification settings
- `garden_note`: Public garden notes
- `onboarding_event`: Onboarding tracking
- `client_perf_metric`: Client-side performance metrics
- `navigation_metric`: Aggregated navigation and click tracking
- `learner_quest`: Quest definitions (reading lists and language assessments)
- `learner_quest_progress`: User progress through quests (reading materials and assessment answers)
- `learner_quest_assessment_result`: Assessment completion results and certifications
- `quest_definition`: Quest definitions stored on Arkiv (Quest Engine)
- `quest_step_progress`: User progress through quest steps with verifiable evidence (Quest Engine)
- `proof_of_skill_badge`: Verifiable badges earned for completing quest tracks (Quest Engine)
- `perf_snapshot`: Performance snapshots
- `retention_cohort`: User retention cohort metrics
- `metric_aggregate`: Aggregated metrics

## Query patterns

All queries start from `arkivSelect(type)` (`lib/arkiv/read.ts`), which wraps the SDK 0.8 `select()` builder and adds the `project` filter. Use `eqAttr` (`lib/arkiv/schema.ts`) so predicates are typed the same way as writes, and `fetchAll(builder, max)` for more than 200 results:

```typescript
import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, getAttr, parsePayload } from '@/lib/arkiv/read';

const result = await arkivSelect('user_profile')
  .where(eqAttr('wallet', walletAddress))
  .limit(100)
  .fetch();
```

See [`docs/dx_arkiv_runbook.md`](/docs/dx_arkiv_runbook.md) for detailed query patterns and examples.
