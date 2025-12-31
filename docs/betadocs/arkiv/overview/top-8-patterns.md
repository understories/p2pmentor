# Top 8 Arkiv Patterns

Essential patterns for building on Arkiv. These patterns solve the most common problems you'll encounter when integrating Arkiv into your application.

Some details depend on current SDK/indexer behavior. See the full pattern docs for verified code pointers and implementation notes.

## 1. PAT-IMMUTABLE-001: Designing with Immutable Data

**Location:** [`patterns/designing-with-immutable-data.md`](./patterns/designing-with-immutable-data.md)

**What problem it solves:**  
Arkiv transactions are immutable, but application data can be mutable at the state level. This fundamental constraint shapes how we design features and user experiences.

**Key points:**
- Transactions cannot be modified after creation
- Entity **state** can be updated by writing new transactions that target a stable `entity_key`, preserving identity while keeping history immutable
- Deletion changes interpretation, not history (use marker entities or status flags)
- UX must reflect uncertainty and latency inherent in blockchain operations

**When to use:** Always. This is the foundational pattern for all Arkiv development.

**See pattern [PAT-IMMUTABLE-001](/docs/arkiv/patterns/designing-with-immutable-data.md) for the canonical rule.**

---

## 2. PAT-UPDATE-001: Stable Entity Key Updates

**Location:** [`patterns/stable-entity-key-updates.md`](./patterns/stable-entity-key-updates.md)

**What problem it solves:**  
Frequently updated entities (profiles, preferences, notifications) need stable identity for relationships and simpler queries. This pattern reuses the same `entity_key` for all updates.

**Key points:**
- Same `entity_key` is reused for all updates to an entity
- Entity identity never changes (relationships don't break)
- Query by `entity_key` always returns current state
- Transaction history is preserved (all updates are queryable)

**When to use:** For frequently updated entities like profiles, preferences, notifications, or any entity that needs stable identity.

**See pattern [PAT-UPDATE-001](/docs/arkiv/patterns/stable-entity-key-updates.md) for the canonical rule.**

**Alternative:** [PAT-VERSION-001: Entity Versioning](/docs/arkiv/patterns/entity-versioning.md) for when version history is a feature.

---

## 3. PAT-SESSION-001: Session State Machine

**Location:** [`flows/session-state-machine.md`](/docs/arkiv/flows/session-state-machine.md)

**What problem it solves:**  
Sessions have complex state transitions (pending → scheduled → completed). Status is computed from supporting entities, not stored directly, ensuring consistency.

**Key points:**
- Canonical session state is derived from supporting entities
- Any stored `status` field is non-authoritative (treat as cache/hint)
- Both parties must confirm for `pending → scheduled` transition
- Requester is auto-confirmed on creation

**When to use:** For any entity with complex state transitions that depend on multiple supporting entities or multi-party interactions (sessions are a canonical example).

**See pattern [PAT-SESSION-001](../flows/session-state-machine.md) for the canonical rule.**

---

## 4. PAT-ACCESS-001: Arkiv-Native Access Grants

**Location:** [`access-grants.md`](./access-grants.md)

**What problem it solves:**  
Access control is modeled as Arkiv entities, not server-side permissions. Capabilities are expressed as signed data entities, enabling portable, verifiable access.

**Key points:**
- Access state lives on Arkiv (not in localStorage or server sessions)
- Grants are signed by issuer (app signer or user wallet)
- Clients verify `issuer_wallet` to prevent user-issued grants
- Grants are queryable and portable across devices

**When to use:** For any access control, capability, or permission system where you want portable, verifiable grants.

**See pattern [PAT-ACCESS-001](../operations/access-grants.md) for the canonical rule.**

---

## 5. PAT-QUERY-001: Indexer-Friendly Query Shapes

**Location:** [`patterns/query-optimization.md`](./patterns/query-optimization.md)

**What problem it solves:**  
Arkiv queries must be optimized for indexer performance. This pattern ensures queries use indexed attributes, limits, and client-side filtering.

**Key points:**
- In p2pmentor, queries **must** include `type` and `spaceId` filters to stay indexer-friendly and avoid cross-space data mixing
- Always use `limit()` to bound result sets
- Client-side filtering for complex conditions (indexer doesn't support all operators)
- Offset-based pagination is not supported by our current query strategy

**When to use:** For all queries. This is a fundamental requirement for efficient Arkiv queries.

**See pattern [PAT-QUERY-001](../patterns/query-optimization.md) for the canonical rule.**

---

## 6. PAT-ERROR-001: Error Handling

**Location:** [`patterns/error-handling.md`](./patterns/error-handling.md)

**What problem it solves:**  
Robust error handling is essential for reliable Arkiv integration. Errors must be categorized, user-friendly, and recoverable.

**Key points:**
- All errors are categorized (network, timeout, validation, etc.)
- User-facing errors are friendly and actionable
- Errors are retryable when appropriate (with backoff)
- Error context is preserved for debugging

**When to use:** Always. All Arkiv operations should have proper error handling.

**See pattern [PAT-ERROR-001](../patterns/error-handling.md) for the canonical rule.**

---

## 7. PAT-TIMEOUT-001: Transaction Timeouts

**Location:** [`patterns/transaction-timeouts.md`](./patterns/transaction-timeouts.md)

**What problem it solves:**  
Arkiv transactions can take time to confirm. Timeout handling ensures UI doesn't hang indefinitely and provides graceful degradation.

**Key points:**
- All transaction flows enforce timeouts so the UI never waits forever
- Receipt/indexer waiting is best-effort and must degrade gracefully
- Timeout errors are retryable (with backoff)
- User feedback shows pending state during timeout

**When to use:** For all transaction operations. Essential for good UX on blockchain applications.

**See pattern [PAT-TIMEOUT-001](../patterns/transaction-timeouts.md) for the canonical rule.**

---

## 8. PAT-AUTH-001: Wallet Authentication Flow

**Location:** [`wallet-authentication-flow.md`](./wallet-authentication-flow.md)

**What problem it solves:**  
Users authenticate via MetaMask wallet connection. The flow handles mobile/desktop, SDK fallbacks, chain switching, and onboarding redirects.

**Key points:**
- An authenticated user is represented by a wallet address proven via wallet provider
- Auth state can be restored after refresh
- Disconnect clears persisted auth state
- Chain switching is best-effort and must not brick login
- Onboarding redirect based on user level (0 → onboarding, >0 → dashboard)
- Note: authentication proves user identity; write authorization may be server-signed during beta (see central signer pattern)

**When to use:** For any application that requires wallet-based authentication.

**See pattern [PAT-AUTH-001](../operations/wallet-authentication-flow.md) for the canonical rule.**

---

## Full Pattern Catalog

For the complete list of all patterns, see the [Arkiv Patterns Catalog](../patterns/README.md).

## Related Documentation

- [Arkiv Overview](./overview.md) - Introduction to Arkiv
- [Entity Overview](./entity-overview.md) - Understanding Arkiv entities
- [Implementation FAQ](../operations/implementation-faq.md) - Common questions and answers
- [Server-Signed Writes (Phase 0)](../operations/central-signer-phase0.md) - Write authorization pattern (separate from authentication)

