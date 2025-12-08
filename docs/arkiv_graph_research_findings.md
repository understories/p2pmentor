# Arkiv + The Graph Integration Research Findings

**Date**: Current Session  
**Status**: Research Complete - Ready for Discord Questions

---

## What We Know (From Research)

### 1. Arkiv Architecture

**3-Layer System:**
- **Layer 1**: Ethereum Mainnet (settlement, security, proof verification)
- **Layer 2**: Arkiv Coordination Layer (data management, registry, DB-chain sync, deterministic queries)
- **Layer 3**: Specialized DB-Chains (high-performance CRUD, JSON-RPC, indexed queries, programmable expiration)

**Key Insight**: Arkiv has its own indexer/API layer that we query via JSON-RPC, not raw blockchain events.

### 2. Our Current Integration

**SDK Usage:**
- Package: `@arkiv-network/sdk@^0.4.4`
- Network: Mendoza testnet (OP Stack)
- RPC Endpoint: `https://mendoza.hoodi.arkiv.network/rpc`
- Chain ID: `60138453056` (from SDK `mendoza` chain config)

**How We Interact:**
- **Write**: `walletClient.createEntity()` → Returns `{ entityKey, txHash }`
  - Creates entities on-chain via blockchain transaction
  - SDK abstracts the contract interaction
- **Read**: `publicClient.buildQuery().where(...).fetch()`
  - Queries Arkiv's indexer via JSON-RPC
  - Filters by attributes (`type`, `wallet`, `status`, etc.)
  - Returns entities with `attributes` and `payload` fields

**Entity Structure:**
- Entities have: `key` (entityKey), `attributes` (key-value pairs), `payload` (encoded content)
- Attributes include: `type`, `wallet`, `skill`, `status`, `createdAt`, `ttlSeconds`, etc.
- Payload contains JSON-encoded data (message, availabilityWindow, etc.)

### 3. What We Built (Graph Infrastructure)

**Completed:**
- ✅ GraphQL client (`lib/graph/client.ts`) - ready for any GraphQL endpoint
- ✅ Network query helpers (`lib/graph/networkQueries.ts`) - GraphQL query defined
- ✅ Network adapter (`lib/graph/networkAdapter.ts`) - converts GraphQL → existing format
- ✅ Subgraph scaffold (`subgraph/`) - schema, manifest placeholder, mapping TODOs

**What We're Waiting For:**
- Understanding how to connect The Graph to Arkiv data

---

## What We DON'T Know (Need to Ask)

### Critical Questions for Discord

#### Question 1: Does Arkiv Expose GraphQL?

**What we need:**
- Does Arkiv's indexer/API layer expose a GraphQL endpoint?
- If yes, what's the endpoint URL for Mendoza testnet?
- What's the GraphQL schema? (Does it match our subgraph schema?)

**Why it matters:**
- If yes → We can point `GRAPH_SUBGRAPH_URL` to Arkiv's GraphQL endpoint
- No subgraph development needed
- Just adapt our queries to match Arkiv's schema

**Follow-up if yes:**
- Can we query by attributes (type, wallet, status)?
- Does it support filtering by expiration/TTL?
- What are the query limits?

---

#### Question 2: If No GraphQL, What's the Contract Architecture?

**What we need:**
- **Contract Address**: What's the Arkiv contract address on Mendoza testnet?
- **Contract ABI**: Can we get the ABI, especially for entity creation events?
- **Event Signatures**: What events does Arkiv emit?
  - `EntityCreated(bytes32 entityKey, ...)`?
  - `EntityUpdated(...)`?
  - `EntityExpired(...)`?
- **Storage Pattern**: How are entity attributes stored on-chain?
  - Are they in event logs?
  - In contract storage?
  - In calldata?

**Why it matters:**
- If no GraphQL → We need to build our own subgraph
- Subgraph needs contract address + ABI to index events
- Mappings need to parse entity attributes from events

**Follow-up:**
- Is there documentation on the contract interface?
- Are there example subgraphs indexing Arkiv?
- What's the recommended approach for indexing Arkiv entities?

---

#### Question 3: Alternative: Can We Query Arkiv Indexer Directly?

**What we need:**
- Can we query Arkiv's JSON-RPC indexer with GraphQL-like queries?
- Is there a way to get richer queries (multi-hop, aggregations) from the indexer?
- Would it be better to build a thin GraphQL wrapper around Arkiv's JSON-RPC?

**Why it matters:**
- If Arkiv indexer is powerful enough, we might not need The Graph
- Or we could build a simple GraphQL proxy that calls Arkiv's JSON-RPC

---

#### Question 4: Entity Lifecycle & Events

**What we need:**
- When an entity is created via `createEntity()`, what happens on-chain?
- Are there events emitted we can index?
- How do we detect entity expiration? (Is there an event, or do we calculate from TTL?)
- Can entities be updated, or are they immutable? (We see "latest" pattern in our code)

**Why it matters:**
- Subgraph needs to know what events to listen for
- Need to understand expiration handling
- Update patterns affect how we index

---

#### Question 5: Best Practices for Indexing Arkiv

**What we need:**
- Has anyone built a subgraph for Arkiv before?
- What's the recommended approach?
- Are there any gotchas or special considerations?
- Should we index from Layer 1 (Mainnet) or Layer 3 (DB-Chains)?

**Why it matters:**
- Learn from others' experience
- Avoid common pitfalls
- Choose the right indexing strategy

---

## Research Summary

### What We Figured Out Ourselves ✅

✅ **Arkiv Architecture**: 3-layer system with indexer/API layer  
✅ **Our Integration**: SDK abstracts contract details, we query indexer  
✅ **Entity Structure**: Attributes + payload pattern  
✅ **Network Details**: Mendoza testnet, OP Stack, RPC endpoint known  
✅ **Graph Infrastructure**: Client, queries, adapter all ready  
✅ **Contract Address**: `0x00000000000000000000000000000061726b6976` (discovered via transaction inspection)  
✅ **Event Signatures**: Identified via transaction log analysis  
✅ **Key Challenge**: Entity attributes not in events - stored separately in indexer  

### Critical Discovery

**Entity attributes (type, wallet, skill, etc.) are NOT in blockchain events!**

- Events contain: entityKey, spaceKey, creator, expiresAt
- Attributes are stored separately and queried via Arkiv's indexer
- This means subgraph needs to call Arkiv indexer API to get full entity data

### Practical Solution: GraphQL Wrapper Around Arkiv Indexer

**Instead of building a full subgraph**, we can build a **GraphQL API that wraps Arkiv's JSON-RPC indexer**:

1. Create a Next.js API route that accepts GraphQL queries
2. Translate GraphQL queries to Arkiv JSON-RPC queries
3. Return GraphQL responses
4. Deploy as our own GraphQL endpoint

**Benefits:**
- ✅ No subgraph development needed
- ✅ Direct access to Arkiv's indexer (already optimized)
- ✅ Full control over schema
- ✅ Can cache/optimize queries
- ✅ Works immediately with our existing code

**Implementation:**
- Use `graphql` and `graphql-http` libraries
- Create resolvers that call our existing `listAsks()`, `listOffers()`, etc.
- Expose at `/api/graphql` endpoint
- Point `GRAPH_SUBGRAPH_URL` to our own endpoint

See `docs/arkiv_subgraph_implementation_notes.md` for subgraph approach details.  

---

## Recommended Discord Message Structure

### Option A: If Asking About GraphQL (Start Here)

```
Hi! We're building p2pmentor on Arkiv and want to add GraphQL queries for our network view.

Question: Does Arkiv's indexer expose a GraphQL endpoint for Mendoza testnet?
- If yes, what's the endpoint URL and schema?
- If no, what's the recommended way to get GraphQL access to Arkiv entities?

Context: We currently query via JSON-RPC (`publicClient.buildQuery()`), but want GraphQL for richer queries and The Graph ecosystem integration.

Thanks!
```

### Option B: If Asking About Subgraph Development

```
Hi! We're building p2pmentor on Arkiv and want to create a Graph subgraph to index our entities.

Questions:
1. What's the Arkiv contract address on Mendoza testnet?
2. Can we get the contract ABI, especially entity creation events?
3. What events does Arkiv emit? (EntityCreated, EntityUpdated, etc.)
4. How are entity attributes stored on-chain? (event logs, storage, calldata?)
5. Has anyone built an Arkiv subgraph before? Any examples or best practices?

Context: We use `@arkiv-network/sdk` which abstracts contract details, but for subgraph we need the underlying contract info.

Thanks!
```

### Option C: Comprehensive Question (Recommended)

```
Hi! We're building p2pmentor on Arkiv and exploring GraphQL integration options.

Current setup:
- Using @arkiv-network/sdk v0.4.4
- Mendoza testnet (OP Stack)
- Querying via `publicClient.buildQuery()` (JSON-RPC to Arkiv indexer)
- Entities: profiles, asks, offers, sessions, feedback

Goal: Add GraphQL queries for network/forest view (better queries, The Graph ecosystem).

Questions:
1. Does Arkiv expose GraphQL? If yes, endpoint URL and schema?
2. If no, what's the contract address/ABI on Mendoza for building a subgraph?
3. What events does Arkiv emit for entity creation/updates?
4. Best practices for indexing Arkiv entities with The Graph?
5. Any existing Arkiv subgraph examples?

We've built the Graph client infrastructure already - just need to understand the connection point.

Thanks!
```

---

## Next Steps After Discord Response

1. **If GraphQL exists**: Adapt our queries to Arkiv's schema, test endpoint
2. **If building subgraph**: Get contract details, implement mappings, deploy
3. **If alternative approach**: Evaluate and implement recommended solution
4. **Update docs**: Revise `graph_indexing_plan.md` with chosen path
5. **Implement**: Wire GraphQL into `/network` and `/network/forest`

---

## Files to Reference

- `docs/graph_indexing_plan.md` - Full implementation plan
- `docs/arkiv_graph_integration_analysis.md` - Architecture analysis
- `lib/graph/` - Graph client, queries, adapter (ready to use)
- `subgraph/` - Subgraph scaffold (ready for implementation)

