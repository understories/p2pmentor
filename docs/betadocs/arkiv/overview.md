# Arkiv Data Model Overview

This section covers Arkiv-specific implementation details. Detailed schemas and query patterns live in dedicated DX documents.

## Core entity types

- `user_profile`: Wallet address, display name, bio, skills array, availability description
- `ask`: Learning goal and skill, status and TTL, transaction hash tracking
- `offer`: Teaching offer and skill, status and TTL, availability window
- `session`: Mentor wallet and learner wallet, subject or topic, scheduled time and duration

## Supporting and meta entities

- Transaction hash tracking: `ask_txhash`, `offer_txhash`, `session_txhash`
- Session state: `session_confirmation`, `session_rejection`, `session_jitsi`, `session_payment_submission`, `session_payment_validation`
- Feedback: `session_feedback`, `app_feedback`, `dx_metric`

## Design patterns

- Query patterns: Filter by `type` and by wallet or skill attributes. Limit and pagination set defensively to avoid unbounded queries.
- TTL and freshness: Asks and offers expire automatically via TTL. Network views exclude expired entities by default.
- Immutability and versioning: Profile updates create new entities. Latest version is selected via query, not mutation.

See [Data Model Details](data-model.md) for complete entity schemas.
