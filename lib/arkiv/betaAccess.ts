/**
 * Beta Access Tracking
 *
 * Tracks wallet-to-beta-code binding on Arkiv.
 * Links wallet addresses to beta codes for audit and access control.
 *
 * Reference: refs/docs/beta_code_gating_plan.md
 */

import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { getPrivateKey, SERVER_SIGNER_ADDRESS, SPACE_ID } from '@/lib/config';
import { createArkivEntity } from './write';

/**
 * Start a beta_access query.
 * beta_access entities are only written with the server key, so reads are scoped
 * to the server signer when it is configured.
 */
function selectBetaAccess(publicClient: ReturnType<typeof getPublicClient>) {
  const q = arkivSelect('beta_access', publicClient);
  return SERVER_SIGNER_ADDRESS ? q.createdBy(SERVER_SIGNER_ADDRESS) : q;
}
import { handleTransactionWithTimeout } from './transaction-utils';

export type BetaAccess = {
  key: string;
  wallet: string;
  code: string;
  grantedAt: string;
  spaceId: string;
  txHash?: string;
};

/**
 * Create beta access entity on Arkiv
 *
 * Records that a wallet has been granted access via a beta code.
 * This creates an immutable audit trail on-chain.
 *
 * @param params - Beta access data
 * @returns Entity key and transaction hash
 */
export async function createBetaAccess({
  wallet,
  code,
  privateKey,
  spaceId = SPACE_ID,
}: {
  wallet: string;
  code: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  // CRITICAL: Verify we're using server signer, not user wallet
  const { privateKeyToAccount } = await import('viem/accounts');
  const serverSignerAccount = privateKeyToAccount(privateKey);
  const serverSignerAddress = serverSignerAccount.address.toLowerCase();

  const walletClient = getWalletClientFromPrivateKey(privateKey);

  // Verify wallet client account matches server signer
  const walletClientAccount = walletClient.account;
  if (!walletClientAccount) {
    throw new Error('[createBetaAccess] Wallet client missing account - cannot sign transaction');
  }
  const walletClientAddress = walletClientAccount.address.toLowerCase();

  if (walletClientAddress !== serverSignerAddress) {
    throw new Error(
      `[createBetaAccess] Wallet client account mismatch: expected ${serverSignerAddress}, got ${walletClientAddress}`
    );
  }

  console.log('[createBetaAccess] Using server signer wallet:', {
    serverSignerAddress: `${serverSignerAddress.substring(0, 6)}...${serverSignerAddress.substring(serverSignerAddress.length - 4)}`,
    walletClientAddress: `${walletClientAddress.substring(0, 6)}...${walletClientAddress.substring(walletClientAddress.length - 4)}`,
    wallet: `${wallet.toLowerCase().substring(0, 6)}...${wallet.toLowerCase().substring(wallet.length - 4)}`,
    note: 'wallet is the grant recipient, serverSignerAddress signs the transaction',
  });

  const grantedAt = new Date().toISOString();
  const normalizedCode = code.toLowerCase().trim();
  const normalizedWallet = wallet.toLowerCase();

  const payload = {
    wallet: normalizedWallet,
    code: normalizedCode,
    grantedAt,
  };

  // Lifetime: type default (see lib/arkiv/schema.ts)
  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: 'beta_access',
      attributes: {
        wallet: normalizedWallet,
        code: normalizedCode,
        space_id: spaceId,
        granted_at: grantedAt,
      },
      payload,
    });
  });

  // Create separate txhash entity (optional metadata, don't wait)
  createArkivEntity(walletClient, {
    type: 'beta_access_txhash',
    attributes: {
      access_key: entityKey,
      wallet: normalizedWallet,
      space_id: spaceId,
    },
    payload: { txHash },
  }).catch((error: any) => {
    console.warn('[createBetaAccess] Failed to create txhash entity:', error);
  });

  return { key: entityKey, txHash };
}

/**
 * Get beta access by wallet address
 *
 * Queries Arkiv for beta access records for a specific wallet.
 *
 * @param wallet - Wallet address
 * @returns Beta access record or null if not found
 */
export async function getBetaAccessByWallet(
  wallet: string,
  spaceId?: string
): Promise<BetaAccess | null> {
  const publicClient = getPublicClient();
  const normalizedWallet = wallet.toLowerCase();
  const finalSpaceId = spaceId || SPACE_ID;

  try {
    const result = await selectBetaAccess(publicClient)
      .where(eqAttr('wallet', normalizedWallet))
      .where(eqAttr('space_id', finalSpaceId))
      .limit(1)
      .fetch();

    if (!result?.entities || result.entities.length === 0) {
      return null;
    }

    const entity = result.entities[0];
    let payload: any = {};
    try {
      if (entity.payload) {
        const decoded =
          entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
              ? entity.payload
              : JSON.stringify(entity.payload);
        payload = JSON.parse(decoded);
      }
    } catch (e) {
      console.error('[getBetaAccessByWallet] Error decoding payload:', e);
    }

    const getAttr = (key: string): string => readAttr(entity, key);

    // Get txHash
    const txHashResult = await arkivSelect('beta_access_txhash', publicClient)
      .where(eqAttr('access_key', entity.key))
      .where(eqAttr('space_id', finalSpaceId))
      .limit(1)
      .fetch();

    let txHash: string | undefined;
    if (txHashResult.entities && txHashResult.entities.length > 0) {
      try {
        const txHashEntity = txHashResult.entities[0];
        const txHashPayload =
          txHashEntity.payload instanceof Uint8Array
            ? new TextDecoder().decode(txHashEntity.payload)
            : typeof txHashEntity.payload === 'string'
              ? txHashEntity.payload
              : JSON.stringify(txHashEntity.payload);
        const decoded = JSON.parse(txHashPayload);
        txHash = decoded.txHash;
      } catch (e) {
        console.error('[getBetaAccessByWallet] Error decoding txHash:', e);
      }
    }

    return {
      key: entity.key,
      wallet: getAttr('wallet') || payload.wallet || normalizedWallet,
      code: getAttr('code') || payload.code || '',
      grantedAt: getAttr('granted_at') || payload.grantedAt || new Date().toISOString(),
      spaceId: getAttr('space_id') || payload.spaceId || SPACE_ID,
      txHash,
    };
  } catch (error: any) {
    console.error('[getBetaAccessByWallet] Arkiv query failed:', {
      message: error?.message,
      stack: error?.stack,
      error,
    });
    return null;
  }
}

/**
 * List all beta access records for a code
 *
 * @param code - Beta code string
 * @param spaceId - Optional space ID to filter by (defaults to SPACE_ID from config)
 * @returns Array of beta access records
 */
export async function listBetaAccessByCode(code: string, spaceId?: string): Promise<BetaAccess[]> {
  const publicClient = getPublicClient();
  const normalizedCode = code.toLowerCase().trim();
  const finalSpaceId = spaceId || SPACE_ID;

  try {
    const result = await fetchAll(
      selectBetaAccess(publicClient)
        .where(eqAttr('code', normalizedCode))
        .where(eqAttr('space_id', finalSpaceId)),
      1000,
      publicClient
    );

    if (!result?.entities || !Array.isArray(result.entities)) {
      return [];
    }

    return result.entities.map((entity: any) => {
      let payload: any = {};
      try {
        if (entity.payload) {
          const decoded =
            entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
                ? entity.payload
                : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('[listBetaAccessByCode] Error decoding payload:', e);
      }

      const getAttr = (key: string): string => readAttr(entity, key);

      // Always use normalized wallet from attributes (Arkiv-native pattern)
      // Attributes are queryable and normalized, payload may contain original case
      const walletAttr = getAttr('wallet') || '';
      const normalizedWallet = walletAttr
        ? walletAttr.toLowerCase()
        : payload.wallet
          ? payload.wallet.toLowerCase()
          : '';

      return {
        key: entity.key,
        wallet: normalizedWallet,
        code: getAttr('code') || payload.code || normalizedCode,
        grantedAt: getAttr('granted_at') || payload.grantedAt || new Date().toISOString(),
        spaceId: getAttr('space_id') || payload.spaceId || SPACE_ID,
      };
    });
  } catch (error: any) {
    console.error('[listBetaAccessByCode] Arkiv query failed:', {
      message: error?.message,
      stack: error?.stack,
      error,
    });
    return [];
  }
}
