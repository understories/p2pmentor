/**
 * GraphQL queries for network data from The Graph subgraph
 * 
 * Queries the mentorship subgraph for asks, offers, and skills.
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
  wallet: string;
  createdAt: string; // ISO string or BigInt string
  status: string;
  expiresAt: string | null; // BigInt string or null
}

export interface GraphQLOffer {
  id: string;
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
 * Matches the query defined in docs/graph_indexing_plan.md Section 5.1
 */
const NETWORK_OVERVIEW_QUERY = `
  query NetworkOverview(
    $skill: String
    $limitSkills: Int!
    $limitAsks: Int!
    $limitOffers: Int!
  ) {
    skillRefs(
      where: { name_contains_nocase: $skill }
      first: $limitSkills
    ) {
      id
      name
      asks(
        where: { status: "open" }
        first: $limitAsks
        orderBy: createdAt
        orderDirection: desc
      ) {
        id
        wallet
        createdAt
        status
        expiresAt
      }
      offers(
        where: { status: "active" }
        first: $limitOffers
        orderBy: createdAt
        orderDirection: desc
      ) {
        id
        wallet
        isPaid
        cost
        paymentAddress
        createdAt
        status
        expiresAt
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
  params: NetworkOverviewParams
): Promise<GraphQLNetworkOverviewResponse> {
  const {
    skillFilter,
    limitSkills = 100, // Cap at reasonable number of skills
    limitAsks = 500, // Match current Arkiv behavior
    limitOffers = 500, // Match current Arkiv behavior
  } = params;

  const variables: Record<string, any> = {
    skill: skillFilter || null,
    limitSkills,
    limitAsks,
    limitOffers,
  };

  // Remove null values (GraphQL doesn't like them)
  Object.keys(variables).forEach(key => {
    if (variables[key] === null) {
      delete variables[key];
    }
  });

  return graphRequest<GraphQLNetworkOverviewResponse>(
    NETWORK_OVERVIEW_QUERY,
    variables
  );
}

