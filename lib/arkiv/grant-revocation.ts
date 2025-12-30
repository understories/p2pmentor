/**
 * Grant Revocation Helpers
 * 
 * Implements PAT-REVOKE-001 for review mode grants.
 * Provides convenience functions for revoking grants.
 */

import { createRevocationMarker, isEntityRevoked } from "./revocation";
import { getPrivateKey } from "@/lib/config";
import { SPACE_ID } from "@/lib/config";

/**
 * Revoke a review mode grant
 * 
 * Creates a revocation marker entity for the specified grant.
 * 
 * @param grantKey - Key of grant to revoke
 * @param revokedBy - Wallet address that is revoking (normalized to lowercase)
 * @param reason - Optional reason for revocation
 * @param spaceId - Optional space ID (defaults to SPACE_ID)
 * @returns Revocation marker key and transaction hash
 */
export async function revokeReviewModeGrant({
  grantKey,
  revokedBy,
  reason,
  spaceId = SPACE_ID,
}: {
  grantKey: string;
  revokedBy: string;
  reason?: string;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const privateKey = getPrivateKey();
  if (!privateKey) {
    throw new Error('Private key not configured. Revocation must be done server-side.');
  }

  return await createRevocationMarker({
    originalType: 'review_mode_grant',
    entityKey: grantKey,
    revokedBy,
    reason: reason || 'Manual revocation',
    spaceId,
    expiresIn: 15768000, // 6 months (same as grants)
  });
}

/**
 * Check if a review mode grant is revoked
 * 
 * @param grantKey - Key of grant to check
 * @param spaceId - Optional space ID (defaults to SPACE_ID)
 * @returns True if grant is revoked, false otherwise
 */
export async function isReviewModeGrantRevoked({
  grantKey,
  spaceId = SPACE_ID,
}: {
  grantKey: string;
  spaceId?: string;
}): Promise<boolean> {
  return await isEntityRevoked({
    originalType: 'review_mode_grant',
    entityKey: grantKey,
    spaceId,
  });
}

