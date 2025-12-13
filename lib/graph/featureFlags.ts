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
 * Client-side: Fetches from /api/graphql-flags endpoint
 * Server-side: Reads from process.env
 * 
 * @returns true if USE_GRAPHQL_FOR_PROFILE is set to "true"
 */
export async function useGraphqlForProfile(): Promise<boolean>;
export function useGraphqlForProfile(): boolean;
export function useGraphqlForProfile(): boolean | Promise<boolean> {
  // Client-side: fetch from API endpoint
  if (typeof window !== 'undefined') {
    return fetch('/api/graphql-flags')
      .then(res => res.json())
      .then(data => data.ok && data.flags?.profile === true)
      .catch(() => false);
  }
  
  // Server-side: read from env
  return readBoolEnv('USE_GRAPHQL_FOR_PROFILE');
}

/**
 * Check if GraphQL should be used for asks page
 * 
 * Client-side: Fetches from /api/graphql-flags endpoint
 * Server-side: Reads from process.env
 * 
 * @returns true if USE_GRAPHQL_FOR_ASKS is set to "true"
 */
export async function useGraphqlForAsks(): Promise<boolean>;
export function useGraphqlForAsks(): boolean;
export function useGraphqlForAsks(): boolean | Promise<boolean> {
  // Client-side: fetch from API endpoint
  if (typeof window !== 'undefined') {
    // Return a promise that fetches the flag
    return fetch('/api/graphql-flags')
      .then(res => res.json())
      .then(data => data.ok && data.flags?.asks === true)
      .catch(() => false);
  }
  
  // Server-side: read from env
  return readBoolEnv('USE_GRAPHQL_FOR_ASKS');
}

/**
 * Check if GraphQL should be used for offers page
 * 
 * Client-side: Fetches from /api/graphql-flags endpoint
 * Server-side: Reads from process.env
 * 
 * @returns true if USE_GRAPHQL_FOR_OFFERS is set to "true"
 */
export async function useGraphqlForOffers(): Promise<boolean>;
export function useGraphqlForOffers(): boolean;
export function useGraphqlForOffers(): boolean | Promise<boolean> {
  // Client-side: fetch from API endpoint
  if (typeof window !== 'undefined') {
    return fetch('/api/graphql-flags')
      .then(res => res.json())
      .then(data => data.ok && data.flags?.offers === true)
      .catch(() => false);
  }
  
  // Server-side: read from env
  return readBoolEnv('USE_GRAPHQL_FOR_OFFERS');
}

/**
 * @deprecated Use useGraphqlForNetwork() instead
 * Backwards-compatible alias for useGraphqlForNetwork()
 */
export function useSubgraphForNetwork(): boolean {
  return useGraphqlForNetwork();
}

