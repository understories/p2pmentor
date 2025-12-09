# Engineering Guidelines

## Core Principles

This document establishes engineering principles for p2pmentor development, ensuring code quality, transparency, and alignment with FLOSS and Ethereum values.

## 1. Code Organization

### Directory Structure

```
/                    # Public-facing code and documentation
├── app/             # Next.js application code
├── components/       # React components
├── lib/             # Core libraries and utilities
├── docs/            # Public documentation (committed, visible to all)
└── refs/            # Internal documentation (not committed, team-only)
    └── docs/        # Internal engineering docs, research, planning
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
- `PERFORMANCE_TESTING.md` - How to test performance
- `ARKIV_GRAPHQL_TOOL.md` - Public API documentation
- `README.md` - Project overview

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
- `performance_data_verification.md` - Internal verification procedures

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

- **Never commit secrets:**
  - API keys
  - Private keys
  - Passwords
  - Access tokens

- **Use environment variables:**
  - `.env` for local development
  - `.env.example` for documentation
  - Vercel environment variables for production

- **Document required variables:**
  - List in `.env.example`
  - Document in README or setup guide
  - No secrets in example files

### Authentication

- **Admin routes:** Password-protected (TODO: proper auth)
- **API routes:** Internal-only or properly authenticated
- **User data:** Wallet-based authentication (no centralized auth)

## 8. Testing and Verification

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
- [ ] No secrets in code
- [ ] No hardcoded test data
- [ ] All data sources are real
- [ ] Documentation is appropriate (public vs internal)
- [ ] Code is clean (no noise)
- [ ] Commit message is clear
- [ ] Changes are auditable

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

**What to Keep Internal:**
- Sprint planning and reviews
- Internal research and findings
- Decision-making processes
- Performance analysis details
- Team coordination notes

**Where:**
- `refs/docs/` directory (gitignored)
- Not committed to repository
- Shared via other channels if needed

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
├─ Is it internal engineering notes?
│  └─ YES → refs/docs/ (don't commit)
│  └─ NO → Continue
└─ Is it code comments?
   └─ YES → Inline comments (explain why)
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

---

**Remember:** 
- **Public = `docs/` (committed)**
- **Internal = `refs/docs/` (not committed)**
- **Code = Clean, verifiable, transparent**
- **Values = FLOSS + Ethereum principles**

