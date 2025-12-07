# Arkiv DX Runbook

This document tracks developer experience (DX) with Arkiv integration. Every feature that uses Arkiv should be documented here.

## Purpose

- Track pain points and friction when working with Arkiv
- Document workarounds and temporary solutions
- Propose improvements for discussion with Arkiv team
- Help future developers understand Arkiv integration patterns

## Template for Each Feature

For every feature that uses Arkiv, document:

- **Feature name**: What feature this is
- **Arkiv entities used**: Which entity types (profile, skill, ask, etc.)
- **Queries used**: Query patterns and filters
- **SDK pain points**: What was confusing or difficult
- **Errors encountered**: Any errors and how they were resolved
- **Developer friction level**: Low / Medium / High
- **Proposed improvements**: Suggestions for better DX
- **UX team notes**: Any UX implications
- **Screenshots/recordings**: If helpful for context

---

## Features

### Profile Management
- **Feature name**: User profile creation and updates
- **Arkiv entities used**: `user_profile` (type attribute)
- **Queries used**: `eq('type', 'user_profile')`, `eq('wallet', walletAddress)`
- **SDK pain points**: None significant - straightforward entity creation
- **Errors encountered**: None
- **Developer friction level**: Low
- **Proposed improvements**: None at this time
- **UX team notes**: Profile updates create new entities (immutability), so we fetch the latest one

### Skills Management
- **Feature name**: Skills add/view/edit
- **Arkiv entities used**: `user_profile` (skills stored in `skillsArray` field)
- **Queries used**: Same as profile management
- **SDK pain points**: None - skills are part of profile entity
- **Errors encountered**: None
- **Developer friction level**: Low
- **Proposed improvements**: None at this time
- **UX team notes**: Skills are stored as an array in the profile payload

### Asks (I am learning)
- **Feature name**: Create and browse learning requests
- **Arkiv entities used**: 
  - `ask` (type attribute) - main ask entity
  - `ask_txhash` (type attribute) - separate entity for transaction hash tracking
- **Queries used**: 
  - `eq('type', 'ask')`, `eq('status', 'open')` for listing
  - `eq('type', 'ask_txhash')` for txhash lookup
  - Optional: `eq('skill', skillName)` for filtering
- **SDK pain points**: 
  - Need to create two entities (ask + ask_txhash) which feels redundant
  - Querying txhashes separately and mapping them back is verbose
- **Errors encountered**: None
- **Developer friction level**: Medium
- **Proposed improvements**: 
  - Consider including txHash in the main entity attributes instead of separate entity
  - Or provide a helper method to fetch entity with its txhash automatically
- **UX team notes**: 
  - Asks expire after 1 hour (TTL: 3600 seconds)
  - Status is 'open' for active asks
  - Skill filtering is done client-side after fetching (could be optimized server-side)

### Offers (I am teaching)
- **Feature name**: Create and browse teaching offers
- **Arkiv entities used**: 
  - `offer` (type attribute) - main offer entity
  - `offer_txhash` (type attribute) - separate entity for transaction hash tracking
- **Queries used**: 
  - `eq('type', 'offer')`, `eq('status', 'active')` for listing
  - `eq('type', 'offer_txhash')` for txhash lookup
  - Optional: `eq('skill', skillName)` for filtering
- **SDK pain points**: 
  - Same as asks - two entities needed (offer + offer_txhash)
  - Same verbose txhash mapping pattern
- **Errors encountered**: None
- **Developer friction level**: Medium
- **Proposed improvements**: 
  - Same as asks - consider simplifying txhash storage
- **UX team notes**: 
  - Offers expire after 2 hours (TTL: 7200 seconds)
  - Status is 'active' for active offers
  - Includes `availabilityWindow` field in payload
  - Skill filtering is done client-side after fetching

---

## General Notes

### Arkiv SDK Version

- Current: `@arkiv-network/sdk@^0.4.4`
- Source: Based on mentor-graph reference implementation

### Chain Configuration

- **Network**: Mendoza testnet
- **Chain ID**: From `@arkiv-network/sdk/chains`
- **RPC**: Provided by Arkiv SDK

### Common Patterns

#### Client-Side Entity Creation

```typescript
import { getWalletClientFromMetaMask } from '@/lib/arkiv/client';

const walletClient = getWalletClientFromMetaMask(account);
const { entityKey, txHash } = await walletClient.createEntity({
  payload: enc.encode(JSON.stringify(data)),
  contentType: 'application/json',
  attributes: [...],
  expiresIn: 31536000, // 1 year
});
```

#### Server-Side Entity Creation

```typescript
import { getWalletClientFromPrivateKey } from '@/lib/arkiv/client';

const walletClient = getWalletClientFromPrivateKey(privateKey);
// Same createEntity pattern as above
```

#### Querying Entities

```typescript
import { getPublicClient } from '@/lib/arkiv/client';
import { eq } from '@arkiv-network/sdk/query';

const publicClient = getPublicClient();
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', walletAddress))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

### Availability Management
- **Feature name**: Simple text-based availability management
- **Arkiv entities used**: `user_profile` (availabilityWindow stored in payload)
- **Queries used**: Same as profile management (no separate queries)
- **SDK pain points**: None - straightforward string storage
- **Errors encountered**: None
- **Developer friction level**: Low
- **Proposed improvements**: None at this time
- **UX team notes**: 
  - Simple text input for beta launch
  - Users can describe availability in natural language (e.g., "Mon-Fri 9am-5pm EST")
  - Calendar API integration deferred to post-beta based on user feedback
  - Research document created: `docs/availability_research.md`

### Network Graph
- **Feature name**: Network view with matching and filtering
- **Arkiv entities used**: 
  - `ask` (type attribute) - for learning requests
  - `offer` (type attribute) - for teaching offers
  - `user_profile` (type attribute) - for displaying user information
- **Queries used**: 
  - `/api/asks` - GET to list all asks
  - `/api/offers` - GET to list all offers
  - `getProfileByWallet()` - to fetch profiles for matched users
- **SDK pain points**: None - uses existing API routes
- **Errors encountered**: None
- **Developer friction level**: Low
- **Proposed improvements**: 
  - Could add server-side matching endpoint for better performance with large datasets
  - Could add more sophisticated matching algorithm (fuzzy matching, skill synonyms)
- **UX team notes**: 
  - Simplified list view for beta (vs complex visual graph)
  - Matching shows side-by-side ask/offer pairs
  - Filtering by skill and view type
  - Shows TTL countdown for urgency
  - Profile names displayed when available

### Sessions (Meeting Requests)
- **Feature name**: Mentorship session creation and management
- **Arkiv entities used**: 
  - `session` (type attribute) - main session entity
  - `session_txhash` (type attribute) - separate entity for transaction hash tracking
  - `session_confirmation` (type attribute) - confirmation entities (one per party)
  - `session_rejection` (type attribute) - rejection entities
  - `session_jitsi` (type attribute) - Jitsi meeting info (generated when both confirm)
- **Queries used**: 
  - `eq('type', 'session')` for listing sessions
  - `eq('mentorWallet', wallet)` or `eq('learnerWallet', wallet)` for filtering
  - `eq('sessionKey', key)` for confirmations/rejections/Jitsi lookup
- **SDK pain points**: 
  - Need to create multiple entities (session + session_txhash) which feels redundant
  - Complex querying to get full session state (session + confirmations + rejections + Jitsi)
  - Status calculation requires checking multiple entity types
- **Errors encountered**: None
- **Developer friction level**: Medium-High
- **Proposed improvements**: 
  - Consider including txHash in main entity attributes instead of separate entity
  - Could simplify status calculation with a helper function
  - Consider a single "session_state" entity that aggregates all info
- **UX team notes**: 
  - Sessions expire based on sessionDate + duration + 1 hour buffer
  - Status flow: pending → scheduled (when both confirm) or cancelled (if rejected)
  - Jitsi meeting auto-generated when both parties confirm
  - Mentor/learner roles auto-detected from profile.mentorRoles

### Known Issues / TODOs

(Will be populated as issues are encountered)

