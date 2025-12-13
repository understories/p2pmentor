/**
 * GraphQL queries for /me dashboard
 * 
 * Queries GraphQL endpoint for user dashboard data.
 * 
 * Reference: refs/docs/sprint2.md Section 3.2
 */

import { graphRequest } from './client';

/**
 * GraphQL query for meOverview
 */
const ME_OVERVIEW_QUERY = `
  query MeOverview($wallet: String!, $limitAsks: Int, $limitOffers: Int, $limitSessions: Int) {
    meOverview(
      wallet: $wallet
      limitAsks: $limitAsks
      limitOffers: $limitOffers
      limitSessions: $limitSessions
    ) {
      profile {
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
      }
      asks {
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
      offers {
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
      sessions {
        id
        key
        mentorWallet
        learnerWallet
        skill
        date
        time
        duration
        notes
        status
        mentorConfirmed
        learnerConfirmed
        createdAt
        txHash
      }
    }
  }
`;

/**
 * Response type for meOverview query
 */
export interface MeOverviewResponse {
  meOverview: {
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
    } | null;
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
    sessions: Array<{
      id: string;
      key: string;
      mentorWallet: string;
      learnerWallet: string;
      skill: string;
      date: string;
      time: string;
      duration: string;
      notes: string | null;
      status: string;
      mentorConfirmed: boolean;
      learnerConfirmed: boolean;
      createdAt: string;
      txHash: string | null;
    }>;
  };
}

/**
 * Parameters for meOverview query
 */
export interface MeOverviewParams {
  wallet: string;
  limitAsks?: number;
  limitOffers?: number;
  limitSessions?: number;
}

/**
 * Fetch meOverview data via GraphQL
 * 
 * @param params - Query parameters
 * @returns MeOverview data
 * 
 * @example
 * ```ts
 * const data = await fetchMeOverview({
 *   wallet: '0x...',
 *   limitAsks: 10,
 *   limitOffers: 10,
 *   limitSessions: 10
 * });
 * ```
 */
export async function fetchMeOverview(
  params: MeOverviewParams
): Promise<MeOverviewResponse['meOverview']> {
  const {
    wallet,
    limitAsks = 50,
    limitOffers = 50,
    limitSessions = 50,
  } = params;

  const variables: Record<string, any> = {
    wallet,
    limitAsks,
    limitOffers,
    limitSessions,
  };

  const response = await graphRequest<MeOverviewResponse>(
    ME_OVERVIEW_QUERY,
    variables,
    { operationName: 'MeOverview' }
  );

  return response.meOverview;
}


