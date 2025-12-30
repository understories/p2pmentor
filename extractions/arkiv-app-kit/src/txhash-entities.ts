/**
 * Transaction hash companion entity helpers
 * 
 * Creates parallel `*_txhash` entities for reliable querying and observability.
 * This pattern is recommended by Engineering Guidelines for all write paths.
 * 
 * **Strongly recommended for any write path** - even though this is optional
 * in API surface, txHash entities provide reliable querying and observability
 * which are core Arkiv realities.
 * 
 * Pattern: Engineering Guidelines recommendation for txHash companion entities
 */

import { getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout, TransactionResult } from './transactions';
import { makeAttributes, ATTR_KEYS } from './schema';
import { requireEnv } from './env';

/**
 * Create a txHash companion entity
 * 
 * Creates a parallel entity that stores the transaction hash for reliable querying.
 * This entity has type `{originalType}_txhash` and includes the txHash as an attribute.
 * 
 * This is non-blocking and handles errors gracefully - if txHash entity creation
 * fails, it logs a warning but doesn't throw (the main entity write already succeeded).
 * 
 * @param originalType - Original entity type (e.g., 'user_profile')
 * @param txHash - Transaction hash from the original entity creation
 * @param entityKey - Entity key of the original entity (optional, for linking)
 * @param privateKey - Private key for signing (if not provided, uses ARKIV_PRIVATE_KEY)
 * @returns Transaction result, or null if creation failed
 * 
 * @example
 * ```ts
 * // After creating main entity
 * const mainResult = await walletClient.createEntity({ ... });
 * 
 * // Create companion txHash entity (non-blocking)
 * await createTxHashEntity('user_profile', mainResult.txHash, mainResult.entityKey);
 * ```
 */
export async function createTxHashEntity(
  originalType: string,
  txHash: string,
  entityKey?: string,
  privateKey?: `0x${string}`
): Promise<TransactionResult | null> {
  try {
    const signerKey = privateKey || (requireEnv('ARKIV_PRIVATE_KEY') as `0x${string}`);
    const walletClient = getWalletClientFromPrivateKey(signerKey);
    
    // Derive txHash entity type
    const txHashType = `${originalType}_txhash`;
    
    // Build attributes
    const attributes = makeAttributes({
      type: txHashType,
      ...(entityKey && { entity_key: entityKey }),
    });
    
    // Add txHash as a separate attribute (not normalized by makeAttributes)
    attributes.push({ key: ATTR_KEYS.TXHASH, value: txHash });
    
    // Create payload (minimal - just the txHash for reference)
    const payload = new TextEncoder().encode(JSON.stringify({
      originalType,
      txHash,
      entityKey,
      createdAt: new Date().toISOString(),
    }));
    
    // Create txHash entity (non-blocking - errors are logged but don't throw)
    const result = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload,
        attributes,
        contentType: 'application/json',
        expiresIn: 15768000, // 6 months (same as main entity)
      });
    });
    
    return result;
  } catch (error: any) {
    // Log error but don't throw - txHash entity creation is best-effort
    // The main entity write already succeeded, so we don't want to fail the whole operation
    console.warn('[txhash-entities.ts] Failed to create txHash companion entity:', {
      originalType,
      txHash,
      error: error?.message,
    });
    return null;
  }
}

/**
 * Query entities by transaction hash
 * 
 * Queries `*_txhash` entities to find entities created by a specific transaction.
 * This is useful for reconciliation and observability.
 * 
 * @param txHash - Transaction hash to query
 * @param originalType - Original entity type (to derive txHash entity type)
 * @returns Array of txHash entities matching this transaction
 * 
 * @example
 * ```ts
 * const txHashEntities = await queryByTxHash(txHash, 'user_profile');
 * if (txHashEntities.length > 0) {
 *   console.log('Found entities created by this transaction');
 * }
 * ```
 */
export async function queryByTxHash(
  txHash: string,
  originalType: string
): Promise<any[]> {
  const txHashType = `${originalType}_txhash`;
  
  // Query txHash entities
  const { buildSafeQuery, executeQuery } = await import('./queries');
  const query = buildSafeQuery(txHashType, { limit: 100 });
  
  // Filter by txHash (client-side, since we can't query by arbitrary attribute easily)
  const entities = await executeQuery(query);
  
  return entities.filter((entity: any) => {
    const attrs = entity.attributes || {};
    const txHashAttr = Array.isArray(attrs)
      ? attrs.find((a: any) => a.key === 'txHash' || a.key === 'tx_hash')?.value
      : attrs.txHash || attrs.tx_hash;
    
    return txHashAttr === txHash;
  });
}

