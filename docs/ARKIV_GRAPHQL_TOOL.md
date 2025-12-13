# Arkiv GraphQL API Tool

**Status**: ✅ Implemented and Ready to Use  
**Location**: `/app/api/graphql` + `/lib/graphql/`

---

## What This Is

A **GraphQL API** that wraps Arkiv's JSON-RPC indexer, providing a GraphQL interface for querying Arkiv entities.

**Reusable tool** that can be:
- Used by p2pmentor immediately
- Extracted as standalone service
- Shared with Arkiv ecosystem
- Demonstrated to The Graph team

---

## Quick Start

### 1. Start the Server

```bash
pnpm dev
```

GraphQL endpoint available at: `http://localhost:3000/api/graphql`

### 2. Test the API

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{
      networkOverview(limitAsks: 10, limitOffers: 10) {
        skillRefs {
          name
          asks { id wallet skill }
          offers { id wallet skill isPaid }
        }
      }
    }"
  }'
```

### 3. Use in Code

```typescript
import { graphRequest } from '@/lib/graph/client';

// Point to our GraphQL endpoint
process.env.GRAPH_SUBGRAPH_URL = 'http://localhost:3000/api/graphql';

const data = await graphRequest(`
  query {
    profile(wallet: "0x...") {
      displayName
      skills
      asks { id skill }
    }
  }
`);
```

---

## Architecture

```
┌─────────────────┐
│  GraphQL Client  │
│  (any app)       │
└────────┬─────────┘
         │ GraphQL Query
         ↓
┌─────────────────┐
│ /api/graphql    │
│ (Next.js route) │
└────────┬─────────┘
         │ Resolves
         ↓
┌─────────────────┐
│  Resolvers      │
│  (lib/graphql)  │
└────────┬─────────┘
         │ Calls Arkiv
         ↓
┌─────────────────┐
│  Arkiv Helpers  │
│  (lib/arkiv/*)  │
└────────┬─────────┘
         │ JSON-RPC
         ↓
┌─────────────────┐
│  Arkiv Indexer  │
│  (mendoza RPC)  │
└─────────────────┘
```

---

## Features

✅ **Full GraphQL Schema** - Profiles, Asks, Offers, Skills  
✅ **Type-Safe** - TypeScript throughout  
✅ **Reuses Existing Code** - Calls `listAsks()`, `listOffers()`, etc.  
✅ **Efficient** - Leverages Arkiv's optimized indexer  
✅ **Extensible** - Easy to add new queries/types  

---

## Schema Overview

```graphql
type Query {
  # Network graph data
  networkOverview(...): NetworkOverview
  
  # Profiles
  profile(wallet: String!): Profile
  profiles(...): [Profile!]!
  
  # Asks
  asks(...): [Ask!]!
  ask(key: String!): Ask
  
  # Offers
  offers(...): [Offer!]!
  offer(key: String!): Offer
  
  # Skills
  skills(...): [SkillRef!]!
  skill(name: String!): SkillRef
}
```

See `lib/graphql/schema.ts` for full schema.

---

## Example Queries

### Network Overview

```graphql
query {
  networkOverview(
    skill: "react"
    limitAsks: 25
    limitOffers: 25
    includeExpired: false
  ) {
    skillRefs {
      id
      name
      asks {
        id
        wallet
        skill
        status
      }
      offers {
        id
        wallet
        skill
        isPaid
        cost
      }
    }
  }
}
```

### Profile with Related Data

```graphql
query {
  profile(wallet: "0x4b6D14e3ad668a2273Ce3Cf9A22cda202f404c5F") {
    displayName
    skills
    asks {
      id
      skill
      status
    }
    offers {
      id
      skill
      isPaid
    }
  }
}
```

### Skills Search

```graphql
query {
  skills(search: "react", limit: 10) {
    id
    name
    asks(limit: 5) {
      id
      wallet
    }
    offers(limit: 5) {
      id
      wallet
      isPaid
    }
  }
}
```

---

## Integration with p2pmentor

### Current Status

✅ GraphQL API implemented  
✅ GraphQL client ready (`lib/graph/client.ts`)  
✅ Adapter ready (`lib/graph/networkAdapter.ts`)  
⏸️ Not yet wired into `/network` views  

### To Enable

1. Set environment variable:
   ```bash
   GRAPH_SUBGRAPH_URL=http://localhost:3000/api/graphql
   USE_SUBGRAPH_FOR_NETWORK=true
   ```

2. Update `lib/arkiv/networkGraph.ts` (see TODO comment there)

3. Test with forest view at `/network/forest`

---

## Extracting as Standalone Service

This can be extracted into a standalone npm package or service:

### Option 1: NPM Package

```bash
# New repo: arkiv-graphql
arkiv-graphql/
├── src/
│   ├── schema.ts
│   ├── resolvers.ts
│   ├── transformers.ts
│   └── server.ts
├── package.json
└── README.md
```

**Usage:**
```typescript
import { createArkivGraphQLServer } from 'arkiv-graphql';

const server = createArkivGraphQLServer({
  arkivRpcUrl: 'https://mendoza.hoodi.arkiv.network/rpc',
});

server.listen(4000);
```

### Option 2: Docker Service

```dockerfile
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "server.js"]
```

Deploy to `graphql.arkiv.network` or similar.

---

## For Arkiv Team (DevRel)

**What This Provides:**
- ✅ GraphQL interface for Arkiv (missing piece)
- ✅ Reference implementation
- ✅ Can be featured in Arkiv docs
- ✅ Community contribution opportunity

**Next Steps:**
- Review schema design
- Consider hosting at `graphql.arkiv.network`
- Add to official Arkiv examples
- Maintain as community project

---

## For The Graph Team

**What This Demonstrates:**
- ✅ Arkiv as data source for GraphQL ecosystem
- ✅ Integration pattern for The Graph
- ✅ Reference implementation for Arkiv-based subgraphs
- ✅ Potential grant opportunity (public good)

**Discussion Points:**
- Is this a valid integration approach?
- Should we also build full subgraph?
- Grant application potential?
- Ecosystem partnership?

---

## Files

- `app/api/graphql/route.ts` - GraphQL endpoint
- `lib/graphql/schema.ts` - GraphQL schema
- `lib/graphql/resolvers.ts` - Query resolvers
- `lib/graphql/transformers.ts` - Entity transformers
- `lib/graphql/README.md` - Technical documentation

---

## Testing

```bash
# Test with curl
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ networkOverview { skillRefs { name } } }"}'

# Test with GraphQL client
import { graphRequest } from '@/lib/graph/client';
const data = await graphRequest('{ networkOverview { skillRefs { name } } }');
```

---

## Next Steps

1. ✅ **Implemented** - GraphQL API ready
2. ⏸️ **Test** - Verify queries work correctly
3. ⏸️ **Wire** - Connect to `/network` views
4. ⏸️ **Share** - Present to Arkiv and The Graph teams
5. ⏸️ **Extract** - Optionally extract as standalone service

---

## Status

**Ready to use!** The GraphQL API is implemented and can be used immediately. It's a practical tool that solves the GraphQL interface need while being reusable and shareable.


