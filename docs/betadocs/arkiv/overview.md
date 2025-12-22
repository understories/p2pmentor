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

Arkiv transactions are **immutable**. Once created, they cannot be modified. Application data is mutable at the state level. To update data:
1. Use `updateEntity()` to update an existing entity with a stable entity key
2. All transaction history is preserved on-chain (immutable ledger)
3. The application displays the latest canonical state

This provides a complete audit trail while allowing editable application data.

### Wallet-Based Identity

User identity is tied to wallet addresses:
- Wallet address is the primary identifier (normalized to lowercase)
- No user accounts or passwords required
- Users sign transactions with their wallet (MetaMask or Passkey)

### Space ID

All entities include a `spaceId` attribute. The default `spaceId` comes from `SPACE_ID` config (`lib/config.ts`), which is:
- `process.env.BETA_SPACE_ID` if set
- Otherwise: `'beta-launch'` in production, `'local-dev'` in development

This enables multi-tenant or environment-specific data isolation. API routes use `SPACE_ID` from config when creating entities. Library functions default to `'local-dev'` but accept an optional `spaceId` parameter.

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

- [Editable Entities](/docs/arkiv/editable-entities) - Mental model: how entities can be "updated" on an immutable blockchain
- [Data Model](/docs/arkiv/data-model) - Complete entity schemas
- [Entity Overview](/docs/arkiv/entity-overview) - Detailed schema documentation
- [Wallet Architecture](/docs/arkiv/wallet-architecture) - Profile wallet vs signing wallet
- [Environments](/docs/arkiv/environments) - Using different signing wallets for separate data environments
- [Invite Code System](/docs/arkiv/invite-code-system) - Arkiv-native invite code implementation with usage tracking
- [Builder Mode](/docs/architecture/modules/builder-mode) - Developer-focused query visibility
- [Learner Quests](/docs/architecture/modules/learner-quests) - Curated reading lists and language assessment quests with progress tracking
- [Implementation FAQ](/docs/arkiv/implementation-faq) - Common patterns and Q&A
- [Arkiv Integration](/docs/architecture/arkiv-integration) - Architecture details
