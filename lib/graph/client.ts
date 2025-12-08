/**
 * GraphQL client for GraphQL queries (subgraph or Arkiv GraphQL API)
 * 
 * Minimal wrapper around fetch for querying GraphQL endpoints.
 * Works with:
 * - The Graph subgraph endpoints
 * - Arkiv GraphQL API wrapper (see /app/api/graphql)
 * - Any GraphQL endpoint
 * 
 * No heavy dependencies (no Apollo, no urql) - just typed fetch with error handling.
 * 
 * Reference: docs/graph_indexing_plan.md
 */

/**
 * GraphQL request error
 */
export class GraphRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: any
  ) {
    super(message);
    this.name = 'GraphRequestError';
  }
}

/**
 * GraphQL response wrapper (standard GraphQL response format)
 */
export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
  }>;
}

/**
 * GraphQL request options
 */
export type GraphRequestOptions = {
  endpoint?: string;
  operationName?: string; // Useful for perf logging
};

/**
 * Execute a GraphQL query against the GraphQL endpoint
 * 
 * Endpoint resolution (in order):
 * 1. options.endpoint (explicit override)
 * 2. GRAPH_SUBGRAPH_URL env var (external subgraph or local)
 * 3. '/api/graphql' (default local Next.js route)
 * 
 * @param query - GraphQL query string
 * @param variables - Optional query variables
 * @param options - Optional endpoint override and operation name
 * @returns Typed response data
 * @throws GraphRequestError if the request fails or GraphQL returns errors
 * 
 * @example
 * ```ts
 * const data = await graphRequest<{ profiles: Profile[] }>(
 *   `query { profiles { id wallet } }`
 * );
 * 
 * // With explicit endpoint
 * const data = await graphRequest(query, vars, { endpoint: 'https://api.example.com/graphql' });
 * ```
 */
export async function graphRequest<T = any>(
  query: string,
  variables?: Record<string, any>,
  options: GraphRequestOptions = {}
): Promise<T> {
  // Resolve endpoint: explicit override > env var > default local
  const endpoint =
    options.endpoint ||
    process.env.GRAPH_SUBGRAPH_URL ||
    '/api/graphql';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: variables || {},
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new GraphRequestError(
        `GraphQL request failed with status ${response.status}: ${errorText}`,
        response.status
      );
    }

    const result: GraphQLResponse<T> = await response.json();

    // Check for GraphQL errors in response
    if (result.errors && result.errors.length > 0) {
      const errorMessages = result.errors.map(e => e.message).join('; ');
      throw new GraphRequestError(
        `GraphQL errors: ${errorMessages}`,
        response.status,
        result.errors
      );
    }

    if (!result.data) {
      throw new GraphRequestError(
        'GraphQL response missing data field',
        response.status
      );
    }

    return result.data;
  } catch (error) {
    // Re-throw GraphRequestError as-is
    if (error instanceof GraphRequestError) {
      throw error;
    }

    // Wrap other errors (network errors, JSON parse errors, etc.)
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new GraphRequestError(
      `GraphQL request failed: ${message}`,
      undefined,
      error
    );
  }
}

