# Environments and Data Seeds

## Overview

p2pmentor uses a single signing wallet (configured via `ARKIV_PRIVATE_KEY`) to sign all server-side entity creation transactions. For data isolation between environments, use `spaceId` attributes on entities, not different signing wallets.

## How It Works

### Signing Wallet

The signing wallet is derived from `ARKIV_PRIVATE_KEY`:

```typescript
// lib/config.ts
export const ARKIV_PRIVATE_KEY = process.env.ARKIV_PRIVATE_KEY;
export const CURRENT_WALLET = ARKIV_PRIVATE_KEY 
  ? privateKeyToAccount(ARKIV_PRIVATE_KEY).address 
  : undefined;
```

Each private key corresponds to a unique wallet address. Different private keys produce different signing wallets.

### Entity Creation

All server-side entity creation uses the signing wallet:

```typescript
// Example: Creating a profile
const walletClient = getWalletClientFromPrivateKey(privateKey);
await walletClient.createEntity({
  attributes: [
    { key: 'type', value: 'user_profile' },
    { key: 'wallet', value: userWallet }, // User's profile wallet
    // ...
  ],
  // ...
});
```

The transaction is signed by the signing wallet (from `ARKIV_PRIVATE_KEY`), but entity attributes reference the user's profile wallet.

### Querying

Queries filter by user wallet addresses, not signing wallet:

```typescript
// Query by user's profile wallet
const query = publicClient.buildQuery()
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', userWallet.toLowerCase()))
  .fetch();
```

The signing wallet address is not used in queries. All queries filter by the `wallet` attribute, which contains the user's profile wallet address.

## Creating Different Environments

### Use SpaceId for Data Isolation

**Important:** Changing the signing wallet does NOT provide data isolation. Queries filter by entity attributes (like `spaceId` and `wallet`), not by which wallet signed the transaction.

To create separate data environments, use different `spaceId` values:

**Default Space ID:**
The default `spaceId` is determined by `SPACE_ID` in `lib/config.ts`:
- If `BETA_SPACE_ID` environment variable is set, use that value
- Otherwise: `'beta-launch'` in production (`NODE_ENV === 'production'`), `'local-dev'` in development

**Development Environment:**
```bash
# Uses 'local-dev' by default (or set explicitly)
BETA_SPACE_ID=local-dev npm run dev
```

**Production Environment:**
```bash
# Uses 'beta-launch' by default (or set explicitly)
BETA_SPACE_ID=beta-launch npm run build
```

**Seed/Example Data:**
```bash
# Use custom spaceId for seed data
BETA_SPACE_ID=local-dev-seed npm run seed
```

Each environment uses a different `spaceId`, and queries filter by `spaceId` to show only relevant data. API routes use `SPACE_ID` from config when creating entities.

### Why SpaceId, Not Signing Wallet?

**Signing Wallet:**
- Only used to sign transactions (technical detail)
- Not stored in entity attributes
- Not used in queries
- Changing it doesn't hide old data

**SpaceId:**
- Stored as an attribute on every entity
- Can be filtered in queries
- Provides real data isolation
- Changing it effectively creates separate environments

### Example: The Difference

**Scenario:** You want to separate development data from production data.

**❌ Wrong Approach (Changing Signing Wallet):**
```bash
# Development
ARKIV_PRIVATE_KEY=0xdev123... npm run dev
# Creates entities signed by wallet 0xdev123...

# Production
ARKIV_PRIVATE_KEY=0xprod789... npm run build
# Creates entities signed by wallet 0xprod789...
```

**Problem:** Queries still return ALL entities because they don't filter by signing wallet:
```typescript
const profiles = await listUserProfiles();
// Returns ALL profiles (dev + prod), regardless of signing wallet
```

**✅ Correct Approach (Using SpaceId):**
```bash
# Development
BETA_SPACE_ID=local-dev npm run dev
# Creates entities with spaceId: 'local-dev'

# Production
BETA_SPACE_ID=beta-launch npm run build
# Creates entities with spaceId: 'beta-launch'
```

**Solution:** Queries filter by `spaceId`:
```typescript
const profiles = await listUserProfiles({ spaceId: 'beta-launch' });
// Returns ONLY profiles with spaceId: 'beta-launch'
```

### Changing the Signing Wallet

Changing `ARKIV_PRIVATE_KEY` creates a different signing wallet, but this does NOT provide data isolation:

1. Different signing wallets create separate transaction histories on Arkiv
2. Queries still return all entities (they filter by `spaceId` and `wallet`, not signing wallet)
3. Old entities remain visible because queries don't filter by signing wallet
4. Use `spaceId` instead for data isolation

**When to change signing wallet:**
- Security rotation (mainnet)
- Separate transaction cost tracking
- Auditing which wallet signed specific transactions

**Not for:**
- Data isolation (use `spaceId`)
- Environment separation (use `spaceId`)
- Hiding development data (use `spaceId`)

## Seeding Data

### Seed Scripts

Seed scripts use the signing wallet to create initial data, but use `spaceId` to separate seeds:

```typescript
// scripts/seed-learner-quest.ts
const privateKey = getPrivateKey(); // From ARKIV_PRIVATE_KEY
// spaceId defaults to 'local-dev' in library functions
// Can be overridden via BETA_SPACE_ID env var or passed explicitly
await createLearnerQuest({
  questId: 'web3privacy_foundations',
  spaceId: 'local-dev-seed', // Use spaceId to separate seed data
  // ...
  privateKey,
});
```

**Note:** Library functions (like `createLearnerQuest`) default to `'local-dev'` if no `spaceId` is provided. API routes use `SPACE_ID` from config (which respects `BETA_SPACE_ID` env var).

### Multiple Seeds

You can maintain multiple data seeds using different `spaceId` values:

1. **Seed A**: `BETA_SPACE_ID=seed-a` → Creates entities with `spaceId: 'seed-a'`
2. **Seed B**: `BETA_SPACE_ID=seed-b` → Creates entities with `spaceId: 'seed-b'`
3. **Production**: `BETA_SPACE_ID=beta-launch` → Creates entities with `spaceId: 'beta-launch'`

All seeds coexist on Arkiv. Queries filter by `spaceId` to show only the relevant seed data.

## Important Considerations

### Space ID

All entities include a `spaceId` attribute. This is the primary mechanism for data isolation:

- `spaceId` is stored as an attribute on every entity
- Queries can filter by `spaceId` to show only relevant data
- Different environments should use different `spaceId` values
- The signing wallet is independent of `spaceId` (just signs transactions)

### User Wallet Addresses

User wallet addresses (profile wallets) are independent of the signing wallet:

- Users connect with their own wallets (MetaMask, Passkey)
- User wallet addresses are stored in entity attributes
- Queries filter by user wallet addresses
- Changing the signing wallet does not affect user wallet addresses

### Transaction Costs

Each signing wallet must have funds on the Arkiv network:

- Testnet: Use Mendoza testnet faucet for funds
- Mainnet: Signing wallet needs mainnet funds for transaction fees
- Different signing wallets require separate funding

## Verification

### Arkiv Explorer

View entities by signing wallet on Arkiv Explorer:

1. Navigate to [Arkiv Explorer](https://explorer.mendoza.hoodi.arkiv.network)
2. Search by transaction hash or entity key
3. View which wallet signed each transaction
4. Verify entities are signed by the expected wallet

### Query Verification

Verify queries return correct data:

```typescript
// Query should return entities regardless of signing wallet
const profiles = await listProfiles();
// Returns all profiles, signed by any wallet
```

Queries filter by entity attributes (user wallet, type, etc.), not by signing wallet.

## Summary

### For Data Isolation: Use SpaceId

- Different `BETA_SPACE_ID` values create separate data environments
- Queries filter by `spaceId` attribute to show only relevant data
- Changing `spaceId` effectively creates a new data environment
- All entity sets coexist on Arkiv, but queries filter them by `spaceId`

### Signing Wallet: Technical Detail Only

- Different `ARKIV_PRIVATE_KEY` values create different signing wallets
- Signing wallet is used to sign transactions (technical detail)
- Signing wallet is NOT used in queries
- Changing signing wallet does NOT provide data isolation
- Use `spaceId` instead for environment separation

### Best Practice

**For environment separation:**
- ✅ Use `BETA_SPACE_ID` environment variable
- ✅ Set different `spaceId` values per environment
- ✅ Queries filter by `spaceId` automatically

**For signing transactions:**
- Use `ARKIV_PRIVATE_KEY` (one wallet is sufficient)
- Only change if needed for security rotation or cost tracking
- Does not affect data visibility or isolation

## Related Documentation

- [Wallet Architecture](wallet-architecture.md) - Profile wallet vs signing wallet
- [Arkiv Overview](overview.md) - Core Arkiv concepts
- [Entity Versioning](patterns/entity-versioning.md) - Immutability patterns

