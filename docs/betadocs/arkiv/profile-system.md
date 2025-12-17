# Arkiv-Native Profile System

## Overview

This document explains how we implement user profiles with blockchain data in a serverless, decentralized architecture. Profiles are stored as Arkiv entities, using the immutable entity pattern to track profile changes over time.

**Key Challenge:** Managing profile updates in a decentralized environment where entities are immutable. Each profile change creates a new entity, requiring efficient querying to get the latest version.

**Solution:** Store profiles as Arkiv entities with immutable updates. Query all profiles for a wallet and select the most recent one by `createdAt` timestamp.

## Architecture

### Core Components

1. **Profile Entities** (`user_profile`)
   - Created when users create or update their profile
   - Immutable - each update creates a new entity
   - Contains: wallet, displayName, username, bio, skills, timezone, contactLinks, etc.
   - TTL: 1 year (31536000 seconds)

2. **Profile Query Pattern**
   - Query all profiles for a wallet
   - Sort by `createdAt` descending
   - Return the most recent profile (latest version)
   - Old profiles remain for history/audit

3. **Client-Side State Management**
   - Optimistic UI updates for immediate feedback
   - Query latest profile on load
   - Handle profile creation and updates seamlessly

## Entity Structure

### User Profile Entity

```typescript
type UserProfile = {
  key: string;                    // Entity key
  wallet: string;                 // User wallet (normalized to lowercase)
  displayName: string;            // Display name
  username?: string;              // Optional username
  profileImage?: string;          // Profile image URL
  identity_seed?: string;        // Emoji Identity Seed (EIS)
  bio?: string;                   // Bio (legacy)
  bioShort?: string;             // Short bio
  bioLong?: string;              // Long bio
  timezone: string;              // User timezone
  languages?: string[];           // Languages spoken
  contactLinks?: {                // Social links
    twitter?: string;
    github?: string;
    telegram?: string;
    discord?: string;
  };
  skills: string;                 // Skills (legacy comma-separated)
  skillsArray?: string[];        // Skills array
  skill_ids?: string[];          // Skill entity keys (Arkiv-native)
  skillExpertise?: Record<string, number>; // Skill expertise levels
  seniority?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  domainsOfInterest?: string[];
  mentorRoles?: string[];
  learnerRoles?: string[];
  availabilityWindow?: string;
  sessionsCompleted?: number;
  sessionsGiven?: number;
  sessionsReceived?: number;
  avgRating?: number;
  npsScore?: number;
  topSkillsUsage?: Array<{ skill: string; count: number }>;
  peerTestimonials?: Array<{ text: string; timestamp: string; fromWallet: string }>;
  trustEdges?: Array<{ toWallet: string; strength: number; createdAt: string }>;
  lastActiveTimestamp?: string;
  communityAffiliations?: string[];
  reputationScore?: number;
  learnerQuestCompletion?: { percent: number; readCount: number; totalMaterials: number };
  spaceId: string;
  createdAt?: string;
  txHash?: string;
};
```

## Immutable Update Pattern

### The Challenge

In a centralized system, profile updates are simple:
- User edits profile → Update database row → Done

In a decentralized system:
- No centralized database
- Entities are immutable (cannot be modified)
- Each update creates a new entity
- Need to query latest version efficiently
- Need to preserve history for audit

### Our Solution

**1. Immutable Update Pattern**

When a user updates their profile:
- Query existing profile entities for that wallet
- Get the current profile data
- Create a NEW entity with updated data
- Old entities remain (for history/audit)

**2. Query Pattern**

To get current profile:
```typescript
// Query all profiles for wallet
const profiles = await listUserProfilesForWallet(wallet);

// Sort by createdAt descending, get most recent
profiles.sort((a, b) => {
  const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return bTime - aTime;
});

const currentProfile = profiles[0]; // Most recent
```

**3. Profile Creation/Update**

```typescript
// Check if profile exists
const existingProfile = await getProfileByWallet(wallet);

// Preserve identity_seed for updates (auto-assign for new profiles)
const identity_seed = existingProfile?.identity_seed || selectRandomEmoji();

// Calculate avgRating from feedback if updating
let avgRating = 0;
if (existingProfile) {
  avgRating = await calculateAverageRating(wallet);
}

// Create new profile entity (immutable update)
const { key, txHash } = await createUserProfile({
  wallet: wallet.toLowerCase(), // Normalize!
  displayName,
  username,
  bio,
  skillsArray,
  skill_ids, // Arkiv-native skill entity keys
  skillExpertise,
  timezone,
  // ... other fields
  privateKey,
});
```

## Wallet Normalization

### Critical Pattern

**Rule:** Always normalize wallet addresses to lowercase when storing and querying.

**Why:** Ethereum addresses are case-insensitive, but string comparisons are case-sensitive. Normalizing ensures consistent querying and prevents case-sensitivity bugs.

**Implementation:**
```typescript
// ✅ Correct: Normalize when storing
attributes: [
  { key: 'wallet', value: wallet.toLowerCase() },
  // ...
]

// ✅ Correct: Normalize when querying
queryBuilder = queryBuilder.where(eq('wallet', wallet.toLowerCase()));

// ❌ Wrong: Mixed case storage/querying
attributes: [{ key: 'wallet', value: wallet }]  // May be mixed case
queryBuilder.where(eq('wallet', wallet))  // May not match!
```

## Query Patterns

### Get Profile by Wallet

```typescript
export async function getProfileByWallet(wallet: string): Promise<UserProfile | null> {
  // Normalize wallet: trim and convert to lowercase
  const normalizedWallet = wallet.trim().toLowerCase();
  
  // Query all profiles for wallet
  const profiles = await listUserProfilesForWallet(normalizedWallet);
  if (profiles.length === 0) return null;
  
  // Return the most recent profile (sorted by createdAt descending)
  profiles.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
  
  return profiles[0];
}
```

### List All Profiles

```typescript
export async function listUserProfiles(params?: { 
  skill?: string; 
  seniority?: string;
  spaceId?: string;
}): Promise<UserProfile[]> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  let queryBuilder = query.where(eq('type', 'user_profile'));
  
  if (params?.seniority) {
    queryBuilder = queryBuilder.where(eq('seniority', params.seniority));
  }
  
  if (params?.spaceId) {
    queryBuilder = queryBuilder.where(eq('spaceId', params.spaceId));
  }
  
  const result = await queryBuilder
    .withAttributes(true)
    .withPayload(true)
    .limit(100)
    .fetch();
  
  // Parse entities and filter by skill client-side
  // (Skills stored in payload, not queryable via attributes)
  let profiles = result.entities.map(parseProfileEntity);
  
  if (params?.skill) {
    profiles = profiles.filter(profile => {
      // Check skillsArray, skills string, or skill_ids
      return profileMatchesSkill(profile, params.skill);
    });
  }
  
  return profiles;
}
```

### List Profiles for Wallet

```typescript
export async function listUserProfilesForWallet(wallet: string): Promise<UserProfile[]> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  const result = await query
    .where(eq('type', 'user_profile'))
    .where(eq('wallet', wallet.toLowerCase())) // Normalize!
    .withAttributes(true)
    .withPayload(true)
    .limit(100)
    .fetch();
  
  return result.entities.map(parseProfileEntity);
}
```

## Entity Creation Pattern

### Standard Create Structure

```typescript
export async function createUserProfile({
  wallet,
  displayName,
  username,
  bio,
  skillsArray,
  skill_ids,
  skillExpertise,
  timezone,
  // ... other fields
  privateKey,
  spaceId = 'local-dev', // Default in library functions; API routes use SPACE_ID from config // Default in library functions; API routes use SPACE_ID from config
}: {
  wallet: string;
  displayName: string;
  // ... types
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();
  
  // Check for existing profile to preserve identity_seed and calculate avgRating
  let existingProfile: UserProfile | null = null;
  let avgRating = 0;
  try {
    existingProfile = await getProfileByWallet(wallet);
    if (existingProfile) {
      avgRating = await calculateAverageRating(wallet);
    }
  } catch (e) {
    // New profile or calculation failed
  }
  
  // Preserve identity_seed for updates, auto-assign for new profiles
  const identity_seed = existingProfile?.identity_seed || selectRandomEmoji();
  
  const payload = {
    displayName,
    username,
    bio,
    bioShort: bioShort || bio,
    bioLong,
    skills: skillsArray.join(', '),
    skillsArray,
    skill_ids: skill_ids || [],
    skillExpertise,
    timezone,
    languages: languages || [],
    contactLinks: contactLinks || {},
    seniority,
    domainsOfInterest: domainsOfInterest || [],
    mentorRoles: mentorRoles || [],
    learnerRoles: learnerRoles || [],
    availabilityWindow,
    identity_seed,
    spaceId,
    createdAt,
    lastActiveTimestamp: new Date().toISOString(),
    sessionsCompleted: 0,
    sessionsGiven: 0,
    sessionsReceived: 0,
    avgRating: Math.round(avgRating * 10) / 10,
    npsScore: 0,
    topSkillsUsage: [],
    peerTestimonials: [],
    trustEdges: [],
    communityAffiliations: [],
    reputationScore: 0,
  };
  
  const attributes: Array<{ key: string; value: string }> = [
    { key: 'type', value: 'user_profile' },
    { key: 'wallet', value: wallet.toLowerCase() }, // Normalize!
    { key: 'displayName', value: displayName },
    { key: 'timezone', value: timezone },
    { key: 'spaceId', value: spaceId },
    { key: 'createdAt', value: createdAt },
  ];
  
  if (username) attributes.push({ key: 'username', value: username });
  if (identity_seed) attributes.push({ key: 'identity_seed', value: identity_seed });
  if (bio) attributes.push({ key: 'bio', value: bio });
  if (skills) attributes.push({ key: 'skills', value: skills });
  if (seniority) attributes.push({ key: 'seniority', value: seniority });
  
  // Store skills as skill_0, skill_1, etc. attributes for querying
  if (skillsArray.length > 0) {
    skillsArray.forEach((skill, idx) => {
      attributes.push({ key: `skill_${idx}`, value: skill });
    });
  }
  
  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes,
      expiresIn: 31536000, // 1 year
    });
  });
  
  return { key: result.entityKey, txHash: result.txHash };
}
```

## Attribute vs Payload

### Attributes (Queryable)

Use for fields that need to be queried:
- `type`: 'user_profile'
- `wallet`: User wallet (normalized to lowercase)
- `displayName`: Display name
- `timezone`: User timezone
- `username`: Username (if unique constraint needed)
- `seniority`: Seniority level
- `skills`: Legacy comma-separated string
- `skill_0`, `skill_1`, etc.: Individual skills for querying
- `spaceId`: Space ID
- `createdAt`: ISO timestamp

### Payload (Content)

Use for complex or large data:
- `bioShort`, `bioLong`: Bio content
- `skillsArray`: Skills array (preferred over attributes)
- `skill_ids`: Skill entity keys (Arkiv-native)
- `skillExpertise`: Expertise levels map
- `contactLinks`: Social links object
- `languages`: Languages array
- `domainsOfInterest`: Domains array
- `mentorRoles`, `learnerRoles`: Role arrays
- `sessionsCompleted`, `avgRating`, etc.: Metrics
- `peerTestimonials`, `trustEdges`: Complex objects

## Profile Updates

### Update Pattern

Profiles use immutable updates - each change creates a new entity:

```typescript
// Get current profile
const currentProfile = await getProfileByWallet(wallet);
if (!currentProfile) {
  throw new Error('Profile not found');
}

// Create new profile with updated data
const { key, txHash } = await createUserProfile({
  wallet,
  displayName: currentProfile.displayName,
  username: currentProfile.username,
  bio: updatedBio, // Updated field
  skillsArray: currentProfile.skillsArray,
  // ... preserve other fields
  privateKey,
});
```

### Regrow Pattern

The "regrow" pattern allows users to recreate their profile from historical data:

```typescript
// Fetch all historical profile data
const historicalData = await fetchHistoricalProfileData(identity);

// Build profile from history
const profileData = buildProfileFromHistory(historicalData);

// Create new profile entity
const result = await regrowProfileFromArkiv(identity, privateKey);
```

## Expected and Found Issues

### Issue 1: Wallet Case Sensitivity

**Problem:** Wallet addresses stored with mixed case would not match queries using different case.

**Solution:** Always normalize wallet addresses to lowercase in both storage and queries.

**Status:** ✅ Solved

### Issue 2: Multiple Profiles for Same Wallet

**Problem:** Users can have multiple profile entities (from updates). Need to get the latest one.

**Solution:** Query all profiles for wallet, sort by `createdAt` descending, return most recent.

**Status:** ✅ Solved

### Issue 3: Skills Querying

**Problem:** Skills stored in payload are not directly queryable via Arkiv attributes.

**Solution:** 
- Store skills in both attributes (`skill_0`, `skill_1`, etc.) and payload (`skillsArray`)
- For filtering, fetch all profiles and filter client-side
- Use `skill_ids` (Arkiv-native skill entity keys) for proper entity references

**Status:** ✅ Solved

### Issue 4: Identity Seed Preservation

**Problem:** Profile updates would create new identity_seed, losing the user's emoji identity.

**Solution:** Check for existing profile and preserve `identity_seed`. Only auto-assign for new profiles.

**Status:** ✅ Solved

### Issue 5: Average Rating Calculation

**Problem:** Profile updates need to recalculate average rating from all feedback.

**Solution:** Query all feedback for wallet, calculate average, include in new profile entity.

**Status:** ✅ Solved

## Best Practices

### 1. Always Normalize Wallet Addresses

Normalize to lowercase in both storage and queries to prevent case-sensitivity bugs.

### 2. Query Latest Profile

Always sort profiles by `createdAt` descending and return the most recent one.

### 3. Preserve Identity Seed

Check for existing profile and preserve `identity_seed` for updates. Only auto-assign for new profiles.

### 4. Recalculate Derived Fields

For updates, recalculate derived fields like `avgRating` from source data (feedback entities).

### 5. Use Skill Entity Keys

Prefer `skill_ids` (Arkiv-native skill entity keys) over skill name strings for proper entity references.

### 6. Handle Transaction Timeouts

Use `handleTransactionWithTimeout` for all entity creation to handle testnet timeouts gracefully.

### 7. Defensive Querying

Always validate result structure before processing. Return empty arrays or null on query failures.

## API Endpoints

### GET /api/profile

Get profile by wallet.

**Query Params:**
- `wallet`: User wallet address (required)

**Response:**
```json
{
  "ok": true,
  "profile": {
    "key": "...",
    "wallet": "0x...",
    "displayName": "John Doe",
    "username": "johndoe",
    "bio": "Software developer",
    "skillsArray": ["JavaScript", "TypeScript"],
    "skill_ids": ["skill_key_1", "skill_key_2"],
    "timezone": "America/New_York",
    "createdAt": "2025-01-01T00:00:00Z",
    "txHash": "0x..."
  }
}
```

### POST /api/profile

Create or update profile.

**Body:**
```json
{
  "action": "createProfile",
  "wallet": "0x...",
  "displayName": "John Doe",
  "username": "johndoe",
  "bio": "Software developer",
  "skillsArray": ["JavaScript", "TypeScript"],
  "skill_ids": ["skill_key_1", "skill_key_2"],
  "timezone": "America/New_York"
}
```

## Query Patterns

### Get Current Profile

```typescript
// 1. Normalize wallet
const normalizedWallet = wallet.toLowerCase().trim();

// 2. Query all profiles for wallet
const profiles = await listUserProfilesForWallet(normalizedWallet);

// 3. Sort by createdAt descending
profiles.sort((a, b) => {
  const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return bTime - aTime;
});

// 4. Return most recent
const currentProfile = profiles[0] || null;
```

### Update Profile

```typescript
// 1. Get current profile
const currentProfile = await getProfileByWallet(wallet);
if (!currentProfile) {
  throw new Error('Profile not found');
}

// 2. Calculate updated avgRating
const avgRating = await calculateAverageRating(wallet);

// 3. Create new profile entity with updated data
const { key, txHash } = await createUserProfile({
  wallet: wallet.toLowerCase(),
  displayName: updatedDisplayName,
  username: currentProfile.username,
  bio: updatedBio,
  skillsArray: updatedSkillsArray,
  skill_ids: updatedSkillIds,
  timezone: currentProfile.timezone,
  // Preserve other fields
  privateKey,
});
```

## Future Considerations

### 1. Profile Versioning

Currently, we query the most recent profile. Consider:
- Explicit versioning system
- Profile history viewer
- Rollback capability

### 2. Profile Merging

If a user has multiple profiles, consider:
- Merge utility to combine profile data
- Conflict resolution strategy
- Data deduplication

### 3. Profile Expiration

Profiles have 1 year TTL. Consider:
- Auto-renewal for active users
- Profile archival for inactive users
- Graceful degradation for expired profiles

### 4. Skill Entity Integration

Currently transitioning from skill name strings to skill entity keys. Consider:
- Migration utility for legacy profiles
- Validation that skill_ids reference valid skill entities
- Fallback to skill names if skill entity not found

## Profile Display Features

### Learner Quest Completion

User profiles display learner quest completion percentage on both public profile pages (`/profiles/[wallet]`) and edit profile pages (`/me/profile`). The completion percentage is calculated across all active reading list quests:

- Fetches all active quests from `/api/learner-quests`
- Filters to only `questType: 'reading_list'` quests (assessment quests have separate result tracking)
- Loads progress for each quest in parallel
- Calculates total read materials across all reading list quests
- Displays as: `X% complete (Y / Z materials)`

The completion data is loaded asynchronously and does not block profile loading. If no quests exist or loading fails, the completion information is not displayed.

**Note:** Language assessment quests are tracked separately via `learner_quest_assessment_result` entities and are not included in the reading list completion percentage.

## Related Documentation

- [Profile Entity](/docs/arkiv/profile)
- [Learner Quests](/docs/arkiv/learner-quests)
- [Notification System](/docs/arkiv/notification-system)

## Summary

The Arkiv-native profile system uses immutable entities to track profile data in a decentralized environment. Key patterns:

1. **Immutable Updates:** Each profile change creates a new entity
2. **Latest Version Query:** Query all profiles, sort by `createdAt`, return most recent
3. **Wallet Normalization:** Always normalize wallet addresses to lowercase
4. **Identity Seed Preservation:** Preserve `identity_seed` for updates, auto-assign for new profiles
5. **Derived Field Calculation:** Recalculate `avgRating` and other derived fields from source data
6. **Skill Entity Keys:** Use `skill_ids` for proper Arkiv-native skill entity references

This approach provides a robust, decentralized profile system that works without a centralized database, preserving full history for audit and allowing users to "regrow" their profiles from historical data.

