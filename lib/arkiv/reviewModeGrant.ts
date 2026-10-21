/**
 * Review Mode Grant Entity Helpers
 *
 * Handles server-signed grant creation and client-side querying of review_mode_grant entities on Arkiv.
 * These entities grant temporary capability to bypass onboarding for reviewers.
 *
 * IMPORTANT: Grants are signed by the server signer wallet (ARKIV_PRIVATE_KEY), not the user wallet.
 * This ensures only the app can issue grants, preventing users from issuing their own grants.
 */

import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, getAttr as readAttr, parsePayload } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { SPACE_ID, getPrivateKey, CURRENT_WALLET, SERVER_SIGNER_ADDRESS } from '@/lib/config';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';
import { isEntityRevoked } from './revocation';

export type ReviewModeGrant = {
  key: string;
  subjectWallet: string;
  mode: string;
  issuedAt: string; // ISO timestamp
  expiresAt?: string; // ISO timestamp
  appBuild?: string;
  grantReason?: string;
  issuerWallet: string; // Server signer address (required for verification)
  spaceId: string;
  txHash: string;
};

/**
 * Issue review mode grant entity (SERVER-ONLY)
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
export async function issueReviewModeGrant({
  subjectWallet,
  expiresAt,
  appBuild,
  grantReason = 'arkiv_team_review',
}: {
  subjectWallet: string;
  expiresAt?: string; // ISO-8601 UTC timestamp
  appBuild?: string;
  grantReason?: string;
}): Promise<{ key: string; txHash: string; expiresAt: string }> {
  // CRITICAL: Use server signer wallet (ARKIV_PRIVATE_KEY), NEVER user wallet
  // This function must ONLY be called from server-side API routes
  const privateKey = getPrivateKey();

  // Validate we have a proper private key (not a wallet address)
  if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
    throw new Error('Invalid private key format. Must be 0x followed by 64 hex characters.');
  }

  // Derive server signer address from private key
  const { privateKeyToAccount } = await import('viem/accounts');
  const serverSignerAccount = privateKeyToAccount(privateKey);
  const serverSignerAddress = serverSignerAccount.address.toLowerCase();

  // CRITICAL: Ensure we're using server signer, not user wallet
  // Log for debugging (remove sensitive data in production)
  console.log('[issueReviewModeGrant] Using server signer wallet:', {
    serverSignerAddress: `${serverSignerAddress.substring(0, 6)}...${serverSignerAddress.substring(serverSignerAddress.length - 4)}`,
    subjectWallet: `${subjectWallet.substring(0, 6)}...${subjectWallet.substring(subjectWallet.length - 4)}`,
    note: 'subjectWallet is the grant recipient, serverSignerAddress signs the transaction',
  });

  const walletClient = getWalletClientFromPrivateKey(privateKey);

  // CRITICAL: Verify wallet client is using server signer account
  // Log the account address to ensure it matches server signer
  const walletClientAccount = walletClient.account;
  if (!walletClientAccount) {
    throw new Error('Wallet client missing account - cannot sign transaction');
  }
  const walletClientAddress = walletClientAccount.address.toLowerCase();

  if (walletClientAddress !== serverSignerAddress) {
    throw new Error(
      `Wallet client account mismatch: expected ${serverSignerAddress}, got ${walletClientAddress}`
    );
  }

  console.log('[issueReviewModeGrant] Wallet client verified:', {
    serverSignerAddress: `${serverSignerAddress.substring(0, 6)}...${serverSignerAddress.substring(serverSignerAddress.length - 4)}`,
    walletClientAddress: `${walletClientAddress.substring(0, 6)}...${walletClientAddress.substring(walletClientAddress.length - 4)}`,
    match: walletClientAddress === serverSignerAddress,
  });

  const issuedAt = new Date().toISOString(); // ISO-8601 UTC
  const spaceId = SPACE_ID;
  const issuedBy = serverSignerAddress; // Server signer address (explicit, not from CURRENT_WALLET)

  // Default expiry: 7 days from now (ISO-8601 UTC)
  const defaultExpiresAt =
    expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const payload = {
    mode: 'arkiv_review',
    issuedAt, // ISO-8601 UTC
    expiresAt: defaultExpiresAt, // ISO-8601 UTC
    appBuild,
    grantReason,
    issuedBy,
  };

  // Attributes: short, queryable fields only (grantReason is payload-only)
  const attributes = {
    type_version: '1',
    space_id: spaceId,
    subject_wallet: subjectWallet.toLowerCase(),
    mode: 'arkiv_review',
    issued_at: issuedAt,
    expires_at: defaultExpiresAt,
    issuer_wallet: issuedBy, // explicit issuer
    app_build: appBuild,
  };

  // CRITICAL: Calculate entity lifetime and ensure it's always an integer (BigInt requirement)
  // Division produces float, must floor immediately and validate
  const expirationTime = new Date(defaultExpiresAt).getTime();
  const now = Date.now();
  const lifetimeSecondsRaw = (expirationTime - now) / 1000;
  const lifetimeSeconds = Math.max(1, Math.floor(lifetimeSecondsRaw));

  // Final safety check: ensure it's definitely an integer for BigInt conversion
  if (!Number.isInteger(lifetimeSeconds) || lifetimeSeconds < 1) {
    throw new Error(
      `lifetimeSeconds must be a positive integer, got: ${lifetimeSeconds} (raw: ${lifetimeSecondsRaw})`
    );
  }

  const result = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: 'review_mode_grant',
      attributes,
      payload,
      lifetimeSeconds, // Entity expires with the grant
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
  // Grants are only written with the server key: scope to the server signer when configured
  const baseQuery = arkivSelect('review_mode_grant', publicClient);
  const query = SERVER_SIGNER_ADDRESS ? baseQuery.createdBy(SERVER_SIGNER_ADDRESS) : baseQuery;
  const finalSpaceId = spaceId || SPACE_ID;

  let queryBuilder = query
    .where(eqAttr('subject_wallet', wallet.toLowerCase()))
    .where(eqAttr('space_id', finalSpaceId)); // Use snake_case per Arkiv standards

  try {
    const result = await queryBuilder.limit(100).fetch();

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      return null;
    }

    // Get server signer address for validation
    const serverSignerAddress = CURRENT_WALLET?.toLowerCase() || '';

    // Filter expired grants, validate issuer, and check for revocation
    // Both issuedAt and expiresAt must be ISO-8601 UTC timestamps
    const now = new Date().toISOString();

    // Check revocation for all grants in parallel (efficient)
    const grantRevocationChecks = await Promise.all(
      result.entities.map(async (entity: any) => {
        const grantKey = entity.key || (entity as any).entityKey || '';
        if (!grantKey) return { entity, isRevoked: false };

        const revoked = await isEntityRevoked({
          originalType: 'review_mode_grant',
          entityKey: grantKey,
          spaceId: finalSpaceId,
        });

        return { entity, isRevoked: revoked };
      })
    );

    const validGrants = grantRevocationChecks
      .filter(({ entity, isRevoked }) => {
        // Check revocation first (PAT-REVOKE-001)
        if (isRevoked) {
          return false; // Revoked
        }

        // Check expiration (required check)
        const expiresAt = readAttr(entity, 'expires_at');
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

        // CRITICAL: Verify issuer is server signer (non-optional, prevents user-issued grants)
        // This check is mandatory - grants without issuer_wallet or with wrong issuer are rejected
        const issuerWallet = readAttr(entity, 'issuer_wallet');
        if (!issuerWallet) {
          return false; // Missing issuer_wallet - reject
        }
        if (!serverSignerAddress) {
          // If server signer not configured, reject all grants (defensive)
          return false;
        }
        if (issuerWallet.toLowerCase() !== serverSignerAddress) {
          return false; // Not issued by server signer - reject
        }

        return true;
      })
      .map(({ entity }) => entity)
      .sort((a: any, b: any) => {
        // Get issued_at, treat missing as oldest
        const aTime = readAttr(a, 'issued_at');
        const bTime = readAttr(b, 'issued_at');
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
    const getAttr = (key: string): string => readAttr(latest, key);
    const payload = parsePayload<any>(latest);

    return {
      key: latest.key || (latest as any).entityKey || '', // Support both key and entityKey
      subjectWallet: getAttr('subject_wallet') || wallet,
      mode: getAttr('mode') || 'arkiv_review',
      issuedAt: getAttr('issued_at') || '',
      expiresAt: getAttr('expires_at') || undefined,
      appBuild: getAttr('app_build') || undefined,
      grantReason: payload.grantReason || 'arkiv_team_review',
      issuerWallet: getAttr('issuer_wallet') || serverSignerAddress, // Required for verification
      spaceId: getAttr('space_id') || finalSpaceId, // Use snake_case per Arkiv standards
      txHash: (latest as any).txHash || '',
    };
  } catch (fetchError: any) {
    console.error('[getLatestValidReviewModeGrant] Arkiv query failed:', {
      message: fetchError?.message,
      stack: fetchError?.stack,
      error: fetchError,
    });
    return null; // Return null on query failure (graceful degradation)
  }
}
