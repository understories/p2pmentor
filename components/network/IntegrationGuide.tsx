/**
 * Integration Guide Component
 * 
 * Step-by-step technical guide for connecting Arkiv to GraphQL
 * Written for both Arkiv and The Graph engineering teams
 */

'use client';

export function IntegrationGuide() {
  return (
    <div className="space-y-4 text-xs">
      {/* Step 1: Setup */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">
            1
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">Install Dependencies</h4>
        </div>
        <div className="ml-8 space-y-1">
          <p className="text-gray-700 dark:text-gray-300">
            Add GraphQL libraries to your project:
          </p>
          <div className="bg-gray-900 p-3 rounded font-mono text-xs text-gray-300 overflow-x-auto relative group">
            <button
              onClick={() => navigator.clipboard.writeText('pnpm add graphql graphql-http')}
              className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy"
            >
              Copy
            </button>
            <code>pnpm add graphql graphql-http</code>
          </div>
        </div>
      </div>

      {/* Step 2: Create GraphQL Schema */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">
            2
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">Define GraphQL Schema</h4>
        </div>
        <div className="ml-8 space-y-1">
          <p className="text-gray-700 dark:text-gray-300">
            Create <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">lib/graphql/schema.ts</code> matching your Arkiv entity structure:
          </p>
          <div className="bg-gray-900 p-3 rounded font-mono text-xs text-gray-300 overflow-x-auto relative group">
            <button
              onClick={() => {
                const schema = `type Query {
  networkOverview(limitAsks: Int, limitOffers: Int): NetworkOverview
}

type NetworkOverview {
  skillRefs: [SkillRef!]!
}

type SkillRef {
  id: ID!
  name: String!
  asks: [Ask!]!
  offers: [Offer!]!
}`;
                navigator.clipboard.writeText(schema);
              }}
              className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy"
            >
              Copy
            </button>
            <code>{`type Query {
  networkOverview(limitAsks: Int, limitOffers: Int): NetworkOverview
}

type NetworkOverview {
  skillRefs: [SkillRef!]!
}

type SkillRef {
  id: ID!
  name: String!
  asks: [Ask!]!
  offers: [Offer!]!
}`}</code>
          </div>
        </div>
      </div>

      {/* Step 3: Implement Resolvers */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">
            3
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">Implement Resolvers</h4>
        </div>
        <div className="ml-8 space-y-1">
          <p className="text-gray-700 dark:text-gray-300">
            Create <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">lib/graphql/resolvers.ts</code> that calls your existing Arkiv helpers:
          </p>
          <div className="bg-gray-900 p-3 rounded font-mono text-xs text-gray-300 overflow-x-auto relative group">
            <button
              onClick={() => {
                const resolver = `import { listAsks, listOffers } from '@/lib/arkiv/asks';

export const resolvers = {
  Query: {
    networkOverview: async (_, args) => {
      // Call existing Arkiv helpers
      const [asks, offers] = await Promise.all([
        listAsks({ limit: args.limitAsks }),
        listOffers({ limit: args.limitOffers }),
      ]);
      
      // Transform to GraphQL format
      return transformToGraphQL(asks, offers);
    },
  },
};`;
                navigator.clipboard.writeText(resolver);
              }}
              className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy"
            >
              Copy
            </button>
            <code>{`import { listAsks, listOffers } from '@/lib/arkiv/asks';

export const resolvers = {
  Query: {
    networkOverview: async (_, args) => {
      // Call existing Arkiv helpers
      const [asks, offers] = await Promise.all([
        listAsks({ limit: args.limitAsks }),
        listOffers({ limit: args.limitOffers }),
      ]);
      
      // Transform to GraphQL format
      return transformToGraphQL(asks, offers);
    },
  },
};`}</code>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-[10px] mt-1">
            <strong>Key point:</strong> Resolvers reuse your existing Arkiv query functions. No new data fetching logic needed.
          </p>
        </div>
      </div>

      {/* Step 4: Create API Route */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">
            4
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">Create GraphQL Endpoint</h4>
        </div>
        <div className="ml-8 space-y-1">
          <p className="text-gray-700 dark:text-gray-300">
            Create <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">app/api/graphql/route.ts</code>:
          </p>
          <div className="bg-gray-900 p-3 rounded font-mono text-xs text-gray-300 overflow-x-auto relative group">
            <button
              onClick={() => {
                const route = `import { buildSchema } from 'graphql';
import { createHandler } from 'graphql-http/lib/use/fetch';
import { graphQLSchema } from '@/lib/graphql/schema';
import { resolvers } from '@/lib/graphql/resolvers';

const schema = buildSchema(graphQLSchema);
const handler = createHandler({ schema, rootValue: resolvers });

export async function POST(request: Request) {
  return handler(request);
}`;
                navigator.clipboard.writeText(route);
              }}
              className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy"
            >
              Copy
            </button>
            <code>{`import { buildSchema } from 'graphql';
import { createHandler } from 'graphql-http/lib/use/fetch';
import { graphQLSchema } from '@/lib/graphql/schema';
import { resolvers } from '@/lib/graphql/resolvers';

const schema = buildSchema(graphQLSchema);
const handler = createHandler({ schema, rootValue: resolvers });

export async function POST(request: Request) {
  return handler(request);
}`}</code>
          </div>
        </div>
      </div>

      {/* Step 5: GraphQL Client (Optional) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">
            5
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">Create GraphQL Client (Optional)</h4>
        </div>
        <div className="ml-8 space-y-1">
          <p className="text-gray-700 dark:text-gray-300">
            Create <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">lib/graph/client.ts</code> for typed GraphQL requests:
          </p>
          <div className="bg-gray-900 p-3 rounded font-mono text-xs text-gray-300 overflow-x-auto relative group">
            <button
              onClick={() => {
                const client = `export async function graphRequest<T>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const response = await fetch(process.env.GRAPH_SUBGRAPH_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  
  const result = await response.json();
  if (result.errors) throw new Error(result.errors[0].message);
  return result.data;
}`;
                navigator.clipboard.writeText(client);
              }}
              className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy"
            >
              Copy
            </button>
            <code>{`export async function graphRequest<T>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const response = await fetch(process.env.GRAPH_SUBGRAPH_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  
  const result = await response.json();
  if (result.errors) throw new Error(result.errors[0].message);
  return result.data;
}`}</code>
          </div>
        </div>
      </div>

      {/* Step 6: Query from Client */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">
            6
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">Query from Your App</h4>
        </div>
        <div className="ml-8 space-y-1">
          <p className="text-gray-700 dark:text-gray-300">
            Use the client to query your GraphQL endpoint:
          </p>
          <div className="bg-gray-900 p-3 rounded font-mono text-xs text-gray-300 overflow-x-auto relative group">
            <button
              onClick={() => {
                const query = `import { graphRequest } from '@/lib/graph/client';

// Set endpoint (or use env var)
process.env.GRAPH_SUBGRAPH_URL = 'http://localhost:3000/api/graphql';

const data = await graphRequest(\`
  query {
    networkOverview(limitAsks: 25, limitOffers: 25) {
      skillRefs {
        name
        asks { id wallet skill }
        offers { id wallet skill isPaid }
      }
    }
  }
\`);`;
                navigator.clipboard.writeText(query);
              }}
              className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy"
            >
              Copy
            </button>
            <code>{`import { graphRequest } from '@/lib/graph/client';

// Set endpoint (or use env var)
process.env.GRAPH_SUBGRAPH_URL = 'http://localhost:3000/api/graphql';

const data = await graphRequest(\`
  query {
    networkOverview(limitAsks: 25, limitOffers: 25) {
      skillRefs {
        name
        asks { id wallet skill }
        offers { id wallet skill isPaid }
      }
    }
  }
\`);`}</code>
          </div>
        </div>
      </div>

      {/* Architecture Diagram */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 text-xs">Data Flow</h4>
        <div className="space-y-1 text-[10px] font-mono text-gray-700 dark:text-gray-300">
          <div>GraphQL Client</div>
          <div className="text-center">↓ POST /api/graphql</div>
          <div>GraphQL Resolvers</div>
          <div className="text-center">↓ listAsks() / listOffers()</div>
          <div>Arkiv JSON-RPC Indexer</div>
          <div className="text-center">↓ Entity Data</div>
          <div>Transform → GraphQL Response</div>
        </div>
      </div>

      {/* Architecture Notes */}
      <div className="mt-4 space-y-3">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 text-xs">For Arkiv Engineers</h4>
          <ul className="space-y-1 text-[10px] text-gray-700 dark:text-gray-300">
            <li>• <strong>Zero changes to Arkiv:</strong> GraphQL layer sits on top of existing JSON-RPC</li>
            <li>• <strong>Reuses your SDK:</strong> Resolvers call <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">listAsks()</code>, <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">listOffers()</code> from <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">@arkiv-network/sdk</code></li>
            <li>• <strong>Same data source:</strong> Queries still hit <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">https://mendoza.hoodi.arkiv.network/rpc</code></li>
            <li>• <strong>Performance:</strong> No additional indexing - leverages your optimized indexer</li>
          </ul>
        </div>

        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <h4 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2 text-xs">For The Graph Engineers</h4>
          <ul className="space-y-1 text-[10px] text-gray-700 dark:text-gray-300">
            <li>• <strong>Integration pattern:</strong> Shows how to wrap non-GraphQL APIs with GraphQL</li>
            <li>• <strong>Subgraph reference:</strong> Schema design matches subgraph patterns (see <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">subgraph/schema.graphql</code>)</li>
            <li>• <strong>Future path:</strong> Can evolve to full subgraph once Arkiv contract events are indexed</li>
            <li>• <strong>Ecosystem growth:</strong> Enables GraphQL tooling (Apollo, Relay) for Arkiv apps</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

