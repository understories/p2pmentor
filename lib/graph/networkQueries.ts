/**
 * GraphQL queries for network data
 * 
 * Queries GraphQL endpoint (subgraph or Arkiv GraphQL API wrapper).
 * Works with:
 * - The Graph subgraph endpoints
 * - Arkiv GraphQL API wrapper (see /app/api/graphql)
 * 
 * Reference: docs/graph_indexing_plan.md Section 5.1
 */

import { graphRequest } from './client';
import type { NetworkGraphData } from '@/lib/types';

/**
 * Raw GraphQL response types (matching subgraph schema)
 */
export interface GraphQLSkillRef {
  id: string; // normalized skill name (lowercase)
  name: string;
  asks: GraphQLAsk[];
  offers: GraphQLOffer[];
}

export interface GraphQLAsk {
  id: string;
  key?: string; // Entity key from Arkiv (optional, may not be in all responses)
  wallet: string;
  createdAt: string; // ISO string or BigInt string
  status: string;
  expiresAt: string | null; // BigInt string or null
}

export interface GraphQLOffer {
  id: string;
  key?: string; // Entity key from Arkiv (optional, may not be in all responses)
  wallet: string;
  isPaid: boolean;
  cost: string | null; // BigInt string or null
  paymentAddress: string | null;
  createdAt: string; // ISO string or BigInt string
  status: string;
  expiresAt: string | null; // BigInt string or null
}

export interface GraphQLNetworkOverviewResponse {
  skillRefs: GraphQLSkillRef[];
}

/**
 * Parameters for network overview query
 */
export interface NetworkOverviewParams {
  skillFilter?: string;
  limitSkills?: number;
  limitAsks?: number;
  limitOffers?: number;
}

/**
 * GraphQL query string for network overview
 * 
 * Works with our Arkiv GraphQL API wrapper (see /app/api/graphql)
 * Also compatible with The Graph subgraph syntax if needed
 */
const NETWORK_OVERVIEW_QUERY = `
  query NetworkOverview(
    $skill: String
    $limitSkills: Int
    $limitAsks: Int
    $limitOffers: Int
    $includeExpired: Boolean
  ) {
    networkOverview(
      skill: $skill
      limitSkills: $limitSkills
      limitAsks: $limitAsks
      limitOffers: $limitOffers
      includeExpired: $includeExpired
    ) {
      skillRefs {
        id
        name
        asks(includeExpired: $includeExpired, limit: $limitAsks) {
          id
          key
          wallet
          skill
          createdAt
          status
          expiresAt
        }
        offers(includeExpired: $includeExpired, limit: $limitOffers) {
          id
          key
          wallet
          skill
          isPaid
          cost
          paymentAddress
          createdAt
          status
          expiresAt
        }
      }
    }
  }
`;

/**
 * Fetch network overview data from the subgraph
 * 
 * @param params - Query parameters
 * @returns Raw GraphQL response data
 * @throws GraphRequestError if the query fails
 * 
 * @example
 * ```ts
 * const data = await fetchNetworkOverview({
 *   skillFilter: 'react',
 *   limitAsks: 25,
 *   limitOffers: 25
 * });
 * ```
 */
export async function fetchNetworkOverview(
  params: NetworkOverviewParams & { includeExpired?: boolean }
): Promise<GraphQLNetworkOverviewResponse> {
  const {
    skillFilter,
    limitSkills = 100, // Cap at reasonable number of skills
    limitAsks = 500, // Match current Arkiv behavior
    limitOffers = 500, // Match current Arkiv behavior
    includeExpired = false,
  } = params;

  const variables: Record<string, any> = {
    skill: skillFilter || undefined,
    limitSkills,
    limitAsks,
    limitOffers,
    includeExpired,
  };

  // Remove undefined values
  Object.keys(variables).forEach(key => {
    if (variables[key] === undefined) {
      delete variables[key];
    }
  });

  const response = await graphRequest<{ networkOverview: GraphQLNetworkOverviewResponse }>(
    NETWORK_OVERVIEW_QUERY,
    variables
  );

  // Extract networkOverview from response
  return response.networkOverview;
}

