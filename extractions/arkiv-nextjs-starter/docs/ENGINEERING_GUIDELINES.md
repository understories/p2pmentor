# Engineering Guidelines (Public-Safe Version)

**Source:** Vendored from p2pmentor Engineering Guidelines, adapted for public consumption.

**Purpose:** Establish engineering principles for Arkiv application development, ensuring code quality, transparency, and alignment with FLOSS and Ethereum values.

---

## ⚡ TLDR - Critical Rules (Review This First)

### 🚨 MANDATORY BEFORE EVERY COMMIT/PUSH

1. **BUILD MUST PASS** - ⚠️ NEVER push code that fails to build
   - Run `npm run build` (or `pnpm run build`) before committing
   - Run `npm run typecheck` (or `npx tsc --noEmit`) before committing
   - Fix all TypeScript errors, linting errors, and build failures
   - Build verification is NON-NEGOTIABLE

2. **NEVER COMMIT SECRETS** - ⚠️ CRITICAL SECURITY RULE
   - No passwords, API keys, private keys, tokens in code
   - No hardcoded credentials as fallbacks (e.g., `|| 'password'`)
   - No secrets in commit messages, comments, or documentation
   - Use environment variables only (scripts MUST fail if env vars missing)
   - If secret committed: remove immediately, use `git filter-repo` to remove from history, rotate secret

3. **NEVER COMMIT refs/ FILES** - ⚠️ ABSOLUTE PROHIBITION - CRITICAL
   - `refs/` = Internal documentation (gitignored, team-only)
   - `docs/` = Public documentation (committed, visible to all)
   - **NEVER use `git add -f` to force-add files from `refs/`**
   - If file needs to be public: move to `docs/` first, then commit normally

4. **KEEP TREE CLEAN - NO WHITESPACE-ONLY CHANGES** - ⚠️ MANDATORY
   - Run `git diff --check` before every commit to detect whitespace issues
   - NEVER commit files with only whitespace changes (trailing spaces, blank lines at EOF)
   - Check regularly: `git diff --check` should return no output before committing

### 📁 Directory Structure

- **`docs/`** = Public documentation (committed to repo)
- **`refs/`** = Internal documentation (gitignored, NEVER commit)
- **`scripts/`** = Public utility scripts (committed, must use env vars only)

### 🔐 Security Checklist (Before Every Commit)

- [ ] No secrets in code (grep for passwords, keys, tokens)
- [ ] No hardcoded credentials as fallbacks
- [ ] No secrets in commit messages
- [ ] No secrets in documentation
- [ ] All scripts use environment variables (fail if missing)
- [ ] Build passes (`npm run build` succeeds)
- [ ] Typecheck passes (`npm run typecheck` succeeds)
- [ ] **No whitespace-only changes** (`git diff --check` returns no output)

### 📝 Documentation Rules

**Public (`docs/` - committed):**
- User-facing guides, API docs, architecture docs
- Clear, comprehensive, no internal-only info
- No secrets or sensitive data

**Internal (`refs/` - NEVER committed):**
- Internal research, security incidents
- Performance testing procedures, test scripts
- Any docs mentioning passwords, secrets, or internal processes
- Decision-making processes, team coordination

### 💻 Code Quality Standards

1. **Clean Code:**
   - Remove commented-out code, unused imports, debug logs
   - No hardcoded test data or fabricated metrics
   - All data must be real, verifiable, traceable

2. **Commit Messages:**
   - Short summary (50 chars or less)
   - Detailed explanation if needed (what, why, breaking changes)
   - Logical grouping (one feature per commit)
   - NEVER mention secrets in commit messages

3. **Comments:**
   - Explain **why**, not **what** (code should be self-documenting)
   - Clarify non-obvious business logic
   - Document assumptions and constraints

---

## 🔗 Arkiv-Native Patterns (CRITICAL)

### Core Principle

**Think Arkiv-native:** We are building on Arkiv, not reinventing the wheel. Use Arkiv's query system properly, build composable tools that work together, and follow established patterns consistently.

### Wallet Address Normalization

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

**Checklist:**
- [ ] All `create*` functions normalize wallet addresses with `.toLowerCase()`
- [ ] All `list*ForWallet` functions normalize wallet addresses with `.toLowerCase()`
- [ ] All queries using wallet addresses normalize them
- [ ] Both main entities and `*_txhash` entities normalize wallet addresses

### Query Patterns

**Standard Query Structure:**
```typescript
const publicClient = getPublicClient();
const query = publicClient.buildQuery();
let queryBuilder = query
  .where(eq('type', 'entity_type'))
  .where(eq('wallet', wallet.toLowerCase())); // Normalize!

if (spaceId) {
  queryBuilder = queryBuilder.where(eq('spaceId', spaceId));
}

const result = await queryBuilder
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

**Defensive Checks:**
```typescript
// Always check result structure before processing
if (!result || !result.entities || !Array.isArray(result.entities)) {
  console.warn('[functionName] Invalid result structure, returning empty array', { result });
  return [];
}
```

### Entity Creation Patterns

**Standard Create Structure:**
```typescript
import { SPACE_ID } from '@/lib/config';

export async function createEntity({
  wallet,
  // ... other fields
  privateKey,
  spaceId = SPACE_ID, // Use SPACE_ID from config, never hardcode
}: {
  wallet: string;
  // ... types
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();
  const finalSpaceId = spaceId || SPACE_ID; // Always fallback to SPACE_ID
  
  // Wrap in handleTransactionWithTimeout for graceful timeout handling
  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({
        // Payload data (user-facing content)
      })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'entity_type' },
        { key: 'wallet', value: wallet.toLowerCase() }, // Normalize!
        { key: 'spaceId', value: finalSpaceId }, // Use finalSpaceId
        { key: 'createdAt', value: createdAt },
        // ... other queryable attributes
      ],
      expiresIn: ttl,
    });
  });

  const { entityKey, txHash } = result;

  // Create separate txhash entity (optional metadata, don't wait)
  walletClient.createEntity({
    payload: enc.encode(JSON.stringify({ txHash })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'entity_type_txhash' },
      { key: 'entityKey', value: entityKey },
      { key: 'wallet', value: wallet.toLowerCase() }, // Normalize!
      { key: 'spaceId', value: finalSpaceId },
    ],
    expiresIn: ttl,
  });

  return { key: entityKey, txHash };
}
```

### Attribute vs Payload

**Attributes:** Queryable fields, indexed by Arkiv
- Use for: `type`, `wallet`, `spaceId`, `createdAt`, `status`, filterable fields
- Keep minimal and normalized (lowercase wallet addresses, consistent formats)

**Payload:** User-facing content, JSON-encoded
- Use for: messages, descriptions, complex objects, large data
- Not directly queryable, but accessible via `.withPayload(true)`

### Error Handling

**Query Errors:**
```typescript
try {
  const result = await queryBuilder.fetch();
} catch (fetchError: any) {
  console.error('[functionName] Arkiv query failed:', {
    message: fetchError?.message,
    stack: fetchError?.stack,
    error: fetchError
  });
  return []; // Return empty array on query failure
}
```

**Transaction Timeouts:**
```typescript
// Use handleTransactionWithTimeout for all entity creation
const result = await handleTransactionWithTimeout(async () => {
  return await walletClient.createEntity({ /* ... */ });
});

// Handle timeout gracefully in API routes
if (isTransactionTimeoutError(error)) {
  return NextResponse.json({ 
    ok: true, 
    key: null,
    txHash: null,
    pending: true,
    message: error.message || 'Transaction submitted, confirmation pending'
  });
}
```

### Space ID Management (CRITICAL)

**Rule:** ALWAYS use `SPACE_ID` from config. NEVER hardcode `'local-dev'` or `'beta-launch'`.

**Why:** Space ID provides data isolation between environments. Hardcoded values cause data leakage and break environment separation.

**Configuration:**
```typescript
// lib/config.ts
export const SPACE_ID = process.env.BETA_SPACE_ID ||
  (process.env.NODE_ENV === 'production' ? 'beta-launch' : 'local-dev');
```

**Entity Creation:**
```typescript
// ✅ Correct: Use SPACE_ID from config
import { SPACE_ID } from '@/lib/config';

export async function createEntity({
  wallet,
  privateKey,
  spaceId = SPACE_ID, // Default to SPACE_ID, can be overridden
}: {
  wallet: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}) {
  const finalSpaceId = spaceId || SPACE_ID; // Always fallback to SPACE_ID
  // ...
  attributes: [
    { key: 'spaceId', value: finalSpaceId },
    // ...
  ],
}
```

**Common Mistakes to Avoid:**
- ❌ `spaceId = 'local-dev'` (hardcoded)
- ❌ `spaceId: getAttr('spaceId') || 'local-dev'` (hardcoded fallback)
- ✅ `spaceId = SPACE_ID` (from config)
- ✅ `spaceId: getAttr('spaceId') || SPACE_ID` (config fallback)

---

## 🎯 Core Principles

- **FLOSS:** Open source, transparent, community-friendly
- **Ethereum Values:** Decentralization, transparency, trustlessness, permissionlessness
- **Data Integrity:** All data real, verifiable, traceable (on-chain when important)
- **Arkiv-Native:** Use Arkiv's query system properly, build composable tools, follow established patterns
- **Minimal Changes:** Make minimal code changes, reuse existing code, don't break functionality

---

## ✅ Pre-Commit Checklist

- [ ] **Build passes** (`npm run build` succeeds) ⚠️ MANDATORY
- [ ] **Typecheck passes** (`npm run typecheck` succeeds) ⚠️ MANDATORY
- [ ] No secrets in code, commit messages, or documentation
- [ ] No hardcoded credentials as fallbacks
- [ ] Documentation is in correct location (public vs internal)
- [ ] Code is clean (no commented code, unused imports, debug logs)
- [ ] Commit message is clear and doesn't mention secrets
- [ ] Wallet addresses normalized in Arkiv operations
- [ ] Arkiv query patterns follow standard structure
- [ ] Error handling is graceful and defensive
- [ ] **No whitespace-only changes** (`git diff --check` returns no output)

---

**Last Updated:** 2025-12-30  
**Status:** Public-safe version for Arkiv builder community

