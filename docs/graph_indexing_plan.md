# GRAPH_INDEXING_PLAN.md  
Arkiv Mentorship Subgraph and Forest View Upgrade

Goal:  
Give the p2pmentor network and forest view a clean, decentralized indexing layer on top of Arkiv, using The Graph.  
Arkiv stays the canonical data layer. The Graph is the indexing and exploration lens.

This plan is the source of truth for graph indexing work.  
Do not invent behavior. Keep it aligned with this document and Arkiv documentation.

---

## 0. Current Implementation Alignment

Before the subgraph exists, all graph-related reads are done **directly against Arkiv**.

### 0.1 What we do today

- `/network` and `/network/forest` both use **`buildNetworkGraphData`** in `lib/arkiv/networkGraph.ts`.
- `buildNetworkGraphData` calls Arkiv helpers:
  - `listAsks`
  - `listOffers`
- Skills are **derived client-side**:
  - Lowercased, trimmed strings.
  - Node IDs follow the patterns:
    - `ask:<key>`
    - `offer:<key>`
    - `skill:<normalized-skill-name>`
- Edges in the current forest:
  - `ask → skill`
  - `offer → skill`
  - `ask ↔ offer` for simple matches (same skill, different wallets).

### 0.2 Status, TTL, and volume

- **Status filters:**
  - Asks: `status = "open"`
  - Offers: `status = "active"`
- **TTL / historical view:**
  - We now expose an `includeExpired` flag to allow historical asks/offers to show up.
- **Volume limits:**
  - Arkiv read helpers fetch up to **500** items for asks and offers.
  - The forest then applies a **client-side node cap** (currently 100 nodes: typically 25 asks + 25 offers + skills).

### 0.3 Payment flags

- Offers already carry payment-related fields from Arkiv:
  - `isPaid`
  - `cost`
  - `paymentAddress`
- The UI uses these to render **Free/Paid** badges.

### 0.4 What the subgraph will change

Subgraph integration is **net-new work**. It will:

- Add a **GraphQL client** (`lib/graph/*`) and `GRAPH_SUBGRAPH_URL` env.
- Introduce **subgraph entities** (`Offer`, `Ask`, `SkillRef`, etc.).
- Require an **adapter layer** that converts GraphQL results into the existing node/link shapes:
  - normalized lowercase skill names
  - node IDs `ask:<key>`, `offer:<key>`, `skill:<name>`.
- Mirror existing semantics:
  - free/paid flags
  - status vs expiration
  - include-expired vs active-only filters
  - volume caps similar to “500 fetched, 100 rendered”.

The rest of this plan describes what we are building on top of this current behavior.

---

## 1. Objectives

1. Make the forest view and network list run on a **subgraph** instead of custom JSON-RPC plumbing.
2. Expose reusable GraphQL APIs for profiles, skills, asks, offers, sessions, payments, and feedback.
3. Enable richer graph queries for the forest:
   - multi hop relationships  
   - recent activity filters  
   - skill and reputation based clustering
4. Position this work for future grants with:
   - Arkiv  
   - The Graph  
   - Optimism and OP Stack aligned programs

---

## 2. Architecture Overview

### 2.1 Data flow

1. **Arkiv**  
   - Stores all canonical entities:
     - `profile`
     - `ask`
     - `offer`
     - `session`
     - `session_payment_validation`
     - `feedback`
     - `jitsi_session` (or equivalent)
2. **The Graph Subgraph (Mentorship Subgraph)**  
   - Indexes Arkiv events or state for the entities above.
   - Exposes a GraphQL endpoint.
3. **p2pmentor App**  
   - Network list view and forest view query the subgraph.
   - The rest of the app continues to write to Arkiv as today.

Arkiv remains the single source of truth.  
If subgraph data disagrees, Arkiv wins.

---

## 3. Scope and Phases

We split work into three phases.

### Phase 1: Minimal Mentorship Subgraph (Beta+)

Focus on the entities needed for the network list and forest view.

Target entities inside the subgraph:

- `Profile`
- `SkillRef` (optional helper for normalized skills)
- `Ask`
- `Offer`
- `Session`
- `Feedback`

Phase 1 use cases:

- Query all active asks and offers by skill.
- Query profiles by skill and seniority.
- Query sessions by wallet.
- Compute simple matches (ask skill = offer skill).
- Preserve existing Arkiv behavior:
  - status `open` / `active`
  - TTL / expiration
  - `includeExpired` toggle
  - free/paid flags on offers.

### Phase 2: Payments and DX Entities

Extend subgraph with:

- `SessionPaymentValidation`
- `JitsiSession` (or `SessionMeta`)

Use cases:

- Show which sessions have validated payments.
- Show which sessions have Jitsi links.
- Filter out unpaid or unconfirmed sessions.
- Provide better DX analytics.

### Phase 3: Advanced Graph Queries

Once the subgraph is stable and has data:

- Multi hop queries:
  - “Mentors of mentors”
  - “Learners who became mentors”
- Time series queries:
  - activity windows
  - new skills
  - growth of skill clusters

Client code will need an **adapter** to reshape these richer results back into the existing `{ nodes, links }` structure used by `buildNetworkGraphData`.

---

## 4. Subgraph Design

### 4.1 Schema (Phase 1, aligned with today’s fields)

We mirror what we already store in Arkiv.  
In particular:

- Offers must include `isPaid`, `cost`, and `paymentAddress` so the Free/Paid logic continues to work.
- Status and TTL/expiration must be explicit so `includeExpired` can be recreated.

Draft schema:

```graphql
type Profile @entity {
  id: ID!                      # wallet address or Arkiv profile id
  wallet: String!
  displayName: String
  username: String
  bio: String
  timezone: String
  seniority: String
  skills: [SkillRef!]!
  availabilityWindow: String
  createdAt: BigInt!
  updatedAt: BigInt!
  asks: [Ask!]! @derivedFrom(field: "profile")
  offers: [Offer!]! @derivedFrom(field: "profile")
  sessionsAsMentor: [Session!]! @derivedFrom(field: "mentor")
  sessionsAsLearner: [Session!]! @derivedFrom(field: "learner")
  feedbackGiven: [Feedback!]! @derivedFrom(field: "from")
  feedbackReceived: [Feedback!]! @derivedFrom(field: "to")
}

type SkillRef @entity {
  id: ID!                      # normalized skill name, lowercase
  name: String!                # store as lowercase to match existing client logic
  profiles: [Profile!]! @derivedFrom(field: "skills")
  asks: [Ask!]! @derivedFrom(field: "skill")
  offers: [Offer!]! @derivedFrom(field: "skill")
}

type Ask @entity {
  id: ID!
  profile: Profile!
  wallet: String!
  skill: SkillRef!
  topic: String
  status: String!              # open / matched / closed
  createdAt: BigInt!
  expiresAt: BigInt            # derived from TTL; nullable
}

type Offer @entity {
  id: ID!
  profile: Profile!
  wallet: String!
  skill: SkillRef!
  topic: String
  isPaid: Boolean!             # mirrors Arkiv
  cost: BigInt                 # mirrors Arkiv `cost`
  paymentAddress: String       # mirrors Arkiv `paymentAddress`
  status: String!              # active / paused / closed
  availabilityWindow: String
  createdAt: BigInt!
  expiresAt: BigInt            # derived from TTL; nullable
}

type Session @entity {
  id: ID!
  mentor: Profile!
  learner: Profile!
  ask: Ask
  offer: Offer
  skill: SkillRef
  scheduledFor: BigInt
  durationMinutes: Int
  status: String!              # pending / scheduled / completed / cancelled
  paymentTxHash: String
  createdAt: BigInt!
}

type Feedback @entity {
  id: ID!
  session: Session!
  from: Profile!
  to: Profile!
  rating: Int!
  comment: String
  technicalFeedback: String
  createdAt: BigInt!
}
````

**Status and expiration rules**

* For asks:

  * `status = "open"` means not expired and not matched.
  * `expiresAt` = block timestamp + TTL.
* For offers:

  * `status = "active"` means not expired / not paused.
  * `expiresAt` = block timestamp + TTL.

Queries must be able to:

* Filter **active-only** (`status` plus `expiresAt > now`) and
* Include-expired (`includeExpired` flag → skip `expiresAt` filter).

---

## 5. Key Queries the App Needs

The forest and network list must be able to replicate **current behavior** first, then extend it.

### 5.1 Network overview (active-only vs includeExpired)

Used by `/network` and `/network/forest`:

```graphql
query NetworkOverview(
  $skill: String
  $limitSkills: Int!
  $limitAsks: Int!
  $limitOffers: Int!
  $now: BigInt!
  $includeExpired: Boolean!
) {
  skillRefs(
    where: { name_contains_nocase: $skill }
    first: $limitSkills
  ) {
    id
    name
    asks(
      where: {
        status: "open"
        expiresAt_gt: $now
      }
      first: $limitAsks
    ) @skip(if: $includeExpired) {
      id
      wallet
      createdAt
      status
    }
    asks(
      where: { status: "open" }
      first: $limitAsks
    ) @include(if: $includeExpired) {
      id
      wallet
      createdAt
      status
    }
    offers(
      where: {
        status: "active"
        expiresAt_gt: $now
      }
      first: $limitOffers
    ) @skip(if: $includeExpired) {
      id
      wallet
      isPaid
      cost
      paymentAddress
      createdAt
      status
    }
    offers(
      where: { status: "active" }
      first: $limitOffers
    ) @include(if: $includeExpired) {
      id
      wallet
      isPaid
      cost
      paymentAddress
      createdAt
      status
    }
  }
}
```

**Pagination / limits**

* Keep **per-query limits explicit**:

  * `$limitAsks`, `$limitOffers` capped (for example) at 500 to match current behavior.
* `buildNetworkGraphData` will still enforce a **render cap**:

  * e.g. only use the newest 25 asks + 25 offers when constructing `{ nodes, links }`.

### 5.2 Adapter layer

We must keep the existing client-side node/link format.

Create an adapter in `lib/graph/networkAdapter.ts` that:

* Takes raw GraphQL results (skillRefs + asks + offers).
* Normalizes skills to **lowercase** (already ensured by `SkillRef.name`).
* Builds node IDs:

  * `ask:<id>`
  * `offer:<id>`
  * `skill:<skillRef.name>`
* Builds only the current three link types:

  * `ask-skill`
  * `offer-skill`
  * `match` (ask ↔ offer with same skill and different wallets).

Phase 3 can add multi-hop or cluster edges, but **Phase 1 must first match today’s behavior**.

---

## 6. Technical Plan (Summary)

No change from the earlier version, but PM expectations clarified:

1. **New subgraph repo**
2. **New GraphQL client in `lib/graph/*` and `GRAPH_SUBGRAPH_URL` env**
3. **Adapter layer to match existing node/link shapes and semantics**
4. **Incremental migration**:

   * `/network` → subgraph
   * `buildNetworkGraphData` → subgraph + adapter
   * `/profiles/[wallet]` → subgraph for sessions/feedback

---

## 7. Testing and Validation

Key PM checkpoints:

* The forest and list views **show the same data** before and after migration for:

  * active-only mode
  * include-expired mode
  * Free/Paid badges
* Node counts in the forest remain **bounded** (no performance regressions).
* Skill matching, node IDs, and links behave identically from the user’s perspective.

---

## 8. Grants and Ecosystem Notes

(unchanged in spirit – subgraph is a reusable public good and a good basis for Arkiv + The Graph + Optimism ecosystem conversations.)

---

## 9. Status and Next Actions

**Current reality:** All reads go directly to Arkiv with JSON-RPC helpers.
**Subgraph work:** Not started; tracked as a net-new integration.

**Next actions:**

1. Implement the subgraph schema and mappings aligned with this document.
2. Add GraphQL client + adapter layer in the app.
3. Migrate `/network` and `/network/forest` to use subgraph queries while preserving behavior.
4. Update this document and `docs/PROGRESS_SUMMARY.md` as phases complete.
