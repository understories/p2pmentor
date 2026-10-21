/**
 * Revocation Pattern Implementation
 *
 * Implements PAT-REVOKE-001: Revocation via Marker Entities
 *
 * Arkiv has no built-in revocation. To revoke grants, consent, invites, or any
 * capability-like entity, create a revocation marker entity that indicates the
 * original entity is revoked.
 */

import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { SPACE_ID, SERVER_SIGNER_ADDRESS, getPrivateKey } from '@/lib/config';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';

export type RevocationMarker = {
  key: string;
  entityKey: string; // Reference to original entity
  revokedAt: string; // ISO timestamp
  revokedBy: string; // Wallet that revoked
  reason?: string; // Optional reason
  spaceId: string;
  txHash: string;
};

/**
 * Create revocation marker entity
 *
 * Creates a marker entity that indicates the original entity is revoked.
 * The marker references the original entity via entityKey.
 *
 * @param originalType - Type of original entity (e.g., 'review_mode_grant')
 * @param entityKey - Key of entity to revoke
 * @param revokedBy - Wallet address that is revoking (normalized to lowercase)
 * @param reason - Optional reason for revocation
 * @param spaceId - Optional space ID (defaults to SPACE_ID)
 * @param lifetimeSeconds - Optional lifetime in seconds (defaults to the type default lifetime)
 * @returns Revocation marker key and transaction hash
 */
export async function createRevocationMarker({
  originalType,
  entityKey,
  revokedBy,
  reason,
  spaceId = SPACE_ID,
  lifetimeSeconds,
}: {
  originalType: string;
  entityKey: string;
  revokedBy: string;
  reason?: string;
  spaceId?: string;
  lifetimeSeconds?: number;
}): Promise<{ key: string; txHash: string }> {
  const privateKey = getPrivateKey();
  if (!privateKey) {
    throw new Error('Private key not configured');
  }

  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const revokedAt = new Date().toISOString();
  const normalizedRevokedBy = revokedBy.toLowerCase().trim();
  const finalSpaceId = spaceId || SPACE_ID;

  const revocationType = `${originalType}_revocation`;

  const payload = {
    originalType,
    entityKey,
    revokedAt,
    revokedBy: normalizedRevokedBy,
    reason,
    spaceId: finalSpaceId,
  };

  // Attributes: short, queryable fields only (reason is payload-only)
  const attributes = {
    entity_key: entityKey,
    revoked_at: revokedAt,
    revoked_by: normalizedRevokedBy,
    space_id: finalSpaceId,
  };

  // Add signer metadata
  const { addSignerMetadata } = await import('./signer-metadata');
  const attributesWithSigner = addSignerMetadata(attributes, privateKey);

  const result = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: revocationType,
      attributes: attributesWithSigner,
      payload,
      lifetimeSeconds,
    });
  });

  return { key: result.entityKey, txHash: result.txHash };
}

/**
 * Check if an entity is revoked
 *
 * Queries for a revocation marker for the given entity key.
 *
 * @param originalType - Type of original entity (e.g., 'review_mode_grant')
 * @param entityKey - Key of entity to check
 * @param spaceId - Optional space ID (defaults to SPACE_ID)
 * @returns True if entity is revoked, false otherwise
 */
export async function isEntityRevoked({
  originalType,
  entityKey,
  spaceId = SPACE_ID,
}: {
  originalType: string;
  entityKey: string;
  spaceId?: string;
}): Promise<boolean> {
  const publicClient = getPublicClient();
  const finalSpaceId = spaceId || SPACE_ID;
  const revocationType = `${originalType}_revocation`;

  try {
    // Revocation markers are only written with the server key: scope to the server signer
    const baseQuery = arkivSelect(revocationType, publicClient);
    const query = SERVER_SIGNER_ADDRESS ? baseQuery.createdBy(SERVER_SIGNER_ADDRESS) : baseQuery;
    const result = await query
      .where(eqAttr('entity_key', entityKey))
      .where(eqAttr('space_id', finalSpaceId))
      .limit(1)
      .fetch();

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      return false;
    }

    return result.entities.length > 0;
  } catch (error: any) {
    console.error('[isEntityRevoked] Query failed:', {
      originalType,
      entityKey,
      spaceId: finalSpaceId,
      error: error?.message,
    });
    // On query failure, assume not revoked (fail open for availability)
    // In production, may want to fail closed for security
    return false;
  }
}
