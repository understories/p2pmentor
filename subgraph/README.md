# Mentorship Subgraph

The Graph subgraph for indexing Arkiv mentorship entities.

**Status:** Scaffold only - not yet implemented or deployed.

## Overview

This subgraph indexes Arkiv entities (profiles, asks, offers, sessions, feedback) and exposes them via GraphQL for the p2pmentor network and forest views.

See `docs/graph_indexing_plan.md` for the full implementation plan.

## Current State

- ✅ Schema defined (`schema.graphql`) - matches plan
- ⏸️ Manifest scaffold (`subgraph.yaml`) - needs Arkiv contract configuration
- ⏸️ Mapping handlers (`src/mappings/`) - placeholder TODOs

## Next Steps

1. Identify Arkiv contract address and ABI on Mendoza testnet
2. Configure data sources in `subgraph.yaml`
3. Implement event handlers in `src/mappings/arkiv.ts`
4. Test locally with Graph Node
5. Deploy to hosted service or self-hosted Graph Node
6. Update `GRAPH_SUBGRAPH_URL` in app environment

## Development

This subgraph is not yet buildable. Once implemented:

```bash
# Install Graph CLI
npm install -g @graphprotocol/graph-cli

# Generate code from schema
graph codegen

# Build
graph build

# Deploy (once configured)
graph deploy --node <graph-node-url> --ipfs <ipfs-url> <subgraph-name>
```

## References

- [The Graph Documentation](https://thegraph.com/docs/)
- [Subgraph Development Guide](https://thegraph.com/docs/en/developing/creating-a-subgraph/)
- `docs/graph_indexing_plan.md` - Implementation plan


