# GraphQL Integration

Location: `app/api/graphql/route.ts`, `lib/graphql/`

## Purpose

GraphQL interface over Arkiv's JSON-RPC indexer. Provides a query layer for Arkiv data while keeping Arkiv as the canonical store.

## Implementation

GraphQL API is a thin wrapper over Arkiv JSON-RPC. All resolvers use the same Arkiv functions as direct JSON-RPC calls. No custom indexing or filtering.

Components:
- API Route: `app/api/graphql/route.ts`
- Schema: `lib/graphql/schema.ts`
- Resolvers: `lib/graphql/resolvers.ts` (calls `lib/arkiv/*` helpers)
- Transformers: `lib/graphql/transformers.ts`

## GraphQL Client

Location: `lib/graph/client.ts`

Standardized GraphQL access for subgraphs and Arkiv GraphQL endpoints. Provides typed responses and centralized error handling. Endpoint resolution supports explicit override, environment variable, or local API route.

## Usage

```typescript
import { graphRequest } from '@/lib/graph/client';

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

GraphQL is used as an index and query layer. Arkiv remains the canonical store. All resolvers use the same Arkiv functions as direct JSON-RPC calls. This makes the GraphQL API a reusable tool for any Arkiv-based application.

See [GraphQL Tool Documentation](../../ARKIV_GRAPHQL_TOOL.md) for complete API documentation.

