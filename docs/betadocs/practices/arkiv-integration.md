# Arkiv Integration Principles

## Treat Arkiv as the primary data store

All core data lives on Arkiv. Any additional storage is viewed as cache or index, not the source of truth.

## Encapsulate Arkiv operations

Encapsulate Arkiv operations behind clearly named functions. Keep entity schemas simple and composable. Prefer additional entities for new concerns over overloading a single entity.

## Query patterns

- Filter by `type` and by wallet or skill attributes
- Limit and pagination set defensively to avoid unbounded queries
- Use `withAttributes(true)` and `withPayload(true)` explicitly

## Entity design

- Keep entities focused and composable
- Use separate entities for transaction hash tracking (subject to future simplification)
- Use TTL for ephemeral entities (asks, offers)
- Entities are immutable - updates create new entities

See [`docs/dx_arkiv_runbook.md`](../../../dx_arkiv_runbook.md) for detailed patterns and examples.
