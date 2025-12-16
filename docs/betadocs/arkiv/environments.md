# Environments and Data Seeds

## Overview

p2pmentor uses a single signing wallet (configured via `ARKIV_PRIVATE_KEY`) to sign all server-side entity creation transactions. Changing the private key creates a different signing wallet, which effectively creates a separate data environment on Arkiv.

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

### Changing the Signing Wallet

To create a separate data environment:

1. Set a different `ARKIV_PRIVATE_KEY` environment variable
2. This creates a different signing wallet address
3. All new entities are signed by this new wallet
4. Existing entities remain on Arkiv (signed by previous wallet)
5. Queries continue to work because they filter by user wallet addresses

### Data Isolation

Different signing wallets create separate transaction histories:

- Entities signed by wallet A are separate from entities signed by wallet B
- Both sets of entities exist on Arkiv simultaneously
- Queries return entities based on user wallet addresses, regardless of signing wallet
- No data is lost or overwritten

### Use Cases

**Development Environment:**
```bash
ARKIV_PRIVATE_KEY=0xdev123... npm run dev
```

**Staging Environment:**
```bash
ARKIV_PRIVATE_KEY=0xstaging456... npm run build
```

**Production Environment:**
```bash
ARKIV_PRIVATE_KEY=0xprod789... npm run build
```

Each environment uses a different signing wallet, creating separate entity sets on Arkiv.

## Seeding Data

### Seed Scripts

Seed scripts use the signing wallet to create initial data:

```typescript
// scripts/seed-learner-quest.ts
const privateKey = getPrivateKey(); // From ARKIV_PRIVATE_KEY
await createLearnerQuest({
  questId: 'web3privacy_foundations',
  // ...
  privateKey,
});
```

Running seed scripts with different `ARKIV_PRIVATE_KEY` values creates quest entities signed by different wallets, effectively creating separate data seeds.

### Multiple Seeds

You can maintain multiple data seeds:

1. **Seed A**: `ARKIV_PRIVATE_KEY=0xseedA...` → Creates entities signed by wallet A
2. **Seed B**: `ARKIV_PRIVATE_KEY=0xseedB...` → Creates entities signed by wallet B
3. **Seed C**: `ARKIV_PRIVATE_KEY=0xseedC...` → Creates entities signed by wallet C

All seeds coexist on Arkiv. Users see the same data because queries filter by user wallet addresses, not signing wallet.

## Important Considerations

### Space ID

Currently, all entities use `spaceId: 'local-dev'`. This is separate from the signing wallet:

- Different signing wallets can use the same `spaceId`
- `spaceId` provides additional data isolation if needed
- Future versions may support multiple `spaceId` values

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

- Different `ARKIV_PRIVATE_KEY` values create different signing wallets
- Different signing wallets create separate transaction histories on Arkiv
- Queries filter by user wallet addresses, not signing wallet
- All entity sets coexist on Arkiv
- Changing signing wallet creates a new data environment without affecting existing data
- Seed scripts create initial data using the current signing wallet

## Related Documentation

- [Wallet Architecture](wallet-architecture.md) - Profile wallet vs signing wallet
- [Arkiv Overview](overview.md) - Core Arkiv concepts
- [Entity Versioning](patterns/entity-versioning.md) - Immutability patterns

