# Arkiv Subgraph Implementation Notes

**Date**: Current Session  
**Status**: Contract Address Discovered, Implementation Approach Documented

---

## What We Discovered

### Contract Details (Via Transaction Inspection)

**Main Arkiv Contract:**
- Address: `0x00000000000000000000000000000061726b6976`
- Network: Mendoza testnet (OP Stack)
- Chain ID: `60138453056`
- RPC: `https://mendoza.hoodi.arkiv.network/rpc`

**Event Signatures Found:**
- `0x73dc52f9255c70375a8835a75fca19be3d9f6940536cccf5a7bc414368b389fa` (3 topics)
- `0xce4b4ad6891d716d0b1fba2b4aeb05ec20edadb01df512263d0dde423736bbb9` (2 topics)

**Event Structure (Observed):**
- Topic 0: Event signature hash
- Topic 1: Entity key (bytes32)
- Topic 2: Wallet address (for EntityCreated with 3 topics)
- Data: Expiration timestamp (uint256)

---

## Key Challenge: Entity Attributes Not in Events

**Problem:**
- Arkiv events only contain: `entityKey`, `spaceKey`, `creator`, `expiresAt`
- Entity attributes (type, wallet, skill, status, etc.) are **not** in event logs
- Attributes are stored separately and queried via Arkiv's indexer

**Implication:**
- Subgraph can index events (entity keys, creators, expiration)
- But to get full entity data, we need to query Arkiv's indexer
- This creates a dependency: Subgraph → Arkiv Indexer API

---

## Implementation Approaches

### Approach 1: Hybrid Indexing (Recommended)

**How it works:**
1. Subgraph indexes `EntityCreated` events (gets entityKey, creator, expiresAt)
2. Subgraph calls Arkiv indexer API to fetch full entity data
3. Parse attributes and create subgraph entities (Profile, Ask, Offer, etc.)

**Pros:**
- Full entity data available in subgraph
- Can build complete GraphQL schema
- Matches our existing query patterns

**Cons:**
- Requires Arkiv indexer API access from subgraph mappings
- May need to handle API rate limits
- More complex than pure event indexing

**Implementation:**
- Mappings call HTTP API or use AssemblyScript HTTP library
- Fetch entity by `entityKey` from Arkiv indexer
- Parse attributes and create subgraph entities

### Approach 2: Minimal Event Indexing + Resolver Enrichment

**How it works:**
1. Subgraph indexes only events (entityKey, creator, expiresAt)
2. GraphQL resolvers query Arkiv indexer to enrich data on-demand

**Pros:**
- Simpler subgraph mappings
- Always fresh data from Arkiv

**Cons:**
- GraphQL queries slower (need to call Arkiv API)
- Doesn't leverage subgraph's indexing power
- More API calls

### Approach 3: Direct Contract Storage Reading

**How it works:**
1. Subgraph reads entity data directly from contract storage
2. Parse storage slots to extract attributes

**Pros:**
- No external API dependency
- Pure blockchain indexing

**Cons:**
- Requires understanding Arkiv's storage layout
- May not be possible if attributes stored off-chain
- Complex storage slot calculations

---

## Recommended Path Forward

**Phase 1: Minimal Event Indexing**
- Index `EntityCreated` events
- Store: entityKey, creator, expiresAt, blockNumber
- This gives us entity lifecycle tracking

**Phase 2: Enrichment Strategy**
- Option A: Call Arkiv indexer from mappings (if HTTP supported)
- Option B: Enrich in GraphQL resolvers (simpler, but slower)
- Option C: Hybrid - cache frequently accessed entities in subgraph

**Phase 3: Full Implementation**
- Parse entity attributes
- Create typed entities (Profile, Ask, Offer, etc.)
- Build relationships (Profile → Ask/Offer, SkillRef links)

---

## Current Subgraph Status

✅ **Completed:**
- Contract address discovered
- Event signatures identified
- Subgraph.yaml configured
- Minimal ABI created
- Mapping handlers scaffolded

⏸️ **Next Steps:**
1. Test if subgraph mappings can call HTTP APIs
2. Implement entity enrichment (Approach 1 or 2)
3. Parse entity attributes and create typed entities
4. Test locally with Graph Node
5. Deploy to hosted service

---

## Files Updated

- `subgraph/subgraph.yaml` - Configured with discovered contract address
- `subgraph/abis/Arkiv.json` - Minimal ABI based on observed events
- `subgraph/src/mappings/arkiv.ts` - Event handlers scaffolded
- `scripts/inspect-arkiv-transaction.ts` - Transaction inspection tool
- `scripts/decode-arkiv-events.ts` - Event decoding tool
- `scripts/analyze-arkiv-patterns.ts` - Pattern analysis tool

---

## Testing the Subgraph

Once enrichment strategy is implemented:

```bash
# Install Graph CLI
npm install -g @graphprotocol/graph-cli

# Generate code from schema
cd subgraph
graph codegen

# Build
graph build

# Deploy locally (requires Graph Node)
graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 p2pmentor-mentorship

# Or deploy to hosted service
graph deploy --studio p2pmentor-mentorship
```

---

## Questions to Resolve

1. **Can subgraph mappings call HTTP APIs?**
   - Need to test if AssemblyScript HTTP library works
   - Or use subgraph's built-in HTTP capabilities

2. **Arkiv Indexer API Endpoint:**
   - What's the endpoint to query entity by key?
   - Is it publicly accessible?
   - Any authentication required?

3. **Event Signature Verification:**
   - Can we verify our ABI matches actual contract?
   - Should we try to get official ABI from Arkiv?

4. **Storage Layout:**
   - Are entity attributes stored on-chain?
   - Or only in indexer database?

---

## References

- Transaction inspection: `scripts/inspect-arkiv-transaction.ts`
- Event analysis: `scripts/decode-arkiv-events.ts`
- Pattern discovery: `scripts/analyze-arkiv-patterns.ts`
- Implementation plan: `docs/graph_indexing_plan.md`

