# Engineering Guidelines

## Core Principles

This document establishes engineering principles for p2pmentor development, ensuring code quality, transparency, and alignment with FLOSS and Ethereum values.

## 1. Code Organization

### Directory Structure

```
/                    # Public-facing code and documentation
├── app/             # Next.js application code
├── components/      # React components
├── lib/             # Core libraries and utilities
├── scripts/         # Public utility scripts (committed)
├── docs/            # Public documentation (committed, visible to all)
└── refs/            # Internal documentation (not committed, team-only)
    ├── docs/        # Internal engineering docs, research, planning
    └── scripts/     # Internal test scripts (not committed)
```

**Rule:** 
- `docs/` = Public documentation (committed to repo)
- `refs/` = Internal documentation (gitignored, not committed)

### File Naming

- **Public docs:** Clear, descriptive names (e.g., `PERFORMANCE_TESTING.md`)
- **Internal docs:** Prefixed with context (e.g., `SPRINT2_READINESS_REVIEW.md` in `refs/docs/`)
- **Code files:** Follow existing patterns, no abbreviations

## 2. Documentation Standards

### Public Documentation (`docs/`)

**Purpose:** Documentation for external contributors, users, and the broader community.

**Requirements:**
- Clear, comprehensive, and accessible
- No internal-only information
- No sensitive data or credentials
- Examples and guides for common tasks
- API documentation for public interfaces

**Examples:**
- `ARKIV_GRAPHQL_TOOL.md` - Public API documentation
- `README.md` - Project overview
- Architecture documentation
- User-facing guides

**⚠️ NOT Public (must be in `refs/docs/`):**
- Performance testing procedures (internal)
- Test scripts documentation (internal)
- Sprint planning (internal)
- Security incident reports (internal)

### Internal Documentation (`refs/docs/`)

**Purpose:** Internal engineering notes, research, planning, and team coordination.

**Requirements:**
- Detailed technical notes
- Sprint planning and reviews
- Research findings
- Internal decision-making processes
- Not committed to repository (gitignored)

**Examples:**
- `sprint2.md` - Sprint planning
- `SPRINT2_READINESS_REVIEW.md` - Internal readiness review
- `PERFORMANCE_TESTING.md` - Internal testing procedures
- `SECURITY_INCIDENT_*.md` - Security incident documentation
- `FORCE_PUSH_*.md` - History rewrite procedures
- Any documentation mentioning passwords or internal processes

### Code Documentation

**In-Code Comments:**
- Explain **why**, not **what** (code should be self-documenting)
- Clarify non-obvious business logic
- Document assumptions and constraints
- Reference external documentation when appropriate

**Example:**
```typescript
// ✅ Good: Explains why
// Warm up requests to avoid cold start skewing performance measurements
await listAsks({ limit: 1 });

// ❌ Bad: Explains what (obvious from code)
// Call listAsks function
await listAsks({ limit: 1 });
```

## 3. Code Quality Standards

### Clean Code Principles

1. **No Noise:**
   - Remove commented-out code
   - Remove unused imports
   - Remove debug console.logs (use proper logging)
   - Remove temporary files

2. **Auditable:**
   - Clear commit messages
   - Logical file organization
   - Consistent patterns
   - Traceable changes

3. **Verifiable:**
   - All data sources are real and traceable
   - No hardcoded values (use environment variables)
   - All on-chain data verifiable via explorers
   - Performance data stored on-chain

### Commit Standards

**Commit Message Format:**
```
Short summary (50 chars or less)

Detailed explanation if needed:
- What changed
- Why it changed
- Any breaking changes
```

**Examples:**
```
✅ Good:
Fix performance summary to query Arkiv entities first

Ensures all performance data comes from verifiable on-chain
sources, not in-memory samples. This guarantees data integrity
for empirical evaluation.

❌ Bad:
fix stuff
```

**Commit Grouping:**
- Group related changes together
- Separate logical features
- One commit per logical change
- No "fix typo" commits mixed with feature work

## 4. FLOSS Principles

### Open Source Best Practices

1. **Transparency:**
   - All code is open and auditable
   - Public documentation for public APIs
   - Clear licensing (check LICENSE file)
   - No hidden functionality

2. **Community:**
   - Welcome contributions
   - Clear contribution guidelines
   - Responsive to issues and PRs
   - Credit contributors appropriately

3. **Freedom:**
   - Users can inspect, modify, and distribute
   - No vendor lock-in
   - Interoperable standards
   - Clear licensing terms

### Attribution and Credit

**Code Attribution:**
- Credit original authors in file headers when appropriate
- Document external dependencies
- Acknowledge inspiration from other projects
- Maintain changelog for significant contributions

**Example Header:**
```typescript
/**
 * Network Graph Builder
 * 
 * Builds graph data from Arkiv asks and offers.
 * Supports both JSON-RPC and GraphQL paths.
 * 
 * Inspired by: [project/repo] (if applicable)
 * Dependencies: @arkiv-network/sdk, react-force-graph-2d
 */
```

## 5. Ethereum Values

### Decentralization

- **Data Ownership:** Users own their data (stored on Arkiv, not centralized DB)
- **No Single Point of Failure:** No reliance on centralized services
- **Censorship Resistance:** Open protocols, no gatekeeping

### Transparency

- **On-Chain Verification:** All important data verifiable on-chain
- **Open Source:** All code publicly auditable
- **Clear Intent:** Code and documentation clearly express intent

### Trustlessness

- **Verifiable Data:** All performance data stored on-chain with txHash
- **No Trusted Third Parties:** Direct interaction with Arkiv protocol
- **Cryptographic Proof:** All claims verifiable via blockchain

### Permissionlessness

- **Open Access:** No gatekeeping for users or developers
- **Public APIs:** All interfaces documented and accessible
- **Open Standards:** Use open protocols and standards

## 6. Data Integrity

### Real Data Only

**Rule:** All data must be real, verifiable, and traceable.

**Implementation:**
- ✅ Query real Arkiv entities
- ✅ Measure actual API calls
- ✅ Store on-chain for verification
- ❌ No hardcoded test data
- ❌ No fabricated metrics
- ❌ No approximations without clear labeling

**Verification:**
- Every performance sample has `txHash`
- All data queryable from Arkiv entities
- Mendoza explorer links for verification
- Clear data source in documentation

### Performance Data

**Requirements:**
1. All measurements from real API calls
2. All data stored as Arkiv entities (`dx_metric`)
3. All summaries query Arkiv entities first
4. All snapshots verifiable on-chain
5. Clear documentation of measurement methodology

## 7. Security Practices

### Secrets Management

**⚠️ CRITICAL: NEVER COMMIT SECRETS IN ANY FORM ⚠️**

- **Never commit secrets:**
  - API keys
  - Private keys
  - Passwords
  - Access tokens
  - **NEVER hardcode passwords as fallback values** (e.g., `|| 'password'`)
  - **NEVER mention passwords in commit messages**
  - **NEVER mention passwords in code comments**
  - **NEVER mention passwords in documentation**

- **Use environment variables:**
  - `.env` for local development (gitignored)
  - `.env.example` for documentation (NO real values)
  - Vercel environment variables for production
  - **Scripts MUST fail if required env vars are missing** - no fallbacks

- **If a secret is accidentally committed:**
  1. **IMMEDIATELY** remove it from code
  2. **DO NOT** mention the secret in commit messages
  3. **DO NOT** create revert commits that mention the secret
  4. **DO NOT** put the secret value in any commit message, even in revert commits
  5. If not yet pushed: 
     - `git reset --hard HEAD~N` (where N = commits to undo)
     - Or use `git rebase -i` to remove the commit
  6. If already pushed:
     - **Use `git filter-repo` to remove from ALL history** (see procedure below)
     - **Force push required** - coordinate with team first
     - **Rotate/change the secret immediately** (it's compromised)
  7. **Document incident in `refs/docs/`** (internal only, never commit)

- **Commit message security:**
  - Use generic descriptions: "Remove hardcoded credentials"
  - Use: "Security fix: require environment variable"
  - **NEVER**: "Remove password 'xyz'" or "Fix 'xyz' password issue"

- **Document required variables:**
  - List in `.env.example` (with placeholder values like `YOUR_PASSWORD_HERE`)
  - Document in README or setup guide
  - No secrets in example files

### Authentication

- **Admin routes:** Password-protected (TODO: proper auth)
- **API routes:** Internal-only or properly authenticated
- **User data:** Wallet-based authentication (no centralized auth)

### History Rewrite Procedures (Security Incidents)

**When to use:** Only when secrets have been committed and pushed to remote.

**⚠️ WARNING: History rewrite affects all collaborators. Coordinate first.**

**Procedure:**

1. **Identify affected commits:**
   ```bash
   git log --all -S "secret_value" --oneline
   git log --all --grep="secret_value" --oneline
   ```

2. **Install git-filter-repo:**
   ```bash
   pip3 install git-filter-repo
   ```

3. **Remove files containing secrets:**
   ```bash
   git filter-repo --path path/to/file --invert-paths --force
   ```

4. **Verify removal:**
   ```bash
   git log --all -S "secret_value" --oneline  # Should return nothing
   ```

5. **Force push (coordinate with team first):**
   ```bash
   git push --force origin main
   ```

6. **Notify collaborators:**
   - They must re-clone or: `git fetch origin && git reset --hard origin/main`
   - Any open PRs referencing old commits will break

7. **Rotate compromised secrets immediately**

**Alternative (if git-filter-repo unavailable):**
- Use `git filter-branch` (deprecated but works)
- Or contact security team for assistance

**Documentation:**
- Document incident in `refs/docs/SECURITY_INCIDENT_*.md` (never commit)
- Update engineering guidelines if new patterns discovered

## 8. Testing and Verification

### Build Testing (CRITICAL - MANDATORY BEFORE EVERY PUSH)

**⚠️ NEVER PUSH CODE THAT FAILS TO BUILD ⚠️**

**MANDATORY PROCESS BEFORE EVERY COMMIT AND PUSH:**

1. **Always run `npm run build` (or `pnpm run build`) before committing**
   - The build MUST succeed with no errors
   - Fix all TypeScript errors, linting errors, and build failures locally
   - Never commit code that fails to build
   - Never push code that fails to build

2. **Build verification checklist (MANDATORY):**
   - ✅ Build completes successfully (`✓ Compiled successfully`)
   - ✅ No TypeScript errors
   - ✅ No linting errors
   - ✅ No missing dependencies
   - ✅ No duplicate JSX attributes or other syntax errors
   - ✅ No runtime errors in build output

3. **If build fails:**
   - ❌ DO NOT commit
   - ❌ DO NOT push
   - ✅ Fix the error locally
   - ✅ Re-run build until it passes
   - ✅ Only then commit and push

4. **This is non-negotiable** - broken builds break production for all users

**Example workflow:**
```bash
# 1. Make changes
# 2. Test build
npm run build

# 3. If build fails, fix errors and repeat step 2
# 4. Only when build passes:
git add .
git commit -m "descriptive message"
git push
```

### Testing Standards

1. **Real Data:**
   - Test with real Arkiv entities
   - No mock data in production code
   - Verify on-chain when possible

2. **Documentation:**
   - Document test procedures
   - Document expected results
   - Document verification steps

3. **Empirical:**
   - Measure real performance
   - Collect sufficient samples
   - Document variance and outliers

### Verification Checklist

Before committing:
- [ ] **Build passes (`npm run build` succeeds)** ⚠️ MANDATORY
- [ ] **No secrets in code** - grep for passwords, keys, tokens
- [ ] **No hardcoded credentials as fallbacks** (e.g., `|| 'password'`)
- [ ] **No secrets in commit messages** - check commit message before committing
- [ ] **No secrets in documentation** - check all docs being committed
- [ ] No hardcoded test data
- [ ] All data sources are real
- [ ] **Documentation is appropriate (public vs internal)** - test scripts and internal docs in `refs/`
- [ ] Code is clean (no noise)
- [ ] Commit message is clear and doesn't mention secrets
- [ ] Changes are auditable

**Pre-commit secret check:**
```bash
# Quick check before committing
grep -r "password.*=.*['\"]" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=refs
grep -r "ADMIN_PASSWORD.*||" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=refs
```

Before pushing to production:
- [ ] **Build passes (`npm run build` succeeds)** ⚠️ MANDATORY
- [ ] **Double-check all data for accuracy** (dates, numbers, metrics, references)
- [ ] Verify all transaction hashes and explorer links
- [ ] Confirm all dates and timestamps are correct
- [ ] Review all metrics and calculations
- [ ] Ensure no placeholder values (TBD, TODO) remain in public docs
- [ ] Test all links and references
- [ ] Confirm environment variables are set correctly

## 9. Agent and Human Collaboration

### For AI Agents

**Code Structure:**
- Clear function names and types
- Explicit error handling
- Comprehensive type definitions
- Clear separation of concerns

**Documentation:**
- Inline comments for complex logic
- Type definitions for all interfaces
- Clear function signatures
- Document assumptions and constraints

**Patterns:**
- Follow existing patterns
- Reuse existing utilities
- Extend, don't duplicate
- Clear intent in code

### For Human Engineers

**Code Review:**
- Review for clarity and maintainability
- Check for proper error handling
- Verify data integrity
- Ensure documentation is appropriate

**Communication:**
- Clear commit messages
- Document decisions in code or docs
- Explain non-obvious choices
- Share learnings in documentation

## 10. External vs Internal

### External (Public)

**What to Share:**
- Public APIs and interfaces
- User-facing documentation
- Contribution guidelines
- Project overview and goals
- Technical architecture (high-level)

**Where:**
- `docs/` directory (committed)
- README.md
- Public GitHub repository

### Internal (Team Only)

**What to Keep Internal (MUST be in `refs/docs/` or `refs/scripts/`):**
- Sprint planning and reviews
- Internal research and findings
- Decision-making processes
- Performance analysis details
- Team coordination notes
- **Performance testing guides and procedures**
- **Test scripts with credentials or internal processes**
- **Security incident reports**
- **Any documentation mentioning passwords, secrets, or internal processes**
- **Internal testing procedures and results**

**Where:**
- `refs/docs/` directory (gitignored) - for documentation
- `refs/scripts/` directory (gitignored) - for test/utility scripts that shouldn't be committed
- Not committed to repository
- Shared via other channels if needed

**Enforcement:**
- All performance testing docs → `refs/docs/`
- All test scripts that use credentials → `refs/scripts/` or ensure they only use env vars
- All sprint planning → `refs/docs/`
- All internal metrics/reports → `refs/docs/`
- If unsure, put it in `refs/` (can always move to public later)

## 11. Best Practices Summary

### Code

- ✅ Clean, auditable, verifiable
- ✅ Real data only, no fabrication
- ✅ Proper error handling
- ✅ Type-safe (TypeScript)
- ✅ Well-documented (why, not what)

### Documentation

- ✅ Public docs in `docs/` (committed)
- ✅ Internal docs in `refs/docs/` (not committed)
- ✅ Clear, comprehensive, accessible
- ✅ Examples and guides
- ✅ API documentation

### Commits

- ✅ Clear, descriptive messages
- ✅ Logical grouping
- ✅ One feature per commit
- ✅ No noise or fluff

### Data

- ✅ Real and verifiable
- ✅ Stored on-chain when important
- ✅ Traceable via transaction hashes
- ✅ No secrets or sensitive data

### Values

- ✅ FLOSS principles
- ✅ Ethereum values (decentralization, transparency)
- ✅ Open source best practices
- ✅ Community-friendly
- ✅ Proper attribution

## 12. Quick Reference

### Before Committing

1. **Check documentation location:**
   - Public? → `docs/`
   - Internal? → `refs/docs/` (not committed)

2. **Verify data integrity:**
   - Real data? ✅
   - Verifiable? ✅
   - No secrets? ✅

3. **Clean code:**
   - No commented code
   - No unused imports
   - No debug logs
   - No temporary files

4. **Clear commit:**
   - Descriptive message
   - Logical grouping
   - No noise

### Documentation Decision Tree

```
Is this documentation?
├─ Is it for external users/contributors?
│  └─ YES → docs/ (commit)
│  └─ NO → Continue
├─ Does it mention passwords, secrets, or credentials?
│  └─ YES → refs/docs/ (NEVER commit)
│  └─ NO → Continue
├─ Is it a test script or testing procedure?
│  └─ YES → refs/docs/ or refs/scripts/ (NEVER commit)
│  └─ NO → Continue
├─ Is it internal engineering notes?
│  └─ YES → refs/docs/ (don't commit)
│  └─ NO → Continue
└─ Is it code comments?
   └─ YES → Inline comments (explain why, no secrets)
```

### Test Scripts and Utilities

**Location:**
- Public utility scripts: `scripts/` (committed)
- Internal test scripts: `refs/scripts/` (gitignored, not committed)
- Or ensure scripts in `scripts/` only use environment variables (no hardcoded values)

**Rules:**
- ✅ Scripts that use credentials MUST only use environment variables
- ✅ Scripts MUST fail if required env vars are missing (no fallbacks)
- ❌ NEVER hardcode passwords, keys, or secrets in scripts
- ❌ NEVER commit test scripts that contain internal procedures or credentials

**Example:**
```typescript
// ✅ Correct: Fail if env var missing
if (!process.env.ADMIN_PASSWORD) {
  console.error('ERROR: ADMIN_PASSWORD required');
  process.exit(1);
}
const password = process.env.ADMIN_PASSWORD;

// ❌ Wrong: Hardcoded fallback
const password = process.env.ADMIN_PASSWORD || 'hardcoded_password';
```

## 13. Enforcement

### Automated Checks

- TypeScript compilation
- Linter (ESLint)
- Build verification
- Type checking

### Manual Review

- Code review for quality
- Documentation review for appropriateness
- Security review for secrets
- Data integrity verification

### Continuous Improvement

- Regular review of guidelines
- Update based on learnings
- Share best practices
- Document patterns


## 14. Arkiv-Native Patterns

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

**Parallel txHash Queries:**
```typescript
// Fetch main entities and txHash entities in parallel
const [result, txHashResult] = await Promise.all([
  queryBuilder.withAttributes(true).withPayload(true).limit(100).fetch(),
  publicClient.buildQuery()
    .where(eq('type', 'entity_type_txhash'))
    .where(eq('wallet', wallet.toLowerCase())) // Normalize!
    .withAttributes(true)
    .withPayload(true)
    .limit(100)
    .fetch(),
]);
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
export async function createEntity({
  wallet,
  // ... other fields
  privateKey,
  spaceId = 'local-dev',
}: {
  wallet: string;
  // ... types
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();
  
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
        { key: 'spaceId', value: spaceId },
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
      { key: 'spaceId', value: spaceId },
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

**Example:**
```typescript
attributes: [
  { key: 'type', value: 'offer' },
  { key: 'wallet', value: wallet.toLowerCase() },
  { key: 'skill', value: skill }, // Queryable
  { key: 'status', value: 'active' }, // Queryable
],
payload: enc.encode(JSON.stringify({
  message, // User-facing, not queryable
  availabilityWindow, // Complex object, not queryable
}))
```

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

### Consistency Checklist

Before creating or modifying Arkiv entity functions:

- [ ] **Wallet normalization:** All wallet addresses normalized with `.toLowerCase()` in both storage and queries
- [ ] **Query structure:** Uses standard `buildQuery().where(eq(...))` pattern
- [ ] **Defensive checks:** Validates result structure before processing
- [ ] **Error handling:** Gracefully handles query failures and transaction timeouts
- [ ] **txHash entities:** Creates parallel `*_txhash` entities for reliable querying
- [ ] **Attribute vs payload:** Uses attributes for queryable fields, payload for content
- [ ] **Space ID:** Includes `spaceId` attribute (defaults to `'local-dev'`)
- [ ] **Created timestamp:** Includes `createdAt` attribute (ISO string)
- [ ] **Type attribute:** Always includes `type` attribute matching entity type

### Building Blocks, Not Reinventing

**Principles:**
1. **Use Arkiv's query system:** Don't build custom indexing or filtering
2. **Compose, don't duplicate:** Reuse patterns across entity types
3. **Queryable attributes:** Put filterable fields in attributes, not just payload
4. **Standard patterns:** Follow established patterns (mentor-graph, existing code)
5. **Web3-native:** Build on decentralized infrastructure, not centralized workarounds

**Example of Good Composition:**
```typescript
// Reuse wallet normalization helper
function normalizeWallet(wallet: string): string {
  return wallet.toLowerCase();
}

// Reuse query builder pattern
function buildWalletQuery(type: string, wallet: string, spaceId?: string) {
  const query = getPublicClient().buildQuery();
  let builder = query
    .where(eq('type', type))
    .where(eq('wallet', normalizeWallet(wallet)));
  if (spaceId) {
    builder = builder.where(eq('spaceId', spaceId));
  }
  return builder;
}
```

### Verify the build before pushing

**What I'll do going forward:**
1. Run `npm run build` and confirm it completes successfully
2. Run `npx tsc --noEmit` to verify types
3. Check linter errors
4. Verify Arkiv-native patterns (wallet normalization, query structure)
5. Only then push to production

Follow this process for all future changes.
---

**Remember:** 
- **Public = `docs/` (committed)**
- **Internal = `refs/docs/` (not committed)**
- **Code = Clean, verifiable, transparent**
- **Values = FLOSS + Ethereum principles**
- **Arkiv-native = Use Arkiv properly, build composable tools**

