# GraphQL API and Client

## GraphQL API

Location: `app/api/graphql/route.ts`

Wraps Arkiv JSON-RPC indexer with GraphQL interface.

- Schema: `lib/graphql/schema.ts`
- Resolvers: `lib/graphql/resolvers.ts` (calls `lib/arkiv/*` helpers)
- Transformers: `lib/graphql/transformers.ts`

## GraphQL client

Location: `lib/graph/client.ts`

Standardized GraphQL access for subgraphs and Arkiv GraphQL endpoints. Typed responses and centralized error handling. Endpoint resolution: explicit override, environment variable, local API route. Thin wrapper around fetch with clear error types.

## Usage

```typescript
import { graphRequest } from '@/lib/graph/client';

// Point to our GraphQL endpoint
process.env.GRAPH_SUBGRAPH_URL = 'http://localhost:3000/api/graphql';

const data = await graphRequest(`
  query {
    networkOverview(limitAsks: 10, limitOffers: 10) {
      skillRefs {
        name
        asks { id wallet skill }
        offers { id wallet skill }
      }
    }
  }
`);
```

## Philosophy

GraphQL used as an index and query layer. Arkiv remains the canonical store. All resolvers use the same Arkiv functions as direct JSON-RPC calls.

See [GraphQL Tool Documentation](../../../ARKIV_GRAPHQL_TOOL.md) for complete API documentation.
