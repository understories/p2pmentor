/**
 * Feature flags for Graph subgraph integration
 * 
 * Controls whether to use The Graph subgraph vs direct Arkiv queries.
 * 
 * Reference: docs/graph_indexing_plan.md
 */

/**
 * Check if subgraph should be used for network queries
 * 
 * Returns true only if:
 * - USE_SUBGRAPH_FOR_NETWORK is explicitly set to "true"
 * - GRAPH_SUBGRAPH_URL is configured
 * 
 * @returns true if subgraph should be used, false otherwise
 */
export function useSubgraphForNetwork(): boolean {
  const useSubgraph = process.env.USE_SUBGRAPH_FOR_NETWORK === 'true';
  const hasSubgraphUrl = !!process.env.GRAPH_SUBGRAPH_URL;

  return useSubgraph && hasSubgraphUrl;
}

