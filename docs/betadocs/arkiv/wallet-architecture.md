# Wallet Architecture: Profile Wallet vs Signing Wallet

For architectural rationale, see [Serverless and Trustless](../philosophy/serverless-and-trustless.md).

## Overview

p2pmentor uses a two-wallet architecture that separates user identity (profile wallet) from transaction signing (signing wallet). This design provides security, flexibility, and prepares for full data sovereignty when Arkiv moves to mainnet.

## Two-Wallet System

### Profile Wallet

The **profile wallet** is your identity on p2pmentor:

- **Purpose**: Represents your user identity and ownership of data
- **Storage**: Stored in `localStorage` as `wallet_address`
- **Usage**: Used as the `wallet` attribute on all entities (profiles, asks, offers, sessions)
- **Funds**: **No funds required** - we recommend using a wallet without any funds
- **Security**: This wallet is your identity, not used for signing transactions

**Example:**
```typescript
// Profile wallet is used in entity attributes
{
  type: 'user_profile',
  wallet: '0x1234...', // Your profile wallet (no funds needed)
  // ... other attributes
}
```

### Signing Wallet

The **signing wallet** is used to sign transactions on Arkiv:

- **Purpose**: Signs all Arkiv transactions (entity creation, updates)
- **Location**: Server-side private key (`ARKIV_PRIVATE_KEY` environment variable)
- **Network**: Mendoza testnet with testnet funds
- **Access**: Controlled by the application server
- **Current State**: Single shared signing wallet for all transactions

**Important**: During beta on Mendoza testnet, all transactions are signed by the server's signing wallet. This is a temporary architecture that will change when Arkiv moves to mainnet.

## Current Implementation (Beta)

### How It Works

1. **User connects profile wallet** (MetaMask or example wallet)
   - Profile wallet address stored in `localStorage`
   - No funds required in profile wallet

2. **User creates profile/asks/offers**
   - Entity attributes use profile wallet address
   - Transactions signed by server's signing wallet

3. **Data ownership**
   - All entities are tied to your profile wallet
   - You own your data, even though transactions are server-signed

### Example Flow

```typescript
// User connects MetaMask
const profileWallet = '0xUSER...'; // Your profile wallet (no funds)

// User creates an ask
const ask = {
  type: 'ask',
  wallet: profileWallet, // Your identity
  skill: 'Solidity',
  // ... other fields
};

// Server signs transaction with signing wallet
// Transaction hash stored in ask_txhash entity
// Both entities viewable on Arkiv Explorer
```

## For Arkiv Builders

If you're building on Arkiv and need testnet funds for your own signing wallet:

### Mendoza Testnet Faucet

Arkiv provides a faucet for Mendoza testnet funds:

**Faucet URL**: [https://mendoza.hoodi.arkiv.network/faucet](https://mendoza.hoodi.arkiv.network/faucet)

Use the faucet to:
- Get testnet funds for your own signing wallet
- Test your own Arkiv integrations
- Develop and experiment on Mendoza testnet

**Note**: The faucet is provided by Arkiv for developers building on the network. Follow their guidelines and rate limits.

## Future: Mainnet Data Sovereignty

When Arkiv moves to mainnet, p2pmentor will implement **full data sovereignty**:

### Planned Changes

1. **User-Signed Transactions**
   - Users will sign their own transactions directly on Arkiv
   - No server-side signing wallet
   - Complete user control over their data

2. **Profile Wallet Becomes Signing Wallet**
   - Your profile wallet will also sign transactions
   - You'll need funds in your wallet for transaction fees
   - Full ownership and control

3. **Migration Path**
   - Existing data remains tied to profile wallets
   - Users can migrate to self-signed transactions
   - All historical data remains verifiable

### Benefits

- **True Ownership**: Users control their own transactions
- **Trustless**: No reliance on server signing
- **Decentralized**: Fully peer-to-peer architecture
- **Verifiable**: All transactions signed by users, verifiable on-chain

## Data Verifiability

Even during beta with server-signed transactions, all data is **fully verifiable**:

### Arkiv Explorer

All entities and transactions are viewable on the [Arkiv Explorer](https://explorer.mendoza.hoodi.arkiv.network):

- **Entity Keys**: View raw entity data
- **Transaction Hashes**: Verify transaction details
- **Block Height**: Confirm on-chain inclusion
- **Timestamps**: See when data was created

### Transparency

- All profile data is public and verifiable
- All asks, offers, and sessions are on-chain
- Complete audit trail of all changes
- No hidden data or server-side secrets

## Security Recommendations

### Profile Wallet

- **Use a separate wallet** from your main funds
- **No funds required** - keep it empty
- **Backup your wallet** - it's your identity
- **Don't share private keys** - treat it like a password

### Signing Wallet (For Builders)

- **Use testnet funds only** - never use mainnet funds
- **Keep private keys secure** - use environment variables
- **Rotate keys regularly** - good security practice
- **Monitor usage** - track transaction costs

## Technical Details

### Entity Creation

```typescript
// Profile wallet used in attributes
const entity = {
  attributes: [
    { key: 'type', value: 'user_profile' },
    { key: 'wallet', value: profileWallet.toLowerCase() }, // Profile wallet
    { key: 'spaceId', value: 'local-dev' },
    { key: 'createdAt', value: new Date().toISOString() },
  ],
  payload: {
    displayName: 'Alice',
    // ... user data
  },
};

// Signed by server's signing wallet
const txHash = await signingWallet.createEntity(entity);
```

### Querying

```typescript
// Query by profile wallet
const query = publicClient.buildQuery()
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', profileWallet.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .fetch();
```

## Summary

- **Profile Wallet**: Your identity, no funds needed, stored in localStorage
- **Signing Wallet**: Server-side, signs transactions, has testnet funds
- **Current State**: Server signs all transactions (beta architecture)
- **Future State**: Users sign their own transactions (mainnet)
- **Verifiability**: All data viewable and verifiable on Arkiv Explorer
- **For Builders**: Use [Mendoza faucet](https://mendoza.hoodi.arkiv.network/faucet) for testnet funds

## See Also

- [Arkiv Overview](overview.md) - Core Arkiv concepts
- [Environments](environments.md) - Using different signing wallets for separate data environments
- [Data Model](data-model.md) - Entity schemas
- [Client Wrapper](overview.md#client-wrapper) - Wallet client implementation
- [Arkiv Explorer](https://explorer.mendoza.hoodi.arkiv.network) - View your data on-chain

