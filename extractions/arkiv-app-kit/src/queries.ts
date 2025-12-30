/**
 * Query builder helpers
 * 
 * Provides safe query shapes that always include required filters (type + spaceId + limit).
 * Includes defensive result validation to prevent processing invalid data.
 * 
 * Pattern: PAT-QUERY-001 (Indexer-Friendly Query Shapes)
 */

import { eq } from '@arkiv-network/sdk/query';
import { getPublicClient } from './client';
import { getSpaceId } from './space';
import { normalizeWallet } from './wallet';

/**
 * Query options
 */
export interface QueryOptions {
  /** Maximum number of results (default: 100) */
  limit?: number;
  /** Include attributes in results (default: true) */
  withAttributes?: boolean;
  /** Include payload in results (default: false) */
  withPayload?: boolean;
  /** Space ID (if not provided, uses getSpaceId()) */
  spaceId?: string;
}

/**
 * Result validation helper
 * 
 * Defensive checks before processing query results.
 * This prevents templates from processing invalid data structures.
 * 
 * @param result - Query result from Arkiv
 * @returns True if result structure is valid
 */
export function validateQueryResult(result: any): boolean {
  if (!result) {
    return false;
  }
  
  if (!result.entities || !Array.isArray(result.entities)) {
    return false;
  }
  
  return true;
}

/**
 * Build a safe query with required filters
 * 
 * Always includes:
 * - `type` filter (required)
 * - `spaceId` filter (from config or provided)
 * - `limit` (default: 100, max: 500)
 * 
 * This ensures all queries are indexer-friendly and follow Arkiv best practices.
 * 
 * @param type - Entity type to query
 * @param options - Query options
 * @returns Query builder ready for additional filters
 * 
 * @example
 * ```ts
 * const query = buildSafeQuery('user_profile', { limit: 50 });
 * const result = await query.fetch();
 * if (validateQueryResult(result)) {
 *   const entities = result.entities;
 * }
 * ```
 */
export function buildSafeQuery(type: string, options: QueryOptions = {}) {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  
  // Always include type filter
  const queryBuilder = query.where(eq('type', type));
  
  // Always include spaceId filter (from config or provided)
  const spaceId = options.spaceId || getSpaceId();
  const queryWithSpace = queryBuilder.where(eq('spaceId', spaceId));
  
  // Set safe limit (default: 100, max: 500)
  const limit = Math.min(options.limit || 100, 500);
  
  // Configure what to include
  const withAttributes = options.withAttributes !== false; // Default: true
  const withPayload = options.withPayload === true; // Default: false
  
  return queryWithSpace
    .withAttributes(withAttributes)
    .withPayload(withPayload)
    .limit(limit);
}

/**
 * Build a wallet-scoped query
 * 
 * Queries entities owned by a specific wallet. Wallet is normalized
 * to lowercase before querying.
 * 
 * @param type - Entity type to query
 * @param wallet - Wallet address (will be normalized)
 * @param options - Query options
 * @returns Query builder ready for fetching
 * 
 * @example
 * ```ts
 * const query = buildWalletQuery('user_profile', '0xABC123...');
 * const result = await query.fetch();
 * ```
 */
export function buildWalletQuery(
  type: string,
  wallet: string,
  options: QueryOptions = {}
) {
  const normalizedWallet = normalizeWallet(wallet);
  const baseQuery = buildSafeQuery(type, options);
  
  // Add wallet filter
  return baseQuery.where(eq('wallet', normalizedWallet));
}

/**
 * Execute query with defensive result validation
 * 
 * Executes a query and validates the result structure before returning.
 * Returns empty array on failure (doesn't throw) to allow graceful degradation.
 * 
 * @param queryBuilder - Query builder from buildSafeQuery or buildWalletQuery
 * @returns Array of entities (empty array on failure)
 * 
 * @example
 * ```ts
 * const query = buildSafeQuery('user_profile');
 * const entities = await executeQuery(query);
 * // entities is always an array (empty on failure)
 * ```
 */
export async function executeQuery(queryBuilder: any): Promise<any[]> {
  try {
    const result = await queryBuilder.fetch();
    
    if (!validateQueryResult(result)) {
      console.warn('[queries.ts] Invalid query result structure:', result);
      return [];
    }
    
    return result.entities || [];
  } catch (error: any) {
    console.error('[queries.ts] Query execution failed:', {
      message: error?.message,
      error,
    });
    // Return empty array on failure (graceful degradation)
    return [];
  }
}

/**
 * Query multiple space IDs (builder mode)
 * 
 * Arkiv doesn't support OR queries, so we query each spaceId separately
 * and combine results client-side. This is explicitly documented as a limitation.
 * 
 * @param type - Entity type to query
 * @param spaceIds - Array of space IDs to query
 * @param options - Query options
 * @returns Combined array of entities from all spaces
 * 
 * @example
 * ```ts
 * const entities = await queryMultipleSpaces('user_profile', ['space1', 'space2']);
 * ```
 */
export async function queryMultipleSpaces(
  type: string,
  spaceIds: string[],
  options: Omit<QueryOptions, 'spaceId'> = {}
): Promise<any[]> {
  if (!spaceIds || spaceIds.length === 0) {
    return [];
  }
  
  // Query each space separately
  const queries = spaceIds.map(spaceId => 
    buildSafeQuery(type, { ...options, spaceId })
  );
  
  // Execute all queries in parallel
  const results = await Promise.all(
    queries.map(query => executeQuery(query))
  );
  
  // Combine results (flatten array of arrays)
  return results.flat();
}

