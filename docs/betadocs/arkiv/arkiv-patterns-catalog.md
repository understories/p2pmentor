# Arkiv Patterns Catalog

**Purpose:** Comprehensive index of reusable implementation patterns for building on Arkiv in p2pmentor.

**Audience:** Engineers, contributors, and builders working with Arkiv.

**Status:** Living document - patterns are extracted from production code and refined through implementation.

## Verification Rule

**Any claim that includes:**
- a file path
- a function name
- a localStorage key
- a specific timeout duration

**Must be backed by a code pointer and reviewed during PR.** Otherwise mark it ⚠️ "unverified".

**Code refs status:** ✅ Verified in repo / ⚠️ Needs verification

---

## Table of Contents

1. [Pattern Classification](#pattern-classification)
2. [Core Patterns](#core-patterns)
3. [Data & Identity Patterns](#data--identity-patterns)
4. [Consistency & UX Patterns](#consistency--ux-patterns)
5. [Query & Performance Patterns](#query--performance-patterns)
6. [Access & Privacy Patterns](#access--privacy-patterns)
7. [Auth & Signing Patterns](#auth--signing-patterns)
8. [Code Cross-References](#code-cross-references)
9. [Document Classification](#document-classification)

---

## Pattern Lifecycle

Patterns move through the following stages:

1. **Implicit** – Observed in code, not yet documented
2. **Stub** – Catalog entry exists with extraction target
3. **Documented** – Dedicated pattern doc exists
4. **Verified** – Code pointers confirmed and marked ✅
5. **Stable** – Used by multiple features and unlikely to change

Only **Documented + Verified** patterns should be referenced in public-facing docs.

---

## Pattern Classification

**Catalog entries are summaries.** Full details (canonical algorithm, debug recipes, anti-patterns, tradeoffs) live in dedicated pattern doc files.

Each catalog entry includes:
1. **Pattern ID** - Unique identifier (e.g., `PAT-IMMUTABLE-001`)
2. **What problem it solves** - 2-4 line description
3. **Invariants** - 3-6 behavioral contracts (not implementation details)
4. **Threat model / failure modes** - 3-6 key risks
5. **Links** - To dedicated pattern doc with full details

Full pattern docs include: canonical algorithm, debug recipe, anti-patterns, tradeoffs, implementation hooks.

---

## Core Patterns

### PAT-IMMUTABLE-001: Designing with Immutable Data

**Status:** ✅ Documented  
**Location:** [`patterns/designing-with-immutable-data.md`](./patterns/designing-with-immutable-data.md)

**What problem it solves:**  
Arkiv transactions are immutable, but application data must be mutable at the state level. This pattern explains how to design features that feel mutable to users while respecting blockchain immutability.

**Invariants:**
- Transactions are never modified after creation
- Entity state can be updated via new transactions
- Full transaction history is preserved and queryable
- Entity identity is stable (via `entity_key`)

**Threat model / failure modes:**
- **Race conditions:** Concurrent updates create multiple transactions; last-write-wins or merge strategy
- **Indexer lag:** UI may show stale data until indexer catches up
- **Transaction failures:** Network issues, gas problems, or validation errors prevent state changes

**Arkiv primitives used:**
- Entity creation and update transactions
- Stable entity identity via `entity_key`
- Transaction history via indexer queries

**Related patterns:**
- [PAT-UPDATE-001: Stable Entity Key Updates](./patterns/stable-entity-key-updates.md) (Pattern B)
- [PAT-VERSION-001: Entity Versioning](./patterns/entity-versioning.md) (Pattern A)

**See full pattern doc for:** canonical algorithm, debug recipe, anti-patterns, tradeoffs, implementation hooks.

---

### PAT-UPDATE-001: Stable Entity Key Updates (Pattern B)

**Status:** ✅ Documented  
**Location:** [`patterns/stable-entity-key-updates.md`](./patterns/stable-entity-key-updates.md)

**What problem it solves:**  
Frequently updated entities (profiles, preferences, notifications) need stable identity for relationships and simpler queries. This pattern reuses the same `entity_key` for all updates.

**Invariants:**
- Same `entity_key` is reused for all updates to an entity
- Entity identity never changes (relationships don't break)
- Query by `entity_key` always returns current state
- Transaction history is preserved (all updates are queryable)

**Threat model / failure modes:**
- **Concurrent updates:** Last-write-wins (or merge strategy per field)
- **Entity key derivation:** Must be deterministic (e.g., `wallet` for profiles)
- **Migration:** Existing Pattern A entities need migration markers

**Related patterns:**
- [PAT-VERSION-001: Entity Versioning](./patterns/entity-versioning.md) (Pattern A alternative)
- [PAT-IMMUTABLE-001: Designing with Immutable Data](./patterns/designing-with-immutable-data.md)
- [PAT-UPSERT-001: Canonical Upsert Helper](#pat-upsert-001-canonical-upsert-helper-create-or-update)

**See full pattern doc for:** canonical algorithm, debug recipe, anti-patterns, tradeoffs, implementation hooks.

---

### PAT-VERSION-001: Entity Versioning (Pattern A)

**Status:** ✅ Documented  
**Location:** [`patterns/entity-versioning.md`](./patterns/entity-versioning.md)

**What problem it solves:**  
When version history is a feature (document revisions, audit logs), create new entities for each change. Each version has independent identity.

**Invariants:**
- Each change creates a new entity with a new `entity_key`
- Old entities remain on-chain (immutable history)
- Queries must select the latest version by `createdAt`
- Relationships must reference stable identifiers (not `entity_key`)

**Threat model / failure modes:**
- **Query complexity:** Must always select "latest" version
- **Relationship breakage:** If relationships reference `entity_key`, they break on updates
- **Storage growth:** Creates more entities over time

**Arkiv primitives used:**
- `createEntity()` always creates new `entity_key`
- `createdAt` timestamp for version ordering
- Stable identifier (e.g., `wallet`) for relationships

**Canonical algorithm:**
1. Query all entities for identifier (e.g., `wallet`)
2. Sort by `createdAt` descending
3. Select first result as "latest version"
4. For updates: create new entity (new `entity_key`)
5. Relationships reference stable identifier (e.g., `wallet`), not `entity_key`

**Implementation hooks:**
- `lib/arkiv/profile.ts` - Legacy Pattern A implementation (before migration)
- Any entity type that needs explicit version history

**Debug recipe:**
- Query all versions: `query({ type, wallet })` returns multiple entities
- Sort by `createdAt` to find latest
- Verify relationships use stable identifiers (not `entity_key`)

**Anti-patterns:**
- ❌ Using this pattern for frequently updated entities (use Pattern B)
- ❌ Relationships referencing `entity_key` (will break on updates)
- ❌ Not sorting by `createdAt` when selecting latest

**Known tradeoffs:**
- **Version history:** Explicit version chain (each version is separate entity)
- **Query complexity:** Must always select "latest" version
- **Storage:** More storage growth over time
- **Relationships:** Must use stable identifiers, not `entity_key`

**Related patterns:**
- [PAT-UPDATE-001: Stable Entity Key Updates](./patterns/stable-entity-key-updates.md)
- [PAT-IMMUTABLE-001: Designing with Immutable Data](./patterns/designing-with-immutable-data.md)

**Full details:** See [`patterns/entity-versioning.md`](./patterns/entity-versioning.md) for canonical algorithm, debug recipe, anti-patterns, tradeoffs.

---

### PAT-DELETE-001: Deletion Patterns

**Status:** ✅ Documented  
**Location:** [`patterns/deletion-patterns.md`](./patterns/deletion-patterns.md)

**What problem it solves:**  
Arkiv entities cannot be deleted. To implement "deletion" functionality, use marker entities or status flags that change interpretation, not history.

**Invariants:**
- Entities are never actually deleted from Arkiv
- Deletion is implemented via marker entities or status flags
- Historical data remains on-chain and verifiable
- Queries filter out "deleted" entities client-side

**Threat model / failure modes:**
- **Query performance:** Requires additional query for deletion markers
- **Filtering bugs:** If deletion markers aren't checked, deleted entities appear
- **TTL mismatch:** Deletion markers should have same TTL as original entity

**Related patterns:**
- [PAT-QUERY-001: Indexer-Friendly Query Shapes](./patterns/query-optimization.md)

**Full details:** See [`patterns/deletion-patterns.md`](./patterns/deletion-patterns.md) for canonical algorithm, debug recipe, anti-patterns, tradeoffs, implementation hooks.

---

## Consistency & UX Patterns

### PAT-SESSION-001: Session State Machine

**Status:** ✅ Documented  
**Location:** [`session-state-machine.md`](./session-state-machine.md)

**What problem it solves:**  
Sessions have complex state transitions (pending → scheduled → completed). Status is computed from supporting entities, not stored directly, ensuring consistency.

**Invariants:**
- Canonical session state is derived from supporting entities
- Any stored `status` field is non-authoritative (treat as cache/hint)
- Both parties must confirm for `pending → scheduled` transition
- Requester is auto-confirmed on creation

**Threat model / failure modes:**
- **Status desync:** If `session.status` attribute doesn't match computed status
- **Missing confirmations:** If confirmation entities are missing, status is wrong
- **Race conditions:** Concurrent confirmations may create inconsistent state

**Related patterns:**
- [PAT-QUERY-001: Indexer-Friendly Query Shapes](./patterns/query-optimization.md)

**Full details:** See [`session-state-machine.md`](./session-state-machine.md) for canonical algorithm, debug recipe, anti-patterns, tradeoffs, implementation hooks.

---

### PAT-OPTIMISTIC-001: Optimistic UI + Reconciliation

**Status:** ✅ Documented  
**Location:** [`patterns/optimistic-ui-reconciliation.md`](./patterns/optimistic-ui-reconciliation.md)

**What problem it solves:**  
Blockchain writes have latency (seconds to minutes). UI should update optimistically, then reconcile with indexer truth when available.

**Invariants:**
- UI updates immediately on user action (optimistic)
- Background reconciliation checks indexer for truth
- UI shows "pending" state until reconciliation confirms
- Errors are surfaced when reconciliation fails
- Optimistic updates are reversible (rollback on failure)

**Threat model / failure modes:**
- **Transaction failures:** Optimistic update may not match reality (must rollback)
- **Indexer lag:** Reconciliation may take time (polling required)
- **Race conditions:** Multiple optimistic updates may conflict (use transaction ordering)

**Related patterns:**
- [PAT-TIMEOUT-001: Transaction Timeouts](./patterns/transaction-timeouts.md)
- [PAT-ERROR-001: Error Handling](./patterns/error-handling.md)
- [PAT-INDEXER-001: Read-Your-Writes Under Indexer Lag](#pat-indexer-001-read-your-writes-under-indexer-lag)

**Full details:** See [`patterns/optimistic-ui-reconciliation.md`](./patterns/optimistic-ui-reconciliation.md) for canonical algorithm, debug recipe, anti-patterns, tradeoffs, implementation hooks.

---

### PAT-INDEXER-001: Read-Your-Writes Under Indexer Lag

**Status:** ✅ Documented  
**Location:** [`patterns/indexer-lag-handling.md`](./patterns/indexer-lag-handling.md)

**What problem it solves:**  
Indexer lag means writes may not be immediately queryable. This pattern handles the state machine: pending → confirmed (receipt) → indexed (queryable), without conflating receipt vs indexer visibility.

**Invariants:**
- Receipt confirmation ≠ indexer visibility (distinct states)
- Read-your-writes requires polling until indexed
- Polling uses exponential backoff to avoid rate limits
- Stale-while-revalidate: Show optimistic state while polling
- Timeout after max retries (entity may be confirmed but not yet indexed)

**Threat model / failure modes:**
- **Indexer lag:** Writes confirmed but not yet queryable (polling required)
- **Polling exhaustion:** Max retries reached, entity still not visible (timeout)
- **Rate limits:** Too aggressive polling hits rate limits (use backoff)

**Related patterns:**
- [PAT-OPTIMISTIC-001: Optimistic UI + Reconciliation](./patterns/optimistic-ui-reconciliation.md)
- [PAT-TIMEOUT-001: Transaction Timeouts](./patterns/transaction-timeouts.md)

**Full details:** See [`patterns/indexer-lag-handling.md`](./patterns/indexer-lag-handling.md) for canonical algorithm, debug recipe, anti-patterns, tradeoffs, implementation hooks.

---

### PAT-IDEMPOTENT-001: Idempotent Writes

**Status:** ✅ Documented  
**Location:** [`patterns/idempotent-writes.md`](./patterns/idempotent-writes.md)

**What problem it solves:**  
Network retries, user double-clicks, or race conditions can cause duplicate writes. Idempotent writes ensure the same operation produces the same result.

**Invariants:**
- Same operation can be safely retried
- Deterministic `entity_key` derivation prevents duplicates
- Operation keys (if used) are unique per operation
- Duplicate writes are detected and ignored
- Retrying an operation produces the same result

**Threat model / failure modes:**
- **Double-submission:** User double-clicks submit button (creates duplicates)
- **Network retries:** Failed requests are retried, creating duplicates
- **Race conditions:** Concurrent writes create conflicting state

**Related patterns:**
- [PAT-UPDATE-001: Stable Entity Key Updates](./patterns/stable-entity-key-updates.md)
- [PAT-UPSERT-001: Canonical Upsert Helper](#pat-upsert-001-canonical-upsert-helper-create-or-update)

**Full details:** See [`patterns/idempotent-writes.md`](./patterns/idempotent-writes.md) for canonical algorithm, debug recipe, anti-patterns, tradeoffs, implementation hooks.

---

### PAT-UPSERT-001: Canonical Upsert Helper (Create-or-Update)

**Status:** ✅ Documented  
**Location:** [`patterns/canonical-upsert.md`](./patterns/canonical-upsert.md)

**What problem it solves:**  
The `arkivUpsertEntity()` helper provides a single canonical path for create-or-update operations, ensuring deterministic key derivation, single writer path, and consistent return values.

**Invariants:**
- Single canonical path for all create-or-update operations
- Deterministic key derivation when `key` is provided
- Consistent return values: `{ key: string, txHash: string }`
- Signer metadata is automatically added to attributes
- Transaction timeout handling is built-in

**Threat model / failure modes:**
- **Non-deterministic keys:** Random keys prevent idempotency
- **Missing key parameter:** Creates new entity instead of updating existing
- **Race conditions:** Concurrent writes may conflict

**Related patterns:**
- [PAT-UPDATE-001: Stable Entity Key Updates](./patterns/stable-entity-key-updates.md)
- [PAT-IDEMPOTENT-001: Idempotent Writes](./patterns/idempotent-writes.md)

**Full details:** See [`patterns/canonical-upsert.md`](./patterns/canonical-upsert.md) for canonical algorithm, debug recipe, anti-patterns, tradeoffs, implementation hooks.

---

## Data & Identity Patterns

### PAT-SPACE-001: Space ID as Environment Boundary

**Status:** ✅ Documented  
**Location:** [`patterns/space-isolation.md`](./patterns/space-isolation.md)

**What problem it solves:**  
`spaceId` provides data isolation between environments (test/beta/prod). Every write must include correct `spaceId`; every read must scope by `spaceId` to prevent cross-environment data leaks.

**Invariants:**
- Every write includes correct `spaceId` (from config, not hardcoded)
- Every read scopes by `spaceId` (no cross-space mixing)
- Test/beta/prod data is completely isolated
- `spaceId` is an indexed attribute for efficient queries

**Threat model / failure modes:**
- **"Works on my machine":** Data leak across spaces if `spaceId` is missing or wrong
- **Hardcoded spaceId:** Breaks when deploying to different environments
- **Missing scope:** Queries without `spaceId` filter may return wrong data

**Related patterns:**
- [Environments](../environments.md) - Complete environment setup guide
- [PAT-QUERY-001: Indexer-Friendly Query Shapes](./patterns/query-optimization.md)
- [PAT-IDENTITY-001: Wallet Normalization](./patterns/wallet-normalization.md)

**Full details:** See [`patterns/space-isolation.md`](./patterns/space-isolation.md) for canonical algorithm, debug recipe, anti-patterns, tradeoffs, implementation hooks.

---

### PAT-IDENTITY-001: Wallet Normalization + Canonical Form

**Status:** ✅ Documented  
**Location:** [`patterns/wallet-normalization.md`](./patterns/wallet-normalization.md)

**What problem it solves:**  
Wallet addresses must be normalized to lowercase for storage/query to prevent entire classes of bugs (case-sensitivity mismatches, duplicate entities, broken relationships).

**Invariants:**
- Always lowercase for storage/query (canonical form)
- Display can use checksum formatting but never as key material
- All wallet comparisons use normalized form
- Wallet attributes in entities are always lowercase

**Threat model / failure modes:**
- **Case sensitivity bugs:** `0xABC` vs `0xabc` treated as different wallets
- **Duplicate entities:** Same wallet creates multiple profiles due to case mismatch
- **Broken relationships:** References fail due to case mismatch

**Related patterns:**
- [PAT-QUERY-001: Indexer-Friendly Query Shapes](./patterns/query-optimization.md)
- [PAT-SPACE-001: Space ID as Environment Boundary](./patterns/space-isolation.md)
- [PAT-REF-001: Relationship References](#pat-ref-001-relationship-references-that-survive-updates)

**Full details:** See [`patterns/wallet-normalization.md`](./patterns/wallet-normalization.md) for canonical algorithm, debug recipe, anti-patterns, tradeoffs, implementation hooks.

---

### PAT-REF-001: Relationship References That Survive Updates

**Status:** ✅ Documented  
**Location:** [`patterns/reference-integrity.md`](./patterns/reference-integrity.md)

**What problem it solves:**  
Relationships between entities must survive updates. Use stable identifiers (wallet, stable entity_key, or explicit logical IDs) instead of volatile `entity_key` when using Pattern A.

**Invariants:**
- Relationships use stable identifiers (never change)
- Pattern B: `entity_key` is stable (relationships never break)
- Pattern A: Reference `wallet` or logical ID, not volatile `entity_key`
- Backlinks use same stable identifier strategy
- Denormalization preserves stable references

**Threat model / failure modes:**
- **Broken relationships:** Volatile `entity_key` references break when entity updates
- **Orphaned references:** References to deleted/updated entities become invalid
- **Inconsistent state:** Relationships and entities get out of sync

**Related patterns:**
- [PAT-UPDATE-001: Stable Entity Key Updates](./patterns/stable-entity-key-updates.md)
- [PAT-VERSION-001: Entity Versioning](./patterns/entity-versioning.md)

**Full details:** See [`patterns/reference-integrity.md`](./patterns/reference-integrity.md) for canonical algorithm, debug recipe, anti-patterns, tradeoffs, implementation hooks.

---

## Query & Performance Patterns

### PAT-QUERY-001: Indexer-Friendly Query Shapes

**Status:** ✅ Documented  
**Location:** [`patterns/query-optimization.md`](./patterns/query-optimization.md)

**What problem it solves:**  
Arkiv indexer has specific indexing rules. Queries must use indexed attributes first and follow indexer-friendly patterns for performance.

**Invariants:**
- Our queries *must* include `type` and `spaceId` filters
- We *always* apply a defensive limit
- We normalize wallet addresses before querying
- We prefer indexed attributes first (per current indexer behavior) ⚠️ (indexer behavior may change)

**Threat model / failure modes:**
- **Slow queries:** Non-indexed attributes cause full scans
- **Unbounded queries:** Missing `.limit()` can return huge result sets
- **Case sensitivity:** Wallet addresses must be lowercase

**Related patterns:**
- [PAT-DELETE-001: Deletion Patterns](./patterns/deletion-patterns.md) (client-side filtering)
- [PAT-IDENTITY-001: Wallet Normalization](#pat-identity-001-wallet-normalization--canonical-form)
- [PAT-SPACE-001: Space ID as Environment Boundary](#pat-space-001-space-id-as-environment-boundary)

**Full details:** See [`patterns/query-optimization.md`](./patterns/query-optimization.md) for canonical algorithm, debug recipe, anti-patterns, tradeoffs, implementation hooks.

---

### PAT-PAGINATION-001: Pagination and Cursor Conventions

**Status:** ✅ Documented  
**Location:** [`patterns/pagination-conventions.md`](./patterns/pagination-conventions.md)

**What problem it solves:**  
Large result sets need pagination. Arkiv doesn't support offset, so use cursor-based pagination or client-side pagination.

**Invariants:**
- Offset-based pagination is not supported by our current query strategy
- Use cursor-based pagination (e.g., `createdAt` timestamp)
- Or paginate client-side after fetching all results
- Always use `.limit()` to bound queries
- Cursor values must be stable and sortable

**Threat model / failure modes:**
- **Large result sets:** Missing pagination causes performance issues
- **Cursor drift:** If entities are created during pagination, cursors may skip results
- **Client-side pagination:** May fetch more data than needed

**Related patterns:**
- [PAT-QUERY-001: Indexer-Friendly Query Shapes](./patterns/query-optimization.md)

**Full details:** See [`patterns/pagination-conventions.md`](./patterns/pagination-conventions.md) for canonical algorithm, debug recipe, anti-patterns, tradeoffs, implementation hooks.

---

## Access & Privacy Patterns

### PAT-ACCESS-001: Arkiv-Native Access Grants

**Status:** ✅ Documented  
**Location:** [`access-grants.md`](./access-grants.md)

**What problem it solves:**  
Access control is modeled as Arkiv entities, not server-side permissions. Capabilities are expressed as signed data entities, enabling portable, verifiable access.

**Invariants:**
- Access state lives on Arkiv (not in localStorage or server sessions)
- Grants are signed by issuer (app signer or user wallet)
- Clients verify `issuer_wallet` to prevent user-issued grants
- Grants are queryable and portable across devices

**Threat model / failure modes:**
- **User-issued grants:** Clients must verify `issuer_wallet` matches expected signer
- **Expired grants:** Grants with `expires_at` must be checked
- **Grant revocation:** No built-in revocation (must create revocation entity)

**Related patterns:**
- [PAT-WRITE-AUTHZ-001: Server-Signed Writes](./central-signer-phase0.md)

---

### PAT-CONSENT-001: Privacy Consent State Machine

**Status:** ✅ Documented (brief)  
**Location:** [`privacy-consent.md`](./privacy-consent.md)

**What problem it solves:**  
Privacy consent is modeled as a state machine on Arkiv. Consent can be granted, revoked, and audited. All feedback/telemetry is opt-in by default.

**Invariants:**
- Consent is stored on Arkiv (not in localStorage)
- Consent can be revoked (creates revocation entity)
- All feedback/telemetry is opt-in by default
- Consent state is queryable and auditable

**Threat model / failure modes:**
- **Consent revocation:** Must create revocation entity (no built-in revocation)
- **Consent scope:** Must define what consent covers
- **Audit trail:** Consent history must be queryable

**Related patterns:**
- [PAT-ACCESS-001: Arkiv-Native Access Grants](./access-grants.md)
- [PAT-REVOKE-001: Revocation via Marker Entities](#pat-revoke-001-revocation-via-marker-entities)

**Full details:** See [`privacy-consent.md`](./privacy-consent.md) (brief doc exists, needs expansion).

---

### PAT-REVOKE-001: Revocation via Marker Entities

**Status:** ✅ Documented  
**Location:** [`patterns/revocation-pattern.md`](./patterns/revocation-pattern.md)

**What problem it solves:**  
Arkiv has no built-in revocation. To revoke grants, consent, invites, or any capability-like entity, create a revocation marker entity that indicates the original entity is revoked.

**Invariants:**
- Revocation is implemented via marker entities (not entity deletion)
- Revocation markers reference the original entity (via `entity_key` or logical ID)
- Queries check for revocation markers before granting access
- Revocation is queryable and auditable
- Revocation markers have same TTL as original entity (or longer)

**Threat model / failure modes:**
- **Missing revocation check:** If queries don't check revocation markers, revoked grants still work
- **Revocation timing:** Revocation markers may not be immediately queryable (indexer lag)
- **TTL mismatch:** Revocation markers with shorter TTL than original entity expire first

**Related patterns:**
- [PAT-ACCESS-001: Arkiv-Native Access Grants](./access-grants.md)
- [PAT-CONSENT-001: Privacy Consent State Machine](./privacy-consent.md)
- [PAT-INDEXER-001: Read-Your-Writes Under Indexer Lag](./patterns/indexer-lag-handling.md)

**Full details:** See [`patterns/revocation-pattern.md`](./patterns/revocation-pattern.md) for canonical algorithm, debug recipe, anti-patterns, tradeoffs, implementation hooks.

**Applies to:** grants (PAT-ACCESS-001), consent (PAT-CONSENT-001), invites, any capability-like entity.

---

## Auth & Signing Patterns

### PAT-WRITE-AUTHZ-001: Server-Signed Writes (Phase 0)

**Status:** ✅ Documented  
**Location:** [`central-signer-phase0.md`](./central-signer-phase0.md)

**What problem it solves:**  
During beta, all server-side transactions are signed by a single server wallet. This is a **write-authorization pattern** (who signs Arkiv tx), separate from authentication (who the user is).

**Invariants:**
- All server-side writes are signed by server signer wallet
- User identity (`wallet` attribute) is separate from signing wallet (`signer_wallet` metadata)
- Client must verify that entities include both subject wallet identity and signer identity, and must not confuse them
- All entities include `signer_wallet` metadata for auditability
- User wallets don't need funds (server pays gas)

**Boundary with auth:**
- **Auth (PAT-AUTH-001):** Proves user wallet identity
- **Write authorization (this pattern):** Authorizes chain writes via server signer

**Threat model / failure modes:**
- **Signer compromise:** If server signer is compromised, all writes are at risk
- **Trust required:** Users must trust server to sign transactions correctly
- **Not fully decentralized:** Central signer is not fully trustless

**Related patterns:**
- [PAT-AUTH-001: Wallet Authentication Flow](#pat-auth-001-wallet-authentication-flow) - User identity proof (separate concern)

**Full details:** See [`central-signer-phase0.md`](./central-signer-phase0.md) for canonical algorithm, debug recipe, anti-patterns, tradeoffs, implementation hooks.

---

### PAT-AUTH-001: Wallet Authentication Flow

**Status:** ✅ Documented  
**Location:** [`wallet-authentication-flow.md`](./wallet-authentication-flow.md)

**What problem it solves:**  
Users authenticate via MetaMask wallet connection. The flow handles mobile/desktop, SDK fallbacks, chain switching, and onboarding redirects.

**Invariants:**
- An authenticated user is represented by a wallet address proven via wallet provider
- Auth state can be restored after refresh
- Disconnect clears persisted auth state
- Chain switching is best-effort and must not brick login
- Onboarding redirect based on user level (0 → onboarding, >0 → dashboard)

**Current implementation notes:** ✅ verified
- Wallet address stored in `localStorage` as `wallet_address` (✅ verified: `lib/auth/metamask.ts`, `app/auth/page.tsx`)
- Connection method stored as `wallet_connection_method` (✅ verified: `app/auth/page.tsx`)
- Chain switching happens AFTER connection (not before)

**Threat model / failure modes:**
- **Mobile detection:** Must detect mobile browser and use appropriate connection method
- **Chain switching:** May fail (non-critical, user can continue)
- **Permission revocation:** Must handle revoked permissions gracefully

**Related patterns:**
- [PAT-WRITE-AUTHZ-001: Server-Signed Writes](./central-signer-phase0.md)

---

### PAT-TIMEOUT-001: Transaction Timeouts

**Status:** ✅ Documented  
**Location:** [`patterns/transaction-timeouts.md`](./patterns/transaction-timeouts.md)

**What problem it solves:**  
Arkiv transactions can take time to confirm. Timeout handling ensures UI doesn't hang indefinitely and provides graceful degradation.

**Invariants:**
- All transactions have timeout (✅ verified: SDK handles timeout, wrapper handles receipt timeouts in `lib/arkiv/transaction-utils.ts`)
- Timeout errors are retryable (with backoff)
- Receipt waiting is optional (entity may still be created)
- User feedback shows pending state during timeout

**Threat model / failure modes:**
- **Network issues:** Transactions may timeout due to network problems
- **Gas issues:** Transactions may fail due to insufficient gas
- **Indexer lag:** Receipt may not be available immediately

**Threat model / failure modes:**
- **Network issues:** Transactions may timeout due to network problems
- **Gas issues:** Transactions may fail due to insufficient gas
- **Indexer lag:** Receipt may not be available immediately

**Timeout configuration:** ✅ verified (SDK handles transaction submission timeout; wrapper handles receipt timeouts)

**Implementation hooks:** ✅ verified: `lib/arkiv/transaction-utils.ts::handleTransactionWithTimeout()` (handles receipt timeouts, retry logic, error classification)

**Related patterns:**
- [PAT-ERROR-001: Error Handling](./patterns/error-handling.md)
- [PAT-OPTIMISTIC-001: Optimistic UI + Reconciliation](#pat-optimistic-001-optimistic-ui--reconciliation)

**Full details:** See [`patterns/transaction-timeouts.md`](./patterns/transaction-timeouts.md) for canonical algorithm, debug recipe, anti-patterns, tradeoffs.

---

### PAT-ERROR-001: Error Handling

**Status:** ✅ Documented  
**Location:** [`patterns/error-handling.md`](./patterns/error-handling.md)

**What problem it solves:**  
Robust error handling is essential for reliable Arkiv integration. Errors must be categorized, user-friendly, and recoverable.

**Invariants:**
- All errors are categorized (network, timeout, validation, etc.)
- User-facing errors are user-friendly (not technical)
- Errors are recoverable (retry, fallback, etc.)
- Technical errors are logged for debugging

**Threat model / failure modes:**
- **Network errors:** Transient failures should be retried
- **Validation errors:** Should be caught before transaction submission
- **Timeout errors:** Should allow retry with backoff
- **Unknown errors:** Should be logged and shown as generic error

**Related patterns:**
- [PAT-TIMEOUT-001: Transaction Timeouts](./patterns/transaction-timeouts.md)

**Full details:** See [`patterns/error-handling.md`](./patterns/error-handling.md) for canonical algorithm, debug recipe, anti-patterns, tradeoffs, implementation hooks.

---

## Code Cross-References

**Implementation Status Legend:**
- ✅ **verified:** Code references verified in codebase
- ⚠️ **unverified:** Code exists but references not yet verified (needs verification pass)
- ⚠️ **needs implementation:** Pattern documented but not yet implemented in code

### Pattern → Implementation Mapping

| Pattern ID | Pattern Name | Primary Implementation | Status |
|------------|--------------|----------------------|--------|
| PAT-IMMUTABLE-001 | Designing with Immutable Data | ✅ verified: `lib/arkiv/entity-utils.ts::arkivUpsertEntity()`, all `createEntity()`/`updateEntity()` calls | ✅ verified |
| PAT-UPDATE-001 | Stable Entity Key Updates | ✅ verified: `lib/arkiv/entity-utils.ts::arkivUpsertEntity()`, `lib/arkiv/profile.ts::createUserProfile()` | ✅ verified |
| PAT-VERSION-001 | Entity Versioning | ✅ verified: `lib/arkiv/profile.ts::getProfileByWallet()` (legacy Pattern A), `lib/arkiv/learnerQuest.ts::updateLearnerQuest()` | ✅ verified |
| PAT-DELETE-001 | Deletion Patterns | ✅ verified: `lib/arkiv/availability.ts::deleteAvailability()` (marker), `lib/arkiv/learningFollow.ts::unfollowSkill()` (status flag), `lib/arkiv/notifications.ts::archiveNotification()` (status flag) | ✅ verified |
| PAT-SESSION-001 | Session State Machine | ✅ verified: `lib/arkiv/sessions.ts::listSessions()` (computes status from confirmations, rejects stored status) | ✅ verified |
| PAT-OPTIMISTIC-001 | Optimistic UI + Reconciliation | ✅ verified: `app/notifications/page.tsx`, `lib/arkiv/transaction-utils.ts` | ✅ verified |
| PAT-INDEXER-001 | Read-Your-Writes Under Indexer Lag | ✅ verified: `app/api/skills/route.ts`, `app/notifications/page.tsx` | ✅ verified |
| PAT-IDEMPOTENT-001 | Idempotent Writes | ✅ verified: `lib/arkiv/metaLearningQuest.ts`, `lib/arkiv/authIdentity.ts`, `lib/arkiv/profile.ts` | ✅ verified |
| PAT-QUERY-001 | Indexer-Friendly Query Shapes | ✅ verified: `lib/arkiv/profile.ts::listUserProfiles()`, `lib/arkiv/sessions.ts::listSessions()`, all `buildQuery().where(eq(...)).limit().fetch()` patterns | ✅ verified |
| PAT-PAGINATION-001 | Pagination Conventions | ✅ verified: `lib/arkiv/profile.ts`, `lib/arkiv/asks.ts`, `lib/arkiv/offers.ts` | ✅ verified |
| PAT-REF-001 | Relationship References | ✅ verified: `lib/arkiv/profile.ts`, `lib/arkiv/notificationPreferences.ts`, `lib/arkiv/learnerQuest.ts` | ✅ verified |
| PAT-UPSERT-001 | Canonical Upsert Helper | ✅ verified: `lib/arkiv/entity-utils.ts::arkivUpsertEntity()` | ✅ verified |
| PAT-SPACE-001 | Space ID as Environment Boundary | ✅ verified: `lib/config.ts::SPACE_ID` | ✅ verified |
| PAT-IDENTITY-001 | Wallet Normalization | ✅ verified: `lib/arkiv/profile.ts`, `lib/identity/rootIdentity.ts` | ✅ verified |
| PAT-REVOKE-001 | Revocation via Marker Entities | ✅ verified: `lib/arkiv/revocation.ts`, `lib/arkiv/grant-revocation.ts`, `lib/arkiv/reviewModeGrant.ts` | ✅ verified |
| PAT-ACCESS-001 | Arkiv-Native Access Grants | ✅ verified: `lib/arkiv/reviewModeGrant.ts::issueReviewModeGrant()`, `getLatestValidReviewModeGrant()` | ✅ verified |
| PAT-CONSENT-001 | Privacy Consent State Machine | ⚠️ documented but not implemented: Pattern described in `privacy-consent.md`, no implementation code exists | ⚠️ needs implementation |
| PAT-WRITE-AUTHZ-001 | Server-Signed Writes | ✅ verified: `lib/arkiv/signer-metadata.ts::addSignerMetadata()`, `lib/arkiv/reviewModeGrant.ts::issueReviewModeGrant()` (server signer) | ✅ verified |
| PAT-AUTH-001 | Wallet Authentication Flow | ✅ verified: `lib/auth/metamask.ts::connectWallet()`, `requestAccounts()`, `switchChain()` | ✅ verified |
| PAT-TIMEOUT-001 | Transaction Timeouts | ✅ verified: `lib/arkiv/transaction-utils.ts::handleTransactionWithTimeout()` (30s timeout, retry logic) | ✅ verified |
| PAT-ERROR-001 | Error Handling | ✅ verified: `lib/arkiv/transaction-utils.ts::handleTransactionWithTimeout()` (error classification, user-friendly messages) | ✅ verified |

### Implementation → Pattern Mapping

| File | Patterns Used | Status |
|------|---------------|--------|
| ✅ verified: `lib/arkiv/entity-utils.ts` | PAT-IMMUTABLE-001, PAT-UPDATE-001, PAT-IDEMPOTENT-001, PAT-UPSERT-001, PAT-WRITE-AUTHZ-001 | ✅ verified |
| ✅ verified: `lib/arkiv/profile.ts` | PAT-UPDATE-001, PAT-QUERY-001, PAT-PAGINATION-001 | ✅ verified |
| ✅ verified: `lib/arkiv/sessions.ts` | PAT-SESSION-001, PAT-QUERY-001 | ✅ verified |
| ✅ verified: `lib/arkiv/transaction-utils.ts` | PAT-TIMEOUT-001, PAT-ERROR-001, PAT-OPTIMISTIC-001 | ✅ verified |
| ✅ verified: `lib/arkiv/signer-metadata.ts` | PAT-WRITE-AUTHZ-001 | ✅ verified |
| ✅ verified: `lib/auth/metamask.ts` | PAT-AUTH-001 | ✅ verified |
| ✅ verified: `app/api/profile/route.ts` | PAT-UPDATE-001, PAT-ERROR-001 | ✅ verified |
| ✅ verified: `app/api/sessions/route.ts` | PAT-SESSION-001, PAT-ERROR-001 | ✅ verified |

---

## Document Classification

### Patterns (Reusable Implementation Methods)

✅ **Fully Documented:**
- `patterns/designing-with-immutable-data.md` → PAT-IMMUTABLE-001
- `patterns/entity-versioning.md` → PAT-VERSION-001
- `patterns/stable-entity-key-updates.md` → PAT-UPDATE-001
- `patterns/deletion-patterns.md` → PAT-DELETE-001
- `patterns/error-handling.md` → PAT-ERROR-001
- `patterns/query-optimization.md` → PAT-QUERY-001
- `patterns/transaction-timeouts.md` → PAT-TIMEOUT-001
- `patterns/optimistic-ui-reconciliation.md` → PAT-OPTIMISTIC-001
- `patterns/idempotent-writes.md` → PAT-IDEMPOTENT-001
- `patterns/pagination-conventions.md` → PAT-PAGINATION-001
- `patterns/canonical-upsert.md` → PAT-UPSERT-001
- `patterns/indexer-lag-handling.md` → PAT-INDEXER-001
- `patterns/reference-integrity.md` → PAT-REF-001
- `patterns/revocation-pattern.md` → PAT-REVOKE-001
- `patterns/wallet-normalization.md` → PAT-IDENTITY-001
- `patterns/space-isolation.md` → PAT-SPACE-001
- `session-state-machine.md` → PAT-SESSION-001
- `access-grants.md` → PAT-ACCESS-001
- `central-signer-phase0.md` → PAT-WRITE-AUTHZ-001
- `wallet-authentication-flow.md` → PAT-AUTH-001 (flow doc; pattern extraction needed)

**Note:** All patterns listed above are now fully documented. Implementation status is tracked in the "Code Cross-References" section below.

### Entity Specs (Schema Definitions)

- `profile.md` - Profile entity schema
- `session.md` - Session entity schema
- `ask.md` - Ask entity schema
- `offer.md` - Offer entity schema
- `skill.md` - Skill entity schema
- `availability.md` - Availability entity schema
- `data-model.md` - Complete data model reference
- `entity-overview.md` - Entity schema overview

### Systems (Composed Features/Services)

- `invite-code-system.md` - Invite code system design
- `environments.md` - Environment configuration (mostly ops, not patterns)

### Flows (User/API Sequences)

- `profile-creation-flow.md` - Profile creation sequence (should reference patterns, not embed them)
- `wallet-authentication-flow.md` - Auth flow (flow doc; pattern PAT-AUTH-001 should reference this)

### References (Glossary, Overview, FAQs)

- `overview.md` - Arkiv overview
- `implementation-faq.md` - Implementation FAQ
- `wallet-architecture.md` - Wallet architecture reference
- `sdk-api-verification-guide.md` - SDK API verification (likely becomes PAT-VERIFY-001: SDK/API Verification)

---

## Next Steps

1. ~~**Add "Patterns Used" sections** to entity specs:~~ ✅ Complete
   - ✅ `profile.md` → PAT-UPDATE-001, PAT-QUERY-001, PAT-IDENTITY-001, PAT-SPACE-001
   - ✅ `session.md` → PAT-SESSION-001, PAT-QUERY-001, PAT-REF-001, PAT-SPACE-001
   - ✅ `ask.md` → PAT-QUERY-001, PAT-REF-001, PAT-SPACE-001
   - ✅ `offer.md` → PAT-QUERY-001, PAT-REF-001, PAT-SPACE-001
   - ✅ `availability.md` → PAT-DELETE-001, PAT-QUERY-001, PAT-SPACE-001

3. **Create public-facing "Top 8 Patterns" page** for beta docs:
   - PAT-IMMUTABLE-001: Designing with Immutable Data
   - PAT-UPDATE-001: Stable Entity Key Updates
   - PAT-SESSION-001: Session State Machine
   - PAT-ACCESS-001: Arkiv-Native Access Grants
   - PAT-QUERY-001: Indexer-Friendly Query Shapes
   - PAT-ERROR-001: Error Handling
   - PAT-TIMEOUT-001: Transaction Timeouts
   - PAT-AUTH-001: Wallet Authentication Flow

4. **Refactor flow docs** to reference patterns:
   - `profile-creation-flow.md` → reference PAT-UPDATE-001, PAT-ERROR-001
   - `wallet-authentication-flow.md` → already a pattern (PAT-AUTH-001)

---

**Last Updated:** 2025-12-30  

