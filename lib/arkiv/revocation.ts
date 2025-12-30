/**
 * Revocation Pattern Implementation
 * 
 * Implements PAT-REVOKE-001: Revocation via Marker Entities
 * 
 * Arkiv has no built-in revocation. To revoke grants, consent, invites, or any
 * capability-like entity, create a revocation marker entity that indicates the
 * original entity is revoked.
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { SPACE_ID, getPrivateKey } from "@/lib/config";
import { handleTransactionWithTimeout } from "./transaction-utils";

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
 * @param expiresIn - Optional TTL in seconds (defaults to 6 months, same as grants)
 * @returns Revocation marker key and transaction hash
 */
export async function createRevocationMarker({
  originalType,
  entityKey,
  revokedBy,
  reason,
  spaceId = SPACE_ID,
  expiresIn = 15768000, // 6 months (same as grants)
}: {
  originalType: string;
  entityKey: string;
  revokedBy: string;
  reason?: string;
  spaceId?: string;
  expiresIn?: number;
}): Promise<{ key: string; txHash: string }> {
  const privateKey = getPrivateKey();
  if (!privateKey) {
    throw new Error('Private key not configured');
  }

  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
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

  const attributes: Array<{ key: string; value: string }> = [
    { key: 'type', value: revocationType },
    { key: 'entityKey', value: entityKey },
    { key: 'revokedAt', value: revokedAt },
    { key: 'revokedBy', value: normalizedRevokedBy },
    { key: 'spaceId', value: finalSpaceId },
  ];

  if (reason) {
    attributes.push({ key: 'reason', value: reason });
  }

  // Add signer metadata
  const { addSignerMetadata } = await import('./signer-metadata');
  const attributesWithSigner = addSignerMetadata(attributes, privateKey);

  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: attributesWithSigner,
      expiresIn,
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
    const result = await publicClient.buildQuery()
      .where(eq('type', revocationType))
      .where(eq('entityKey', entityKey))
      .where(eq('spaceId', finalSpaceId))
      .withAttributes(true)
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

