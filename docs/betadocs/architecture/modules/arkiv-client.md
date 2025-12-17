# Arkiv Client Wrapper

Location: `lib/arkiv/client.ts`

## Purpose

Provide a single entry point for Arkiv clients. Hide chain configuration and boilerplate (Mendoza testnet).

## Features

- `getPublicClient()`: read-only operations, no authentication required
- `getWalletClientFromPrivateKey()`: server-side entity creation
- `getWalletClientFromMetaMask()`: client-side with MetaMask
- `getWalletClientFromPasskey()`: client-side with passkey wallets (via embedded EVM keypairs)

## Design choices

- Small surface area, minimal abstraction
- Based on mentor-graph reference implementation, adjusted for p2pmentor
- Uses `@arkiv-network/sdk` with Mendoza chain configuration

## Usage

```typescript
// Public client (reads)
import { getPublicClient } from '@/lib/arkiv/client';
const publicClient = getPublicClient();

// Server-side wallet client
import { getWalletClientFromPrivateKey } from '@/lib/arkiv/client';
const walletClient = getWalletClientFromPrivateKey(privateKey);

// Client-side wallet client (MetaMask)
import { getWalletClientFromMetaMask } from '@/lib/arkiv/client';
const walletClient = getWalletClientFromMetaMask(account);

// Client-side wallet client (Passkey)
import { getWalletClientFromPasskey } from '@/lib/wallet/getWalletClientFromPasskey';
const walletClient = await getWalletClientFromPasskey(userId, credentialID);
```
