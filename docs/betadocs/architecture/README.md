# Architecture

Technical architecture and design decisions for p2pmentor.

## Overview

- [Architecture Overview](overview.md) - High-level system architecture and technology stack
- [Arkiv Integration](arkiv-integration.md) - How p2pmentor uses Arkiv as the data layer
- [Admin Dashboard](admin-dashboard.md) - Admin interface and tools
- [GraphQL Performance](graphql-performance.md) - GraphQL query optimization
- [Decentralized Static Client](decentralized-static-client.md) - IPFS-deployable static version

## Modules

Core system modules that implement major features.

- [Modules Overview](modules/README.md) - All available modules
- [Feedback System](modules/feedback-system.md) - User feedback and issue tracking
- [Learner Quests](modules/learner-quests.md) - Reading lists and language assessments
- [Notification System](modules/notification-system.md) - Read/unread state management
- [Profile System](modules/profile-system.md) - User profile management

## Supporting Modules

- [Arkiv Client](modules/arkiv-client.md) - Arkiv client wrapper
- [GraphQL API](modules/graphql-api.md) - GraphQL interface over Arkiv
- [Feedback Modules](modules/feedback-modules.md) - Feedback-related utilities

## Integrations

External service integrations.

- [Integrations Overview](integrations/README.md) - All available integrations
- [MetaMask Integration](integrations/metamask-integration.md) - Wallet connection and mobile browser handling
- [WalletConnect Integration](integrations/walletconnect-integration.md) - QR code and deep link wallet connection
- [Passkey Integration](integrations/passkey-integration.md) - WebAuthn-based authentication with embedded EVM keypairs
- [Jitsi Integration](integrations/jitsi-integration.md) - Video meeting rooms for sessions
- [GitHub Integration](integrations/github-integration.md) - Issue linking from feedback
- [GraphQL Integration](integrations/graphql-integration.md) - GraphQL interface over Arkiv

