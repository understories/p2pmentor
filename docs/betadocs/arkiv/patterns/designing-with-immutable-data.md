# Designing with Immutable Data

## Core Principles

When building on Arkiv, transactions are immutable, but application data can be mutable at the state level. This fundamental constraint shapes how we design features and user experiences.

## Transactions are Immutable

Transactions cannot be modified after creation. Each entity mutation (create or update) creates a new immutable transaction. However, entities can be updated in place using stable entity keys, preserving identity while maintaining full transaction history.

## Update Patterns

Arkiv supports two update patterns:

**Pattern A: Create New Entity per Change** (for versioning scenarios)
- Each change creates a new entity with a new `entity_key`
- Queries must select the latest version by `createdAt`
- Use for: document revisions, immutable audit logs, version history as a feature

**Pattern B: Update in Place** (for mutable application state) ⭐ **Recommended for most cases**
- Reuse the same `entity_key` for updates
- Query by `entity_key` always returns current state
- Use for: profiles, preferences, notifications, frequently updated entities

p2pmentor uses **Pattern B** for mutable entities. See [Editable Entities](/docs/arkiv/overview/editable-entities) for details on how updates work with stable entity keys.

For Pattern A (versioning), see [Entity Versioning](/docs/arkiv/patterns/entity-versioning) for implementation patterns.

## Deletion Changes Interpretation, Not History

Entities cannot be deleted from Arkiv. To "delete" data, we change its interpretation:

- Status fields: Mark entities as `deleted` or `archived` via status attribute
- Filtering: Exclude entities from queries based on status
- Expiration: Use TTL to let entities expire naturally

The historical data remains on-chain and verifiable. See [Deletion Patterns](/docs/arkiv/patterns/deletion-patterns) for details.

## UX Must Reflect Uncertainty and Latency

Blockchain operations have inherent latency and uncertainty:

- **Pending states**: Show "pending" or "submitting" while transactions are in flight
- **Timeout handling**: Gracefully handle transaction receipt timeouts
- **Optimistic updates**: Update UI optimistically, but show when data is unconfirmed
- **Error recovery**: Allow retries and show clear error messages

See [Error Handling](/docs/arkiv/patterns/error-handling) and [Transaction Timeouts](/docs/arkiv/patterns/transaction-timeouts) for patterns.

