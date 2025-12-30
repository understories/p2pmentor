/**
 * Query helpers for records
 * 
 * Uses Arkiv App Primitives for safe query building.
 * Follows PAT-QUERY-001 (Indexer-Friendly Query Shapes).
 */

import { buildSafeQuery, executeQuery, validateQueryResult } from '../../../../arkiv-app-kit/src/queries';

/**
 * Query all records of a type
 * 
 * Always includes type + spaceId + limit (indexer-friendly).
 * Returns empty array on failure (graceful degradation).
 */
export async function listRecords(type: string, options?: { limit?: number; withPayload?: boolean }) {
  const query = buildSafeQuery(type, {
    limit: options?.limit || 50,
    withPayload: options?.withPayload !== false, // Default: true
  });
  
  return await executeQuery(query);
}

/**
 * Query records by wallet
 * 
 * Wallet is normalized to lowercase before querying.
 */
export async function listRecordsByWallet(
  type: string,
  wallet: string,
  options?: { limit?: number; withPayload?: boolean }
) {
  const { buildWalletQuery } = await import('../../../../arkiv-app-kit/src/queries');
  const query = buildWalletQuery(type, wallet, {
    limit: options?.limit || 50,
    withPayload: options?.withPayload !== false,
  });
  
  return await executeQuery(query);
}

