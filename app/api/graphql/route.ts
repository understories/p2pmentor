/**
 * GraphQL API Route
 * 
 * Provides GraphQL interface over Arkiv's JSON-RPC indexer.
 * Reusable tool for any Arkiv-based application.
 * 
 * Usage:
 *   POST /api/graphql
 *   Body: { query: "...", variables: {...} }
 * 
 * Example query:
 *   {
 *     networkOverview(limitAsks: 25, limitOffers: 25) {
 *       skillRefs {
 *         name
 *         asks { id wallet skill }
 *         offers { id wallet skill isPaid }
 *       }
 *     }
 *   }
 */

import { buildSchema } from 'graphql';
import { createHandler } from 'graphql-http/lib/use/fetch';
import { graphQLSchema } from '@/lib/graphql/schema';
import { resolvers } from '@/lib/graphql/resolvers';

// Build GraphQL schema
const schema = buildSchema(graphQLSchema);

// Create GraphQL handler
// Note: rootValue should match the resolver structure
const handler = createHandler({
  schema,
  rootValue: resolvers,
  // Ensure context is passed correctly
  context: () => ({}),
});

export async function POST(request: Request) {
  try {
    // Log request details for debugging
    const url = request.url;
    const method = request.method;
    const headers = Object.fromEntries(request.headers.entries());
    console.log('[GraphQL] Request received:', { url, method, headers: Object.keys(headers) });
    
    // Clone the request to ensure it can be read multiple times
    const clonedRequest = request.clone();
    
    return await handler(clonedRequest);
  } catch (error) {
    console.error('[GraphQL] Handler error:', error);
    return new Response(
      JSON.stringify({
        errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function GET(request: Request) {
  // GraphQL Playground or simple info endpoint
  return new Response(
    JSON.stringify({
      message: 'GraphQL API for Arkiv Mentorship Data',
      endpoint: '/api/graphql',
      method: 'POST',
      example: {
        query: `{
          networkOverview(limitAsks: 10, limitOffers: 10) {
            skillRefs {
              name
              asks { id wallet skill }
              offers { id wallet skill isPaid }
            }
          }
        }`,
      },
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

