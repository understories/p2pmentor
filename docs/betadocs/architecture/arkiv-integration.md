# Arkiv Integration

## Client wrapper

Location: `lib/arkiv/client.ts`

Provides a single entry point for Arkiv clients, hiding chain configuration and boilerplate (Mendoza testnet).

### Clients

- `getPublicClient()`: read-only operations, no authentication required
- `getWalletClientFromPrivateKey()`: server-side entity creation
- `getWalletClientFromMetaMask()`: client-side with MetaMask
- `getWalletClientFromPasskey()`: client-side with passkey wallets (via embedded EVM keypairs)

### Design choices

- Small surface area, minimal abstraction
- Based on mentor-graph reference implementation, adjusted for p2pmentor
- Uses `@arkiv-network/sdk` with Mendoza chain configuration

## Entity-centric design

Core entities: `user_profile`, `ask`, `offer`, `session`

Supporting entities: `ask_txhash`, `offer_txhash`, `session_txhash`, `session_confirmation`, `session_rejection`, `session_jitsi`, `session_feedback`

TTL used for ephemeral entities (asks: 3600s, offers: 7200s). Entities are immutable - updates create new entities.

## No central application database

Any additional storage is viewed as cache or index, not the source of truth. GraphQL layer is a thin wrapper over Arkiv JSON-RPC.

See [Data Model](../arkiv/data-model.md) for detailed entity schemas.
