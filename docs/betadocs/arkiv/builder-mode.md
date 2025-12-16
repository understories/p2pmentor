# Arkiv Builder Mode

## Overview

Arkiv Builder Mode is a developer-focused feature that makes every Arkiv query and interaction visible and educational. When enabled, it reveals the underlying Arkiv infrastructure powering p2pmentor, displaying entity information, query details, and links to Arkiv Explorer.

## How to Enable

1. Look for the **[A]** toggle button in the top-right corner of any page (next to the theme toggle)
2. Click the toggle to enable Arkiv Builder Mode
3. The mode persists across page navigations via localStorage
4. A banner appears at the top of the page when active
5. All tooltips and entity information become visible

## Features

### Query Tooltips

When Arkiv Builder Mode is enabled, hover over loading states, buttons, and interactive elements to see detailed query information:

- What query is being made (function name, API endpoint)
- Query parameters (filters, wallet addresses, entity types)
- What data is returned (entity types, attributes, payloads)
- TTL (Time To Live) values for entities

### Entity Links

All displayed entities show:

- View on Arkiv links that open the entity in the Arkiv Explorer
- Entity keys (truncated for readability)
- Transaction hashes (when available)

### Action Tooltips

Buttons that create or update entities show tooltips explaining:

- What entity type will be created
- What attributes will be set
- What payload data will be stored
- TTL for the new entity

### Visual Banner

When active, a banner appears at the top of the page showing:

- Arkiv Builder Mode status
- Query count (future feature)
- Quick toggle access
- Collapsible information panel

## Implementation

### State Management

Arkiv Builder Mode state is managed globally via:

- localStorage: Persists mode across page navigations
- Custom Events: Syncs state across components in same tab
- Storage Events: Syncs state across browser tabs

### Components

- `ArkivBuilderModeToggle`: Toggle component for enabling/disabling mode
- `ArkivQueryTooltip`: Tooltip component that displays query information
- `ViewOnArkivLink`: Link component that opens entities in Arkiv Explorer
- `ArkivModeBanner`: Banner component that shows mode status
- `GlobalToggles`: Global toggle container (includes theme and Arkiv Builder Mode)

### Hook

- `useArkivBuilderMode()`: Global hook for consistent state access across components

## Coverage

Arkiv Builder Mode is implemented across all major pages and flows:

- Dashboard (`/me`)
- Profile management (`/me/profile`, `/me/skills`, `/me/availability`)
- Sessions (`/me/sessions`)
- Discovery pages (`/profiles`, `/skills/explore`, `/topic/[slug]`)
- Interaction pages (`/asks`, `/offers`, `/matches`, `/network`)
- Social pages (`/garden/public-board`, `/profiles/[wallet]/garden-notes`)
- Onboarding flow (all steps)
- Notifications (`/notifications`)

## Technical Details

### Query Patterns

All Arkiv queries follow standard patterns:

- Use `buildQuery().where(eq(...))` structure
- Fetch main entities and `*_txhash` entities in parallel
- Gracefully handle query failures and transaction timeouts
- Return empty arrays on query failures (don't throw)

### Entity Creation

All entity creation follows Arkiv-native patterns:

- Normalize wallet addresses to lowercase
- Use attributes for queryable fields
- Use payload for user-facing content
- Include `spaceId`, `createdAt`, `type` attributes
- Create parallel `*_txhash` entities for reliable querying

### Error Handling

All Arkiv operations use defensive error handling:

- Use `handleTransactionWithTimeout` for entity creation
- Return null or empty arrays on failures
- Log errors but don't block user flows
- Handle transaction receipt timeouts gracefully

## Examples

### Profile Query Tooltip

When viewing a profile with Arkiv Builder Mode enabled, hovering over the loading state shows:

```
getProfileByWallet("0x4b6d14...")
Query: type='user_profile', wallet='0x4b6d14...'
Returns: UserProfile | null
```

### Entity Creation Tooltip

When creating a session with Arkiv Builder Mode enabled, hovering over the "Request Meeting" button shows:

```
POST /api/sessions { action: 'createSession', ... }
Creates: type='session' entity
Attributes: mentorWallet, learnerWallet, skill, sessionDate, duration
Payload: notes, paymentAddress, cost
TTL: sessionDate + duration + 1 hour buffer
```

### View on Arkiv Link

When viewing an entity with Arkiv Builder Mode enabled, a link appears:

```
View on Arkiv Explorer
Entity Key: abc123...
TxHash: 0xdef456...
```

## Benefits

- Educational: Learn how Arkiv queries work
- Transparent: See exactly what data is stored
- Verifiable: All entities linkable to Arkiv Explorer
- Debuggable: Understand query patterns and performance
- Trustless: Verify all claims on-chain

