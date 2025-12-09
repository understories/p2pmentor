/**
 * GraphQL queries for offers pages
 * 
 * Queries GraphQL endpoint for offers data.
 * 
 * Reference: refs/docs/sprint2.md
 */

import { graphRequest } from './client';

/**
 * GraphQL query for offers list
 */
const OFFERS_QUERY = `
  query Offers(
    $skill: String
    $wallet: String
    $includeExpired: Boolean
    $limit: Int
  ) {
    offers(
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
      availabilityWindow
      isPaid
      cost
      paymentAddress
      status
      createdAt
      expiresAt
      ttlSeconds
      txHash
    }
  }
`;

/**
 * Response type for offers query
 */
export interface OffersResponse {
  offers: Array<{
    id: string;
    key: string;
    wallet: string;
    skill: string;
    message: string | null;
    availabilityWindow: string | null;
    isPaid: boolean;
    cost: string | null;
    paymentAddress: string | null;
    status: string;
    createdAt: string;
    expiresAt: bigint | null;
    ttlSeconds: number;
    txHash: string | null;
  }>;
}

/**
 * Parameters for offers query
 */
export interface OffersParams {
  skill?: string;
  wallet?: string;
  includeExpired?: boolean;
  limit?: number;
}

/**
 * Fetch offers via GraphQL
 * 
 * @param params - Query parameters
 * @returns Array of offers
 */
export async function fetchOffers(
  params: OffersParams = {}
): Promise<OffersResponse['offers']> {
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
  
  const response = await graphRequest<OffersResponse>(
    OFFERS_QUERY,
    variables,
    { operationName: 'Offers' }
  );
  
  const durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
  const payloadBytes = JSON.stringify(response).length;
  
  // Record performance metrics
  try {
    const { recordPerfSample } = await import('@/lib/metrics/perf');
    recordPerfSample({
      source: 'graphql',
      operation: 'listOffers',
      route: '/offers',
      durationMs: Math.round(durationMs),
      payloadBytes,
      httpRequests: 1, // Single GraphQL query
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // Silently fail if metrics module not available
  }
  
  return response.offers;
}

