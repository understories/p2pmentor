# Arkiv App Kit

**Purpose:** Composable building blocks for Arkiv integrations.

**Status:** Available in `extractions/arkiv-app-kit/` (will be published as standalone package `@understories/arkiv-app-kit`)

**Target Audience:** Developers building Arkiv applications who need consistent, pattern-aligned primitives for common operations.

---

## What This Package Does

The Arkiv App Kit provides the "boring but essential" Arkiv plumbing that every app needs: wallet normalization, query builders, transaction timeouts, space ID management, and more.

## Primitives

The modules in this package are **Arkiv application primitives** - composable building blocks with restraint, not opinionated abstractions. They enforce Arkiv-native invariants while remaining flexible for different use cases.

**Key Capabilities:**

1. **Fail-closed configuration** - Environment variables throw errors if missing (no silent fallbacks)
2. **Pattern-aligned code** - All functions follow established patterns from the Arkiv Patterns Catalog
3. **Type-safe** - Full TypeScript with strict mode
4. **Testnet-native** - Mendoza-focused with local node support for CI
5. **Composable design** - Primitives, not a framework (use as needed)

**What It Is Not:**

- Not a full application framework
- Not a replacement for the Arkiv SDK (builds on top of it)
- Not opinionated about app architecture (only enforces Arkiv-native invariants)
- Not a tutorial (complements learn-arkiv, doesn't replace it)

---

## Package Structure

When published as a standalone package, the structure will be:

```
arkiv-app-kit/
├── src/
│   ├── env.ts              # Environment variable helpers (requireEnv, ARKIV_TARGET)
│   ├── space.ts             # Space ID management (fail-closed)
│   ├── wallet.ts            # Wallet normalization helpers
│   ├── schema.ts            # Canonical attribute keys + makeAttributes() helper
│   ├── client.ts            # Public and wallet client construction
│   ├── queries.ts           # Safe query builders with result validation
│   ├── transactions.ts      # Transaction timeout handling and error classification
│   ├── keys.ts              # Stable entity key derivation (Pattern B)
│   ├── indexer.ts           # Indexer reconciliation helpers (strongly recommended)
│   ├── txhash-entities.ts   # Transaction hash companion entities (strongly recommended)
│   └── index.ts             # Main exports
├── package.json
├── tsconfig.json
└── README.md
```

---

## Contract Defaults (Executable Constants)

These defaults are pinned to prevent template drift. All templates must use these values unless explicitly overriding for a specific reason.

### Query Limits

- **Default limit:** `100` entities per query
- **Maximum cap:** `500` entities per query (enforced in `buildSafeQuery()`)
- **Rationale:** Prevents indexer overload and ensures predictable performance

### Canonical Attribute Keys

The `ATTR_KEYS` constant defines all standard attribute keys:

- `ATTR_KEYS.TYPE` = `'type'` (required on all entities)
- `ATTR_KEYS.SPACE_ID` = `'spaceId'` (required on all entities)
- `ATTR_KEYS.WALLET` = `'wallet'` (general wallet field)
- `ATTR_KEYS.SUBJECT_WALLET` = `'subject_wallet'` (Phase 0: wallet that owns the entity)
- `ATTR_KEYS.ISSUER_WALLET` = `'issuer_wallet'` (grants: wallet that issued the grant)
- `ATTR_KEYS.STATUS` = `'status'` (entity status)
- `ATTR_KEYS.CREATED_AT` = `'created_at'` (ISO timestamp)
- `ATTR_KEYS.UPDATED_AT` = `'updated_at'` (ISO timestamp)
- `ATTR_KEYS.TXHASH` = `'txHash'` (transaction hash for companion entities)

Templates must use these constants, not string literals.

### Error Taxonomy

Transaction wrapper errors are classified as:

- **Rate limit errors:** HTTP 429, error code -32016, or message contains "rate limit"
- **Transaction replacement errors:** Message contains "replacement transaction underpriced", "nonce too low", "nonce too high", or "already known"
- **Transaction timeout errors:** Message contains "Transaction receipt", "confirmation pending", "Transaction submitted", or "could not be found" + "hash"

All errors return user-friendly messages suitable for UI display.

### Indexer Wait Policy Defaults

- **Initial delay:** `1000ms` (1 second)
- **Max attempts:** `10` polling attempts
- **Backoff multiplier:** `1.5x` (exponential backoff)
- **Total max time:** Approximately 30 seconds (10 attempts with exponential backoff)

These defaults balance indexer load with user experience. Adjust only if you have specific requirements.

### Transaction Retry Policy

- **Rate limit retries:** `3` attempts with exponential backoff (initial delay: 1000ms)
- **Nonce/replacement retries:** `1` attempt (single retry with delay)
- **Timeout handling:** No retries (returns user-friendly error immediately)

---

## Core Modules

### Environment Variables (`env.ts`)

Fail-closed helpers for environment variables with friendly errors.

**Functions:**
- `requireEnv(name)` - Require an env var (throws if missing)
- `getEnv(name, defaultValue)` - Get env var with optional default
- `getArkivTarget()` - Get ARKIV_TARGET ('local' | 'mendoza')
- `isLocalTarget()` - Check if targeting local node
- `isMendozaTarget()` - Check if targeting Mendoza testnet

**Philosophy:** Prohibits "cute fallbacks" - makes it painful to hardcode values, easy to use config.

### Space ID Management (`space.ts`)

Fail-closed Space ID management. Space IDs provide data isolation between environments.

**Functions:**
- `getSpaceId()` - Get Space ID from environment (throws if not set)
- `validateSpaceId(spaceId)` - Validate Space ID format
- `getValidatedSpaceId()` - Get and validate Space ID

**Philosophy:** Never allows hardcoded fallbacks - prevents accidental cross-environment data leaks.

### Wallet Normalization (`wallet.ts`)

Consistent wallet address normalization to prevent case-sensitivity bugs.

**Functions:**
- `normalizeWallet(wallet)` - Normalize to lowercase
- `validateWalletFormat(wallet)` - Validate wallet format

**Pattern:** PAT-IDENTITY-001 (Wallet Normalization)

### Schema Conventions (`schema.ts`)

Canonical attribute keys and helpers to enforce consistent attribute schemas.

**Exports:**
- `ATTR_KEYS` - Canonical attribute key constants
- `makeAttributes(options)` - Create attributes with enforced conventions

**Enforces:**
- `type` is always present (required)
- `spaceId` is always present (from config or provided)
- Wallet fields are normalized (lowercase)
- Consistent attribute key naming

### Client Construction (`client.ts`)

Public and wallet client construction with automatic RPC URL selection.

**Functions:**
- `getPublicClient()` - Public client for reads
- `getWalletClientFromPrivateKey(privateKey)` - Server-side wallet client
- `getWalletClientFromMetaMask(account)` - Client-side wallet client

**Behavior:** Automatically uses correct RPC URL based on ARKIV_TARGET.

### Query Builders (`queries.ts`)

Safe query shapes with defensive validation. Always includes required filters (type + spaceId + limit).

**Functions:**
- `buildSafeQuery(type, options)` - Build query with type + spaceId + limit
- `buildWalletQuery(type, wallet, options)` - Wallet-scoped query
- `executeQuery(queryBuilder)` - Execute with defensive validation
- `queryMultipleSpaces(type, spaceIds, options)` - Query multiple spaces (client-side filter)
- `validateQueryResult(result)` - Validate result structure

**Pattern:** PAT-QUERY-001 (Indexer-Friendly Query Shapes)

### Transaction Handling (`transactions.ts`)

Timeout handling and error classification for entity creation/update operations.

**Functions:**
- `handleTransactionWithTimeout(createEntityFn)` - Wrap entity creation with timeout handling
- `isRateLimitError(error)` - Check if rate limit error
- `isTransactionReplacementError(error)` - Check if nonce error
- `isTransactionTimeoutError(error)` - Check if timeout error

**Handles:**
- Rate limit errors (with exponential backoff retry)
- Transaction replacement/nonce errors (with single retry)
- Transaction receipt timeouts (with user-friendly error)
- Network/RPC errors (with user-friendly error)

**Patterns:** PAT-TIMEOUT-001 (Transaction Timeouts), PAT-ERROR-001 (Error Handling)

### Stable Entity Key Derivation (`keys.ts`)

Deterministic key derivation for Pattern B (stable entity key updates).

**Functions:**
- `deriveStableKey(type, identifyingAttrs, options)` - Derive stable key
- `deriveWalletKey(type, wallet, options)` - Derive wallet-scoped key
- `parseStableKey(key)` - Parse key into components

**Pattern:** PAT-UPDATE-001 (Stable Entity Key Updates)

---

## Strongly Recommended Modules

These modules are **optional in API surface** but **strongly recommended for any write path**. They directly address core Arkiv realities (indexer lag, observability).

### Indexer Reconciliation (`indexer.ts`)

Polling helpers to wait for indexer to catch up after writes.

**Functions:**
- `waitForIndexer(entityKey, type, options)` - Wait for entity to be indexed
- `waitForIndexerByTxHash(txHash, type, options)` - Wait for transaction to be indexed

**Why:** Directly addresses indexer lag, which is a core Arkiv reality.

**Pattern:** PAT-INDEXER-001 (Read-Your-Writes Under Indexer Lag)

### Transaction Hash Companion Entities (`txhash-entities.ts`)

Creates parallel `*_txhash` entities for reliable querying and observability.

**Functions:**
- `createTxHashEntity(originalType, txHash, entityKey?, privateKey?)` - Create companion entity (non-blocking, handles errors gracefully)
  - **Canonical signature:** `(originalType: string, txHash: string, entityKey?: string, privateKey?: \`0x${string}\`)`
  - **Required:** `originalType`, `txHash`
  - **Optional:** `entityKey` (for linking), `privateKey` (defaults to `ARKIV_PRIVATE_KEY`)
  - **Returns:** `Promise<TransactionResult | null>` (null if creation failed gracefully)
- `queryByTxHash(txHash, originalType)` - Query entities by transaction hash

**Why:** Directly addresses observability and reliable querying, which are core Arkiv realities.

**Pattern:** Engineering Guidelines recommendation for txHash companion entities

---

## Usage Examples

### Creating an Entity

```typescript
import { 
  getWalletClientFromPrivateKey,
  makeAttributes,
  handleTransactionWithTimeout,
  createTxHashEntity,
  requireEnv
} from '@understories/arkiv-app-kit';

const privateKey = requireEnv('ARKIV_PRIVATE_KEY') as `0x${string}`;
const walletClient = getWalletClientFromPrivateKey(privateKey);

// Create attributes
const attributes = makeAttributes({
  type: 'user_profile',
  wallet: '0xABC123...', // Automatically normalized
  status: 'active',
});

// Create payload
const payload = new TextEncoder().encode(JSON.stringify({
  name: 'Alice',
  bio: 'Developer',
}));

// Create entity with timeout handling
const result = await handleTransactionWithTimeout(async () => {
  return await walletClient.createEntity({
    payload,
    attributes,
    contentType: 'application/json',
    expiresIn: 15768000, // 6 months
  });
});

// Create companion txHash entity (strongly recommended, canonical signature)
await createTxHashEntity('user_profile', result.txHash, result.entityKey);
// Signature: createTxHashEntity(originalType, txHash, entityKey?, privateKey?)
```

### Querying Entities

```typescript
import { 
  buildSafeQuery, 
  executeQuery,
  buildWalletQuery
} from '@understories/arkiv-app-kit';

// Query all entities of a type
const query = buildSafeQuery('user_profile', { 
  limit: 50,
  withPayload: true 
});
const entities = await executeQuery(query);

// Query wallet-scoped entities
const walletQuery = buildWalletQuery('user_profile', '0xABC123...');
const userEntities = await executeQuery(walletQuery);
```

### Updating an Entity (Pattern B)

```typescript
import { 
  deriveWalletKey,
  getWalletClientFromPrivateKey,
  makeAttributes,
  handleTransactionWithTimeout,
  requireEnv
} from '@understories/arkiv-app-kit';

const privateKey = requireEnv('ARKIV_PRIVATE_KEY') as `0x${string}`;
const walletClient = getWalletClientFromPrivateKey(privateKey);

// Derive stable key
const entityKey = deriveWalletKey('user_profile', '0xABC123...');

// Create attributes
const attributes = makeAttributes({
  type: 'user_profile',
  wallet: '0xABC123...',
  status: 'updated',
  updated_at: new Date().toISOString(),
});

// Update entity (reuses same entityKey)
const result = await handleTransactionWithTimeout(async () => {
  return await walletClient.updateEntity({
    entityKey: entityKey as `0x${string}`,
    payload: new TextEncoder().encode(JSON.stringify({ name: 'Alice Updated' })),
    attributes,
    contentType: 'application/json',
    expiresIn: 15768000,
  });
});
```

---

## Environment Variables

### Required

- `SPACE_ID` - Space ID for data isolation (no fallback allowed)
- `ARKIV_PRIVATE_KEY` - Private key for server-signed writes (Phase 0)

### Optional

- `ARKIV_TARGET` - Target network: 'local' or 'mendoza' (default: 'mendoza')
- `ARKIV_RPC_URL` - Custom RPC URL (overrides default for ARKIV_TARGET)

---

## Distribution Strategy

**For this month:** Prefer one of these approaches (avoid npm publish overhead):

- **Git submodule** approach (simplest for Arkiv builders to inspect)
- **Workspace monorepo** (`pnpm` or `npm workspaces`) with `packages/arkiv-app-kit`
- **Copy-in** approach with a loud banner: "This is vendored; update by copying from app-kit"

**Future:** Can publish to npm when patterns stabilize.

---

## Testnet-Native Design

This package is **testnet-native** (Mendoza-focused):

- Defaults to Mendoza testnet
- Supports local node for CI determinism
- All examples use testnet addresses
- Mainnet guidance is intentionally non-operational (checklist, not instructions)

This ensures builders validate the protocol at scale before mainnet.

---

## Pattern Alignment

All code in this package follows established patterns from the [Arkiv Patterns Catalog](../arkiv-patterns-catalog.md):

- **PAT-QUERY-001:** Indexer-Friendly Query Shapes
- **PAT-TIMEOUT-001:** Transaction Timeouts
- **PAT-ERROR-001:** Error Handling
- **PAT-SPACE-001:** Space ID as Environment Boundary
- **PAT-IDENTITY-001:** Wallet Normalization
- **PAT-UPDATE-001:** Stable Entity Key Updates
- **PAT-INDEXER-001:** Read-Your-Writes Under Indexer Lag

---

## TypeScript

Full TypeScript support with strict mode. All functions are typed and documented.

---

## Related Documentation

- [Arkiv Patterns Catalog](../arkiv-patterns-catalog.md) - Comprehensive pattern documentation
- [Top 8 Patterns](../top-8-patterns.md) - Essential patterns demonstrated in templates
- [Engineering Guidelines](../../../ENGINEERING_GUIDELINES.md) - Complete engineering standards
- [AI Agent Kit](./ai-agent-kit.md) - LLM context for building Arkiv integrations

---

**Last Updated:** 2025-12-30  
**Status:** Complete and ready for publication

