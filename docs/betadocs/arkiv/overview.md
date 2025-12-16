# Arkiv Overview

This section covers Arkiv-specific implementation details for p2pmentor. Arkiv is a decentralized blockchain network that serves as the primary data layer, eliminating the need for a central database.

## What is Arkiv?

Arkiv is a blockchain-native storage layer that enables serverless and trustless application development. Instead of storing data in a traditional database, p2pmentor stores all data as immutable entities on the Arkiv blockchain.

## Core Concepts

### Entity-Centric Model

All data in p2pmentor is stored as **entities** on Arkiv. An entity consists of:
- **Attributes**: Indexed key-value pairs for querying (e.g., `type`, `wallet`, `spaceId`)
- **Payload**: JSON data stored in the entity body
- **Entity Key**: Unique identifier for the entity
- **Transaction Hash**: Blockchain transaction that created the entity

### Immutability

Arkiv entities are **immutable**. Once created, they cannot be modified. To update data:
1. Create a new entity with updated fields
2. Query all entities for the identifier (e.g., wallet address)
3. Select the latest version by sorting by `createdAt` descending

This provides a complete audit trail and enables data recovery.

### Wallet-Based Identity

User identity is tied to wallet addresses:
- Wallet address is the primary identifier (normalized to lowercase)
- No user accounts or passwords required
- Users sign transactions with their wallet (MetaMask or Passkey)

### Space ID

All entities include a `spaceId` attribute. Currently set to `'local-dev'` for beta. This enables multi-tenant or environment-specific data isolation.

## Core Entity Types

### Primary Entities
- `user_profile`: User profile information
- `skill`: First-class skill/topic entities
- `ask`: Learning requests ("I want to learn X")
- `offer`: Teaching offers ("I can teach X")
- `session`: Mentorship sessions between mentor and learner
- `availability`: User availability time blocks
- `session_feedback`: Post-session feedback and ratings

### Supporting Entities
- Transaction hash tracking: `*_txhash` entities for reliable querying
- Session state: `session_confirmation`, `session_rejection`, `session_jitsi`, `session_payment_*`
- Community: `virtual_gathering` for community meetings
- Access control: `beta_code_usage`, `auth_identity`
- Feedback: `app_feedback`, `github_issue_link`, `admin_response`
- Metrics: `dx_metric`, `client_perf_metric`, `perf_snapshot`, `retention_metric`, `metric_aggregate`
- Other: `learning_follow`, `notification_preferences`, `garden_note`, `onboarding_event`

## Query Patterns

All queries use the Arkiv SDK query builder:

```typescript
import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient } from "./client";

const publicClient = getPublicClient();
const query = publicClient.buildQuery();
const result = await query
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', walletAddress.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

**Key Patterns:**
- Always filter by `type` first (indexed)
- Normalize wallet addresses to lowercase
- Use `.limit()` defensively to avoid unbounded queries
- Sort client-side for latest version selection

## Design Patterns

### Transaction Hash Tracking

Separate `*_txhash` entities track transaction hashes for reliable querying:
- `ask_txhash`, `offer_txhash`, `session_txhash`, etc.
- Linked via entity key reference (e.g., `askKey`, `sessionKey`)
- Same expiration as main entity

### TTL and Expiration

Ephemeral entities use TTL (Time To Live):
- **Asks**: 3600 seconds (1 hour) default
- **Offers**: 7200 seconds (2 hours) default
- **Availability**: 2592000 seconds (30 days)
- **Sessions**: Calculated as `sessionDate + duration + 1 hour buffer`

**Implementation:**
- Client-side filtering: `createdAt + ttlSeconds < now`
- Arkiv-level expiration: `expiresIn` parameter for network cleanup

### Deletion Pattern

Arkiv entities are immutable, so "deletion" uses marker entities:
- Create `*_deletion` entity with reference to original
- Query filters exclude entities with deletion markers
- Original entity remains on-chain (audit trail)

Example: `availability_deletion` marks availability entities as deleted.

## Client Wrapper

Location: `lib/arkiv/client.ts`

Provides a single entry point for Arkiv clients:

- `getPublicClient()`: Read-only operations, no authentication
- `getWalletClientFromPrivateKey()`: Server-side entity creation
- `getWalletClientFromMetaMask()`: Client-side with MetaMask
- `getWalletClientFromPasskey()`: Client-side with passkey wallets

**Design:**
- Small surface area, minimal abstraction
- Based on mentor-graph reference implementation
- Uses `@arkiv-network/sdk` with Mendoza testnet configuration

## No Central Database

Any additional storage is viewed as **cache or index**, not the source of truth:
- GraphQL layer is a thin wrapper over Arkiv JSON-RPC
- No PostgreSQL, MongoDB, or other databases
- All data queries read from Arkiv

## Benefits

1. **Serverless**: No database servers to manage
2. **Trustless**: Cryptographic proof of data existence
3. **Data Ownership**: Users own their data on-chain
4. **Resilience**: Data persists even if application disappears
5. **Verifiability**: Anyone can verify data on Arkiv explorer
6. **Audit Trail**: Complete history of all changes

## See Also

- [Data Model](data-model.md) - Complete entity schemas
- [Entity Overview](entity-overview.md) - Detailed schema documentation
- [Wallet Architecture](wallet-architecture.md) - Profile wallet vs signing wallet
- [Builder Mode](builder-mode.md) - Developer-focused query visibility
- [Learner Quests](learner-quests.md) - Curated reading lists and progress tracking
- [Implementation FAQ](implementation-faq.md) - Common patterns and Q&A
- [Arkiv Integration](../architecture/arkiv-integration.md) - Architecture details
