/**
 * Indexer reconciliation helpers
 * 
 * Provides polling helpers to wait for indexer to catch up after writes.
 * This addresses the core Arkiv reality: "submitted" != "indexed".
 * 
 * **Strongly recommended for any write path** - even though this is optional
 * in API surface, indexer lag is a core Arkiv reality that all apps must handle.
 * 
 * Pattern: PAT-INDEXER-001 (Read-Your-Writes Under Indexer Lag)
 */

import { getPublicClient } from './client';
import { buildSafeQuery, executeQuery } from './queries';

/**
 * Wait options for indexer polling
 */
export interface WaitOptions {
  /** Maximum number of polling attempts (default: 10) */
  maxAttempts?: number;
  /** Delay between attempts in milliseconds (default: 1000) */
  delay?: number;
  /** Exponential backoff multiplier (default: 1.5) */
  backoffMultiplier?: number;
}

/**
 * Wait for entity to be indexed by entity key
 * 
 * Polls the indexer until the entity is found or max attempts reached.
 * Uses exponential backoff to avoid hammering the indexer.
 * 
 * @param entityKey - Entity key to wait for
 * @param type - Entity type (for querying)
 * @param options - Wait options
 * @returns True if entity was found, false if timeout
 * 
 * @example
 * ```ts
 * const found = await waitForIndexer(entityKey, 'user_profile');
 * if (found) {
 *   console.log('Entity is now indexed');
 * }
 * ```
 */
export async function waitForIndexer(
  entityKey: string,
  type: string,
  options: WaitOptions = {}
): Promise<boolean> {
  const maxAttempts = options.maxAttempts || 10;
  const initialDelay = options.delay || 1000;
  const backoffMultiplier = options.backoffMultiplier || 1.5;
  
  const publicClient = getPublicClient();
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Try to fetch the entity by key
      // Note: This assumes the SDK supports fetching by entity key
      // If not available, we'll query by type and filter client-side
      const query = buildSafeQuery(type, { limit: 100 });
      const entities = await executeQuery(query);
      
      // Check if entity exists in results
      const found = entities.some((entity: any) => entity.entityKey === entityKey);
      
      if (found) {
        return true;
      }
      
      // If not found and not last attempt, wait with exponential backoff
      if (attempt < maxAttempts - 1) {
        const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error: any) {
      console.warn(`[indexer.ts] Polling attempt ${attempt + 1} failed:`, error?.message);
      
      // If not last attempt, continue with backoff
      if (attempt < maxAttempts - 1) {
        const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return false;
}

/**
 * Wait for transaction to be indexed by transaction hash
 * 
 * Polls the indexer until a transaction with the given hash is found
 * in query results, or max attempts reached.
 * 
 * This is useful when you have a txHash but need to wait for the entity
 * to be queryable.
 * 
 * @param txHash - Transaction hash to wait for
 * @param type - Entity type to query (to find entities created by this tx)
 * @param options - Wait options
 * @returns Array of entities found with this txHash, or empty array if timeout
 * 
 * @example
 * ```ts
 * const entities = await waitForIndexerByTxHash(txHash, 'user_profile');
 * if (entities.length > 0) {
 *   console.log('Transaction is now indexed');
 * }
 * ```
 */
export async function waitForIndexerByTxHash(
  txHash: string,
  type: string,
  options: WaitOptions = {}
): Promise<any[]> {
  const maxAttempts = options.maxAttempts || 10;
  const initialDelay = options.delay || 1000;
  const backoffMultiplier = options.backoffMultiplier || 1.5;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Query entities of this type
      const query = buildSafeQuery(type, { limit: 100 });
      const entities = await executeQuery(query);
      
      // Filter entities that have this txHash (check txHash attribute or metadata)
      // Note: This assumes entities have a txHash attribute or metadata field
      const matching = entities.filter((entity: any) => {
        // Check various places where txHash might be stored
        const attrs = entity.attributes || {};
        const txHashAttr = Array.isArray(attrs)
          ? attrs.find((a: any) => a.key === 'txHash' || a.key === 'tx_hash')?.value
          : attrs.txHash || attrs.tx_hash;
        
        return txHashAttr === txHash || entity.txHash === txHash;
      });
      
      if (matching.length > 0) {
        return matching;
      }
      
      // If not found and not last attempt, wait with exponential backoff
      if (attempt < maxAttempts - 1) {
        const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error: any) {
      console.warn(`[indexer.ts] Polling attempt ${attempt + 1} failed:`, error?.message);
      
      // If not last attempt, continue with backoff
      if (attempt < maxAttempts - 1) {
        const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return [];
}

