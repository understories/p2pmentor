# Entity Schemas

This document provides complete schema documentation for all Arkiv entities used in p2pmentor.

**Note:** This is a public-facing summary. For detailed technical documentation, see the internal schema documentation.

---

## Overview

All entities are stored on Arkiv (blockchain-native storage). Transactions are immutable, but entities can be updated in place using stable entity keys (Pattern B). For versioning scenarios, updates can create new entities (Pattern A). See [Editable Entities](/docs/arkiv/overview/editable-entities) for details on update patterns.

**Common Patterns:**
- All entities have `type` attribute for filtering
- All entities have `spaceId` attribute (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development)
- All entities have `createdAt` attribute (ISO timestamp)
- Transaction hash tracking via separate `*_txhash` entities
- Wallet addresses are normalized to lowercase

---

## Core Entities

### Profile (`user_profile`)

Stores user profile information including identity, skills, availability, and reputation metadata.

**Key Fields:**
- `wallet`: Wallet address (primary identifier)
- `displayName`: User's display name (required)
- `username`: Unique username (optional)
- `bioShort`: Short bio
- `timezone`: IANA timezone (required)
- `skillsArray`: Array of skill names
- `skillExpertise`: Map of skillId -> expertise level (0-5)
- `availabilityWindow`: Text description of availability

**Update Handling:** Profile updates use stable entity keys (Pattern B). The same `entity_key` is reused for all updates, preserving identity while maintaining full transaction history. See [Editable Entities](/docs/arkiv/overview/editable-entities) for details.

**Query:** Filter by `type: 'user_profile'` and `wallet: <address>`.

---

### Skill (`skill`)

First-class entity for skills/topics. All user-facing flows reference `Skill.id`, not free-text strings.

**Key Fields:**
- `name_canonical`: Display name (e.g., "Spanish")
- `slug`: Normalized key (e.g., "spanish")
- `status`: `'active' | 'archived'`
- `created_by_profile`: Wallet address of creator (null for curated)

**Query:** Filter by `type: 'skill'` and `status: 'active'`.

---

### Ask (`ask`)

Learning requests - users post what they want to learn.

**Key Fields:**
- `wallet`: Wallet address of asker
- `skill_id`: Reference to Skill entity (preferred)
- `message`: Ask description
- `ttlSeconds`: TTL in seconds (default: 3600 = 1 hour)
- `status`: `'open'` (default)

**TTL/Expiration:** Stored in `ttlSeconds` attribute. Expired asks filtered client-side.

**Query:** Filter by `type: 'ask'` and `status: 'open'`.

---

### Offer (`offer`)

Teaching offers - users post what they can teach.

**Key Fields:**
- `wallet`: Wallet address of offerer
- `skill_id`: Reference to Skill entity (preferred)
- `message`: Offer description
- `availabilityWindow`: Text or serialized WeeklyAvailability JSON
- `isPaid`: `'true' | 'false'`
- `cost`: Cost amount (required if `isPaid` is `'true'`)
- `paymentAddress`: Payment receiving address (if paid)
- `ttlSeconds`: TTL in seconds (default: 7200 = 2 hours)
- `status`: `'active'` (default)

**Free vs Paid:** Free offers have `isPaid: 'false'`. Paid offers require `cost` and `paymentAddress`.

**TTL/Expiration:** Stored in `ttlSeconds` attribute. Expired offers filtered client-side.

**Query:** Filter by `type: 'offer'` and `status: 'active'`.

---

### Session (`session`)

Mentorship sessions between mentor and learner.

**Key Fields:**
- `mentorWallet`: Mentor wallet address
- `learnerWallet`: Learner wallet address
- `skill`: Skill/topic name
- `sessionDate`: ISO timestamp when session is scheduled
- `duration`: Duration in minutes (default: 60)
- `status`: `'pending' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled'`
- `notes`: Optional notes
- `requiresPayment`: Whether session requires payment
- `paymentAddress`: Payment receiving address (if paid)
- `cost`: Cost amount (if paid)

**State Transitions:**
- `pending → scheduled`: Both mentor and learner confirm
- `pending → cancelled`: Either party rejects
- `scheduled → in-progress`: Automatic when `sessionDate` arrives
- `in-progress → completed`: Automatic when duration ends

**Query:** Filter by `type: 'session'` and `mentorWallet` or `learnerWallet`.

---

### Feedback (`session_feedback`)

Post-session feedback (ratings, notes, technical DX feedback).

**Key Fields:**
- `sessionKey`: Reference to Session entity
- `mentorWallet`: Mentor wallet address
- `learnerWallet`: Learner wallet address
- `feedbackFrom`: Wallet of person giving feedback
- `feedbackTo`: Wallet of person receiving feedback
- `rating`: Rating (1-5)
- `notes`: Qualitative feedback
- `technicalDxFeedback`: Technical developer experience feedback

**Linking:** Links to session via `sessionKey`, links to profile via `feedbackTo` (wallet address).

**Query:** Filter by `type: 'session_feedback'` and `feedbackTo: <wallet>`.

**Note:** Entity type is `session_feedback`, not `feedback`.

---

### Availability (`availability`)

User availability time blocks for scheduling sessions.

**Key Fields:**
- `wallet`: Wallet address
- `timezone`: IANA timezone (e.g., "America/New_York")
- `availabilityWindow`: Legacy text description
- `weeklyAvailability`: Structured WeeklyAvailability JSON (version 1.0)

**Timezone:** All times stored in user's timezone (not converted to UTC). The timezone is stored in both the `timezone` attribute and the payload. Times are converted to viewer's timezone client-side when displaying.

**Query:** Filter by `type: 'availability'` and `wallet: <address>`.

---

### Virtual Gathering (`virtual_gathering`)

Community virtual gatherings (public meetings). Anyone can suggest, anyone can RSVP.

**Key Fields:**
- `organizerWallet`: Organizer wallet address
- `community`: Community identifier (e.g., skill slug)
- `title`: Gathering title
- `description`: Gathering description
- `sessionDate`: ISO timestamp when gathering is scheduled
- `duration`: Duration in minutes
- `videoJoinUrl`: Jitsi join URL (generated immediately)

**Jitsi:** Link generated immediately upon creation (no confirmation needed).

**RSVP:** Users RSVP by creating `session` entities with `skill: 'virtual_gathering_rsvp'`.

**Query:** Filter by `type: 'virtual_gathering'` and `community: <identifier>`.

---

## Quest Engine Entities

### Quest Definition (`quest_definition`)

Quest definitions stored on Arkiv for network-wide discovery. Quest content is stored inline in the entity payload.

**Key Fields:**
- `questId`: Unique quest identifier (e.g., "arkiv_builder")
- `track`: Quest track (e.g., "arkiv", "mandarin")
- `version`: Quest version (e.g., "1", "2")
- `title`: Quest title
- `steps`: Array of quest step definitions with inline markdown content
- `badge`: Badge configuration for quest completion

**Versioning:** Pattern A (immutable versions) - each version creates a new entity.

**Query:** Filter by `type: 'quest_definition'`, `questId`, `track`, `version`, `spaceId`.

**See Also:** [Quest Definition Entity Schema](/docs/arkiv/entities/quest-definition)

---

### Quest Step Progress (`quest_step_progress`)

Tracks user progress through quest steps with verifiable evidence.

**Key Fields:**
- `wallet`: Wallet address (primary identifier)
- `questId`: Quest identifier
- `stepId`: Step identifier
- `stepType`: Step type (READ, DO, QUIZ, SUBMIT, SESSION, VERIFY)
- `evidence`: Evidence record (varies by step type)

**Evidence Types:**
- `completion`: Simple completion (READ steps)
- `entity_created`: Entity creation proof (DO steps)
- `quiz_result`: Quiz score and rubric (QUIZ steps)
- `submission`: User-submitted artifact (SUBMIT steps)
- `session_completed`: Mentorship session completion (SESSION steps)
- `query_proof`: Query verification proof (VERIFY steps)

**Update Handling:** Pattern B (stable entity keys) - same key reused for updates.

**Query:** Filter by `type: 'quest_step_progress'`, `wallet`, `questId`, `stepId`, `spaceId`.

**See Also:** [Quest Step Progress Entity Schema](/docs/arkiv/entities/quest-step-progress)

---

### Proof of Skill Badge (`proof_of_skill_badge`)

Verifiable badges earned for completing quest tracks.

**Key Fields:**
- `wallet`: Wallet address (primary identifier)
- `badgeType`: Badge type (e.g., "arkiv_builder", "mandarin_starter")
- `questId`: Quest identifier this badge was earned for
- `questVersion`: Quest version this badge was earned on
- `evidenceRefs`: Array of evidence references to quest_step_progress entities

**Update Handling:** Pattern B (stable entity keys) - same key reused for updates.

**Query:** Filter by `type: 'proof_of_skill_badge'`, `wallet`, `badgeType`, `questId`, `spaceId`.

**See Also:** [Proof of Skill Badge Entity Schema](/docs/arkiv/entities/proof-of-skill-badge)

---

## Supporting Entities

### Transaction Hash Tracking

All entities have corresponding `*_txhash` entities for reliable querying:
- `user_profile_txhash`
- `ask_txhash`
- `offer_txhash`
- `session_txhash`
- `feedback_txhash`
- `availability_txhash`
- `virtual_gathering_txhash`
- `beta_code_usage_txhash`
- `auth_identity_passkey_txhash`
- `auth_identity_backup_wallet_txhash`
- `quest_definition_txhash`
- `quest_step_progress_txhash`
- `proof_of_skill_badge_txhash`

### Session State Entities

- `session_confirmation`: Confirmation from mentor or learner
- `session_rejection`: Rejection/cancellation
- `session_jitsi`: Jitsi room info (name, joinUrl)
- `session_payment_submission`: Payment transaction hash
- `session_payment_validation`: Payment validation

---

## Query Patterns

### Fetch Latest Entity for Wallet

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'entity_type'))
  .where(eq('wallet', wallet.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(1)
  .fetch();
```

### Fetch Entities by Skill

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'ask'))
  .where(eq('skill_id', skillId))
  .withAttributes(true)
  .withPayload(true)
  .fetch();
```

### Fetch Transaction Hash

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'entity_type_txhash'))
  .where(eq('entityKey', entityKey))
  .withAttributes(true)
  .withPayload(true)
  .limit(1)
  .fetch();
```

---

## Notes

- **Update Patterns:** Mutable entities (profiles, preferences, notifications) use stable entity keys (Pattern B). Versioning scenarios use new entities per change (Pattern A). See [Editable Entities](/docs/arkiv/overview/editable-entities).
- **Transaction History:** All mutations create immutable transactions. Full history is queryable via Arkiv's indexer.
- **TTL:** Asks and offers have TTL; expired entities filtered client-side.
- **Normalization:** All wallet addresses normalized to lowercase.
- **Transaction Tracking:** Separate `*_txhash` entities for reliable querying.

---

**See Also:**
- [Arkiv Data Model Overview](/docs/arkiv/entities/data-model)
- [Additional Entities](/docs/arkiv/entities/README) - Supporting entity types
- [Implementation FAQ](/docs/arkiv/operations/implementation-faq) - Common patterns and Q&A
- [Arkiv Integration Guide](/docs/architecture/arkiv-integration)
