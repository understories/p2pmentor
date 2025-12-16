# Arkiv Data Model

## Core entity types

### user_profile

**Attributes:**
- `type`: 'user_profile'
- `wallet`: Wallet address (lowercase)
- `spaceId`: 'local-dev'

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
- Immutable: updates create new entities
- Latest version selected via query filtering by wallet and selecting most recent

### ask

**Attributes:**
- `type`: 'ask'
- `wallet`: Wallet address (lowercase)
- `skill`: Skill name
- `spaceId`: 'local-dev'
- `createdAt`: ISO timestamp
- `status`: 'open'
- `ttlSeconds`: TTL in seconds (default: 3600)

**Payload:**
- `message`: Ask description

**Additional fields (beta):**
- `skill_id`: Skill entity key (preferred over `skill` attribute)
- `skill_label`: Skill display name (derived, readonly)

**Supporting entity:**
- `ask_txhash`: Transaction hash tracking, linked via `askKey` attribute

### offer

**Attributes:**
- `type`: 'offer'
- `wallet`: Wallet address (lowercase)
- `skill`: Skill name
- `spaceId`: 'local-dev'
- `createdAt`: ISO timestamp
- `status`: 'active'
- `ttlSeconds`: TTL in seconds (default: 7200)

**Payload:**
- `message`: Offer description
- `availabilityWindow`: Availability description

**Additional fields (beta):**
- `skill_id`: Skill entity key (preferred over `skill` attribute)
- `skill_label`: Skill display name (derived, readonly)
- `availabilityKey`: Reference to Availability entity key (optional)
- `isPaid`: 'true' | 'false' (free vs paid offer)
- `cost`: Cost amount (required if paid)
- `paymentAddress`: Payment receiving address (required if paid)

**Supporting entity:**
- `offer_txhash`: Transaction hash tracking, linked via `offerKey` attribute

### session

**Attributes:**
- `type`: 'session'
- `mentorWallet`: Mentor wallet address (lowercase)
- `learnerWallet`: Learner wallet address (lowercase)
- `skill`: Skill name
- `spaceId`: 'local-dev'
- `createdAt`: ISO timestamp

**Payload:**
- `sessionDate`: ISO timestamp when session is/was scheduled
- `duration`: Duration in minutes (default: 60)
- `notes`: Optional notes
- `requiresPayment`: Boolean
- `paymentAddress`: Payment receiving address (if paid)
- `cost`: Cost amount (if paid)

**Supporting entities:**
- `session_txhash`: Transaction hash tracking, linked via `sessionKey`
- `session_confirmation`: Confirmation from mentor or learner, linked via `sessionKey`
- `session_rejection`: Rejection/cancellation, linked via `sessionKey`
- `session_jitsi`: Jitsi room info (name, joinUrl), linked via `sessionKey`
- `session_payment_submission`: Payment txHash from learner, linked via `sessionKey`
- `session_payment_validation`: Payment validation from mentor, linked via `sessionKey`

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
- `spaceId`: 'local-dev'
- `createdAt`: ISO timestamp
- `created_by_profile`: Wallet address of creator (optional)

**Payload:**
- `description`: Skill description (optional)

**Notes:**
- First-class entity for beta
- Profiles reference skills via `skill_ids` array (entity keys)
- Expires after 1 year (31536000 seconds)

### availability

**Attributes:**
- `type`: 'availability'
- `wallet`: Wallet address (lowercase)
- `timezone`: IANA timezone (e.g., "America/New_York")
- `availabilityVersion`: '1.0' (structured) | 'legacy' (text)
- `spaceId`: 'local-dev'
- `createdAt`: ISO timestamp

**Payload:**
- `timeBlocks`: JSON string (WeeklyAvailability) or legacy text
- `timezone`: IANA timezone
- `createdAt`: ISO timestamp

**Notes:**
- Supports structured (v1.0) and legacy text formats
- Expires after 30 days (2592000 seconds)
- Deletion via `availability_deletion` marker entity

### session_feedback

**Attributes:**
- `type`: 'session_feedback'
- `sessionKey`: Session entity key
- `mentorWallet`: Mentor wallet address
- `learnerWallet`: Learner wallet address
- `feedbackFrom`: Wallet of person giving feedback
- `feedbackTo`: Wallet of person receiving feedback
- `spaceId`: 'local-dev'
- `createdAt`: ISO timestamp
- `rating`: Rating 1-5 (optional, stored as string)

**Payload:**
- `rating`: Rating 1-5 (optional)
- `notes`: Qualitative feedback text
- `technicalDxFeedback`: Technical developer experience feedback
- `createdAt`: ISO timestamp

**Notes:**
- Expires after 1 year (31536000 seconds)
- Validation: Only session participants can give feedback

### app_feedback

**Attributes:**
- `type`: 'app_feedback'
- `wallet`: Feedback author wallet
- `page`: Page where feedback was given
- `feedbackType`: 'feedback' | 'issue'
- `spaceId`: 'local-dev'
- `createdAt`: ISO timestamp
- `rating`: Rating 1-5 (optional, stored as string)

**Payload:**
- `message`: Feedback message
- `rating`: Rating 1-5 (optional)
- `createdAt`: ISO timestamp

**Notes:**
- Expires after 1 year (31536000 seconds)

### virtual_gathering

**Attributes:**
- `type`: 'virtual_gathering'
- `organizerWallet`: Organizer wallet address
- `community`: Community identifier (e.g., skill slug)
- `spaceId`: 'local-dev'
- `createdAt`: ISO timestamp

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
- `spaceId`: 'local-dev'
- `createdAt`: ISO timestamp

**Payload:**
- `durationMs`: Duration in milliseconds
- `payloadBytes`: Payload size in bytes (optional)
- `httpRequests`: Number of HTTP requests (optional)
- `status`: 'success' | 'failure' (optional)
- `errorType`: Error type (optional)
- `usedFallback`: Whether fallback was used (optional)

**Notes:**
- Performance metrics stored on-chain for verifiability
- Expires after 1 year (31536000 seconds)

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
- `learner_quest`: Curated reading list definitions
- `learner_quest_progress`: User progress through quests
- `perf_snapshot`: Performance snapshots
- `retention_cohort`: User retention cohort metrics
- `metric_aggregate`: Aggregated metrics

## Query patterns

All queries use Arkiv SDK query builder:

```typescript
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', walletAddress))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

See [`docs/dx_arkiv_runbook.md`](../../../dx_arkiv_runbook.md) for detailed query patterns and examples.
