# Invite Code System (Arkiv-Native)

## Overview

The invite code system (also called "beta code system") implements access control and usage tracking using Arkiv entities. It enforces limits on the number of unique wallets that can use a given invite code, creating a transparent, auditable, and decentralized access control mechanism.

**Key Principle:** Usage tracking is based on **unique wallet count**, not code entry count. This ensures accurate limit enforcement and prevents double-counting.

## Architecture

The system uses two complementary entity types:

1. **`beta_code_usage`**: Tracks overall usage statistics for each code (usage count, limit)
2. **`beta_access`**: Records wallet-to-code bindings (who used which code)

Together, these entities provide:
- **Accurate tracking**: `beta_access` entities are the source of truth for unique wallet counts
- **Efficient queries**: `beta_code_usage` provides quick limit checks
- **Complete audit trail**: Every access grant is recorded immutably on-chain
- **Transparency**: All data is public and verifiable

## Entity Types

### 1. Beta Code Usage (`beta_code_usage`)

Tracks usage statistics for each invite code.

**Entity Type:** `beta_code_usage`  
**TTL:** 1 year (31536000 seconds)  
**Immutability:** Updates create new entities (usage count changes)

**Attributes:**
- `type`: `'beta_code_usage'` (required)
- `code`: Beta code string (required, lowercase, trimmed)
- `usageCount`: Current usage count (required, as string)
- `limit`: Usage limit (required, as string, default: 50)
- `spaceId`: Space ID (required)
- `createdAt`: ISO timestamp (required)

**Payload:**
```typescript
{
  code: string;            // Beta code (lowercase, trimmed)
  usageCount: number;      // Current usage count (synced with unique wallet count)
  limit: number;          // Usage limit (default: 50)
  lastUsedAt?: string;    // ISO timestamp of last use
  createdAt: string;       // ISO timestamp when entity was created
}
```

**Key Design Decision:** `usageCount` is synchronized with the actual unique wallet count from `beta_access` entities. This ensures accuracy even if tracking logic changes.

### 2. Beta Access (`beta_access`)

Records wallet-to-code bindings. This is the **source of truth** for unique wallet counts.

**Entity Type:** `beta_access`  
**TTL:** 1 year (31536000 seconds)  
**Immutability:** Immutable - each access grant creates a new entity

**Attributes:**
- `type`: `'beta_access'` (required)
- `wallet`: Wallet address granted access (required, lowercase)
- `code`: Beta code used (required, lowercase, trimmed)
- `spaceId`: Space ID (required)
- `grantedAt`: ISO timestamp (required)

**Payload:**
```typescript
{
  wallet: string;          // Wallet address (lowercase)
  code: string;            // Beta code (lowercase, trimmed)
  grantedAt: string;       // ISO timestamp when access was granted
}
```

**Key Design Decision:** One `beta_access` entity per wallet-code combination. Duplicate checks prevent double-counting.

## System Flow

### 1. Code Entry (`/beta` page)

User enters invite code on the beta gate page:

```typescript
// User enters code: "letitgrow"
// Frontend validates format and calls API
POST /api/beta-code
{
  code: "letitgrow",
  action: "validate"
}
```

**API Response:**
```typescript
{
  ok: true,
  canUse: true,
  usage: {
    usageCount: 7,      // Actual unique wallet count
    limit: 50,
    remaining: 43
  }
}
```

**What Happens:**
- Queries `beta_code_usage` for current usage stats
- Queries `beta_access` to get actual unique wallet count (source of truth)
- Returns whether code can be used and remaining slots

### 2. Code Validation (`track` action)

After code entry, frontend validates the code:

```typescript
POST /api/beta-code
{
  code: "letitgrow",
  action: "track"
}
```

**What Happens:**
- Checks if code exists and hasn't exceeded limit
- Returns validation result
- **Does NOT increment usage count yet** (wallet not known)

### 3. Wallet Connection (`/auth` page)

User connects wallet (MetaMask):

```typescript
// After wallet connection, check if new user
const level = await calculateOnboardingLevel(walletAddress);

if (level === 0) {
  // New user - create beta access record
  POST /api/beta-code
  {
    code: "letitgrow",
    action: "createAccess",
    wallet: "0x1234..."
  }
}
```

### 4. Access Creation (`createAccess` action)

This is where the limit is enforced and access is granted:

**Step 1: Check for Duplicates**
```typescript
const existingAccess = await getBetaAccessByWallet(wallet, SPACE_ID);
if (existingAccess && existingAccess.code === normalizedCode) {
  // Wallet already has access - return success without incrementing
  return { ok: true, alreadyExists: true };
}
```

**Step 2: Enforce Limit (Source of Truth)**
```typescript
// Count unique wallets from beta_access entities (Arkiv-native, accurate)
const accessRecords = await listBetaAccessByCode(normalizedCode, SPACE_ID);
const uniqueWalletCount = new Set(accessRecords.map(a => a.wallet.toLowerCase())).size;

if (uniqueWalletCount >= limit) {
  return { ok: false, error: 'Beta code limit reached' }; // 403 Forbidden
}
```

**Step 3: Create Access Record**
```typescript
const { key, txHash } = await createBetaAccess({
  wallet: normalizedWallet,
  code: normalizedCode,
  privateKey: getPrivateKey(),
});
```

**Step 4: Sync Usage Count**
```typescript
// Sync usageCount with actual unique wallet count (includes this new wallet)
await syncBetaCodeUsageCount(normalizedCode, SPACE_ID);
```

**Result:**
- New `beta_access` entity created (wallet → code binding)
- `beta_code_usage` entity updated (usageCount incremented)
- Limit enforced based on actual unique wallet count

## Limit Enforcement

The limit is enforced at **50 unique wallets** per code. Enforcement happens in multiple places:

### Primary Enforcement (createAccess)

```typescript
// Count unique wallets from beta_access entities (source of truth)
const accessRecords = await listBetaAccessByCode(normalizedCode, SPACE_ID);
const uniqueWalletCount = new Set(accessRecords.map(a => a.wallet.toLowerCase())).size;

if (uniqueWalletCount >= limit) {
  return NextResponse.json({
    ok: false,
    error: `Beta code has reached its usage limit (${uniqueWalletCount}/${limit} unique wallets).`,
  }, { status: 403 }); // 403 Forbidden
}
```

**Why this works:**
- Uses actual unique wallet count from `beta_access` entities
- Prevents race conditions (checks before creating)
- Accurate even if `usageCount` is temporarily out of sync

### Secondary Enforcement (canUseBetaCode)

```typescript
export async function canUseBetaCode(code: string, spaceId?: string): Promise<boolean> {
  const usage = await getBetaCodeUsage(code, spaceId);
  const limit = usage?.limit || 50;

  // Check actual unique wallet count (source of truth)
  const { listBetaAccessByCode } = await import('./betaAccess');
  const accessRecords = await listBetaAccessByCode(code, spaceId);
  const uniqueWalletCount = new Set(accessRecords.map(a => a.wallet.toLowerCase())).size;

  return uniqueWalletCount < limit;
}
```

**Why this works:**
- Always uses actual unique wallet count
- Used by `validate` action for early checks
- Provides accurate remaining count

## Query Patterns

### Get Usage Statistics

```typescript
import { getBetaCodeUsage } from '@/lib/arkiv/betaCode';
import { listBetaAccessByCode } from '@/lib/arkiv/betaAccess';

// Get usage entity
const usage = await getBetaCodeUsage(code, SPACE_ID);

// Get actual unique wallet count (source of truth)
const accessRecords = await listBetaAccessByCode(code, SPACE_ID);
const uniqueWalletCount = new Set(accessRecords.map(a => a.wallet.toLowerCase())).size;

console.log(`Usage: ${uniqueWalletCount}/${usage?.limit || 50}`);
console.log(`Remaining: ${Math.max(0, (usage?.limit || 50) - uniqueWalletCount)}`);
```

### Check if Wallet Has Access

```typescript
import { getBetaAccessByWallet } from '@/lib/arkiv/betaAccess';

const access = await getBetaAccessByWallet(walletAddress, SPACE_ID);
if (access && access.code === normalizedCode) {
  // Wallet has access via this code
}
```

### List All Access Grants for Code

```typescript
import { listBetaAccessByCode } from '@/lib/arkiv/betaAccess';

const accessRecords = await listBetaAccessByCode(code, SPACE_ID);
const uniqueWallets = new Set(accessRecords.map(a => a.wallet.toLowerCase()));

console.log(`${uniqueWallets.size} unique wallets have used code "${code}"`);
```

## Arkiv-Native Benefits

### 1. Transparency

All access grants are public and verifiable on-chain:
- Anyone can query `beta_access` entities to see who used which code
- Usage statistics are public (`beta_code_usage`)
- Complete audit trail of all access grants

### 2. Accuracy

Usage tracking is based on actual unique wallet count:
- `beta_access` entities are the source of truth
- `usageCount` is synchronized with actual wallet count
- Prevents double-counting (duplicate checks)

### 3. Decentralization

No centralized database required:
- All data stored as Arkiv entities
- Queries use Arkiv's public client
- No server-side state management

### 4. Immutability

Complete audit trail:
- Every access grant creates an immutable entity
- History of usage count changes preserved
- Cannot be tampered with

### 5. Serverless

No backend state management:
- All logic uses Arkiv queries
- Stateless API routes
- Scales automatically

## Implementation Details

### Code Normalization

All codes are normalized to ensure consistency:
```typescript
const normalizedCode = code.toLowerCase().trim();
```

This ensures:
- Case-insensitive matching
- Whitespace handling
- Consistent storage

### Wallet Normalization

All wallet addresses are normalized:
```typescript
const normalizedWallet = wallet.toLowerCase();
```

This ensures:
- Case-insensitive matching
- Consistent storage
- Accurate unique counting

### Concurrency Handling

The system handles concurrent requests:
- Duplicate checks prevent double-counting
- Limit checks happen before entity creation
- `syncBetaCodeUsageCount` ensures accuracy

### Error Handling

Graceful error handling:
- Network errors don't block auth flow
- Failed access creation doesn't prevent login
- Errors logged but don't crash system

## Related Documentation

- [Beta Code Entity Schema](../additional-entities/beta-code.md)
- [Beta Access Entity Schema](../additional-entities/beta-access.md)
- [Wallet Authentication Flow](./wallet-authentication-flow.md)

## Code References

- **API Route:** `app/api/beta-code/route.ts`
- **Beta Code Library:** `lib/arkiv/betaCode.ts`
- **Beta Access Library:** `lib/arkiv/betaAccess.ts`
- **Auth Integration:** `app/auth/page.tsx`
- **Beta Gate:** `app/beta/page.tsx`

## Security Considerations

### Public Data

- Beta codes are stored on-chain (public)
- Access grants are public (wallet → code bindings)
- Usage statistics are public

**Implications:**
- Anyone can see who used which code
- Code privacy not guaranteed
- Consider for production: use codes that don't reveal sensitive info

### Access Control

- Limits enforced server-side (API routes)
- Client-side validation for UX only
- Always verify on-chain before granting access

### Rate Limiting

- Limit enforced per unique wallet
- Duplicate checks prevent double-counting
- Concurrent request handling prevents race conditions

## Future Enhancements

Potential improvements:
- Multiple codes per wallet support
- Code expiration dates
- Admin code management UI
- Usage analytics dashboard
- Code generation automation

