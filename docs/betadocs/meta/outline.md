# p2pmentor Beta Documentation

Planting the first beta seed of peer to peer mentorship.  
Teach, learn, and mentor without intermediaries.  
Own your data.

## Audience

- Builders using Arkiv who want a concrete reference implementation
- Designers and PMs working on peer to peer mentorship flows
- Early mentors and learners testing the beta

## Structure

- Concept first (why), then architecture (how), then feature walkthrough (what it does)
- Arkiv-specific details collected in dedicated sections for reuse
- Beta documentation for an invite-only release
- Assumes readers are comfortable with web3 basics and TypeScript

---

## 1. Project overview

### 1.1 What p2pmentor is

- A focused beta of a peer to peer mentorship network
- Built on Arkiv so that user data lives on a shared, user-owned data layer
- First live step from Mentor Graph prototypes toward a broader Mentor Garden ecosystem
- Designed for small, high trust cohorts rather than public internet scale

### 1.2 What p2pmentor is not

- Not production ready for mainnet or real funds
- Not a full mentorship marketplace or all-in-one learning platform
- Not a custodial SaaS product with a central application database
- Not an analytics-first product. Priority is trust and sovereignty, then optimized performance.

### 1.3 Goals for the beta

- Validate core mentorship flows end to end
  - Create profile
  - Publish asks and offers
  - Match and schedule sessions
  - Join a call and reflect
- Validate Arkiv as the primary data layer for a real product
  - Only store what is needed off-chain (for performance or UX)
  - Make it easy for other builders to reuse our patterns and packages
- Collect structured feedback from both users and developers

---

## 2. Philosophy and values

### 2.1 First principles

- Data sovereignty
  - Users own and control their data
  - The application is a client of a shared data layer, not the owner of data
- No intermediaries in the core value flow
  - The platform helps people find each other and coordinate
  - It does not sit in the middle as the primary owner of identity, content or relationships
- Trustless infrastructure, trustworthy UX
  - Infrastructure should not require trust to protect user data
  - UX and community norms should encourage good behavior and mutual respect

### 2.2 Dark forest and hidden garden

- Dark forest metaphor
  - The open internet is noisy and adversarial
  - Users need safe, semi-private spaces where trust and context can grow
- Hidden garden vision
  - Small, curated networks with strong norms and shared purpose
  - Visual language of constellations, forest, and growing light
- p2pmentor as the garden path
  - First surface where people can move between dark forest and garden safely
  - Mentorship sessions as “lamps” that light parts of the network

### 2.3 Design values

- White-hat UX
  - No dark patterns, no attention traps
  - Clear language and consent for any data sharing
- Calm default
  - Minimal notifications
  - Simple UI flows that reward depth, not shallow engagement
- Composability
  - Prefer primitives that other builders can reuse
  - Every new integration considered as a potential Arkiv builder package

---

## 3. History and context

### 3.1 Hidden Garden and early experiments

- Hidden Garden as initial prototype for networked learning and mutual aid
- Experiments with:
  - Network visualizations
  - Permissioned spaces
  - Trust building and small-group governance

### 3.2 Mentor Graph

- Mentor Graph as the first Arkiv-based reference implementation
- Focus on:
  - Basic entities for profiles, asks, offers, sessions, feedback
  - DX patterns for Arkiv SDK on testnet
- p2pmentor builds on these patterns while simplifying the experience for non-technical users

### 3.3 Mentor Garden vision

- Long-term direction
  - A living, growing map of skills, mentors, learners and sessions
  - A set of tools for communities to run their own mentorship networks on Arkiv
- p2pmentor role
  - Seed project and blueprint for other gardens
  - Concrete testbed for Arkiv DX and ecosystem integrations

---

## 4. Architecture overview

### 4.1 High-level view

- Frontend
  - Next.js 15+ (App Router) and TypeScript
  - Tailwind-based UI components
  - Opinionated but minimal design system tuned to dark forest / garden aesthetics
- Data layer
  - Arkiv on Mendoza testnet as source of truth for all core entities
  - Arkiv SDK (`@arkiv-network/sdk@^0.4.4`) used on both client and server
- Indexing and queries
  - GraphQL API wrapper (`/api/graphql`) that wraps Arkiv JSON-RPC indexer
  - GraphQL client wrapper for subgraph and Arkiv GraphQL endpoints
  - API routes that adapt GraphQL responses into UI-friendly shapes
- Integrations
  - Wallet based authentication with MetaMask
  - Passkey authentication (WebAuthn-based) with embedded EVM keypairs
  - Jitsi for video sessions
  - No central application database for primary data

### 4.2 Arkiv integration

- Arkiv client wrapper (`lib/arkiv/client.ts`)
  - Public client for read-only operations (no authentication required)
  - Wallet clients for:
    - Private key on server side (`getWalletClientFromPrivateKey`)
    - MetaMask on client side (`getWalletClientFromMetaMask`)
    - Passkey wallets (`getWalletClientFromPasskey` via embedded EVM keypairs)
- Entity-centric design
  - Core entities: `user_profile`, `ask`, `offer`, `session`
  - Supporting entities: `ask_txhash`, `offer_txhash`, `session_txhash`, `session_confirmation`, `session_rejection`, `session_jitsi`, `session_feedback`
  - TTL used for ephemeral entities (asks: 3600s, offers: 7200s)
  - Entities are immutable - updates create new entities
- No central application database for primary data
  - Any additional storage is viewed as cache or index, not the source of truth
  - GraphQL layer is a thin wrapper over Arkiv JSON-RPC

### 4.3 GraphQL and performance

- GraphQL API (`/app/api/graphql`)
  - Wraps Arkiv JSON-RPC indexer with GraphQL interface
  - Resolvers call existing Arkiv helper functions (`lib/arkiv/*`)
  - Schema defined in `lib/graphql/schema.ts`
- GraphQL client (`lib/graph/client.ts`)
  - Minimal typed wrapper over fetch for GraphQL endpoints
  - Works with:
    - The Graph subgraph endpoints
    - Arkiv GraphQL API exposed via `/api/graphql`
- Philosophy
  - GraphQL used as an index and query layer
  - Arkiv remains the canonical store
  - All resolvers use the same Arkiv functions as direct JSON-RPC calls
  - Performance tooling is transparent and measurable

---

## 5. Core user flows (beta)

### 5.1 Onboarding and authentication

- Beta invite
  - Invite-only, small cohort
  - Focus on people we can support directly
- Wallet connection
  - MetaMask connection flow with Mendoza testnet detection
  - Wallet address stored in session/cookies for state management
- Passkey authentication
  - WebAuthn-based passkey login implemented
  - Embedded EVM keypairs unlocked via passkey authentication
  - Wallet client adapter (`lib/wallet/getWalletClientFromPasskey.ts`) produces Arkiv-compatible wallet client
  - No central database - credential mapping stored in Arkiv profile entities

### 5.2 Profiles and skills

- Profile creation
  - Basic identity fields
  - Short bio and context
  - Availability description (simple text in beta)
- Skills
  - Skills stored as part of the profile payload
  - Simple tagging rather than complex ontology in early versions
- Design intent
  - Lightweight and quick to complete
  - Enough information for meaningful matching

### 5.3 Asks and offers

- Asks
  - “I am learning” signals
  - Skill, description, urgency and context
  - Time to live for each ask to keep the network fresh
- Offers
  - “I am teaching” signals
  - Skill, experience, and availability window
  - Time to live for offers, separate from asks
- Matching logic
  - Simple skill-based matching for beta
  - Client side filtering with room to move matching to the server later

### 5.4 Network view and discovery

- Network view
  - Consolidated view of relevant asks and offers
  - Filters by skill and status
- Design
  - Text-first list view for beta instead of complex graph visualization
  - Future iterations may add full graph canvas built on the same data

### 5.5 Sessions (mentorship meetings)

- Session creation
  - Request from ask to offer or from offer to ask
  - Session entity (`type: 'session'`) records mentor, learner, skill, scheduled time, duration
  - Optional payment fields: `requiresPayment`, `paymentAddress`, `cost`
  - Separate `session_txhash` entity for transaction hash tracking
- Confirmation flow
  - `session_confirmation` entities (one per party) linked via `sessionKey`
  - `session_rejection` entities for cancellations
  - Status computed from main session plus confirmations, rejections and expiration
  - Status flow: `pending` → `scheduled` (when both confirm) or `cancelled` (if rejected)
- Payment flow (for paid sessions)
  - `session_payment_submission` entity when learner submits payment txHash
  - `session_payment_validation` entity when mentor validates payment
- Jitsi integration
  - Jitsi room created when both parties confirm
  - Room info stored in `session_jitsi` entity linked via `sessionKey`
  - Room name and join URL stored in entity payload
- Lifecycle
  - Expiration: `sessionDate + duration + 1 hour buffer`
  - Statuses: `pending`, `scheduled`, `in-progress`, `completed`, `cancelled`

### 5.6 Feedback and learning loops

- Session feedback
  - `session_feedback` entities keyed by session
  - Users can leave structured feedback on sessions
  - Feedback stored on Arkiv for future analysis and learning
- App feedback
  - `app_feedback` entities for general UX feedback
  - Developer experience feedback tracked in [`docs/dx_arkiv_runbook.md`](../../../dx_arkiv_runbook.md)
  - DX metrics stored as `dx_metric` entities on Arkiv
- Builder feedback
  - Developer experience with Arkiv tracked in [`docs/dx_arkiv_runbook.md`](../../../dx_arkiv_runbook.md)
  - Pain points and improvements feed back into Arkiv SDK and examples

---

## 6. Arkiv data model (beta)

> This section is intentionally higher level. Detailed schemas and query patterns live in dedicated DX documents.

### 6.1 Core entity types

- `user_profile`
  - Attributes: `type`, `wallet`, `spaceId`
  - Payload: `displayName`, `bio`, `skills` (array), `availabilityWindow` (text), `mentorRoles` (array)
  - Immutable: updates create new entities, latest selected via query
- `ask`
  - Attributes: `type`, `wallet`, `skill`, `spaceId`, `createdAt`, `status` ('open'), `ttlSeconds`
  - Payload: `message`
  - TTL: 3600 seconds (1 hour) default
  - Separate `ask_txhash` entity for transaction hash tracking
- `offer`
  - Attributes: `type`, `wallet`, `skill`, `spaceId`, `createdAt`, `status` ('active'), `ttlSeconds`
  - Payload: `message`, `availabilityWindow`
  - TTL: 7200 seconds (2 hours) default
  - Separate `offer_txhash` entity for transaction hash tracking
- `session`
  - Attributes: `type`, `mentorWallet`, `learnerWallet`, `skill`, `spaceId`, `createdAt`
  - Payload: `sessionDate` (ISO timestamp), `duration` (minutes), `notes`, `requiresPayment`, `paymentAddress`, `cost`
  - Status computed from session + confirmations/rejections
  - Separate `session_txhash` entity for transaction hash tracking

### 6.2 Supporting and meta entities

- Transaction hash tracking
  - `ask_txhash`, `offer_txhash`, `session_txhash` entities
  - Linked via `askKey`, `offerKey`, `sessionKey` attributes
  - Pattern subject to simplification in future iterations
- Session state
  - `session_confirmation`: one per party, linked via `sessionKey` attribute
  - `session_rejection`: cancellations, linked via `sessionKey`
  - `session_jitsi`: room info (name, joinUrl), linked via `sessionKey`
  - `session_payment_submission`: payment txHash from learner
  - `session_payment_validation`: payment validation from mentor
- Feedback
  - `session_feedback`: keyed by session, stored in payload
  - `app_feedback`: general UX feedback
  - `dx_metric`: developer experience metrics

### 6.3 Design patterns

- Query patterns
  - Filter by `type` and by wallet or skill attributes
  - Limit and pagination set defensively to avoid unbounded queries
- TTL and freshness
  - Asks and offers expire automatically via TTL
  - Network views exclude expired entities by default
- Immutability and versioning
  - Profile updates create new entities
  - Latest version is selected via query, not mutation

---

## 7. Arkiv builder packages and modules

> These are the components we either ship as separate packages or treat as reusable modules for other Arkiv builders.

### 7.1 Arkiv client wrapper

- Location: `lib/arkiv/client.ts`
- Purpose
  - Provide a single entry point for Arkiv clients
  - Hide chain configuration and boilerplate (Mendoza testnet)
- Features
  - `getPublicClient()`: read-only operations, no authentication
  - `getWalletClientFromPrivateKey()`: server-side entity creation
  - `getWalletClientFromMetaMask()`: client-side with MetaMask
- Design choices
  - Small surface area, minimal abstraction
  - Based on mentor-graph reference implementation, adjusted for p2pmentor
  - Uses `@arkiv-network/sdk` with Mendoza chain configuration

### 7.2 GraphQL API and client

- GraphQL API: `app/api/graphql/route.ts`
  - Wraps Arkiv JSON-RPC indexer with GraphQL interface
  - Schema: `lib/graphql/schema.ts`
  - Resolvers: `lib/graphql/resolvers.ts` (calls `lib/arkiv/*` helpers)
  - Transformers: `lib/graphql/transformers.ts`
- GraphQL client: `lib/graph/client.ts`
  - Standardized GraphQL access for subgraphs and Arkiv GraphQL endpoints
  - Typed responses and centralized error handling
  - Endpoint resolution: explicit override, environment variable, local API route
  - Thin wrapper around fetch with clear error types
- Intended use
  - Network queries for asks, offers and profiles
  - Performance tracking and indexing

### 7.3 Jitsi integration (session bridge)

- Location: `lib/jitsi.ts`
- Purpose
  - Simple bridge from Arkiv sessions to live video rooms
- Behavior
  - When both participants confirm a session, a Jitsi room is generated
  - Room name generated from session key
  - Room info stored in `session_jitsi` entity linked via `sessionKey`
  - Join URL format: `${JITSI_BASE_URL}/${roomName}`
- Design intent
  - No external database needed
  - Easy to reuse in other Arkiv-based apps that need ephemeral rooms

### 7.4 Query performance tracking

- Location: `lib/arkiv/perfSnapshots.ts`, `lib/arkiv/dxMetrics.ts`
- Purpose
  - Monitor GraphQL and Arkiv query performance per route and operation
- Features
  - Performance metrics stored as `dx_metric` entities on Arkiv
  - Performance snapshots stored as `perf_snapshot` entities
  - All data verifiable on-chain via transaction hashes
- Philosophy
  - Optimize performance without compromising sovereignty
  - Treat performance logs as transparent and verifiable
  - All measurements include timestamps, operation names, and source ('arkiv' vs 'graphql')

### 7.5 Feedback modules

- App feedback: `lib/arkiv/appFeedback.ts`
  - `app_feedback` entities for general UX feedback
  - Admin responses stored as `admin_response` entities
- Session feedback: `lib/arkiv/feedback.ts`
  - `session_feedback` entities keyed by session
  - Structured feedback on mentorship sessions
- DX metrics: `lib/arkiv/dxMetrics.ts`
  - Developer experience metrics stored on Arkiv
  - Tracks pain points, errors, and improvements
- Constraints
  - Respect data ownership and consent
  - All feedback stored on Arkiv, no opaque off-chain logging

---

## 8. Technical best practices

### 8.1 Arkiv integration principles

- Treat Arkiv as the primary data store
- Encapsulate Arkiv operations behind clearly named functions
- Keep entity schemas simple and composable
- Prefer additional entities for new concerns over overloading a single entity

### 8.2 Privacy and consent

- Explicit communication that data is written to Arkiv testnet
- Clear guidance that testnet wallets should not hold real funds
- Feedback and telemetry features designed with opt in by default, not silent collection

### 8.3 Performance without compromise

- Use GraphQL and indexing to improve UX, not to re-centralize data
- Cache and logs treated as disposable
- Data needed for long-term value is stored on Arkiv, not only in application databases

### 8.4 Developer experience

- Maintain a running DX runbook for Arkiv integration
- Capture:
  - Feature name and entities used
  - Query patterns
  - Pain points and errors
  - Proposed improvements and UX notes
- Use this as a living document to improve both p2pmentor and Arkiv SDK

### 8.5 CI/CD and quality pipeline

- GitHub Actions for code quality, security scanning, and build verification
- Vercel for deployment, environment variables, and scheduled tasks
- Clear separation: GitHub Actions validates, Vercel deploys
- See [CI/CD and Quality Pipeline](/docs/practices/ci-cd) for full documentation

---

## 9. Roadmap and extension points

### 9.1 Short term (post beta)

- Hardening of session flows and error handling
- Richer matching and filtering
- First public version of Arkiv builder packages extracted from this codebase

### 9.2 Medium term

- Full Mentor Garden experience on top of the same data
- More advanced availability, scheduling and calendar integrations
- Governance and community tools for networks that want to run their own gardens

---

## 10. Contributing and questions

- Contributions
  - Start with issues labelled for DX, performance or Arkiv patterns
  - Propose improvements to entity schemas or builder packages
- Questions
  - Use repository discussions or issues for technical questions
  - Share Arkiv-specific feedback in the DX runbook format where possible

## Reference

Parts of this outline are aligned with and abstracted from:

- [`docs/architecture_overview.md`](../../../architecture_overview.md) - Architecture decisions
- [`docs/dx_arkiv_runbook.md`](../../../dx_arkiv_runbook.md) - Developer experience tracking
- [`docs/ARKIV_GRAPHQL_TOOL.md`](../../../ARKIV_GRAPHQL_TOOL.md) - GraphQL API documentation
- `lib/arkiv/client.ts` - Arkiv client implementation
- `lib/graphql/README.md` - GraphQL implementation details
