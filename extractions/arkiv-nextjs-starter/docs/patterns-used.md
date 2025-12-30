# Patterns Used

This template demonstrates the following Arkiv patterns:

## PAT-QUERY-001: Indexer-Friendly Query Shapes
- All queries include `type` + `spaceId` + `limit`
- Implemented via `buildSafeQuery()` from app-kit
- See: `src/lib/arkiv/queries.ts`

## PAT-TIMEOUT-001: Transaction Timeouts
- All writes go through `handleTransactionWithTimeout()` wrapper
- API routes return "submitted" status, never claim "indexed"
- See: `src/lib/arkiv/writes.ts`, `app/api/records/route.ts`

## PAT-ERROR-001: Error Handling
- Structured error classification (rate limit, timeout, nonce errors)
- User-friendly error messages
- Graceful degradation (return empty arrays on query failure)
- See: `app/api/records/route.ts`

## PAT-OPTIMISTIC-001: Optimistic UI + Reconciliation
- UI shows "submitted" state immediately
- Acknowledges indexer lag (doesn't claim immediate indexing)
- Uses reconciliation helpers for polling
- See: `app/records/new/page.tsx`, `scripts/smoke-test.ts`

## PAT-SPACE-001: Space ID as Environment Boundary
- Space ID from environment (fail-closed, no fallbacks)
- Implemented via `getSpaceId()` from app-kit
- See: `arkiv-app-kit/src/space.ts`

## PAT-IDENTITY-001: Wallet Normalization
- All wallet addresses normalized to lowercase
- Applied in both writes and queries
- Implemented via `normalizeWallet()` from app-kit
- See: `arkiv-app-kit/src/wallet.ts`

## Additional Patterns

- **TxHash Companion Entities:** Created via `createTxHashEntity()` (strongly recommended)
- **Result Validation:** Defensive checks via `validateQueryResult()` from app-kit
- **Testnet-Native:** All defaults target Mendoza testnet

