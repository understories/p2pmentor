# Architecture Overview

## High-level view

### Frontend

- Next.js 15+ (App Router) and TypeScript
- Tailwind-based UI components
- Opinionated but minimal design system tuned to dark forest / garden aesthetics

### Data layer

- Arkiv on Mendoza testnet as source of truth for all core entities
- Arkiv SDK (`@arkiv-network/sdk@^0.4.4`) used on both client and server

### Indexing and queries

- GraphQL API wrapper (`/api/graphql`) that wraps Arkiv JSON-RPC indexer
- GraphQL client wrapper for subgraph and Arkiv GraphQL endpoints
- API routes that adapt GraphQL responses into UI-friendly shapes

### Integrations

See [Integrations](/docs/architecture/integrations) for detailed integration documentation.

- Wallet based authentication with MetaMask
- WalletConnect for QR code and deep link wallet connection
- Passkey authentication (WebAuthn-based) with embedded EVM keypairs
- Jitsi for video sessions
- GitHub integration for issue linking
- GraphQL API for data querying
- No central application database for primary data

### Modules

- Builder Mode: Developer-focused query visibility
- Feedback System: User feedback and issue tracking
- Learner Quests: Reading lists and language assessments
- Notification System: Read/unread state management
- Profile System: User profile management

## Technology Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Data Layer**: Arkiv Network (Mendoza testnet)
- **Authentication**: MetaMask + WalletConnect + Ethereum Passkeys (WebAuthn)
- **Video**: Jitsi
- **Package Manager**: pnpm (preferred) or yarn

## Project Structure

```
/app                    # Next.js App Router routes
/lib
  /arkiv                # Arkiv integration layer
  /auth                 # Authentication utilities
  /graph                # GraphQL client
  /graphql              # GraphQL API implementation
/components             # React components
/docs                   # Documentation
```

See [Arkiv Integration](arkiv-integration.md) for detailed data layer architecture.

## Additional Architecture Topics

- [Admin Dashboard](admin-dashboard.md) - Admin interface and tools
- [GraphQL Performance](graphql-performance.md) - GraphQL query optimization
- [Decentralized Static Client](decentralized-static-client.md) - IPFS-deployable static version

## Documentation Structure

For a complete overview of all architecture documentation, see [Architecture Documentation](README.md).
