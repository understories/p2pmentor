# WalletConnect Integration

## Overview

WalletConnect integration provides an additional wallet connection method for p2pmentor users. It enables connection via QR code (desktop) or deep linking (mobile), supporting any WalletConnect-compatible wallet. This is an additive connector that does not modify existing MetaMask flows.

## Architecture

### Core Components

1. **WalletConnect Connection** (`lib/auth/walletconnect.ts`)
   - Initializes WalletConnect EthereumProvider
   - Handles QR code display (desktop) and deep linking (mobile)
   - Registers lifecycle listeners for session management
   - Non-critical chain switching to Mendoza testnet

2. **Provider Singleton** (`lib/wallet/walletconnectProvider.ts`)
   - Module-level singleton for provider instance
   - Phase 0: In-memory only (no session persistence across reloads)
   - Provides accessor functions for getting and setting provider
   - Disconnect handling with localStorage cleanup

3. **Unified Wallet Client** (`lib/wallet/getWalletClient.ts`)
   - Auto-detects wallet type (MetaMask, Passkey, or WalletConnect)
   - Returns appropriate wallet client based on localStorage `wallet_type`
   - Feature flag guard for WalletConnect support

4. **Auth Page** (`app/auth/page.tsx`)
   - WalletConnect button (feature flagged)
   - Connection flow orchestration
   - Error handling and user feedback

## Implementation Details

### Connection Flow

1. User clicks "Connect with WalletConnect"
2. `connectWalletConnect()` initializes EthereumProvider with Mendoza chain
3. Provider shows QR code (desktop) or triggers deep link (mobile)
4. User scans QR or approves connection in wallet app
5. Provider returns connected wallet address
6. Address stored in localStorage with `wallet_type: 'walletconnect'`
7. Redirects based on onboarding level

### Provider Configuration

```typescript
const provider = await EthereumProvider.init({
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  chains: [mendoza.id],
  rpcMap: {
    [mendoza.id]: mendoza.rpcUrls.default.http[0],
  },
  showQrModal: true,
  metadata: {
    name: 'p2pmentor',
    description: 'Peer-to-peer learning platform',
    url: window.location.origin,
    icons: [],
  },
});
```

### Session Management

**Phase 0 (Current):**
- Provider stored in module singleton (in-memory only)
- On page reload, provider is null and user must reconnect
- No localStorage persistence for session metadata

**Phase 1 (Future):**
- Session restore from localStorage
- Provider re-initialization on page load
- Automatic reconnection if session still valid

### Wallet Type Detection

The unified wallet client checks localStorage for wallet type:

```typescript
const walletType = localStorage.getItem(`wallet_type_${address.toLowerCase()}`);
// Returns: 'metamask' | 'passkey' | 'walletconnect' | null
```

If `walletType === 'walletconnect'`:
1. Get WalletConnect provider from singleton
2. If provider is null, throw "WalletConnect session expired" error
3. Create wallet client with WalletConnect provider (EIP-1193 compliant)
4. Use with viem `custom()` transport

### Chain Switching

Chain switching is non-critical (same as MetaMask):
1. After connection, check `eth_chainId`
2. If mismatch with Mendoza, attempt `wallet_switchEthereumChain`
3. If switch fails, show non-blocking prompt
4. Do not attempt `wallet_addEthereumChain` in Phase 0

## Feature Flag

WalletConnect is feature-flagged for controlled rollout:

- **Environment Variable**: `NEXT_PUBLIC_WALLETCONNECT_ENABLED=true`
- **UI**: Button hidden if flag is not `'true'`
- **Guard**: `getWalletClient()` throws if WalletConnect disabled but wallet_type is 'walletconnect'

## Configuration

### Required Environment Variables

1. **NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID**
   - WalletConnect Cloud project ID
   - Public and safe to expose in client builds
   - How to get:
     1. Go to https://cloud.walletconnect.com/
     2. Sign up or log in
     3. Create a new project (or use existing)
     4. Copy the Project ID from the project dashboard

2. **NEXT_PUBLIC_WALLETCONNECT_ENABLED**
   - Set to `'true'` to enable WalletConnect button
   - Default: disabled (button hidden)

See `.env.example` for complete setup instructions.

## Code Locations

### Core Files

- `lib/auth/walletconnect.ts` - Connection logic and provider initialization
- `lib/wallet/walletconnectProvider.ts` - Provider singleton management
- `lib/wallet/getWalletClient.ts` - Unified wallet client with WalletConnect support
- `app/auth/page.tsx` - Auth page with WalletConnect button

### Key Functions

- `connectWalletConnect()` - Main connection entry point
- `getWalletConnectProvider()` - Get provider from singleton
- `setWalletConnectProvider()` - Store provider in singleton
- `disconnectWalletConnect()` - Disconnect and cleanup

## Best Practices

### 1. Always Check Feature Flag

Check `NEXT_PUBLIC_WALLETCONNECT_ENABLED` before showing WalletConnect UI or attempting connection.

### 2. Handle Session Expiry

If `wallet_type` is 'walletconnect' but provider is null, show clear error: "WalletConnect session expired. Please reconnect via /auth."

### 3. Non-Critical Chain Switching

Chain switching failures should not block the connection flow. Show non-blocking prompts if switch fails.

### 4. Lifecycle Listeners

Register `disconnect` and `session_delete` listeners to clean up provider and localStorage on session end.

### 5. Wallet Type Storage

Always store wallet type in localStorage: `wallet_type_${address.toLowerCase()} = 'walletconnect'`

## Error Handling

### Connection Errors

- "WalletConnect project ID not configured" - Missing `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- "Connection cancelled by user" - User rejected or closed connection
- "No accounts returned from WalletConnect" - Provider enabled but no accounts

### Session Errors

- "WalletConnect session expired" - Provider is null after page reload (Phase 0 limitation)
- "WalletConnect is disabled" - Feature flag not enabled but wallet_type is 'walletconnect'

### Chain Errors

- Chain mismatch warnings - Non-critical, user can switch manually in wallet

## Testing Matrix

### Desktop
- Chrome with WalletConnect QR code
- Firefox with WalletConnect QR code
- Safari with WalletConnect QR code

### Mobile
- Safari on iOS (deep link or QR)
- Chrome on Android (deep link or QR)
- DuckDuckGo browser (QR code)

### Test Cases
- Direct connection from auth page
- Session expiry after page reload
- Disconnect from wallet app
- Chain switching (success and failure)
- Feature flag disabled state

## Compatibility

### MetaMask Flows

WalletConnect is fully orthogonal to MetaMask:
- Does not modify MetaMask connection logic
- Does not interfere with MetaMask mobile browser flow
- Does not touch MetaMask redirect handling
- Can be used alongside MetaMask (different wallet addresses)

### Arkiv Signing Wallet

WalletConnect only affects profile wallet (identity wallet):
- All Arkiv writes still signed by `ARKIV_PRIVATE_KEY` (server-side)
- Profile wallet address stored as `wallet` attribute on entities
- Same query patterns as MetaMask addresses

## Related Documentation

- [MetaMask Integration](metamask-integration.md) - Primary wallet connection method
- [Passkey Integration](/docs/architecture/integrations/passkey-integration) - WebAuthn-based authentication
- [Wallet Architecture](/docs/arkiv/operations/wallet-architecture) - Profile wallet vs signing wallet
- [Environment Variables](/docs/architecture/overview#environment-variables) - Configuration reference

## Summary

WalletConnect Phase 0 provides an additional wallet connection option that works alongside MetaMask without modifying existing flows. It uses EIP-1193 compliant providers compatible with viem's `custom()` transport, enabling seamless integration with the existing Arkiv client architecture.

Key features:
- QR code connection on desktop
- Deep linking on mobile
- Feature-flagged for controlled rollout
- Non-critical chain switching
- In-memory session (Phase 0)
- Fully orthogonal to MetaMask flows

Phase 1 enhancements will add session persistence and automatic reconnection on page reload.

