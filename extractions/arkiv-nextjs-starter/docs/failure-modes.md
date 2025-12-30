# Common Failure Modes

This document describes common failure modes when building on Arkiv and how this template handles them.

## Timeouts

**What it looks like:**
- Transaction submitted but receipt not found
- API returns "submitted_or_pending" status
- Error message: "Transaction submitted but confirmation pending"

**Why it happens:**
- Common on testnets (network congestion)
- Indexer lag
- RPC node temporarily unavailable

**How this template handles it:**
- Uses `handleTransactionWithTimeout()` wrapper from app-kit
- Returns 202 (Accepted) status with "submitted_or_pending"
- UI shows pending state, allows user to refresh
- Never claims "indexed" unless actually verified

## Indexer Lag

**What it looks like:**
- Record created successfully but not immediately queryable
- List page shows old data after creation
- Details page shows "not found" for newly created record

**Why it happens:**
- Indexer is eventually consistent
- "Submitted" ≠ "Indexed"
- Normal part of Arkiv's architecture

**How this template handles it:**
- Acknowledges lag in UI messages
- Uses reconciliation helpers (`waitForIndexer`) in smoke tests
- Shows "submitted" status, not "done"
- Allows user to refresh to see updated data

## Wallet Casing Issues

**What it looks like:**
- Record created but can't be queried by wallet
- "Wallet not found" errors
- Inconsistent results

**Why it happens:**
- Wallet addresses in different cases (0xABC... vs 0xabc...)
- Arkiv stores wallets in lowercase
- Case-sensitive queries fail

**How this template handles it:**
- All wallets normalized to lowercase via `normalizeWallet()` from app-kit
- Applied in both writes (`makeAttributes`) and queries (`buildWalletQuery`)
- Consistent normalization everywhere

## SpaceId Mismatches

**What it looks like:**
- Records created but not queryable
- Empty results when records should exist
- "Wrong space" errors

**Why it happens:**
- Hardcoded space IDs
- Environment variable not set
- Different spaces in different environments

**How this template handles it:**
- Space ID from environment (fail-closed via `getSpaceId()`)
- No hardcoded fallbacks
- Clear error if `SPACE_ID` not set
- `.env.example` documents required variables

## Transaction Replacement Errors

**What it looks like:**
- "Nonce too low" errors
- "Transaction already known" errors
- Duplicate transaction attempts

**Why it happens:**
- Multiple transactions with same nonce
- Previous transaction still pending
- Network congestion

**How this template handles it:**
- Automatic retry with delay in `handleTransactionWithTimeout()`
- User-friendly error message
- Single retry attempt before failing

## Rate Limit Errors

**What it looks like:**
- 429 status codes
- "Rate limit exceeded" errors
- Temporary failures

**Why it happens:**
- Too many requests to RPC endpoint
- Testnet rate limiting
- Network throttling

**How this template handles it:**
- Exponential backoff retry in app-kit
- User-friendly error message
- Returns 429 status to client
- Client can retry after delay

