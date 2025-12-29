/**
 * Review Mode Grant Entity Helpers
 * 
 * Handles server-signed grant creation and client-side querying of review_mode_grant entities on Arkiv.
 * These entities grant temporary capability to bypass onboarding for reviewers.
 * 
 * IMPORTANT: Grants are signed by the server signer wallet (ARKIV_PRIVATE_KEY), not the user wallet.
 * This ensures only the app can issue grants, preventing users from minting their own grants.
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { SPACE_ID, getPrivateKey, CURRENT_WALLET } from "@/lib/config";
import { handleTransactionWithTimeout } from "./transaction-utils";

export type ReviewModeGrant = {
  key: string;
  subjectWallet: string;
  mode: string;
  issuedAt: string;
  expiresAt?: string;
  appBuild?: string;
  grantReason?: string;
  issuedBy: string;
  spaceId: string;
  txHash: string;
};

/**
 * Mint review mode grant entity (SERVER-ONLY)
 * 
 * This function must be called from a server-side API route.
 * It uses the server signer wallet (ARKIV_PRIVATE_KEY) to sign the grant entity.
 * 
 * @param subjectWallet - User wallet address that will receive the grant (normalized to lowercase)
 * @param expiresAt - Optional ISO-8601 UTC timestamp (defaults to 7 days from now)
 * @param appBuild - Optional build identifier
 * @param grantReason - Optional reason for grant (defaults to 'review_mode')
 * @returns Entity key and transaction hash
 */
export async function mintReviewModeGrant({
  subjectWallet,
  expiresAt,
  appBuild,
  grantReason = 'review_mode',
}: {
  subjectWallet: string;
  expiresAt?: string; // ISO-8601 UTC timestamp
  appBuild?: string;
  grantReason?: string;
}): Promise<{ key: string; txHash: string; expiresAt: string }> {
  // Use server signer wallet (ARKIV_PRIVATE_KEY)
  const privateKey = getPrivateKey();
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  
  const enc = new TextEncoder();
  const issuedAt = new Date().toISOString(); // ISO-8601 UTC
  const spaceId = SPACE_ID;
  const issuedBy = CURRENT_WALLET || ''; // Server signer address
  
  // Default expiry: 7 days from now (ISO-8601 UTC)
  const defaultExpiresAt = expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const payload = {
    mode: 'arkiv_review',
    issuedAt, // ISO-8601 UTC
    expiresAt: defaultExpiresAt, // ISO-8601 UTC
    appBuild,
    grantReason,
    issuedBy,
  };

  const attributes: Array<{ key: string; value: string }> = [
    { key: 'type', value: 'review_mode_grant' },
    { key: 'typeVersion', value: '1' },
    { key: 'space_id', value: spaceId }, // Use snake_case per Arkiv standards
    { key: 'subject_wallet', value: subjectWallet.toLowerCase() },
    { key: 'mode', value: 'arkiv_review' },
    { key: 'issuedAt', value: issuedAt },
    { key: 'grantReason', value: grantReason },
    { key: 'issuedBy', value: issuedBy },
  ];

  // Always include expiresAt (defaults to 7 days if not provided)
  attributes.push({ key: 'expiresAt', value: defaultExpiresAt });
  if (appBuild) {
    attributes.push({ key: 'appBuild', value: appBuild });
  }

  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes,
      expiresIn: Math.floor((new Date(defaultExpiresAt).getTime() - Date.now()) / 1000),
    });
  });

  return { key: result.entityKey, txHash: result.txHash, expiresAt: defaultExpiresAt };
}

/**
 * Get latest valid (non-expired) review mode grant for wallet (CLIENT-SAFE)
 * 
 * Returns the most recent grant that:
 * - Has not expired
 * - Has subject_wallet matching the provided wallet
 * - Is in the correct space_id
 * - Was issued by the server signer (checked via issuedBy attribute)
 * 
 * If multiple grants exist, returns the one with the latest issuedAt timestamp.
 * 
 * @param wallet - Wallet address (normalized to lowercase)
 * @param spaceId - Optional space ID (defaults to SPACE_ID from config)
 * @returns Latest valid grant or null if none found
 */
export async function getLatestValidReviewModeGrant(
  wallet: string,
  spaceId?: string
): Promise<ReviewModeGrant | null> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  const finalSpaceId = spaceId || SPACE_ID;

  let queryBuilder = query
    .where(eq('type', 'review_mode_grant'))
    .where(eq('subject_wallet', wallet.toLowerCase()))
    .where(eq('space_id', finalSpaceId)); // Use snake_case per Arkiv standards

  try {
    const result = await queryBuilder
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch();

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      return null;
    }

    // Get server signer address for validation
    const serverSignerAddress = CURRENT_WALLET?.toLowerCase() || '';
    
    // Filter expired grants and validate issuer
    // Both issuedAt and expiresAt must be ISO-8601 UTC timestamps
    const now = new Date().toISOString();
    const validGrants = result.entities
      .filter((entity: any) => {
        // Check expiration
        const expiresAt = entity.attributes?.find((attr: any) => attr.key === 'expiresAt')?.value;
        if (expiresAt) {
          try {
            if (expiresAt <= now) {
              return false; // Expired
            }
          } catch {
            // If invalid timestamp, exclude it
            return false;
          }
        }
        
        // Verify issuer is server signer (prevent user-minted grants)
        const issuedBy = entity.attributes?.find((attr: any) => attr.key === 'issuedBy')?.value;
        if (serverSignerAddress && issuedBy) {
          if (issuedBy.toLowerCase() !== serverSignerAddress) {
            return false; // Not issued by server signer
          }
        }
        
        return true;
      })
      .sort((a: any, b: any) => {
        // Get issuedAt, treat missing as oldest
        const aTime = a.attributes?.find((attr: any) => attr.key === 'issuedAt')?.value || '';
        const bTime = b.attributes?.find((attr: any) => attr.key === 'issuedAt')?.value || '';
        // Missing timestamps sort to end (oldest)
        if (!aTime && !bTime) return 0;
        if (!aTime) return 1; // a is older
        if (!bTime) return -1; // b is older
        return bTime.localeCompare(aTime); // Latest first (ISO string comparison)
      });

    if (validGrants.length === 0) {
      return null;
    }

    const latest = validGrants[0];
    const getAttr = (key: string): string => {
      const attr = latest.attributes?.find((attr: any) => attr.key === key);
      return attr?.value ? String(attr.value) : '';
    };

    return {
      key: latest.key || (latest as any).entityKey || '', // Support both key and entityKey
      subjectWallet: getAttr('subject_wallet') || wallet,
      mode: getAttr('mode') || 'arkiv_review',
      issuedAt: getAttr('issuedAt') || '',
      expiresAt: getAttr('expiresAt') || undefined,
      appBuild: getAttr('appBuild') || undefined,
      grantReason: getAttr('grantReason') || 'review_mode',
      issuedBy: getAttr('issuedBy') || serverSignerAddress,
      spaceId: getAttr('space_id') || finalSpaceId, // Use snake_case per Arkiv standards
      txHash: (latest as any).txHash || '',
    };
  } catch (fetchError: any) {
    console.error('[getLatestValidReviewModeGrant] Arkiv query failed:', {
      message: fetchError?.message,
      stack: fetchError?.stack,
      error: fetchError
    });
    return null; // Return null on query failure (graceful degradation)
  }
}

