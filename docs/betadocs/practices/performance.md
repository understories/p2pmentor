# Performance Without Compromise

## GraphQL as index layer

Use GraphQL and indexing to improve UX, not to re-centralize data. Cache and logs treated as disposable. Data needed for long-term value is stored on Arkiv, not only in application databases.

## Performance tracking

All performance measurements stored on Arkiv as `dx_metric` and `perf_snapshot` entities. All data verifiable on-chain via transaction hashes. Measurements include timestamps, operation names, and source ('arkiv' vs 'graphql').

## Philosophy

Optimize performance without compromising sovereignty. Treat performance logs as transparent and verifiable.
