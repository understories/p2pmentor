# Blockchain Data Loading Patterns

## Problem Statement

In a decentralized application (dapp), the frontend often loads before blockchain data is available. This creates a common error pattern where:

1. **Component renders before data is fetched** - Causes undefined/null reference errors
2. **Arkiv queries return empty/undefined** - Components try to access properties that don't exist
3. **Race conditions** - Multiple async operations complete in unpredictable order
4. **Network delays** - Blockchain queries can be slow, especially on testnets

## Solution Architecture

We use a **three-phase loading pattern**:
1. **Loading State** - Show loading indicator while fetching
2. **Empty State** - Show appropriate message when no data exists
3. **Data State** - Render content when data is available

This pattern ensures the UI never tries to render data that doesn't exist, preventing runtime errors.

---

## Core Patterns

### 1. State Initialization Pattern

**Always initialize state with safe defaults:**

```typescript
// ✅ CORRECT: Safe defaults
const [data, setData] = useState<DataType[]>([]);  // Array defaults to empty
const [loading, setLoading] = useState(true);        // Start in loading state
const [error, setError] = useState('');             // Error starts empty
const [wallet, setWallet] = useState<string | null>(null);  // Nullable types use null

// ❌ WRONG: Undefined or missing initialization
const [data, setData] = useState<DataType[]>();     // Undefined!
const [loading, setLoading] = useState(false);     // Shows content before data loads!
```

**Why this works:**
- Empty arrays `[]` are safe to iterate over (won't crash)
- `null` is explicit and can be checked with `if (!wallet)`
- `loading: true` prevents premature rendering

---

### 2. Loading State Pattern

**Always show loading indicator while fetching:**

```typescript
// ✅ CORRECT: Loading state check
if (loading) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>
        <PageHeader title="Sessions" />
        <LoadingSpinner text="Loading sessions..." className="py-12" />
      </div>
    </div>
  );
}

// ❌ WRONG: No loading check
return (
  <div>
    {data.map(item => <Item key={item.id} />)}  // Crashes if data is undefined!
  </div>
);
```

**Example from `app/me/sessions/page.tsx`:**
```typescript
export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);  // Start loading
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (address) {
        loadSessions(address);
      } else {
        setError('Please connect your wallet first');
        setLoading(false);  // Stop loading on error
      }
    }
  }, []);

  const loadSessions = async (wallet: string) => {
    try {
      setLoading(true);
      setError('');
      
      const sessionsRes = await fetch(`/api/sessions?wallet=${wallet}`);
      const sessionsData = await sessionsRes.json();
      const sessionsList = sessionsData.sessions || [];  // Fallback to empty array
      setSessions(sessionsList);
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError(err.message || 'Failed to load sessions');
    } finally {
      setLoading(false);  // Always stop loading
    }
  };

  // Early return for loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <BackButton href="/me" />
          </div>
          <PageHeader title="Sessions" />
          <LoadingSpinner text="Loading sessions..." className="py-12" />
        </div>
      </div>
    );
  }

  // Rest of component...
}
```

---

### 3. Empty State Pattern

**Show appropriate message when no data exists:**

```typescript
// ✅ CORRECT: Empty state check
{loading ? (
  <LoadingSpinner text="Loading profiles..." className="py-12" />
) : profiles.length === 0 ? (
  <EmptyState
    title="No profiles yet"
    description="Be the first to create a profile and join the network!"
    icon={<UsersIcon />}
  />
) : (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {profiles.map(profile => (
      <ProfileCard key={profile.wallet} profile={profile} />
    ))}
  </div>
)}
```

**Example from `app/profiles/page.tsx`:**
```typescript
{loading ? (
  <LoadingSpinner text="Loading profiles..." className="py-12" />
) : profiles.length === 0 ? (
  <EmptyState
    title={skillFilter ? `No profiles found` : 'No profiles yet'}
    description={skillFilter 
      ? `No profiles match "${skillFilter}". Try a different skill or clear the filter.`
      : 'Be the first to create a profile and join the network!'}
    icon={
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    }
  />
) : (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {profiles.map((profile) => (
      <ProfileCard key={profile.wallet} profile={profile} />
    ))}
  </div>
)}
```

---

### 4. Defensive Data Access Pattern

**Always check data exists before accessing properties:**

```typescript
// ✅ CORRECT: Defensive checks
const sessionsList = sessionsData.sessions || [];  // Fallback to empty array
const profile = profileData.profile || null;        // Fallback to null
const wallet = localStorage.getItem('wallet_address') || null;

// When rendering
{profile && (
  <div>
    <h2>{profile.displayName}</h2>
    {profile.skills && profile.skills.length > 0 && (
      <div>{profile.skills.join(', ')}</div>
    )}
  </div>
)}

// ❌ WRONG: Direct access without checks
const sessionsList = sessionsData.sessions;  // Could be undefined!
<h2>{profile.displayName}</h2>  // Crashes if profile is null!
```

**Example from `app/network/page.tsx`:**
```typescript
const loadNetwork = async () => {
  try {
    setLoading(true);
    const [asksRes, offersRes] = await Promise.all([
      fetch('/api/asks').then(r => r.json()),
      fetch('/api/offers').then(r => r.json()),
    ]);

    // Defensive: Use fallback to empty array
    if (asksRes.ok) {
      setAsks(asksRes.asks || []);  // ✅ Safe fallback
    }
    if (offersRes.ok) {
      setOffers(offersRes.offers || []);  // ✅ Safe fallback
    }

    // Defensive: Check array exists before iterating
    const allWallets = new Set<string>();
    (asksRes.asks || []).forEach((ask: Ask) => allWallets.add(ask.wallet));
    (offersRes.offers || []).forEach((offer: Offer) => allWallets.add(offer.wallet));

    // Defensive: Handle profile fetch failures gracefully
    const profilePromises = Array.from(allWallets).map(async (wallet) => {
      try {
        const profile = await getProfileByWallet(wallet);
        return { wallet, profile };
      } catch {
        return { wallet, profile: null };  // ✅ Return null on error
      }
    });

    const profileResults = await Promise.all(profilePromises);
    const profilesMap: Record<string, UserProfile> = {};
    profileResults.forEach(({ wallet, profile }) => {
      if (profile) {  // ✅ Only add if profile exists
        profilesMap[wallet] = profile;
      }
    });
    setProfiles(profilesMap);
  } catch (err) {
    console.error('Error loading network:', err);
  } finally {
    setLoading(false);  // ✅ Always stop loading
  }
};
```

---

### 5. Optional Chaining Pattern

**Use optional chaining for nested property access:**

```typescript
// ✅ CORRECT: Optional chaining
const displayName = profile?.displayName || 'Unknown';
const firstSkill = profile?.skillsArray?.[0] || profile?.skills?.split(',')[0]?.trim() || '';
const wallet = userWallet?.toLowerCase();

// In JSX
{profile?.displayName && (
  <h2>{profile.displayName}</h2>
)}

// ❌ WRONG: Direct access
const displayName = profile.displayName;  // Crashes if profile is null!
const firstSkill = profile.skillsArray[0];  // Crashes if array is empty!
```

**Example from `app/asks/page.tsx`:**
```typescript
// Pre-fill skill from offer or profile's first skill
useEffect(() => {
  if (profile && isOpen) {
    // ✅ Safe optional chaining with fallbacks
    const skill = offer?.skill 
      || profile.skillsArray?.[0] 
      || profile.skills?.split(',')[0]?.trim() 
      || '';
    setFormData(prev => ({
      ...prev,
      skill: skill,
    }));
  }
}, [profile, offer, isOpen]);
```

---

### 6. Error Handling Pattern

**Always handle errors gracefully:**

```typescript
// ✅ CORRECT: Comprehensive error handling
const loadData = async (wallet: string) => {
  try {
    setLoading(true);
    setError('');
    
    const res = await fetch(`/api/data?wallet=${wallet}`);
    if (!res.ok) {
      throw new Error('Failed to fetch data');
    }
    
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Unknown error');
    }
    
    setData(data.items || []);  // Fallback to empty array
  } catch (err: any) {
    console.error('Error loading data:', err);
    setError(err.message || 'Failed to load data');
    setData([]);  // Reset to empty on error
  } finally {
    setLoading(false);  // Always stop loading
  }
};
```

**Example from `app/me/sessions/page.tsx`:**
```typescript
const loadSessions = async (wallet: string) => {
  try {
    setLoading(true);
    setError('');

    const sessionsRes = await fetch(`/api/sessions?wallet=${wallet}`);
    if (!sessionsRes.ok) {
      throw new Error('Failed to fetch sessions');
    }
    const sessionsData = await sessionsRes.json();
    const sessionsList = sessionsData.sessions || [];  // ✅ Fallback
    setSessions(sessionsList);

    // Optional profile fetch - doesn't fail if profile doesn't exist
    const profileRes = await fetch(`/api/profile?wallet=${wallet}`);
    if (profileRes.ok) {
      const profileData = await profileRes.json();
      setUserProfile(profileData.profile);  // ✅ Can be null
    }
  } catch (err: any) {
    console.error('Error loading sessions:', err);
    setError(err.message || 'Failed to load sessions');
  } finally {
    setLoading(false);  // ✅ Always stop loading
  }
};
```

---

### 7. Wallet Check Pattern

**Always check wallet exists before loading data:**

```typescript
// ✅ CORRECT: Wallet check before data load
useEffect(() => {
  if (typeof window !== 'undefined') {
    const address = localStorage.getItem('wallet_address');
    if (address) {
      setWalletAddress(address);
      loadData(address);
    } else {
      router.push('/auth');  // Redirect if no wallet
      return;
    }
  }
}, [router]);

// Early return if no wallet
if (!walletAddress) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 flex items-center justify-center">
      <p>Loading...</p>
    </div>
  );
}
```

**Example from `app/me/page.tsx`:**
```typescript
export default function MePage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (!address) {
        router.push('/auth');  // ✅ Redirect if no wallet
        return;
      }
      setWalletAddress(address);
      loadNotificationCount(address);
      loadProfileStatus(address);
    }
  }, [router]);

  // ✅ Early return if wallet not loaded
  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // Rest of component...
}
```

---

### 8. Arkiv Query Defensive Pattern

**Handle Arkiv query failures gracefully:**

```typescript
// ✅ CORRECT: Defensive Arkiv query handling
export async function listAsks(params?: { skill?: string; spaceId?: string }): Promise<Ask[]> {
  try {
    const publicClient = getPublicClient();
    const query = publicClient.buildQuery();
    let queryBuilder = query.where(eq('type', 'ask')).where(eq('status', 'open'));
    
    let result: any = null;
    try {
      result = await queryBuilder.withAttributes(true).withPayload(true).limit(500).fetch();
    } catch (fetchError: any) {
      console.error('[listAsks] Arkiv query failed:', {
        message: fetchError?.message,
        stack: fetchError?.stack,
        error: fetchError
      });
      return [];  // ✅ Return empty array on query failure
    }

    // ✅ Defensive check: ensure result structure is valid
    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.warn('[listAsks] Invalid result structure, returning empty array', { 
        result: result ? { 
          hasEntities: !!result.entities, 
          entitiesType: typeof result.entities, 
          entitiesIsArray: Array.isArray(result.entities) 
        } : 'null/undefined'
      });
      return [];  // ✅ Return empty array on invalid structure
    }

    // Process entities...
    return result.entities.map((entity: any) => {
      // Safe property access with fallbacks
      const wallet = getAttr('wallet') || '';
      const skill = getAttr('skill') || '';
      // ...
    });
  } catch (error: any) {
    console.error('[listAsks] Unexpected error:', error);
    return [];  // ✅ Always return empty array on error
  }
}
```

---

## Complete Example: Sessions Page

Here's a complete example showing all patterns together:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import type { Session } from '@/lib/arkiv/sessions';

export default function SessionsPage() {
  // ✅ Pattern 1: Safe state initialization
  const [sessions, setSessions] = useState<Session[]>([]);
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ✅ Pattern 7: Wallet check before data load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (address) {
        setUserWallet(address);
        loadSessions(address);
      } else {
        setError('Please connect your wallet first');
        setLoading(false);
      }
    }
  }, []);

  // ✅ Pattern 6: Comprehensive error handling
  const loadSessions = async (wallet: string) => {
    try {
      setLoading(true);
      setError('');

      const sessionsRes = await fetch(`/api/sessions?wallet=${wallet}`);
      if (!sessionsRes.ok) {
        throw new Error('Failed to fetch sessions');
      }
      
      const sessionsData = await sessionsRes.json();
      // ✅ Pattern 4: Defensive data access with fallback
      const sessionsList = sessionsData.sessions || [];
      setSessions(sessionsList);
    } catch (err: any) {
      console.error('Error loading sessions:', err);
      setError(err.message || 'Failed to load sessions');
      setSessions([]);  // Reset to empty on error
    } finally {
      setLoading(false);  // Always stop loading
    }
  };

  // ✅ Pattern 2: Loading state check
  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <PageHeader title="Sessions" />
          <LoadingSpinner text="Loading sessions..." className="py-12" />
        </div>
      </div>
    );
  }

  // ✅ Pattern 3: Empty state check
  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <PageHeader title="Sessions" />
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <PageHeader title="Sessions" />
          <EmptyState
            title="No sessions yet"
            description="Your mentorship sessions will appear here."
            icon={<CalendarIcon />}
          />
        </div>
      </div>
    );
  }

  // ✅ Pattern 5: Safe rendering with optional chaining
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <PageHeader title="Sessions" />
        <div className="space-y-4">
          {sessions.map((session) => (
            <div key={session.key}>
              <h3>{session.skill}</h3>
              <p>{session.notes || 'No notes'}</p>
              {/* ✅ Safe optional chaining */}
              {session.mentorWallet && (
                <p>Mentor: {session.mentorWallet}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## UX/UI Patterns

### Loading Spinner Component

```typescript
// components/LoadingSpinner.tsx
export function LoadingSpinner({ text, className }: { text?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className || ''}`}>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      {text && (
        <p className="mt-4 text-gray-600 dark:text-gray-400">{text}</p>
      )}
    </div>
  );
}
```

### Empty State Component

```typescript
// components/EmptyState.tsx
export function EmptyState({ 
  title, 
  description, 
  icon 
}: { 
  title: string; 
  description: string; 
  icon?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12">
      {icon && (
        <div className="flex justify-center mb-4 text-gray-400 dark:text-gray-500">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}
```

---

## Checklist for Every Page

When creating or updating a page that loads blockchain data, ensure:

- [ ] **State initialization**: Arrays default to `[]`, nullable types to `null`, loading starts as `true`
- [ ] **Loading state**: Early return with `<LoadingSpinner />` when `loading === true`
- [ ] **Wallet check**: Verify wallet exists before loading data, redirect to `/auth` if missing
- [ ] **Error handling**: Try/catch blocks with error state and user-friendly messages
- [ ] **Defensive access**: Use `|| []` or `|| null` fallbacks when accessing API responses
- [ ] **Empty state**: Show `<EmptyState />` when `data.length === 0` and not loading
- [ ] **Optional chaining**: Use `?.` for nested property access
- [ ] **Finally block**: Always set `loading = false` in `finally` block
- [ ] **Arkiv queries**: Handle query failures gracefully, return empty array on error
- [ ] **Result validation**: Check `result.entities` exists and is an array before processing

---

## Common Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: No Loading State
```typescript
// BAD: Renders before data loads
const [data, setData] = useState<Data[]>([]);
useEffect(() => {
  loadData();  // Async, but no loading state
}, []);

return <div>{data.map(item => <Item key={item.id} />)}</div>;  // Crashes!
```

### ❌ Anti-Pattern 2: Undefined State
```typescript
// BAD: State can be undefined
const [data, setData] = useState<Data[]>();  // Undefined!
// Later...
data.map(...)  // TypeError: Cannot read property 'map' of undefined
```

### ❌ Anti-Pattern 3: No Fallbacks
```typescript
// BAD: No fallback for API response
const data = await res.json();
setData(data.items);  // What if data.items is undefined?
```

### ❌ Anti-Pattern 4: Direct Property Access
```typescript
// BAD: Direct access without checks
<h2>{profile.displayName}</h2>  // Crashes if profile is null!
```

### ❌ Anti-Pattern 5: Missing Error Handling
```typescript
// BAD: No error handling
const loadData = async () => {
  const res = await fetch('/api/data');
  const data = await res.json();
  setData(data.items);  // What if fetch fails?
};
```

---

## Arkiv-Specific Patterns

### Handling Arkiv Query Failures

```typescript
// ✅ CORRECT: Graceful Arkiv query handling
export async function listEntities(): Promise<Entity[]> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  
  try {
    const result = await query
      .where(eq('type', 'entity'))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch();
    
    // ✅ Validate result structure
    if (!result?.entities || !Array.isArray(result.entities)) {
      console.warn('[listEntities] Invalid result structure');
      return [];
    }
    
    return result.entities.map((entity: any) => {
      // ✅ Safe attribute access
      const attrs = entity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };
      
      return {
        key: entity.key,
        wallet: getAttr('wallet') || '',
        // ... other fields with safe access
      };
    });
  } catch (error: any) {
    console.error('[listEntities] Arkiv query failed:', {
      message: error?.message,
      stack: error?.stack,
    });
    return [];  // ✅ Always return empty array on error
  }
}
```

### Handling Transaction Timeouts

```typescript
// ✅ CORRECT: Handle transaction receipt timeouts
try {
  const { entityKey, txHash } = await walletClient.createEntity({ /* ... */ });
  return { ok: true, key: entityKey, txHash };
} catch (error: any) {
  // Handle transaction receipt timeout - common on testnets
  if (error.message?.includes('confirmation pending') || 
      error.message?.includes('Transaction submitted')) {
    return NextResponse.json({ 
      ok: true, 
      key: null,
      txHash: null,
      pending: true,
      message: error.message || 'Transaction submitted, confirmation pending'
    });
  }
  throw error;
}
```

---

## Summary

The key principles for handling blockchain data loading:

1. **Always initialize state safely** - Empty arrays, null for optionals, true for loading
2. **Show loading state first** - Prevent rendering before data exists
3. **Handle errors gracefully** - Try/catch with user-friendly messages
4. **Use defensive access** - Fallbacks (`|| []`, `|| null`), optional chaining (`?.`)
5. **Validate data structure** - Check arrays exist before iterating
6. **Show empty states** - Better UX than blank screens
7. **Always stop loading** - Use `finally` blocks

Following these patterns ensures the dapp never crashes due to missing blockchain data, providing a smooth user experience even when network conditions are poor.

