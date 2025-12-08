/**
 * Code Comparison Component
 * 
 * Shows side-by-side code comparison for Arkiv JSON-RPC vs GraphQL API
 * Appeals to engineering teams by showing the actual implementation
 */

'use client';

interface CodeComparisonProps {
  useGraphQL: boolean;
}

export function CodeComparison({ useGraphQL }: CodeComparisonProps) {
  const arkivCode = `// Arkiv JSON-RPC Path (lib/arkiv/networkGraph.ts)
// Direct query to Arkiv indexer

import { listAsks } from './asks';
import { listOffers } from './offers';

export async function buildNetworkGraphData(options) {
  const { limitAsks = 25, limitOffers = 25, includeExpired = false } = options;
  
  // Direct Arkiv JSON-RPC queries
  const [asks, offers] = await Promise.all([
    listAsks({ limit: limitAsks, includeExpired }),
    listOffers({ limit: limitOffers, includeExpired }),
  ]);
  
  // Build graph nodes and links from Arkiv entities
  const nodes = buildNodes(asks, offers);
  const links = buildLinks(asks, offers);
  
  return { nodes, links };
}`;

  const graphqlCode = `// GraphQL API Path (lib/arkiv/networkGraph.ts)
// GraphQL query → Resolvers → Arkiv indexer

import { fetchNetworkOverview } from '@/lib/graph/networkQueries';
import { adaptNetworkOverviewToGraphData } from '@/lib/graph/networkAdapter';

export async function buildNetworkGraphData(options) {
  const { limitAsks = 25, limitOffers = 25, includeExpired = false } = options;
  
  // GraphQL query to our API wrapper
  const raw = await fetchNetworkOverview({
    skillFilter: options.skillFilter,
    limitAsks,
    limitOffers,
    includeExpired,
  });
  
  // Adapter transforms GraphQL response → graph format
  return adaptNetworkOverviewToGraphData(raw, {
    limitAsks,
    limitOffers,
    includeExpired,
  });
}`;

  const resolverCode = `// GraphQL Resolver (lib/graphql/resolvers.ts)
// Translates GraphQL queries to Arkiv calls

import { listAsks } from '@/lib/arkiv/asks';
import { listOffers } from '@/lib/arkiv/offers';
import { buildNetworkOverview } from './resolvers';

export const resolvers = {
  Query: {
    networkOverview: async (_, args) => {
      // Under the hood: calls Arkiv helpers
      const [asks, offers] = await Promise.all([
        listAsks({ 
          limit: args.limitAsks,
          includeExpired: args.includeExpired 
        }),
        listOffers({ 
          limit: args.limitOffers,
          includeExpired: args.includeExpired 
        }),
      ]);
      
      // Group by skill and transform to GraphQL format
      return buildNetworkOverview({ 
        skill: args.skill,
        limitAsks: args.limitAsks,
        limitOffers: args.limitOffers 
      });
    },
  },
};`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      {/* Arkiv Path */}
      <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b border-gray-300 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">
              Arkiv JSON-RPC Path
            </span>
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Direct query to Arkiv indexer
          </div>
        </div>
        <div className="bg-gray-900 p-4 overflow-x-auto relative group">
          <button
            onClick={() => {
              navigator.clipboard.writeText(arkivCode);
            }}
            className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copy code"
          >
            Copy
          </button>
          <pre className="text-xs text-gray-300 font-mono">
            <code>{arkivCode}</code>
          </pre>
        </div>
      </div>

      {/* GraphQL Path */}
      <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 border-b border-gray-300 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              GraphQL API Path
            </span>
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
            GraphQL wrapper over Arkiv indexer
          </div>
        </div>
        <div className="bg-gray-900 p-4 overflow-x-auto relative group">
          <button
            onClick={() => {
              navigator.clipboard.writeText(graphqlCode);
            }}
            className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copy code"
          >
            Copy
          </button>
          <pre className="text-xs text-gray-300 font-mono">
            <code>{graphqlCode}</code>
          </pre>
        </div>
      </div>

      {/* Resolver Code (Full Width) */}
      <div className="lg:col-span-2 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden mt-2">
        <div className="bg-purple-50 dark:bg-purple-900/20 px-4 py-2 border-b border-gray-300 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="text-sm font-semibold text-purple-800 dark:text-purple-200">
              GraphQL Resolver Implementation
            </span>
          </div>
          <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
            Shows how GraphQL queries translate to Arkiv calls - Reuses existing Arkiv helpers
          </div>
        </div>
        <div className="bg-gray-900 p-4 overflow-x-auto relative group">
          <button
            onClick={() => {
              navigator.clipboard.writeText(resolverCode);
            }}
            className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copy code"
          >
            Copy
          </button>
          <pre className="text-xs text-gray-300 font-mono">
            <code>{resolverCode}</code>
          </pre>
        </div>
      </div>

      {/* GraphQL Schema */}
      <div className="lg:col-span-2 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden mt-2">
        <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-2 border-b border-gray-300 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              GraphQL Schema (lib/graphql/schema.ts)
            </span>
          </div>
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Type-safe GraphQL schema matching Arkiv entity structure
          </div>
        </div>
        <div className="bg-gray-900 p-4 overflow-x-auto relative group">
          <button
            onClick={() => {
              const schemaCode = `type Query {
  networkOverview(
    skill: String
    limitAsks: Int
    limitOffers: Int
    includeExpired: Boolean
  ): NetworkOverview
}

type NetworkOverview {
  skillRefs: [SkillRef!]!
}

type SkillRef {
  id: ID!
  name: String!
  asks: [Ask!]!
  offers: [Offer!]!
}

type Ask {
  id: ID!
  wallet: String!
  skill: String!
  status: String!
  createdAt: String!
  expiresAt: BigInt
}

type Offer {
  id: ID!
  wallet: String!
  skill: String!
  isPaid: Boolean!
  cost: String
  status: String!
  expiresAt: BigInt
}`;
              navigator.clipboard.writeText(schemaCode);
            }}
            className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copy code"
          >
            Copy
          </button>
          <pre className="text-xs text-gray-300 font-mono">
            <code>{`type Query {
  networkOverview(
    skill: String
    limitAsks: Int
    limitOffers: Int
    includeExpired: Boolean
  ): NetworkOverview
}

type NetworkOverview {
  skillRefs: [SkillRef!]!
}

type SkillRef {
  id: ID!
  name: String!
  asks: [Ask!]!
  offers: [Offer!]!
}

type Ask {
  id: ID!
  wallet: String!
  skill: String!
  status: String!
  createdAt: String!
  expiresAt: BigInt
}

type Offer {
  id: ID!
  wallet: String!
  skill: String!
  isPaid: Boolean!
  cost: String
  status: String!
  expiresAt: BigInt
}`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

