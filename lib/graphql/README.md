# Arkiv GraphQL API

GraphQL interface over Arkiv's JSON-RPC indexer. Reusable tool for any Arkiv-based application.

## Overview

This GraphQL API provides a clean, type-safe interface to query Arkiv entities (profiles, asks, offers, skills) using GraphQL instead of direct JSON-RPC calls.

**Benefits:**
- ✅ GraphQL query language (familiar, powerful)
- ✅ Type-safe queries and responses
- ✅ Ecosystem tooling (Apollo, Relay, etc.)
- ✅ Reusable across Arkiv applications
- ✅ Can be extracted as standalone service

## Usage

### Endpoint

```
POST /api/graphql
GET /api/graphql (info endpoint)
```

### Example Query

```graphql
query NetworkOverview {
  networkOverview(limitAsks: 25, limitOffers: 25) {
    skillRefs {
      id
      name
      asks {
        id
        wallet
        skill
        status
        createdAt
      }
      offers {
        id
        wallet
        skill
        isPaid
        cost
        status
      }
    }
  }
}
```

### Using the GraphQL Client

```typescript
import { graphRequest } from '@/lib/graph/client';

// Point client to our GraphQL endpoint
process.env.GRAPH_SUBGRAPH_URL = 'http://localhost:3000/api/graphql';

const data = await graphRequest(`
  query {
    networkOverview(limitAsks: 10) {
      skillRefs {
        name
        asks { id wallet skill }
      }
    }
  }
`);
```

## Schema

See `lib/graphql/schema.ts` for full schema definition.

**Main Types:**
- `Query` - Root query type
- `NetworkOverview` - Network graph data
- `SkillRef` - Skill with related asks/offers
- `Profile` - User profile
- `Ask` - Learning request
- `Offer` - Teaching offer

## Architecture

```
GraphQL Client
    ↓ GraphQL Query
/app/api/graphql/route.ts
    ↓ Resolves query
lib/graphql/resolvers.ts
    ↓ Calls Arkiv helpers
lib/arkiv/* (listAsks, listOffers, etc.)
    ↓ JSON-RPC
Arkiv Indexer
    ↓ Returns entities
lib/graphql/transformers.ts
    ↓ Transforms to GraphQL
GraphQL Response
```

## Resolvers

Resolvers in `lib/graphql/resolvers.ts` translate GraphQL queries to Arkiv JSON-RPC:

- `networkOverview` → `listAsks()` + `listOffers()`
- `profile` → `getProfileByWallet()`
- `asks` → `listAsks()` or `listAsksForWallet()`
- `offers` → `listOffers()` or `listOffersForWallet()`

## Transformers

Transformers in `lib/graphql/transformers.ts` convert Arkiv entities to GraphQL types:

- `transformAsk()` - Ask → GraphQL Ask
- `transformOffer()` - Offer → GraphQL Offer
- `transformProfile()` - Profile → GraphQL Profile
- `createSkillRef()` - Builds SkillRef with asks/offers

## Extracting as Standalone Service

This can be extracted into a standalone service:

1. Copy `lib/graphql/` to new repo
2. Copy `lib/arkiv/` (or make it a dependency)
3. Create Express/Fastify server instead of Next.js route
4. Deploy as `graphql.arkiv.network` or similar

See `docs/arkiv_graphql_wrapper_approach.md` for extraction details.

## Testing

```bash
# Start dev server
pnpm dev

# Query via curl
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ networkOverview { skillRefs { name } } }"
  }'
```

## Integration with p2pmentor

To use this GraphQL API in p2pmentor:

1. Set `GRAPH_SUBGRAPH_URL=http://localhost:3000/api/graphql` (or production URL)
2. Set `USE_SUBGRAPH_FOR_NETWORK=true`
3. Update `lib/arkiv/networkGraph.ts` to use GraphQL path (see TODO there)

The existing GraphQL client (`lib/graph/client.ts`) and adapter (`lib/graph/networkAdapter.ts`) are ready to use!


