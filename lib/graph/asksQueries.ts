/**
 * GraphQL queries for asks pages
 * 
 * Queries GraphQL endpoint for asks data.
 * 
 * Reference: refs/docs/sprint2.md
 */

import { graphRequest } from './client';

/**
 * GraphQL query for asks list
 */
const ASKS_QUERY = `
  query Asks(
    $skill: String
    $wallet: String
    $includeExpired: Boolean
    $limit: Int
  ) {
    asks(
      skill: $skill
      wallet: $wallet
      includeExpired: $includeExpired
      limit: $limit
    ) {
      id
      key
      wallet
      skill
      message
      status
      createdAt
      expiresAt
      ttlSeconds
      txHash
    }
  }
`;

/**
 * Response type for asks query
 */
export interface AsksResponse {
  asks: Array<{
    id: string;
    key: string;
    wallet: string;
    skill: string;
    message: string | null;
    status: string;
    createdAt: string;
    expiresAt: bigint | null;
    ttlSeconds: number;
    txHash: string | null;
  }>;
}

/**
 * Parameters for asks query
 */
export interface AsksParams {
  skill?: string;
  wallet?: string;
  includeExpired?: boolean;
  limit?: number;
}

/**
 * Fetch asks via GraphQL
 * 
 * @param params - Query parameters
 * @returns Array of asks
 */
export async function fetchAsks(
  params: AsksParams = {}
): Promise<AsksResponse['asks']> {
  const {
    skill,
    wallet,
    includeExpired = false,
    limit = 100,
  } = params;

  const variables: Record<string, any> = {
    skill,
    wallet,
    includeExpired,
    limit,
  };

  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  
  const response = await graphRequest<AsksResponse>(
    ASKS_QUERY,
    variables,
    { operationName: 'Asks' }
  );
  
  const durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
  const payloadBytes = JSON.stringify(response).length;
  
  // Record performance metrics
  try {
    const { recordPerfSample } = await import('@/lib/metrics/perf');
    recordPerfSample({
      source: 'graphql',
      operation: 'listAsks',
      route: '/asks',
      durationMs: Math.round(durationMs),
      payloadBytes,
      httpRequests: 1, // Single GraphQL query
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // Silently fail if metrics module not available
  }
  
  return response.asks;
}

