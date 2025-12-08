/**
 * GraphQL client for The Graph subgraph queries
 * 
 * Minimal wrapper around fetch for querying The Graph subgraph endpoint.
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
 * Execute a GraphQL query against the subgraph endpoint
 * 
 * @param query - GraphQL query string
 * @param variables - Optional query variables
 * @returns Typed response data
 * @throws GraphRequestError if the request fails or GraphQL returns errors
 * 
 * @example
 * ```ts
 * const data = await graphRequest<{ profiles: Profile[] }>(
 *   `query { profiles { id wallet } }`
 * );
 * ```
 */
export async function graphRequest<T = any>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const subgraphUrl = process.env.GRAPH_SUBGRAPH_URL;

  if (!subgraphUrl) {
    throw new GraphRequestError(
      'GRAPH_SUBGRAPH_URL is not configured. Set it in your environment variables or disable subgraph usage.',
      0
    );
  }

  try {
    const response = await fetch(subgraphUrl, {
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

