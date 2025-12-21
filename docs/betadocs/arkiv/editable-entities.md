# Editable Entities on a Blockchain (Arkiv Mental Model)

**Audience:** Builders, contributors, and curious users  
**Purpose:** Explain how entities on Arkiv can be "updated" while remaining fully blockchain-native

---

## The Common Confusion

A frequent misconception when building on blockchains is:

> "Blockchains are immutable, therefore data cannot be edited."

This is **partially true**, but incomplete.

- Blockchains are **immutable at the transaction level**
- Application data is **mutable at the state level**

Arkiv follows this same principle.

---

## What Is Actually Immutable?

On Arkiv (as on any blockchain):

- **Transactions are immutable**
- **Event history is immutable**
- **Past states are never deleted or rewritten**

Once something is written to the chain, it stays there forever.

---

## What *Is* Mutable?

What *can* change is the **latest state derived from those transactions**.

Arkiv exposes this through **entities**.

An Arkiv entity has:
- a stable **entity_key** (identity)
- a payload and attributes (state)
- a full transaction history behind it

When an entity is "updated," Arkiv does **not** rewrite history.

Instead, it appends a new transaction that says:

> "For entity_key = X, the new state is Y."

---

## Create vs Update: Two Valid Blockchain Patterns

Both of the following are blockchain-valid, but they behave very differently for applications.

### Pattern A: New Entity per Change (Append-Only Versions)

**How it works:**
- Every change creates a **new entity** with a new `entity_key`
- Old entities remain on-chain (immutable history)
- To get the "current" version, query all entities and select the latest by `createdAt`

**Example:**
```typescript
// First profile creation
const profile1 = await createEntity({
  type: 'user_profile',
  wallet: '0x123...',
  displayName: 'Alice',
  // ... entity_key: 'abc123'
});

// Profile update creates NEW entity
const profile2 = await createEntity({
  type: 'user_profile',
  wallet: '0x123...',
  displayName: 'Alice Updated',
  // ... entity_key: 'def456' (different!)
});

// To get current profile:
const profiles = await query({ type: 'user_profile', wallet: '0x123...' });
const current = profiles.sort((a, b) => 
  new Date(b.createdAt) - new Date(a.createdAt)
)[0]; // profile2
```

**Characteristics:**
- ✅ Full version history preserved
- ✅ Simple to implement (just create)
- ❌ Queries must select "latest" version
- ❌ Relationships can break if they reference `entity_key`
- ❌ More storage over time

**When to use:**
- Audit trails are critical
- Version history is a feature
- Entities are rarely updated
- Relationships don't depend on stable `entity_key`

### Pattern B: Update in Place (Stable Entity Key)

**How it works:**
- Reuse the same `entity_key` for updates
- New transaction updates the entity's state
- Query by `entity_key` always returns current state
- Transaction history remains queryable

**Example:**
```typescript
// First profile creation
const profile = await createEntity({
  type: 'user_profile',
  wallet: '0x123...',
  displayName: 'Alice',
  // ... entity_key: 'abc123'
});

// Profile update reuses SAME entity_key
const updated = await updateEntity({
  entity_key: 'abc123', // Same key!
  displayName: 'Alice Updated',
});

// To get current profile:
const current = await query({ entity_key: 'abc123' }); // Always current
```

**Characteristics:**
- ✅ Simple queries (no "latest" selection needed)
- ✅ Stable relationships (entity_key never changes)
- ✅ Less storage over time
- ✅ Transaction history still queryable
- ❌ No explicit version chain (but history exists)

**When to use:**
- Entities are frequently updated
- Relationships depend on stable identity
- Simpler queries are preferred
- Current state is more important than version history

---

## How Arkiv Handles Updates

Arkiv supports **both patterns**:

1. **Create new entity**: `walletClient.createEntity()` - always creates a new `entity_key`
2. **Update existing entity**: `walletClient.updateEntity()` - reuses existing `entity_key`

Both operations:
- Create immutable transactions
- Preserve full transaction history
- Are queryable via Arkiv's indexer
- Cost gas (transaction fees)

The key difference is whether the `entity_key` changes.

---

## Which Pattern Does p2pmentor Use?

p2pmentor uses **Pattern B (Update in Place)** for mutable entities:

- **Profiles**: Stable `entity_key` per wallet
- **Notification preferences**: Stable `entity_key` per `(wallet, notification_id)`
- **Sessions**: Stable `entity_key` (once created, never changes)

This ensures:
- Relationships don't break (feedback always points to same session)
- Queries are simpler (no "latest version" selection)
- State persists correctly (notification read/unread state)

**Migration:** p2pmentor previously used Pattern A (create new entity on update) but migrated to Pattern B to fix relationship breakage and state persistence issues. This migration is documented in the internal implementation plan.

---

## Transaction History Is Always Preserved

Even with Pattern B (update in place), **all transaction history is preserved**:

- Every update creates a new transaction
- All transactions are queryable via Arkiv's indexer
- You can reconstruct the full history of any entity
- Explorer links show all transactions for an entity

The difference is:
- **Pattern A**: Explicit version chain (each version is a separate entity)
- **Pattern B**: Implicit version history (all transactions for one entity_key)

Both provide complete audit trails.

---

## Implementation Details

### Entity Key Stability

For Pattern B to work, entities need **stable identity**:

```typescript
// Profile: wallet address is stable identity
const profileKey = deriveProfileKey(wallet); // Deterministic

// Notification preference: (wallet, notification_id) is stable identity
const prefKey = derivePreferenceKey(wallet, notificationId); // Deterministic

// Session: session identifier is stable (never changes after creation)
const sessionKey = session.entity_key; // Set once, never changes
```

### Migration Mode

p2pmentor uses a **migration mode flag** to safely transition from Pattern A to Pattern B:

- `ENTITY_UPDATE_MODE = off`: Use Pattern A (create new entity)
- `ENTITY_UPDATE_MODE = shadow`: Validate both patterns work
- `ENTITY_UPDATE_MODE = on`: Use Pattern B (update in place)

Per-wallet migration markers ensure deterministic behavior per user.

### Query Paths

**Pattern A queries:**
```typescript
// Must select latest version
const profiles = await query({ type: 'user_profile', wallet });
const current = profiles.sort((a, b) => 
  new Date(b.createdAt) - new Date(a.createdAt)
)[0];
```

**Pattern B queries:**
```typescript
// Direct query by entity_key (always current)
const profile = await query({ entity_key: profileKey });
// Or query by wallet (should only be one)
const profiles = await query({ type: 'user_profile', wallet });
const current = profiles[0]; // Only one canonical entity
```

---

## Common Questions

### Q: Can I still see the history of an entity?

**A:** Yes! All transactions are preserved. You can query transaction history for any `entity_key` via Arkiv's indexer or explorer.

### Q: What happens if two updates happen simultaneously?

**A:** Last-write-wins (or merge strategy, depending on field). Arkiv processes transactions in order. Concurrent updates create sequential transactions.

### Q: Can I revert to Pattern A if needed?

**A:** Yes, but it requires migration. The migration mode flag allows rollback. Old entities remain on-chain, so you can always reconstruct history.

### Q: Does updating cost the same as creating?

**A:** Yes, both create transactions and cost gas. The difference is whether a new `entity_key` is created or an existing one is reused.

### Q: What about relationships that reference entity_key?

**A:** Pattern B ensures relationships never break because `entity_key` is stable. Pattern A requires relationships to reference stable identifiers (like `wallet`) instead of `entity_key`.

---

## See Also

- [Entity Versioning Patterns](/docs/arkiv/patterns/entity-versioning.md) - Pattern A implementation details
- [Implementation FAQ](/docs/arkiv/implementation-faq.md) - Common patterns and Q&A
- [Arkiv Overview](/docs/arkiv/overview.md) - Core Arkiv concepts
- [Entity Overview](/docs/arkiv/entity-overview.md) - Entity schemas and structure

---

## Summary

**Key Takeaways:**

1. **Blockchains are immutable at the transaction level, mutable at the state level**
2. **Arkiv supports both patterns**: create new entity (Pattern A) or update in place (Pattern B)
3. **p2pmentor uses Pattern B** for mutable entities to ensure stable relationships and simpler queries
4. **Transaction history is always preserved** regardless of pattern
5. **Entity keys provide stable identity** for relationships and queries

The choice between patterns depends on your application's needs:
- **Pattern A**: When version history is a feature
- **Pattern B**: When stable relationships and simpler queries are priorities

