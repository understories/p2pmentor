# GraphQL and Performance

For architectural rationale, see [Serverless and Trustless](../philosophy/serverless-and-trustless.md).

## GraphQL API

Location: `app/api/graphql/route.ts`

Wraps Arkiv JSON-RPC indexer with GraphQL interface.

- Schema: `lib/graphql/schema.ts`
- Resolvers: `lib/graphql/resolvers.ts` (calls `lib/arkiv/*` helpers)
- Transformers: `lib/graphql/transformers.ts`

## GraphQL client

Location: `lib/graph/client.ts`

Standardized GraphQL access for subgraphs and Arkiv GraphQL endpoints. Typed responses and centralized error handling. Endpoint resolution: explicit override, environment variable, local API route. Thin wrapper around fetch with clear error types.

## Philosophy

GraphQL used as an index and query layer. Arkiv remains the canonical store. All resolvers use the same Arkiv functions as direct JSON-RPC calls. Performance tooling is transparent and measurable.

## Performance tracking

Location: `lib/arkiv/perfSnapshots.ts`, `lib/arkiv/dxMetrics.ts`

Performance metrics stored as `dx_metric` entities on Arkiv. Performance snapshots stored as `perf_snapshot` entities. All data verifiable on-chain via transaction hashes. All measurements include timestamps, operation names, and source ('arkiv' vs 'graphql').

See [GraphQL Tool Documentation](../../../ARKIV_GRAPHQL_TOOL.md) for detailed API documentation.
