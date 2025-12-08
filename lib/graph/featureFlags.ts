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
 * For client-side demo: checks localStorage for 'USE_GRAPHQL' override
 * 
 * @returns true if subgraph should be used, false otherwise
 */
export function useSubgraphForNetwork(): boolean {
  // Client-side: check localStorage for demo override
  if (typeof window !== 'undefined') {
    const localStorageOverride = localStorage.getItem('USE_GRAPHQL');
    if (localStorageOverride !== null) {
      return localStorageOverride === 'true';
    }
    
    // Check public env vars (available client-side in Next.js)
    const useSubgraph = process.env.NEXT_PUBLIC_USE_SUBGRAPH_FOR_NETWORK === 'true';
    const hasSubgraphUrl = !!process.env.NEXT_PUBLIC_GRAPH_SUBGRAPH_URL;
    return useSubgraph && hasSubgraphUrl;
  }
  
  // Server-side: check process.env
  if (typeof process !== 'undefined' && process.env) {
    const useSubgraph = process.env.USE_SUBGRAPH_FOR_NETWORK === 'true';
    const hasSubgraphUrl = !!process.env.GRAPH_SUBGRAPH_URL;
    return useSubgraph && hasSubgraphUrl;
  }
  
  return false;
}

