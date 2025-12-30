/**
 * Write helpers for records
 * 
 * Uses Arkiv App Primitives for transaction handling.
 * Follows PAT-TIMEOUT-001 (Transaction Timeouts) and PAT-ERROR-001 (Error Handling).
 */

import { getServerWalletClient } from './client';
import { handleTransactionWithTimeout } from '../../../arkiv-app-kit/src/transactions';
import { makeAttributes } from '../../../arkiv-app-kit/src/schema';
import { createTxHashEntity } from '../../../arkiv-app-kit/src/txhash-entities';

/**
 * Create a record entity
 * 
 * This is the canonical write path for this template.
 * It handles timeouts, errors, and creates companion txHash entity.
 * 
 * @param type - Entity type (e.g., 'record')
 * @param payload - Payload data (will be JSON-encoded)
 * @param attributes - Additional attributes (wallet, status, etc.)
 * @returns Transaction result with entityKey and txHash
 */
export async function createRecord(
  type: string,
  payload: Record<string, any>,
  attributes?: Record<string, string>
) {
  const walletClient = getServerWalletClient();
  
  // Build attributes using app-kit helper (enforces conventions)
  const baseAttributes = makeAttributes({
    type,
    ...attributes,
  });
  
  // Encode payload
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  
  // Create entity with timeout handling
  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: payloadBytes,
      attributes: baseAttributes,
      contentType: 'application/json',
      expiresIn: 15768000, // 6 months
    });
  });
  
  // Create companion txHash entity (strongly recommended for observability)
  // This is non-blocking - if it fails, we still return success for the main entity
  await createTxHashEntity(type, result.txHash, result.entityKey);
  
  return {
    entityKey: result.entityKey,
    txHash: result.txHash,
    status: 'submitted' as const, // Never claim "indexed" - indexer lag is normal
  };
}

