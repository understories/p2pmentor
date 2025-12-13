# Arkiv Implementation FAQ

This document answers common questions about Arkiv patterns and implementation details in p2pmentor.

## Profile Updates: Immutable Entity Pattern

**Question:** Does editing a profile create a new entity or mutate the existing one?

**Answer:** Editing a profile **creates a new entity**. This follows Arkiv's immutable entity pattern.

**Implementation:**
- The `createUserProfile()` function is called for both new profiles and updates
- When updating, the function first fetches the existing profile using `getProfileByWallet()`
- It preserves certain fields (like `identity_seed`) and recalculates others (like `avgRating`)
- A new entity is created with all the updated data
- The old entity remains on Arkiv (immutable history)

**Latest Version Selection:**
- `getProfileByWallet()` queries all profiles for a wallet: `type='user_profile', wallet='<address>'`
- It sorts by `createdAt` descending and returns the most recent one
- This means the "current" profile is always the latest entity

**Code Reference:**
```typescript
// lib/arkiv/profile.ts:503-536
export async function getProfileByWallet(wallet: string): Promise<UserProfile | null> {
  const profiles = await listUserProfilesForWallet(wallet);
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

**Benefits:**
- Complete history of profile changes
- No data loss
- Verifiable audit trail
- Can "regrow" profiles from history if needed

## Wallet-to-Profile Lookup

**Question:** What's the query to fetch a profile given only a wallet address? Is this indexed?

**Answer:** The query is `type='user_profile', wallet='<address>'`. The `wallet` attribute is indexed by Arkiv.

**Implementation:**
```typescript
// lib/arkiv/profile.ts:544-553
export async function listUserProfilesForWallet(wallet: string): Promise<UserProfile[]> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  const result = await query
    .where(eq('type', 'user_profile'))
    .where(eq('wallet', wallet.toLowerCase()))
    .withAttributes(true)
    .withPayload(true)
    .limit(100)
    .fetch();
  // ... parse and return
}
```

**Indexing:**
- Arkiv indexes all entity attributes by default
- The `wallet` attribute is indexed, making this query efficient
- Queries filter by `type` first (also indexed), then by `wallet`

**Performance:**
- Single query operation
- Returns all profile versions for that wallet
- Client-side sorting selects the latest version

## Entity References: Sessions to Asks/Offers

**Question:** How does a Session reference the related Ask/Offer? By entity ID? By content hash?

**Answer:** Sessions do **not** directly reference asks/offers by entity ID or content hash. The connection is implicit through matching logic.

**Session Entity Structure:**
- `mentorWallet`: Mentor wallet address
- `learnerWallet`: Learner wallet address
- `skill` or `skill_id`: Skill name or Skill entity key
- No `askKey` or `offerKey` attributes

**Why No Direct Reference:**
- Sessions are created when a match is found between an ask and offer
- The matching happens in the UI/application logic, not in Arkiv
- Once a session is created, it's independent of the original ask/offer
- The ask/offer may expire or be deleted, but the session persists

**Implicit Connection:**
- You can find related asks/offers by querying:
  - `type='ask', wallet='<learnerWallet>', skill='<skill>'`
  - `type='offer', wallet='<mentorWallet>', skill='<skill>'`
- But there's no guaranteed link if multiple asks/offers exist

**Future Consideration:**
- If direct references are needed, add `askKey` and `offerKey` attributes to session entities
- This would require updating `createSession()` and session schemas

## Skill Ownership: Embedded vs Separate Entities

**Question:** Are skills separate entities linked to profiles, or embedded in the profile entity?

**Answer:** Skills are **separate entities** (`type='skill'`), and profiles reference them via entity keys.

**Skill Entities:**
- Type: `skill`
- Attributes: `name_canonical`, `slug`, `status`, `created_by_profile`
- Each skill is a first-class Arkiv entity with its own key

**Profile References:**
- `skill_ids`: Array of Skill entity keys (preferred, for beta)
- `skillsArray`: Array of skill names (backward compatibility)
- `skills`: Comma-separated string (legacy)

**Implementation:**
```typescript
// Profile payload includes:
{
  skill_ids: ['entity-key-1', 'entity-key-2'], // Skill entity keys
  skillsArray: ['Spanish', 'French'],          // Skill names (derived)
  skills: 'Spanish, French'                    // Legacy string format
}
```

**Benefits of Separate Entities:**
- Skills can have metadata (description, creator, status)
- Skills can be referenced by asks, offers, sessions
- Skills can be archived without affecting profiles
- Enables skill-based community pages

**Code Reference:**
```typescript
// lib/arkiv/skill.ts:43-108
export async function createSkill({
  name_canonical,
  description,
  created_by_profile,
  privateKey,
  spaceId = 'local-dev',
}: {
  name_canonical: string;
  // ...
}): Promise<{ key: string; txHash: string }> {
  // Creates a separate Skill entity
}
```

## Conflict Resolution: Simultaneous Updates

**Question:** If two devices update a profile simultaneously, what happens?

**Answer:** Both updates create new entities. The latest one (by `createdAt`) is selected as the "current" profile.

**How It Works:**
1. Device A and Device B both fetch the current profile
2. Device A updates bio and creates new entity at time T1
3. Device B updates timezone and creates new entity at time T2
4. Both entities exist on Arkiv
5. `getProfileByWallet()` returns the one with the latest `createdAt`

**Potential Issues:**
- If T1 and T2 are very close, the "latest" might not include both changes
- Device A's bio update might be "lost" if Device B's update happens milliseconds later
- This is a form of last-write-wins conflict resolution

**Mitigation Strategies:**
- Client-side: Check for updates before submitting (optimistic locking)
- Merge strategy: Fetch latest, merge changes, create new entity
- UI: Show "profile updated" notifications to prevent simultaneous edits

**Current Behavior:**
- No explicit conflict detection
- Relies on `createdAt` timestamp for latest version
- Both updates are preserved in history (can be recovered)

**Code Reference:**
```typescript
// lib/arkiv/profile.ts:503-536
// getProfileByWallet() sorts by createdAt descending
// Returns profiles[0] (most recent)
```

## TTL Implementation: Ask Expiration

**Question:** How is Ask expiration (TTL) enforced? Client-side? Arkiv-native?

**Answer:** TTL is enforced **client-side** by filtering based on `createdAt + ttlSeconds < now`. Arkiv's `expiresIn` parameter sets when the entity is removed from the network, but client-side filtering happens before that.

**TTL Storage:**
- `ttlSeconds`: Stored in entity attributes (default: 3600 seconds = 1 hour)
- `expiresIn`: Passed to `createEntity()` to set Arkiv-level expiration
- Both values are the same, but serve different purposes

**Client-Side Filtering:**
```typescript
// lib/arkiv/networkGraph.ts:44-50
const now = Date.now();
let activeAsks = asks
  .filter(ask => {
    const created = new Date(ask.createdAt).getTime();
    const expires = created + (ask.ttlSeconds * 1000);
    const isActive = expires > now;
    
    if (!includeExpired && !isActive) return false;
    // ...
  });
```

**Arkiv-Level Expiration:**
- `expiresIn` parameter tells Arkiv when to remove the entity from the network
- This is a hard deletion (entity is gone)
- Used for cleanup, not for application logic

**Why Client-Side Filtering:**
- More flexible: can show expired asks if needed (`includeExpired: true`)
- Faster: no need to wait for Arkiv to expire entities
- Predictable: expiration logic is in application code

**Code Reference:**
```typescript
// lib/arkiv/asks.ts:65-98
const ttl = Math.floor(ttlRaw); // Ensure integer
const result = await walletClient.createEntity({
  // ...
  attributes: [
    { key: 'ttlSeconds', value: String(ttl) }, // For client-side filtering
    // ...
  ],
  expiresIn: ttl, // For Arkiv-level cleanup
});
```

## Username Uniqueness

**Question:** How is username uniqueness enforced across all profiles?

**Answer:** Username uniqueness is **checked client-side** before creation, but there is **no enforcement** at the Arkiv level. Multiple profiles can have the same username.

**Implementation:**
```typescript
// lib/arkiv/profile.ts:645-720
export async function checkUsernameExists(username: string): Promise<UserProfile[]> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  
  const result = await query
    .where(eq('type', 'user_profile'))
    .where(eq('username', username.trim()))
    .withAttributes(true)
    .withPayload(true)
    .limit(100)
    .fetch();
  
  // Returns all profiles with this username
}
```

**Current Behavior:**
- Before creating/updating a profile, the UI calls `checkUsernameExists()`
- If profiles are found, the UI shows an error
- But if two users submit simultaneously, both can succeed
- No database-level unique constraint (Arkiv doesn't support this)

**Limitations:**
- Race conditions: Two users can claim the same username simultaneously
- Historical usernames: Old profile versions may have the username
- No global uniqueness: Username is only checked within the application

**Potential Solutions:**
- Username reservation entities: Create a `username_reservation` entity before profile creation
- Username namespace: Prefix usernames with wallet address hash
- Accept duplicates: Allow multiple users with the same username (like Twitter handles)

**Code Reference:**
```typescript
// lib/arkiv/profile.ts:645-720
// checkUsernameExists() queries all profiles with the username
// Returns array of matching profiles (all historical versions)
```

## Summary

| Question | Answer | Pattern |
|----------|--------|---------|
| Profile updates | Creates new entity | Immutable entities |
| Wallet lookup | `type='user_profile', wallet='<address>'` | Indexed attribute query |
| Session references | No direct reference | Implicit via matching |
| Skills | Separate entities, referenced by key | Entity relationships |
| Conflict resolution | Last-write-wins (by `createdAt`) | Timestamp-based |
| TTL enforcement | Client-side filtering | `createdAt + ttlSeconds < now` |
| Username uniqueness | Client-side check only | No enforcement |

