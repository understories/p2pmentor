# 30_timeouts_and_retries.md — Timeouts, Retries, and "Submitted vs Indexed"

## Key reality
- A transaction can be submitted but not yet indexed.
- UX must represent "pending indexing" as a state.

## Write wrapper requirements
All writes must go through a timeout wrapper that:
- Sets a max duration (no hanging requests)
- Categorizes common failures:
  - timeout
  - rate limit
  - nonce/tx replacement
  - user rejection (client-side)
- Returns structured error info (never just "something went wrong")

## Retry policy
- Retries must be bounded and exponential backoff.
- Retries must not multiply duplicate entities. Use stable keys for mutable state.

## API route behavior (Phase 0 server-signed writes)
- On success: return `{ status: "submitted", txHash, entityKey? }`
- If timeout: return `{ status: "submitted_or_pending", hint: "...", txHash?: maybe }`
- Never claim "confirmed/indexed" unless you actually verified indexing.

## Reconciliation
Strongly recommended:
- `waitForIndexerByTxHash(txHash, policy)` or `waitForIndexer(entityKey, policy)`
- Capped polling attempts with increasing delays
- UI should show: pending → indexed OR pending → unknown (user can refresh / retry)

