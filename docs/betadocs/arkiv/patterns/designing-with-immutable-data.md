# Designing with Immutable Data

## Core Principles

When building on Arkiv, data is append-only. This fundamental constraint shapes how we design features and user experiences.

## Data is Append-Only

Entities cannot be modified after creation. Updates create new entities. The latest version is determined by querying and selecting the most recent entity, not by mutating an existing record.

## Updates are New Entities

When a user updates their profile, we create a new `user_profile` entity. The old entity remains on-chain. Queries select the latest entity based on `createdAt` timestamp or by querying all versions and selecting the most recent.

See [Entity Versioning](entity-versioning.md) for implementation patterns.

## Deletion Changes Interpretation, Not History

Entities cannot be deleted from Arkiv. To "delete" data, we change its interpretation:

- Status fields: Mark entities as `deleted` or `archived` via status attribute
- Filtering: Exclude entities from queries based on status
- Expiration: Use TTL to let entities expire naturally

The historical data remains on-chain and verifiable. See [Deletion Patterns](deletion-patterns.md) for details.

## UX Must Reflect Uncertainty and Latency

Blockchain operations have inherent latency and uncertainty:

- **Pending states**: Show "pending" or "submitting" while transactions are in flight
- **Timeout handling**: Gracefully handle transaction receipt timeouts
- **Optimistic updates**: Update UI optimistically, but show when data is unconfirmed
- **Error recovery**: Allow retries and show clear error messages

See [Error Handling](error-handling.md) and [Transaction Timeouts](transaction-timeouts.md) for patterns.

