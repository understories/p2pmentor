/**
 * Feature flags for GraphQL integration
 * 
 * Controls whether to use GraphQL API vs direct Arkiv JSON-RPC queries.
 * Standardized on USE_GRAPHQL_FOR_* pattern with backwards compatibility.
 * 
 * Reference: refs/docs/sprint2.md
 */

/**
 * Read boolean environment variable
 */
function readBoolEnv(name: string | undefined): boolean {
  if (!name) return false;
  const value = typeof window !== 'undefined'
    ? process.env[`NEXT_PUBLIC_${name}`]
    : process.env[name];
  return value === 'true' || value === '1';
}

/**
 * Check if GraphQL should be used for network queries
 * 
 * Returns true if:
 * - USE_GRAPHQL_FOR_NETWORK is set to "true" (preferred), OR
 * - USE_SUBGRAPH_FOR_NETWORK is set to "true" (backwards-compat alias)
 * 
 * For client-side demo: checks localStorage for 'USE_GRAPHQL' override
 * 
 * @returns true if GraphQL should be used, false otherwise
 */
export function useGraphqlForNetwork(): boolean {
  // Client-side: check localStorage for demo override
  if (typeof window !== 'undefined') {
    const localStorageOverride = localStorage.getItem('USE_GRAPHQL');
    if (localStorageOverride !== null) {
      return localStorageOverride === 'true';
    }
    
    // Check new flag name (preferred)
    if (readBoolEnv('USE_GRAPHQL_FOR_NETWORK')) return true;
    // Backwards-compat alias
    if (readBoolEnv('USE_SUBGRAPH_FOR_NETWORK')) return true;
    
    return false;
  }
  
  // Server-side: check process.env
  if (typeof process !== 'undefined' && process.env) {
    // Check new flag name (preferred)
    if (readBoolEnv('USE_GRAPHQL_FOR_NETWORK')) return true;
    // Backwards-compat alias
    if (readBoolEnv('USE_SUBGRAPH_FOR_NETWORK')) return true;
  }
  
  return false;
}

/**
 * Check if GraphQL should be used for /me dashboard
 * 
 * @returns true if USE_GRAPHQL_FOR_ME is set to "true"
 */
export function useGraphqlForMe(): boolean {
  return readBoolEnv('USE_GRAPHQL_FOR_ME');
}

/**
 * Check if GraphQL should be used for profile pages
 * 
 * @returns true if USE_GRAPHQL_FOR_PROFILE is set to "true"
 */
export function useGraphqlForProfile(): boolean {
  return readBoolEnv('USE_GRAPHQL_FOR_PROFILE');
}

/**
 * Check if GraphQL should be used for asks page
 * 
 * @returns true if USE_GRAPHQL_FOR_ASKS is set to "true"
 */
export function useGraphqlForAsks(): boolean {
  return readBoolEnv('USE_GRAPHQL_FOR_ASKS');
}

/**
 * Check if GraphQL should be used for offers page
 * 
 * @returns true if USE_GRAPHQL_FOR_OFFERS is set to "true"
 */
export function useGraphqlForOffers(): boolean {
  return readBoolEnv('USE_GRAPHQL_FOR_OFFERS');
}

/**
 * @deprecated Use useGraphqlForNetwork() instead
 * Backwards-compatible alias for useGraphqlForNetwork()
 */
export function useSubgraphForNetwork(): boolean {
  return useGraphqlForNetwork();
}

