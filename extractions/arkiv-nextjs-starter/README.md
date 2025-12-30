# Arkiv Next.js Starter

A starter template for building Arkiv applications with Next.js.

**Why Arkiv over centralized DB:** Your app's core records are independently verifiable and portable across deployments/spaces.

## What You'll Build

This template demonstrates:

- **Read path:** Querying Arkiv entities via `createPublicClient` + query builder
- **Write path:** Server-signed writes via Next.js API routes (Phase 0)
- **Optimistic UI:** Handling "submitted vs indexed" states gracefully
- **Error handling:** Timeout, rate limit, and network error classification
- **Testnet-native:** Mendoza testnet defaults with local node support for CI

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and set:
   # - SPACE_ID (required, no fallback)
   # - ARKIV_PRIVATE_KEY (required for writes)
   # - ARKIV_TARGET (optional: 'local' or 'mendoza', default: 'mendoza')
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Seed demo data:**
   ```bash
   npm run seed
   ```

5. **Run smoke test:**
   ```bash
   npm run test:smoke
   ```

## Project Structure

```
arkiv-nextjs-starter/
├── app/
│   ├── api/records/route.ts    # Server-signed write endpoint
│   ├── records/
│   │   ├── page.tsx            # List records
│   │   ├── [id]/page.tsx       # Record details
│   │   └── new/page.tsx        # Create record
│   └── layout.tsx
├── src/lib/arkiv/
│   ├── client.ts               # Uses app-kit
│   ├── queries.ts              # Uses app-kit
│   └── writes.ts               # Uses app-kit
├── scripts/
│   ├── seed.ts                 # Create demo records
│   └── smoke-test.ts           # Minimal read/write test
└── docs/
    ├── patterns-used.md         # Patterns demonstrated
    └── failure-modes.md        # Common issues and solutions
```

## Arkiv App Kit Integration

This template uses `arkiv-app-kit` via **copy-in** approach (simplest for templates).

The app-kit is located at `../arkiv-app-kit/` relative to this template.

**To use in your own project:**
- **Workspace monorepo:** Add `arkiv-app-kit` as a workspace package
- **Git submodule:** Add as a git submodule
- **Copy-in:** Copy `src/` directory into your project

See `arkiv-app-kit/README.md` for distribution strategies.

### Update Policy

This template uses **copy-in** for app-kit by default. To pull improvements:

1. **Check for updates:** Review `../arkiv-app-kit/` for changes
2. **Copy updated files:** Copy changed files from `arkiv-app-kit/src/` to `src/lib/arkiv/`
3. **Test:** Run `npm run build` and `npm run test:smoke` to verify compatibility
4. **Commit:** Document which app-kit changes were incorporated

**Alternative:** Switch to workspace monorepo or git submodule for easier updates (see `arkiv-app-kit/README.md` for setup).

## Measurable Proof

**Fork, deploy, and query your data from a second client without migrating DB credentials.**

**Proof steps:**
1. Fork this template and deploy to separate environment (both on Mendoza testnet)
2. Use same `SPACE_ID` (testnet/devrel-scoped) and Mendoza RPC endpoint
3. Query records created by first deployment
4. Verify records are independently queryable (no shared DB connection)
5. **Verify on explorer:** Click txHash link, confirm transaction visible on Mendoza explorer
6. **Testnet validation:** Both deployments read same records from same testnet space

## Testnet Ops Reality

**Server signer wallet must be funded** (or writes will fail/timeout).

**How to derive signer address:**
```bash
ARKIV_PRIVATE_KEY=0x... node ../arkiv-ai-agent-kit/scripts/derive-signer-address.mjs
```

**Faucet behavior:**
- Manual only (no automation)
- Fund the signer address shown above

**What failures look like when signer is empty:**
- Timeouts (transaction never submitted)
- Transaction replacement errors (nonce issues)
- Rate limit errors (if retrying)

**How to distinguish "indexer lag" from "tx never landed":**
- Indexer lag: Transaction hash exists, explorer shows tx, but query returns empty
- Tx never landed: No transaction hash, explorer shows nothing, API returns error

## Common Failure Modes

See `docs/failure-modes.md` for detailed information on:
- Timeouts
- Indexer lag
- Wallet casing issues
- SpaceId mismatches
- Transaction replacement errors
- Rate limit errors

## Mainnet Migration Checklist (Non-Operational)

This section is intentionally non-operational (checklist, not instructions) to avoid divergent folklore while Arkiv finalizes mainnet guidance. Do not convert this into an operational runbook until official mainnet documentation is available.

- [ ] Update RPC endpoint to mainnet
- [ ] Update `SPACE_ID` to production space
- [ ] Verify signer wallet is funded on mainnet
- [ ] Update explorer links to mainnet explorer
- [ ] Review gas costs and transaction fees
- [ ] Test all write paths on mainnet
- [ ] Verify indexer performance on mainnet
- [ ] Update documentation with mainnet-specific guidance

## Patterns Demonstrated

This template demonstrates the following patterns (see `docs/patterns-used.md`):

- **PAT-QUERY-001:** Indexer-Friendly Query Shapes
- **PAT-TIMEOUT-001:** Transaction Timeouts
- **PAT-ERROR-001:** Error Handling
- **PAT-OPTIMISTIC-001:** Optimistic UI + Reconciliation
- **PAT-SPACE-001:** Space ID as Environment Boundary
- **PAT-IDENTITY-001:** Wallet Normalization

## Builder Mode (Multi-Space)

If you need to query across multiple spaces:

- Arkiv doesn't support OR queries across `spaceId`
- Strategy: Query broadly by `type` with safe limit, then filter client-side by allowed spaceIds
- See `arkiv-app-kit/src/queries.ts` for `queryMultipleSpaces()` helper

## Related Documentation

- [Arkiv Patterns Catalog](../../docs/betadocs/arkiv/arkiv-patterns-catalog.md) - Comprehensive pattern documentation
- [Top 8 Patterns](../../docs/betadocs/arkiv/top-8-patterns.md) - Essential patterns
- [Engineering Guidelines](../../docs/ENGINEERING_GUIDELINES.md) - Complete engineering standards
- [Arkiv App Kit](../arkiv-app-kit/README.md) - Shared core package
- [AI Agent Kit](../arkiv-ai-agent-kit/README.md) - LLM context for building Arkiv integrations

---

**Status:** Testnet-native (Mendoza)  
**Last Updated:** 2025-12-30

