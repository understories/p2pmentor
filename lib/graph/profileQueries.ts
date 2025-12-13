/**
 * GraphQL queries for profile pages
 * 
 * Queries GraphQL endpoint for profile data with related entities.
 * 
 * Reference: refs/docs/sprint2.md
 */

import { graphRequest } from './client';

// Record performance metrics for profile queries
async function recordProfilePerf(source: 'arkiv' | 'graphql', durationMs: number, payloadBytes: number, httpRequests: number) {
  try {
    // Dynamic import to avoid circular dependencies
    const { recordPerfSample } = await import('@/lib/metrics/perf');
    recordPerfSample({
      source,
      operation: 'loadProfileData',
      route: '/profiles/[wallet]',
      durationMs: Math.round(durationMs),
      payloadBytes,
      httpRequests,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // Silently fail if metrics module not available
  }
}

/**
 * GraphQL query for profile detail page
 * Fetches profile, asks, offers, and feedback in a single query
 * Note: Sessions are fetched separately via API (not yet in GraphQL schema)
 */
const PROFILE_DETAIL_QUERY = `
  query ProfileDetail(
    $wallet: String!
    $limitAsks: Int
    $limitOffers: Int
    $limitFeedback: Int
  ) {
    profile(wallet: $wallet) {
      id
      wallet
      displayName
      username
      bio
      bioShort
      bioLong
      timezone
      seniority
      skills
      availabilityWindow
      createdAt
      asks(limit: $limitAsks) {
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
      offers(limit: $limitOffers) {
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
    feedback(wallet: $wallet, limit: $limitFeedback) {
      id
      key
      sessionKey
      mentorWallet
      learnerWallet
      feedbackFrom
      feedbackTo
      rating
      notes
      technicalDxFeedback
      createdAt
      txHash
    }
  }
`;

/**
 * Response type for profile detail query
 */
export interface ProfileDetailResponse {
  profile: {
    id: string;
    wallet: string;
    displayName: string | null;
    username: string | null;
    bio: string | null;
    bioShort: string | null;
    bioLong: string | null;
    timezone: string;
    seniority: string | null;
    skills: string[];
    availabilityWindow: string | null;
    createdAt: bigint | null;
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
  } | null;
  feedback: Array<{
    id: string;
    key: string;
    sessionKey: string;
    mentorWallet: string;
    learnerWallet: string;
    feedbackFrom: string;
    feedbackTo: string;
    rating: number | null;
    notes: string | null;
    technicalDxFeedback: string | null;
    createdAt: string;
    txHash: string | null;
  }>;
}

/**
 * Parameters for profile detail query
 */
export interface ProfileDetailParams {
  wallet: string;
  limitAsks?: number;
  limitOffers?: number;
  limitFeedback?: number;
}

/**
 * Fetch profile detail data via GraphQL
 * 
 * @param params - Query parameters
 * @param options - Optional endpoint override (for server-side calls)
 * @returns Profile detail data
 */
export async function fetchProfileDetail(
  params: ProfileDetailParams,
  options?: { endpoint?: string }
): Promise<ProfileDetailResponse> {
  const {
    wallet,
    limitAsks = 50,
    limitOffers = 50,
    limitFeedback = 50,
  } = params;

  const variables: Record<string, any> = {
    wallet,
    limitAsks,
    limitOffers,
    limitFeedback,
  };

  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  
  const response = await graphRequest<ProfileDetailResponse>(
    PROFILE_DETAIL_QUERY,
    variables,
    { operationName: 'ProfileDetail', endpoint: options?.endpoint }
  );
  
  const durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
  const payloadBytes = JSON.stringify(response).length;
  
  // Record performance metrics
  await recordProfilePerf('graphql', durationMs, payloadBytes, 2); // 1 GraphQL + 1 API (sessions)
  
  return response;
}

