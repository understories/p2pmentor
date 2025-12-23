# Phase 0: Central Signer Model

**Date:** 2025-12-21  
**Status:** ✅ Implemented  
**Purpose:** Document the Phase 0 trust model where a single server-side signing wallet signs all transactions

## Overview

During beta on Mendoza testnet, p2pmentor uses a **central signer model** where all server-side entity creation and updates are signed by a single Arkiv signing wallet (configured via `ARKIV_PRIVATE_KEY` environment variable).

## How It Works

### Signing Wallet

- **Location:** Server-side private key (`ARKIV_PRIVATE_KEY` environment variable)
- **Network:** Mendoza testnet with testnet funds
- **Access:** Controlled by the application server
- **Usage:** Signs all server-side entity creation and update transactions

### User Identity (Profile Wallet)

- **Purpose:** Represents user identity and ownership of data
- **Storage:** Stored in `localStorage` as `wallet_address` (client-side)
- **Usage:** Used as the `wallet` attribute on all entities (profiles, asks, offers, sessions)
- **Funds:** **No funds required** - we recommend using a wallet without any funds

### Signer Metadata

All entities created by the app include `signer_wallet` metadata in attributes:

```typescript
{
  type: 'user_profile',
  wallet: '0x1234...', // User's profile wallet
  signer_wallet: '0x5678...', // Server's signing wallet
  // ... other attributes
}
```

This metadata makes the Phase 0 trust model observable in data, enabling:
- **Auditability:** Reviewers can confirm "who signed this write" without external logs
- **Future Migration:** Clear path to migrate to user-signed transactions when Arkiv moves to mainnet

## Why This Model?

### Current Benefits (Beta)

1. **Simplicity:** Single signing wallet simplifies infrastructure
2. **No User Funds Required:** Users don't need testnet tokens
3. **Fast Onboarding:** Users can start using the platform immediately
4. **Server-Side Control:** Application can manage transaction signing

### Future Migration Path

When Arkiv moves to mainnet, the migration path will be:

1. **Phase 1:** Hybrid model - users can optionally sign their own transactions
2. **Phase 2:** Full user sovereignty - all transactions signed by user wallets
3. **Phase 3:** Remove central signer entirely

The `signer_wallet` metadata enables this migration by making it clear which transactions were signed by the server vs. users.

## Risks and Limitations

### Current Risks

1. **Single Point of Failure:** If the signing wallet is compromised, all server-side writes are at risk
2. **Trust Required:** Users must trust the application to sign transactions correctly
3. **Not Fully Decentralized:** Central signer model is not fully trustless

### Mitigations

1. **Signer Metadata:** All writes include `signer_wallet` for transparency
2. **User Data Ownership:** Entity attributes reference user wallets, not signing wallet
3. **Future Migration:** Clear path to user-signed transactions

## Related Documentation

- [Wallet Architecture](/docs/arkiv/wallet-architecture) - Profile wallet vs. signing wallet
- [Environments](/docs/arkiv/environments) - How spaceId provides data isolation
- [Entity Update Implementation Plan](/refs/entity-update-implementation-plan.md) - Technical migration details

