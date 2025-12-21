/**
 * Canonical entity update helper
 * 
 * This is the canonical helper wrapper that will be used everywhere for entity updates.
 * The exact API signature will be determined in U0.1 SDK API verification.
 * 
 * Based on the entity update implementation plan (refs/entity-update-implementation-plan.md).
 * 
 * IMPORTANT: This is a placeholder implementation. The actual SDK API signature
 * will be verified and this will be updated accordingly.
 */

import { getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';

/**
 * Upsert an entity (create or update)
 * 
 * If `key` is provided and an entity with that key exists, updates the entity.
 * If `key` is not provided or entity doesn't exist, creates a new entity.
 * 
 * This is the canonical helper that will be used throughout the codebase
 * for all entity update operations.
 * 
 * @param params - Upsert parameters
 * @param params.type - Entity type (e.g., 'user_profile', 'notification_preference')
 * @param params.key - Optional entity key. If provided and entity exists, updates; otherwise creates.
 * @param params.attributes - Array of attribute key-value pairs
 * @param params.payload - Payload as Uint8Array (JSON-encoded)
 * @param params.contentType - Content type (default: 'application/json')
 * @param params.expiresIn - Optional TTL in seconds
 * @param params.privateKey - Private key for signing
 * @returns Entity key and transaction hash
 * 
 * @throws Error if SDK API verification (U0.1) reveals different signature
 * 
 * TODO: Verify exact SDK API signature in U0.1 and update this implementation
 */
export async function arkivUpsertEntity({
  type,
  key,
  attributes,
  payload,
  contentType = 'application/json' as const,
  expiresIn,
  privateKey,
}: {
  type: string;
  key?: string;
  attributes: Array<{ key: string; value: string }>;
  payload: Uint8Array;
  contentType?: 'application/json';
  expiresIn?: number;
  privateKey: `0x${string}`;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  
  // PLACEHOLDER: Actual implementation depends on SDK API verification (U0.1)
  // Expected behavior:
  // - If key is provided: call updateEntity (or equivalent) with that key
  // - If key is not provided: call createEntity (existing pattern)
  // - Both should return { entityKey, txHash }
  
  if (key) {
    // TODO: Replace with actual SDK updateEntity call once API is verified
    // Expected: await walletClient.updateEntity({ entityKey: key, attributes, payload, ... })
    throw new Error(
      'Entity update not yet implemented. SDK API verification (U0.1) required. ' +
      'See refs/entity-update-implementation-plan.md for details.'
    );
  } else {
    // Use existing createEntity pattern
    // expiresIn is required by SDK, use default if not provided (6 months)
    const finalExpiresIn = expiresIn ?? 15768000; // 6 months in seconds
    const result = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload,
        contentType,
        attributes,
        expiresIn: finalExpiresIn,
      });
    });
    // Map entityKey to key for consistency
    return { key: result.entityKey, txHash: result.txHash };
  }
}

