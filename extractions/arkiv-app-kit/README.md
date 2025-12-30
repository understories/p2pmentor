# Arkiv App Kit

**Composable building blocks for Arkiv integrations.**

**Package name:** `@understories/arkiv-app-kit` (when published)

**Product name:** Arkiv App Kit

**Internal concept:** The modules in this package are **Arkiv application primitives** - composable building blocks with restraint, not opinionated abstractions.

This package provides the "boring but essential" Arkiv plumbing that every app needs: wallet normalization, query builders, transaction timeouts, space ID management, and more.

**Philosophy:** These are Arkiv application primitives, not a framework. They provide composable building blocks with restraint, not opinionated abstractions.

---

## Installation

**For this month:** This package is distributed via git submodule, workspace monorepo, or copy-in approach (not published to npm yet).

**Future:** Will be published to npm when patterns stabilize.

### Git Submodule

```bash
git submodule add <repository-url> packages/arkiv-app-kit
```

### Workspace Monorepo

```json
{
  "workspaces": [
    "packages/*"
  ]
}
```

### Copy-In

Copy the `src/` directory into your project with a banner noting it's vendored.

---

## Quick Start

```typescript
import { 
  getPublicClient, 
  buildSafeQuery, 
  executeQuery,
  makeAttributes,
  normalizeWallet,
  getSpaceId,
  requireEnv
} from '@understories/arkiv-app-kit';

// Get public client
const client = getPublicClient();

// Build a safe query (always includes type + spaceId + limit)
const query = buildSafeQuery('user_profile', { limit: 50 });
const entities = await executeQuery(query);

// Create attributes with enforced conventions
const attributes = makeAttributes({
  type: 'user_profile',
  wallet: '0xABC123...', // Automatically normalized
  status: 'active',
});

// Get environment variables (fail-closed)
const spaceId = getSpaceId(); // Throws if SPACE_ID not set
const privateKey = requireEnv('ARKIV_PRIVATE_KEY');
```

---

## Core Modules

### `env.ts` - Environment Variables

Fail-closed helpers for environment variables.

- `requireEnv(name)` - Require an env var (throws if missing)
- `getEnv(name, defaultValue)` - Get env var with default
- `getArkivTarget()` - Get ARKIV_TARGET ('local' | 'mendoza')
- `isLocalTarget()` - Check if targeting local node
- `isMendozaTarget()` - Check if targeting Mendoza testnet

**Prohibits "cute fallbacks"** - makes it painful to hardcode values, easy to use config.

### `space.ts` - Space ID Management

Fail-closed Space ID management.

- `getSpaceId()` - Get Space ID from environment (throws if not set)
- `validateSpaceId(spaceId)` - Validate Space ID format
- `getValidatedSpaceId()` - Get and validate Space ID

**Never allows hardcoded fallbacks** - prevents accidental cross-environment data leaks.

### `wallet.ts` - Wallet Normalization

Consistent wallet address normalization.

- `normalizeWallet(wallet)` - Normalize to lowercase
- `validateWalletFormat(wallet)` - Validate wallet format

**Always normalizes** - prevents case-sensitivity bugs.

### `schema.ts` - Schema Conventions

Canonical attribute keys and helpers.

- `ATTR_KEYS` - Canonical attribute key constants
- `makeAttributes(options)` - Create attributes with enforced conventions

**Enforces conventions** - prevents template-specific attribute name drift.

### `client.ts` - Client Construction

Public and wallet client construction.

- `getPublicClient()` - Public client for reads
- `getWalletClientFromPrivateKey(privateKey)` - Server-side wallet client
- `getWalletClientFromMetaMask(account)` - Client-side wallet client

**Automatically uses correct RPC** based on ARKIV_TARGET.

### `queries.ts` - Query Builders

Safe query shapes with defensive validation.

- `buildSafeQuery(type, options)` - Build query with type + spaceId + limit
- `buildWalletQuery(type, wallet, options)` - Wallet-scoped query
- `executeQuery(queryBuilder)` - Execute with defensive validation
- `queryMultipleSpaces(type, spaceIds, options)` - Query multiple spaces (client-side filter)
- `validateQueryResult(result)` - Validate result structure

**Always includes required filters** - ensures indexer-friendly queries.

### `transactions.ts` - Transaction Handling

Timeout handling and error classification.

- `handleTransactionWithTimeout(createEntityFn)` - Wrap entity creation with timeout handling
- `isRateLimitError(error)` - Check if rate limit error
- `isTransactionReplacementError(error)` - Check if nonce error
- `isTransactionTimeoutError(error)` - Check if timeout error

**Handles all common errors** - rate limits, timeouts, nonce errors, network issues.

### `keys.ts` - Stable Entity Key Derivation

Deterministic key derivation for Pattern B.

- `deriveStableKey(type, identifyingAttrs, options)` - Derive stable key
- `deriveWalletKey(type, wallet, options)` - Derive wallet-scoped key
- `parseStableKey(key)` - Parse key into components

**Deterministic keys** - enables Pattern B (stable entity key updates).

---

## Strongly Recommended Modules

These modules are **optional in API surface** but **strongly recommended for any write path**. They directly address core Arkiv realities (indexer lag, observability).

### `indexer.ts` - Indexer Reconciliation

Polling helpers to wait for indexer to catch up.

- `waitForIndexer(entityKey, type, options)` - Wait for entity to be indexed
- `waitForIndexerByTxHash(txHash, type, options)` - Wait for transaction to be indexed

**Why:** Directly addresses indexer lag, which is a core Arkiv reality.

### `txhash-entities.ts` - Transaction Hash Companion Entities

Creates parallel `*_txhash` entities for reliable querying.

- `createTxHashEntity(originalType, txHash, entityKey, privateKey)` - Create companion entity
- `queryByTxHash(txHash, originalType)` - Query entities by transaction hash

**Why:** Directly addresses observability and reliable querying, which are core Arkiv realities.

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

// Create companion txHash entity (strongly recommended)
await createTxHashEntity('user_profile', result.txHash, result.entityKey);
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

## Testnet-Native Design

This package is **testnet-native** (Mendoza-focused):

- Defaults to Mendoza testnet
- Supports local node for CI determinism
- All examples use testnet addresses
- Mainnet guidance is intentionally non-operational (checklist, not instructions)

---

## Pattern Alignment

All code in this package follows established patterns from the Arkiv Patterns Catalog:

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

## License

MIT

