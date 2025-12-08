# GraphQL Wrapper Around Arkiv Indexer (Practical Solution)

**Date**: Current Session  
**Status**: Recommended Approach - Simpler than Full Subgraph

---

## The Problem We Solved

We discovered that:
1. Arkiv contract events don't contain entity attributes (type, wallet, skill, etc.)
2. Attributes are stored separately and queried via Arkiv's indexer
3. Building a full subgraph would require calling Arkiv indexer API anyway

**Solution**: Build a GraphQL API that wraps Arkiv's existing JSON-RPC indexer.

---

## Architecture

```
p2pmentor App
    ↓ GraphQL Query
/app/api/graphql (Next.js API Route)
    ↓ Translates to Arkiv queries
lib/arkiv/* (Existing helpers)
    ↓ JSON-RPC
Arkiv Indexer (https://mendoza.hoodi.arkiv.network/rpc)
```

**Benefits:**
- ✅ No subgraph development needed
- ✅ Uses existing Arkiv indexer (already optimized)
- ✅ Full control over GraphQL schema
- ✅ Can add caching/optimization
- ✅ Works immediately

---

## Implementation Plan

### Step 1: GraphQL Server Setup

Create `/app/api/graphql/route.ts`:

```typescript
import { graphql, buildSchema } from 'graphql';
import { listAsks } from '@/lib/arkiv/asks';
import { listOffers } from '@/lib/arkiv/offers';
// ... other imports

const schema = buildSchema(`
  type Query {
    networkOverview(
      skill: String
      limitAsks: Int
      limitOffers: Int
      includeExpired: Boolean
    ): NetworkOverview
  }
  
  type NetworkOverview {
    skillRefs: [SkillRef!]!
  }
  
  # ... rest of schema matching our subgraph schema
`);

const rootValue = {
  networkOverview: async (args) => {
    // Call existing Arkiv helpers
    const [asks, offers] = await Promise.all([
      listAsks({ limit: args.limitAsks, includeExpired: args.includeExpired }),
      listOffers({ limit: args.limitOffers, includeExpired: args.includeExpired }),
    ]);
    
    // Transform to GraphQL format
    return transformToGraphQL(asks, offers, args.skill);
  },
};

export async function POST(request: Request) {
  const { query, variables } = await request.json();
  const result = await graphql({ schema, source: query, rootValue, variableValues: variables });
  return Response.json(result);
}
```

### Step 2: Use Existing Adapter

Our `lib/graph/networkAdapter.ts` already transforms Arkiv data to GraphQL format!
We can reuse it:

```typescript
// In GraphQL resolver
const raw = await fetchNetworkOverviewFromArkiv(args);
return adaptNetworkOverviewToGraphData(raw, args);
```

### Step 3: Point Client to Our Endpoint

```typescript
// .env
GRAPH_SUBGRAPH_URL=http://localhost:3000/api/graphql
USE_SUBGRAPH_FOR_NETWORK=true
```

---

## Comparison: Wrapper vs Subgraph

| Aspect | GraphQL Wrapper | Full Subgraph |
|--------|----------------|---------------|
| **Development Time** | 1-2 days | 1-2 weeks |
| **Complexity** | Low (reuse existing code) | High (new indexing layer) |
| **Data Source** | Arkiv indexer (direct) | Blockchain events + Arkiv API |
| **Performance** | Good (cached queries) | Excellent (pre-indexed) |
| **Maintenance** | Low (just API route) | Medium (subgraph updates) |
| **Dependencies** | None (uses existing) | Graph Node, IPFS |

**Recommendation**: Start with GraphQL wrapper, migrate to subgraph later if needed.

---

## Implementation Steps

1. ✅ Graph client ready (`lib/graph/client.ts`)
2. ✅ Query helpers ready (`lib/graph/networkQueries.ts`)
3. ✅ Adapter ready (`lib/graph/networkAdapter.ts`)
4. ⏸️ Create GraphQL API route (`/app/api/graphql/route.ts`)
5. ⏸️ Define GraphQL schema (match our subgraph schema)
6. ⏸️ Implement resolvers (call existing Arkiv helpers)
7. ⏸️ Test with GraphQL client
8. ⏸️ Wire into `/network` and `/network/forest`

---

## Files to Create

- `app/api/graphql/route.ts` - GraphQL endpoint
- `lib/graphql/schema.ts` - GraphQL schema definition
- `lib/graphql/resolvers.ts` - Query resolvers

---

## Next Steps

1. Implement GraphQL API route
2. Test with our existing GraphQL client
3. Wire into network views
4. Optionally: Add caching layer for performance
5. Later: Consider full subgraph if we need blockchain-level indexing

---

## Why This Works Better

**The Graph subgraph is designed for:**
- Indexing raw blockchain events
- Complex on-chain data relationships
- Decentralized query infrastructure

**Our use case:**
- Data already indexed by Arkiv
- Need GraphQL interface
- Want to leverage existing Arkiv indexer

**Solution:**
- GraphQL wrapper = perfect fit
- Subgraph = overkill (but good for future if needed)

