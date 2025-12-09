/**
 * Direct GraphQL execution (bypasses HTTP layer)
 * 
 * Use this for server-to-server calls within the same Next.js app.
 * This avoids Vercel deployment protection and is more efficient.
 */

import { buildSchema, parse } from 'graphql';
import { execute, ExecutionResult } from 'graphql';
import { graphQLSchema } from './schema';
import { resolvers } from './resolvers';

// Build GraphQL schema once (cached)
const schema = buildSchema(graphQLSchema);

/**
 * Execute a GraphQL query directly (server-side only)
 * 
 * @param query - GraphQL query string
 * @param variables - Optional query variables
 * @returns GraphQL execution result
 */
export async function executeGraphQL<T = any>(
  query: string,
  variables?: Record<string, any>
): Promise<ExecutionResult<T>> {
  const document = parse(query);
  return execute({
    schema,
    document,
    rootValue: resolvers,
    variableValues: variables || {},
  }) as Promise<ExecutionResult<T>>;
}

