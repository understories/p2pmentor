# Arkiv Builder Mode

**Date:** December 13, 2025  
**Status:** ✅ Fully Implemented  
**Purpose:** Developer-focused feature that makes every Arkiv query and interaction visible and educational for Arkiv builders.

## Overview

Arkiv Builder Mode is a global toggle feature that reveals the underlying Arkiv infrastructure powering p2pmentor. When enabled, it displays:

- **Arkiv entity information** (keys, transaction hashes)
- **Query details** (what queries are being made, how, why)
- **Entity creation/update information** (what entities are created on interactions)
- **Links to Arkiv Explorer** for all entities

**Goal:** Make every single Arkiv query and interaction legible and educational for Arkiv builders.

## How to Enable

1. Look for the **[A]** toggle button in the top-right corner of any page (next to the theme toggle)
2. Click the toggle to enable Arkiv Builder Mode
3. The mode persists across page navigations via localStorage
4. All tooltips and entity information will now be visible

## Features

### Query Tooltips

When Arkiv Builder Mode is enabled, hover over loading states, buttons, and interactive elements to see detailed query information:

- **What query is being made** (function name, API endpoint)
- **Query parameters** (filters, wallet addresses, entity types)
- **What data is returned** (entity types, attributes, payloads)
- **TTL (Time To Live)** values for entities

### Entity Links

All displayed entities show:
- **View on Arkiv** links that open the entity in the Arkiv Explorer
- **Entity keys** (truncated for readability)
- **Transaction hashes** (when available)

### Action Tooltips

Buttons that create or update entities show tooltips explaining:
- **What entity type** will be created
- **What attributes** will be set
- **What payload data** will be stored
- **TTL** for the new entity

## Implementation Status

### ✅ Fully Implemented Pages

All major pages and flows have Arkiv Builder Mode implemented:

#### Core Pages
- **`/me`** - Dashboard with profile, stats cards, skills section
- **`/me/profile`** - Profile creation and updates
- **`/me/skills`** - Skills management, join/leave communities
- **`/me/sessions`** - Session listing, confirmation, rejection, payment flows
- **`/me/availability`** - Availability management (create, edit, delete)

#### Discovery Pages
- **`/profiles`** - Profile listing
- **`/profiles/[wallet]`** - Profile detail view
- **`/skills/explore`** - Skills exploration
- **`/topic/[slug]`** - Topic/skill detail pages

#### Interaction Pages
- **`/asks`** - Asks listing and creation
- **`/offers`** - Offers listing and creation
- **`/matches`** - Skill matching page
- **`/network`** - Network graph view

#### Social Pages
- **`/garden/public-board`** - Public garden board
- **`/profiles/[wallet]/garden-notes`** - Profile garden notes
- **`/communities/gatherings`** - Virtual gatherings

#### System Pages
- **`/notifications`** - Notification center
- **`/onboarding`** - Onboarding flow (all steps)

#### Components
- **Sidebar Navigation** - Dashboard, Network, Sessions buttons, upcoming sessions
- **RequestMeetingModal** - Session creation flows

### Components

#### `ArkivBuilderModeToggle`
Reusable toggle component for enabling/disabling Arkiv Builder Mode.

**Location:** `components/ArkivBuilderModeToggle.tsx`

#### `ArkivQueryTooltip`
Tooltip component that displays query information on hover.

**Location:** `components/ArkivQueryTooltip.tsx`

**Usage:**
```typescript
<ArkivQueryTooltip
  query={[
    `getProfileByWallet("${wallet}")`,
    `Query: type='user_profile', wallet='${wallet}'`,
    `Returns: UserProfile | null`
  ]}
  label="Profile Query"
>
  {/* Wrapped element */}
</ArkivQueryTooltip>
```

#### `ViewOnArkivLink`
Link component that opens entities in the Arkiv Explorer.

**Location:** `components/ViewOnArkivLink.tsx`

**Usage:**
```typescript
{arkivBuilderMode && (
  <ViewOnArkivLink
    entityKey={entity.key}
    txHash={entity.txHash}
    label="View Profile on Arkiv"
  />
)}
```

#### `GlobalToggles`
Global component combining ThemeToggle and ArkivBuilderModeToggle, positioned in top-right corner.

**Location:** `components/GlobalToggles.tsx`

#### `useArkivBuilderMode`
Global hook for accessing Arkiv Builder Mode state across all components.

**Location:** `lib/hooks/useArkivBuilderMode.ts`

**Usage:**
```typescript
const arkivBuilderMode = useArkivBuilderMode();
```

## Complete List of Arkiv Queries

This section documents all Arkiv queries used in p2pmentor, as revealed by Arkiv Builder Mode.

### Profile Queries

1. **`getProfileByWallet(wallet: string)`**
   - **Query:** `type='user_profile', wallet='{wallet}'`
   - **Used in:** Dashboard, profile pages, sidebar, onboarding
   - **Returns:** `UserProfile | null`
   - **Attributes:** wallet, displayName, username, timezone, identity_seed, bio, skills, seniority, spaceId, createdAt
   - **Payload:** skillsArray, skillExpertise, contactLinks, etc.

2. **`listUserProfiles({ skill?, seniority?, spaceId? })`**
   - **Query:** `type='user_profile'` + optional filters
   - **Used in:** Network page, profile discovery
   - **Returns:** `UserProfile[]`

3. **`listUserProfilesForWallet(wallet: string)`**
   - **Query:** `type='user_profile', wallet='{wallet}'`
   - **Used in:** Profile history, audit trails
   - **Returns:** `UserProfile[]`

4. **`calculateAverageRating(wallet: string)`**
   - **Query:** `type='session_feedback', feedbackTo='{wallet}'`
   - **Used in:** Dashboard stats, profile pages
   - **Returns:** `number` (average rating 0-5)

### Skill Queries

5. **`listSkills({ status?, slug?, limit? })`**
   - **Query:** `type='skill'` + optional filters
   - **Used in:** Skills pages, topic pages, sidebar, onboarding
   - **Returns:** `Skill[]`
   - **Parallel Query:** `type='skill_txhash'` for transaction hashes
   - **Attributes:** name_canonical, slug, status, created_by_profile, spaceId, createdAt
   - **Payload:** description, metadata

6. **`getSkillBySlug(slug: string)`**
   - **Query:** `type='skill'` (filters by slug client-side)
   - **Used in:** Topic pages, skill helpers
   - **Returns:** `Skill | null`

7. **`getSkillByKey(key: string)`**
   - **Query:** `type='skill'` (filters by key client-side)
   - **Used in:** Skill helpers, validation
   - **Returns:** `Skill | null`

8. **`getSkillTopicLink(skillName: string)`**
   - **Queries:** `getSkillBySlug()` or `listSkills()`
   - **Used in:** Dashboard (View Community links)
   - **Returns:** `string | null` (topic URL)

### Learning Follow Queries

9. **`listLearningFollows({ profile_wallet?, skill_id?, active?, limit? })`**
   - **Query:** `type='learning_follow'` + optional filters
   - **Used in:** Dashboard (skills learning count), skills pages, sidebar, onboarding
   - **Returns:** `LearningFollow[]`
   - **Parallel Query:** `type='learning_follow_txhash'` for transaction hashes
   - **Attributes:** profile_wallet, skill_id, mode, active, spaceId, createdAt

### Session Queries

10. **`listSessions({ mentorWallet?, learnerWallet?, skill?, status?, spaceId?, limit? })`**
    - **Query:** `type='session'` + optional filters
    - **Used in:** Session listing, matching system
    - **Returns:** `Session[]`
    - **Parallel Query:** `type='session_txhash'` for transaction hashes
    - **Attributes:** mentorWallet, learnerWallet, skill, skill_id, status, sessionDate, spaceId, createdAt
    - **Payload:** notes, metadata, meetingLink, videoProvider, videoRoomName, videoJoinUrl

11. **`listSessionsForWallet(wallet: string)`**
    - **Queries:** `listSessions({ mentorWallet })` and `listSessions({ learnerWallet })` in parallel
    - **Used in:** Dashboard (sessions completed count), sessions page, sidebar (upcoming sessions)
    - **Returns:** `Session[]`

12. **`getSessionByKey(key: string)`**
    - **Query:** `type='session', key='{key}'`
    - **Used in:** Session details, confirmation flows, payment flows
    - **Returns:** `Session | null`
    - **Parallel Queries:** Also fetches session_txhash, session_confirmation, session_rejection, session_payment_submission, session_payment_validation, session_jitsi_info

### Feedback Queries

13. **`listFeedbackForSession(sessionKey: string)`**
    - **Query:** `type='session_feedback', sessionKey='{sessionKey}'`
    - **Used in:** Session details, feedback validation
    - **Returns:** `Feedback[]`
    - **Attributes:** sessionKey, mentorWallet, learnerWallet, feedbackFrom, feedbackTo, rating, spaceId, createdAt
    - **Payload:** notes, technicalDxFeedback

14. **`listFeedbackForWallet(wallet: string)`**
    - **Query:** `type='session_feedback'` (filters client-side for feedbackFrom or feedbackTo)
    - **Used in:** Dashboard (average rating calculation), profile pages
    - **Returns:** `Feedback[]`

15. **`hasUserGivenFeedbackForSession(sessionKey: string, feedbackFrom: string)`**
    - **Queries:** `listFeedbackForSession()` then checks if feedbackFrom exists
    - **Used in:** Feedback creation validation
    - **Returns:** `boolean`

### App Feedback Queries

16. **`listAppFeedback({ page?, wallet?, limit?, since?, feedbackType? })`**
    - **Query:** `type='app_feedback'` + optional filters
    - **Used in:** Admin dashboard, feedback management
    - **Returns:** `AppFeedback[]`
    - **Parallel Queries:** Also queries app_feedback_txhash, app_feedback_resolution, admin_response
    - **Attributes:** wallet, page, feedbackType, rating, spaceId, createdAt
    - **Payload:** message

17. **`getAppFeedbackByKey(key: string)`**
    - **Query:** `type='app_feedback', key='{key}'`
    - **Used in:** Notifications (feedback details), admin dashboard
    - **Returns:** `AppFeedback | null`
    - **Parallel Queries:** Also fetches app_feedback_txhash, app_feedback_resolution, admin_response

### Admin Response Queries

18. **`listAdminResponses({ feedbackKey?, wallet?, limit?, since? })`**
    - **Query:** `type='admin_response'` + optional filters
    - **Used in:** App feedback details, admin dashboard
    - **Returns:** `AdminResponse[]`
    - **Parallel Query:** `type='admin_response_txhash'`
    - **Attributes:** feedbackKey, wallet, adminWallet, spaceId, createdAt
    - **Payload:** message

19. **`getAdminResponseByKey(key: string)`**
    - **Query:** `type='admin_response', key='{key}'`
    - **Used in:** Notifications (admin response details)
    - **Returns:** `AdminResponse | null`
    - **Parallel Query:** `type='admin_response_txhash'`

### Notification Queries

20. **`listNotifications({ wallet?, notificationType?, status?, sourceEntityType?, limit? })`**
    - **Query:** `type='notification'` + optional filters
    - **Used in:** Notifications page, notification count hooks
    - **Returns:** `Notification[]`
    - **Parallel Query:** `type='notification_txhash'` for transaction hashes
    - **Attributes:** wallet, notificationType, sourceEntityType, sourceEntityKey, status, spaceId, createdAt
    - **Payload:** title, message, link, metadata

### Notification Preference Queries

21. **`listNotificationPreferences({ wallet?, notificationId?, notificationType?, read?, archived?, limit? })`**
    - **Query:** `type='notification_preference'` + optional filters
    - **Used in:** Notification management, read state tracking
    - **Returns:** `NotificationPreference[]`
    - **Attributes:** wallet, notificationId, notificationType, read, archived, spaceId, createdAt, updatedAt

22. **`getNotificationPreference(wallet: string, notificationId: string)`**
    - **Queries:** `listNotificationPreferences({ wallet, notificationId, limit: 1 })`
    - **Used in:** Notification read state checks
    - **Returns:** `NotificationPreference | null`

### Ask Queries

23. **`listAsks({ skill?, spaceId?, limit?, includeExpired? })`**
    - **Query:** `type='ask', status='open'` + optional filters
    - **Used in:** Asks page, matching system, topic pages
    - **Returns:** `Ask[]`
    - **Parallel Query:** `type='ask_txhash'` for transaction hashes
    - **Attributes:** wallet, skill, skill_id, skill_label, status, spaceId
    - **Payload:** message

24. **`listAsksForWallet(wallet: string)`**
    - **Queries:** `listAsks()` then filters client-side by wallet
    - **Used in:** User profile pages, ask management
    - **Returns:** `Ask[]`

### Offer Queries

25. **`listOffers({ skill?, spaceId?, limit?, includeExpired? })`**
    - **Query:** `type='offer', status='active'` + optional filters
    - **Used in:** Offers page, matching system, topic pages
    - **Returns:** `Offer[]`
    - **Parallel Query:** `type='offer_txhash'` for transaction hashes
    - **Attributes:** wallet, skill, skill_id, skill_label, status, availabilityKey, isPaid, spaceId
    - **Payload:** message, availabilityWindow, cost, paymentAddress

26. **`listOffersForWallet(wallet: string)`**
    - **Queries:** `listOffers()` then filters client-side by wallet
    - **Used in:** User profile pages, offer management
    - **Returns:** `Offer[]`

### Availability Queries

27. **`listAvailabilityForWallet(wallet: string, spaceId?: string)`**
    - **Query:** `type='availability', wallet='{wallet}'` + filters out deletions
    - **Used in:** Availability page, offer creation
    - **Returns:** `Availability[]`
    - **Parallel Queries:** Also queries availability_txhash, availability_deletion
    - **Attributes:** wallet, timezone, spaceId, createdAt
    - **Payload:** timeBlocks (WeeklyAvailability object)

28. **`getAvailabilityByKey(key: string)`**
    - **Query:** `type='availability', key='{key}'` (uses getEntity)
    - **Used in:** Availability management
    - **Returns:** `Availability | null`

### Virtual Gathering Queries

29. **`listVirtualGatherings({ skill?, spaceId?, limit? })`**
    - **Query:** `type='virtual_gathering'` + optional filters
    - **Used in:** Communities/gatherings page, session creation
    - **Returns:** `VirtualGathering[]`
    - **Parallel Query:** `type='virtual_gathering_txhash'` for transaction hashes
    - **Attributes:** organizerWallet, community, title, sessionDate, duration, videoProvider, videoRoomName, videoJoinUrl, spaceId, createdAt
    - **Payload:** description, metadata

30. **`getVirtualGatheringByKey(key: string)`**
    - **Query:** `type='virtual_gathering', key='{key}'` (uses getEntity)
    - **Used in:** Gathering details, RSVP flows
    - **Returns:** `VirtualGathering | null`

31. **`listRsvpWalletsForGathering(gatheringKey: string)`**
    - **Query:** `type='session', gatheringKey='{gatheringKey}'`
    - **Used in:** Gathering RSVP counts, participant lists
    - **Returns:** `string[]` (array of wallet addresses)

### Garden Note Queries

32. **`listGardenNotes({ channel?, targetWallet?, authorWallet?, tags?, limit? })`**
    - **Query:** `type='garden_note', channel='{channel}', moderationState='active'` + optional filters
    - **Used in:** Profile garden notes, public garden board
    - **Returns:** `GardenNote[]`
    - **Attributes:** authorWallet, targetWallet, channel, visibility, publishConsent, moderationState, replyToNoteId, tags, spaceId, createdAt
    - **Payload:** message, tags array

33. **`getGardenNoteByKey(key: string)`**
    - **Query:** Uses `publicClient.getEntity(key)` directly
    - **Used in:** Garden note details, reply threads
    - **Returns:** `GardenNote | null`

34. **`hasExceededDailyLimit(authorWallet: string)`**
    - **Queries:** `listGardenNotes({ authorWallet, limit: GARDEN_NOTE_DAILY_LIMIT + 1 })`
    - **Used in:** Garden note creation validation
    - **Returns:** `boolean`

### Beta Code Queries

35. **`getBetaCodeUsage(code: string)`**
    - **Query:** `type='beta_code_usage', code='{code}'`
    - **Used in:** Beta access validation, usage tracking
    - **Returns:** `BetaCodeUsage | null`
    - **Parallel Query:** `type='beta_code_usage_txhash'`
    - **Attributes:** code, usageCount, limit, spaceId, createdAt

36. **`canUseBetaCode(code: string)`**
    - **Queries:** `getBetaCodeUsage()` then checks if usageCount < limit
    - **Used in:** Beta access validation
    - **Returns:** `boolean`

### Beta Access Queries

37. **`getBetaAccessByWallet(wallet: string)`**
    - **Query:** `type='beta_access', wallet='{wallet}'`
    - **Used in:** Beta gate component, authentication
    - **Returns:** `BetaAccess | null`
    - **Parallel Query:** `type='beta_access_txhash'`
    - **Attributes:** wallet, code, spaceId, grantedAt

38. **`listBetaAccessByCode(code: string)`**
    - **Query:** `type='beta_access', code='{code}'`
    - **Used in:** Beta code usage tracking, admin dashboard
    - **Returns:** `BetaAccess[]`

### Auth Identity Queries

39. **`listPasskeyIdentities(wallet: string)`**
    - **Query:** `type='auth_identity', subtype='passkey', wallet='{wallet}'`
    - **Used in:** Authentication, multi-device support
    - **Returns:** `AuthIdentity[]`
    - **Attributes:** wallet, subtype, credentialId, spaceId, createdAt
    - **Payload:** credential (PasskeyCredential object)

40. **`listBackupWalletIdentities(wallet: string)`**
    - **Query:** `type='auth_identity', subtype='backup_wallet', wallet='{wallet}'`
    - **Used in:** Account recovery flows
    - **Returns:** `AuthIdentity[]`
    - **Attributes:** wallet, subtype, spaceId, createdAt
    - **Payload:** backupMetadata (walletAddress, createdAt)

41. **`findPasskeyIdentityByCredentialID(credentialID: string)`**
    - **Query:** `type='auth_identity', subtype='passkey', credentialId='{credentialID}'`
    - **Used in:** Passkey authentication flow
    - **Returns:** `AuthIdentity | null`

### Onboarding Event Queries

42. **`listOnboardingEvents({ wallet, eventType?, limit?, spaceId? })`**
    - **Query:** `type='onboarding_event', wallet='{wallet}', spaceId='{spaceId}'` + optional eventType filter
    - **Used in:** Onboarding flow, access control, onboarding level calculation
    - **Returns:** `OnboardingEvent[]`
    - **Attributes:** wallet, eventType, spaceId, createdAt
    - **Payload:** Additional metadata

### Performance Metrics Queries

43. **`listDxMetrics({ limit? })`**
    - **Query:** `type='dx_metric'`
    - **Used in:** Performance monitoring, admin dashboard
    - **Returns:** `DxMetric[]`
    - **Attributes:** metricType, spaceId, createdAt
    - **Payload:** sample data

### Performance Snapshot Queries

44. **`listPerfSnapshots({ limit? })`**
    - **Query:** `type='perf_snapshot'`
    - **Used in:** Performance monitoring, admin dashboard
    - **Returns:** `PerfSnapshot[]`
    - **Attributes:** spaceId, createdAt
    - **Payload:** snapshot data

45. **`getLatestSnapshot(operation: string)`**
    - **Queries:** `listPerfSnapshots()` then filters by operation and gets most recent
    - **Used in:** Performance tracking, optimization
    - **Returns:** `PerfSnapshot | null`

### Metric Aggregates Queries

46. **`listMetricAggregates({ metricType?, limit? })`**
    - **Query:** `type='metric_aggregate'` + optional metricType filter
    - **Used in:** Performance monitoring, analytics
    - **Returns:** `MetricAggregate[]`
    - **Attributes:** metricType, spaceId, createdAt
    - **Payload:** Aggregate data

### Retention Metrics Queries

47. **`getActiveWalletsForDateRange(startDate: string, endDate: string)`**
    - **Query:** `type='user_profile'` (filters by createdAt in date range client-side)
    - **Used in:** Retention analysis, cohort tracking
    - **Returns:** `string[]` (array of wallet addresses)

48. **`listRetentionCohorts({ cohortDate?, limit? })`**
    - **Query:** `type='retention_cohort'` + optional filters
    - **Used in:** Retention analysis, analytics
    - **Returns:** `RetentionCohort[]`
    - **Attributes:** cohortDate, spaceId, createdAt
    - **Payload:** Cohort data

### Client Performance Metric Queries

49. **`listClientPerfMetrics({ limit? })`**
    - **Query:** `type='client_perf_metric'`
    - **Used in:** Performance monitoring, client-side optimization
    - **Returns:** `ClientPerfMetric[]`
    - **Attributes:** metricType, spaceId, createdAt
    - **Payload:** Metric data

### GitHub Issue Link Queries

50. **`listGitHubIssueLinks({ issueNumber?, limit? })`**
    - **Query:** `type='github_issue_link'` + optional filters
    - **Used in:** Issue tracking, GitHub integration
    - **Returns:** `GitHubIssueLink[]`
    - **Attributes:** issueNumber, spaceId, createdAt
    - **Payload:** Link data

## Complete List of Entity Creation Functions

This section documents all entity creation operations used in p2pmentor, as revealed by Arkiv Builder Mode.

### Profile Creation

1. **`createUserProfileClient({ wallet, displayName, ... })`**
   - **Creates:** `type='user_profile'`
   - **Used in:** Profile pages, onboarding
   - **TTL:** 1 year (31536000 seconds)
   - **Attributes:** wallet, displayName, username, timezone, identity_seed, bio, skills, seniority, spaceId, createdAt
   - **Payload:** skillsArray, skillExpertise, contactLinks, etc.

2. **`createUserProfile({ wallet, displayName, ... })`**
   - **Creates:** `type='user_profile'`
   - **Used in:** API routes, server-side profile creation
   - **TTL:** 1 year
   - **Attributes:** Same as createUserProfileClient

### Skill Creation

3. **`createSkill({ name_canonical, description, created_by_profile, ... })`**
   - **Creates:** `type='skill'`
   - **Used in:** Skill helpers, skill creation flow
   - **TTL:** Permanent (no expiration)
   - **Attributes:** name_canonical, slug, status, created_by_profile, spaceId, createdAt
   - **Payload:** description, metadata
   - **Also Creates:** `type='skill_txhash'`

### Learning Follow Creation

4. **`createLearningFollow({ profile_wallet, skill_id, ... })`**
   - **Creates:** `type='learning_follow'`
   - **Used in:** Skills pages, onboarding
   - **TTL:** 1 year (31536000 seconds)
   - **Attributes:** profile_wallet, skill_id, mode, active, spaceId, createdAt
   - **Also Creates:** `type='learning_follow_txhash'`

### Session Creation

5. **`createSession({ mentorWallet, learnerWallet, skill_id, ... })`**
   - **Creates:** `type='session'`
   - **Used in:** Session creation flow, matching system, virtual gathering RSVPs
   - **TTL:** Calculated based on sessionDate + duration + 1 hour buffer
   - **Attributes:** mentorWallet, learnerWallet, skill, skill_id, status, sessionDate, spaceId, createdAt, requiresPayment, paymentAddress, cost
   - **Payload:** notes, metadata, meetingLink, duration
   - **Also Creates:** `type='session_txhash'`

6. **`confirmSession({ sessionKey, confirmedByWallet, ... })`**
   - **Creates:** `type='session_confirmation'`
   - **Used in:** Session confirmation flow
   - **TTL:** 1 year
   - **Attributes:** sessionKey, confirmedBy, mentorWallet, learnerWallet, spaceId, createdAt
   - **Payload:** confirmation data

7. **`rejectSession({ sessionKey, rejectedByWallet, ... })`**
   - **Creates:** `type='session_rejection'`
   - **Used in:** Session rejection flow
   - **TTL:** 1 year
   - **Attributes:** sessionKey, rejectedBy, mentorWallet, learnerWallet, spaceId, createdAt
   - **Payload:** Rejection reason

8. **`submitPayment({ sessionKey, learnerWallet, paymentTxHash, ... })`**
   - **Creates:** `type='session_payment_submission'`
   - **Used in:** Payment flow
   - **TTL:** 1 year
   - **Attributes:** sessionKey, learnerWallet, paymentTxHash, spaceId, createdAt
   - **Payload:** Payment details

9. **`validatePayment({ sessionKey, paymentTxHash, validatedBy, ... })`**
   - **Creates:** `type='session_payment_validation'`
   - **Used in:** Payment validation flow
   - **TTL:** 1 year
   - **Attributes:** sessionKey, paymentTxHash, validatedBy, spaceId, createdAt
   - **Payload:** Validation details

### Feedback Creation

10. **`createFeedback({ sessionKey, feedbackFrom, feedbackTo, rating, ... })`**
    - **Creates:** `type='session_feedback'`
    - **Used in:** Session feedback flow
    - **TTL:** 1 year
    - **Attributes:** sessionKey, mentorWallet, learnerWallet, feedbackFrom, feedbackTo, rating, spaceId, createdAt
    - **Payload:** notes, technicalDxFeedback

### App Feedback Creation

11. **`createAppFeedback({ wallet, page, message, rating, ... })`**
    - **Creates:** `type='app_feedback'`
    - **Used in:** Feedback modal, issue reporting
    - **TTL:** 1 year
    - **Attributes:** wallet, page, feedbackType, rating, spaceId, createdAt
    - **Payload:** message
    - **Also Creates:** `type='app_feedback_txhash'`

12. **`resolveAppFeedback({ feedbackKey, resolvedBy, ... })`**
    - **Creates:** `type='app_feedback_resolution'`
    - **Used in:** Admin dashboard
    - **TTL:** 1 year
    - **Attributes:** feedbackKey, resolvedBy, spaceId, resolvedAt
    - **Payload:** Resolution notes

### Admin Response Creation

13. **`createAdminResponse({ feedbackKey, wallet, message, ... })`**
    - **Creates:** `type='admin_response'`
    - **Used in:** Admin dashboard
    - **TTL:** 1 year
    - **Attributes:** feedbackKey, wallet, adminWallet, spaceId, createdAt
    - **Payload:** message
    - **Also Creates:** `type='admin_response_txhash'` and triggers notification creation

### Notification Creation

14. **`createNotification({ wallet, notificationType, sourceEntityType, ... })`**
    - **Creates:** `type='notification'`
    - **Used in:** Various flows (session creation, admin response, virtual gathering, garden notes, etc.)
    - **TTL:** 30 days (2592000 seconds)
    - **Attributes:** wallet, notificationType, sourceEntityType, sourceEntityKey, status, spaceId, createdAt
    - **Payload:** title, message, link, metadata
    - **Also Creates:** `type='notification_txhash'`

### Notification Preference Creation

15. **`upsertNotificationPreference({ wallet, notificationId, notificationType, read?, archived? })`**
    - **Creates:** `type='notification_preference'`
    - **Used in:** Notifications page (mark as read/unread, delete)
    - **TTL:** 30 days
    - **Attributes:** wallet, notificationId, notificationType, read, archived, spaceId, createdAt, updatedAt
    - **Payload:** Additional metadata

### Ask Creation

16. **`createAsk({ wallet, skill_id, message, ... })`**
    - **Creates:** `type='ask'`
    - **Used in:** Asks page, onboarding
    - **TTL:** 30 days (2592000 seconds)
    - **Attributes:** wallet, skill, skill_id, skill_label, status, spaceId
    - **Payload:** message
    - **Also Creates:** `type='ask_txhash'`

### Offer Creation

17. **`createOffer({ wallet, skill_id, message, availabilityWindow, ... })`**
    - **Creates:** `type='offer'`
    - **Used in:** Offers page, onboarding
    - **TTL:** 30 days
    - **Attributes:** wallet, skill, skill_id, skill_label, status, availabilityKey, isPaid, spaceId
    - **Payload:** message, availabilityWindow, cost, paymentAddress
    - **Also Creates:** `type='offer_txhash'`

### Availability Creation

18. **`createAvailability({ wallet, timeBlocks, timezone, ... })`**
    - **Creates:** `type='availability'`
    - **Used in:** Availability page, offer creation
    - **TTL:** 30 days (2592000 seconds)
    - **Attributes:** wallet, timezone, spaceId, createdAt
    - **Payload:** timeBlocks (WeeklyAvailability object)
    - **Also Creates:** `type='availability_txhash'`

### Virtual Gathering Creation

19. **`createVirtualGathering({ organizerWallet, community, title, ... })`**
    - **Creates:** `type='virtual_gathering'`
    - **Used in:** Communities/gatherings page
    - **TTL:** Calculated based on sessionDate + duration + 1 hour buffer
    - **Attributes:** organizerWallet, community, title, sessionDate, duration, videoProvider, videoRoomName, videoJoinUrl, spaceId, createdAt
    - **Payload:** description, metadata
    - **Also Creates:** `type='virtual_gathering_txhash'`

20. **`createVirtualGatheringRsvp({ gatheringKey, wallet, ... })`**
    - **Creates:** `type='session'` with `gatheringKey` attribute
    - **Used in:** Virtual gathering RSVP flow
    - **TTL:** Calculated based on sessionDate + duration + 1 hour buffer
    - **Attributes:** gatheringKey, mentorWallet (organizer), learnerWallet (RSVP wallet), skill_id, sessionDate, duration, spaceId, createdAt
    - **Payload:** notes, metadata

### Garden Note Creation

21. **`createGardenNote({ authorWallet, message, tags, ... })`**
    - **Creates:** `type='garden_note'`
    - **Used in:** Garden notes flow, public garden board
    - **TTL:** 1 year (31536000 seconds)
    - **Attributes:** authorWallet, targetWallet, channel, visibility, publishConsent, moderationState, replyToNoteId, tags, spaceId, createdAt
    - **Payload:** message, tags array
    - **Also Creates:** `type='garden_note_txhash'`

### Beta Code Creation

22. **`trackBetaCodeUsage(code: string, limit: number)`**
    - **Creates:** `type='beta_code_usage'`
    - **Used in:** Beta access validation
    - **TTL:** 1 year
    - **Attributes:** code, usageCount, limit, spaceId, createdAt
    - **Payload:** Additional metadata
    - **Also Creates:** `type='beta_code_usage_txhash'`

### Beta Access Creation

23. **`createBetaAccess({ wallet, code, ... })`**
    - **Creates:** `type='beta_access'`
    - **Used in:** Beta gate, authentication
    - **TTL:** 1 year (31536000 seconds)
    - **Attributes:** wallet, code, spaceId, grantedAt
    - **Payload:** Additional metadata
    - **Also Creates:** `type='beta_access_txhash'`

### Auth Identity Creation

24. **`createPasskeyIdentity({ wallet, credentialID, credentialPublicKey, ... })`**
    - **Creates:** `type='auth_identity'` with `subtype='passkey'`
    - **Used in:** Passkey registration flow
    - **TTL:** 1 year (31536000 seconds)
    - **Attributes:** wallet, subtype, credentialId, spaceId, createdAt
    - **Payload:** credential (PasskeyCredential object)
    - **Also Creates:** `type='auth_identity_passkey_txhash'`

25. **`createBackupWalletIdentity({ wallet, backupWalletAddress, ... })`**
    - **Creates:** `type='auth_identity'` with `subtype='backup_wallet'`
    - **Used in:** Account recovery flow
    - **TTL:** 1 year
    - **Attributes:** wallet, subtype, spaceId, createdAt
    - **Payload:** backupMetadata (walletAddress, createdAt)
    - **Also Creates:** `type='auth_identity_backup_wallet_txhash'`

### Onboarding Event Creation

26. **`createOnboardingEvent({ wallet, eventType, ... })`**
    - **Creates:** `type='onboarding_event'`
    - **Used in:** Onboarding flow, access control
    - **TTL:** 1 year (31536000 seconds)
    - **Attributes:** wallet, eventType, spaceId, createdAt
    - **Payload:** Additional metadata
    - **Also Creates:** `type='onboarding_event_txhash'`

27. **`createOnboardingEventClient({ wallet, eventType, account, ... })`**
    - **Creates:** `type='onboarding_event'`
    - **Used in:** Onboarding flow
    - **TTL:** 1 year
    - **Attributes:** Same as createOnboardingEvent
    - **Also Creates:** `type='onboarding_event_txhash'`

### Performance Metric Creation

28. **`createDxMetric({ sample, ... })`**
    - **Creates:** `type='dx_metric'`
    - **Used in:** Performance tracking, client perf tracker
    - **TTL:** 1 year
    - **Attributes:** metricType, spaceId, createdAt
    - **Payload:** sample data

### Performance Snapshot Creation

29. **`createPerfSnapshot({ snapshot, ... })`**
    - **Creates:** `type='perf_snapshot'`
    - **Used in:** Performance monitoring
    - **TTL:** 1 year
    - **Attributes:** spaceId, createdAt
    - **Payload:** snapshot data

### Metric Aggregate Creation

30. **`createMetricAggregate({ metricType, aggregateData, ... })`**
    - **Creates:** `type='metric_aggregate'`
    - **Used in:** Performance monitoring, analytics
    - **TTL:** 1 year
    - **Attributes:** metricType, spaceId, createdAt
    - **Payload:** Aggregate data

### Retention Cohort Creation

31. **`createRetentionCohort({ cohortDate, cohortData, ... })`**
    - **Creates:** `type='retention_cohort'`
    - **Used in:** Retention analysis, analytics
    - **TTL:** 1 year
    - **Attributes:** cohortDate, spaceId, createdAt
    - **Payload:** Cohort data

### Client Performance Metric Creation

32. **`createClientPerfMetric({ metricType, metricData, ... })`**
    - **Creates:** `type='client_perf_metric'`
    - **Used in:** Client-side performance tracking
    - **TTL:** 1 year
    - **Attributes:** metricType, spaceId, createdAt
    - **Payload:** Metric data

### GitHub Issue Link Creation

33. **`createGitHubIssueLink({ issueNumber, linkData, ... })`**
    - **Creates:** `type='github_issue_link'`
    - **Used in:** Issue tracking, GitHub integration
    - **TTL:** 1 year
    - **Attributes:** issueNumber, spaceId, createdAt
    - **Payload:** Link data

## Entity Update/Delete Functions

### Availability Deletion

1. **`deleteAvailability({ availabilityKey, wallet, ... })`**
   - **Creates:** `type='availability_deletion'`
   - **Used in:** Availability page
   - **TTL:** 30 days (matches original availability)
   - **Attributes:** availabilityKey, wallet, spaceId, createdAt
   - **Payload:** deletedAt, availabilityKey

### Learning Follow Unfollow

2. **`unfollowSkill({ profile_wallet, skill_id, ... })`**
   - **Creates:** `type='learning_follow'` with `active=false`
   - **Used in:** Skills pages, dashboard
   - **TTL:** 1 year
   - **Attributes:** profile_wallet, skill_id, mode, active=false, spaceId, createdAt
   - **Payload:** unfollowed flag

## Query Patterns and Best Practices

### 1. Parallel Queries for Transaction Hashes

Many entities store transaction hashes in separate entities for reliable querying:

- `user_profile` → `user_profile_txhash`
- `skill` → `skill_txhash`
- `session` → `session_txhash`
- `ask` → `ask_txhash`
- `offer` → `offer_txhash`
- `app_feedback` → `app_feedback_txhash`
- `admin_response` → `admin_response_txhash`
- `learning_follow` → `learning_follow_txhash`
- `availability` → `availability_txhash`
- `virtual_gathering` → `virtual_gathering_txhash`
- `garden_note` → `garden_note_txhash`
- `beta_code_usage` → `beta_code_usage_txhash`
- `beta_access` → `beta_access_txhash`
- `auth_identity` (passkey) → `auth_identity_passkey_txhash`
- `auth_identity` (backup_wallet) → `auth_identity_backup_wallet_txhash`
- `onboarding_event` → `onboarding_event_txhash`
- `notification` → `notification_txhash`

### 2. Wallet Normalization

All wallet addresses are normalized to lowercase:
```typescript
wallet.toLowerCase()
```

This is critical for consistent querying and storage.

### 3. Immutable Update Pattern

Since Arkiv entities are immutable, updates create new entities:
- Profile updates: Create new `user_profile` entity
- Learning follow unfollow: Create new `learning_follow` with `active=false`
- Availability deletion: Create `availability_deletion` marker
- Notification preference updates: Create new `notification_preference` entity

### 4. Filtering Deleted Entities

For entities that support deletion:
- Query both the entity type and deletion marker type
- Filter out entities that have corresponding deletion markers

### 5. Payload Encoding/Decoding

All payloads are JSON-encoded:
```typescript
// Encoding
const payload = enc.encode(JSON.stringify(data));

// Decoding
const decoded = entity.payload instanceof Uint8Array
  ? new TextDecoder().decode(entity.payload)
  : typeof entity.payload === 'string'
  ? entity.payload
  : JSON.stringify(entity.payload);
const data = JSON.parse(decoded);
```

### 6. TTL (Time To Live)

Common TTL values:
- **Permanent (no expiration):** Skills
- **1 year (31536000s):** Profiles, sessions, feedback, learning follows, garden notes, beta codes, beta access, auth identities, onboarding events, performance metrics
- **30 days (2592000s):** Notifications, asks, offers, availability

### 7. Client-Side vs Server-Side Filtering

Some queries fetch all entities then filter client-side:
- **Client-side filtering:** Skills (by status/slug), profiles (by skill), feedback (by wallet), asks/offers (by skill)
- **Arkiv-level filtering:** Notifications (by wallet), sessions (by mentorWallet/learnerWallet), availability (by wallet)

Reason: Some attributes may be stored in payload or in multiple formats, making Arkiv-level filtering unreliable.

## Summary Statistics

- **Total Query Functions:** 50
- **Total Creation Functions:** 33
- **Total Update/Delete Functions:** 2
- **Total Entity Types:** 30+
- **API Routes Using Arkiv:** 12
- **Page Components Using Arkiv:** 20+
- **Pages with Arkiv Builder Mode:** 18

## Technical Implementation

### State Management

Arkiv Builder Mode state is managed globally via:
- **localStorage:** Persists mode across page navigations
- **Custom Events:** Syncs state across components in same tab
- **Storage Events:** Syncs state across browser tabs

### Component Architecture

All Arkiv Builder Mode features are implemented using:
- **Conditional Rendering:** Only shows when `arkivBuilderMode === true`
- **Reusable Components:** `ArkivQueryTooltip`, `ViewOnArkivLink`
- **Global Hook:** `useArkivBuilderMode()` for consistent state access

### Code Organization

- **Components:** `components/ArkivQueryTooltip.tsx`, `components/ViewOnArkivLink.tsx`, `components/ArkivBuilderModeToggle.tsx`, `components/GlobalToggles.tsx`
- **Hooks:** `lib/hooks/useArkivBuilderMode.ts`
- **Implementation:** Spread across all page components and onboarding step components

## Examples

### Example 1: Profile Query Tooltip

When viewing a profile with Arkiv Builder Mode enabled, hovering over the loading state shows:

```
getProfileByWallet("0x4b6d14...")
Query: type='user_profile', wallet='0x4b6d14...'
Returns: UserProfile | null
```

### Example 2: Entity Creation Tooltip

When creating a session with Arkiv Builder Mode enabled, hovering over the "Request Meeting" button shows:

```
POST /api/sessions { action: 'createSession', ... }
Creates: type='session' entity
Attributes: mentorWallet, learnerWallet, skill, sessionDate, duration, requiresPayment, ...
Payload: notes, paymentAddress, cost
TTL: sessionDate + duration + 1 hour buffer
```

### Example 3: Entity Link

When viewing a skill with Arkiv Builder Mode enabled, the skill entity shows:

```
[View Skill on Arkiv] Key: abc123def456...
```

Clicking the link opens the entity in the Arkiv Explorer.

## Benefits for Arkiv Builders

1. **Transparency:** See exactly what queries are being made and when
2. **Education:** Learn Arkiv query patterns and entity structures
3. **Debugging:** Quickly identify which queries are failing or slow
4. **Verification:** Verify all data comes from on-chain sources
5. **Exploration:** Direct links to Arkiv Explorer for all entities

## Future Enhancements

Potential improvements:
- Query performance metrics in tooltips
- Query result counts
- Entity relationship visualization
- Query history tracking
- Export query logs for analysis

---

**Last Updated:** December 13, 2025  
**Status:** ✅ Fully Implemented  
**Maintained By:** Engineering Team

