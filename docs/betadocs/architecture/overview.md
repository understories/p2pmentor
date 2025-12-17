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

- Wallet based authentication with MetaMask
- Passkey authentication (WebAuthn-based) with embedded EVM keypairs
- Jitsi for video sessions
- No central application database for primary data

## Technology Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Data Layer**: Arkiv Network (Mendoza testnet)
- **Authentication**: MetaMask + Ethereum Passkeys (WebAuthn)
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

See [Arkiv Integration](/docs/arkiv/overview) for detailed data layer architecture.

## Decentralized Static Client

We are building a fully decentralized, no-JavaScript version of p2pmentor that works entirely without centralized servers. This static client will be deployable on IPFS and accessible via ENS.

See [Decentralized Static Client](decentralized-static-client.md) for details.
