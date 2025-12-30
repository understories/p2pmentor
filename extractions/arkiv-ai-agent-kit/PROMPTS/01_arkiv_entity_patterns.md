# 10_arkiv_entity_patterns.md — Arkiv Application Patterns (Testnet-Native)

## Core principles
- Immutable history: design state as interpretation over append-only facts.
- Attributes are queryable; payload is not (treat payload as opaque to queries).
- Indexer lag is normal: represent it as a state, not an error.

## Required entity fields (attributes)
- `type` (string) — required
- `spaceId` (string) — required (never hardcode; must come from config/env)
- wallet fields normalized to lowercase (examples below)
- `created_at` (ISO string) — strongly recommended for ordering/debug

## Wallet fields (naming)
- `subject_wallet` — the wallet the record is about (often the user)
- `issuer_wallet` — the wallet that issued a grant/capability
- Always lowercase on write AND query.

## Stable keys for mutable state (Pattern B)
When representing mutable user state (e.g., notification read/unread):
- Use deterministic `entity_key` derived from stable inputs (spaceId + type + subject_wallet + object_id).
- Avoid "query first, then decide create" for mutable state. That races under indexer lag and creates duplicates.

## Companion txhash entities (strongly recommended)
For observability and reliable lookups:
- After creating a primary entity, also create a parallel `*_txhash` entity keyed by tx hash or referencing it.
- This is best-effort and non-blocking (don't fail the primary operation if it fails).

## SpaceId management (fail closed)
- SpaceId must come from environment/config.
- No "cute fallbacks" like `SPACE_ID || 'local-dev'`.
- If missing, throw with a clear error.

## Anti-pattern callouts (LLMs love these mistakes)
- Query-first upserts for mutable entities ❌
- Assuming read-your-writes without reconciliation ❌
- Treating indexer lag as an exceptional error ❌
- Putting queryable fields only in payload ❌

## Minimal "good" write flow (conceptual)
1) Validate input
2) Normalize wallets to lowercase
3) Build attributes (type, spaceId, wallets, created_at)
4) Submit tx via timeout wrapper
5) Return status: `submitted` with `txHash`, not "done"
6) Reconcile client-side or via polling helper until indexed

## Agent compliance footer
If you propose Arkiv writes, you must also propose reconciliation (indexer lag state).
If you propose mutable state, you must use stable keys.

