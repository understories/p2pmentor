/**
 * Beta Access Tracking
 * 
 * Tracks wallet-to-beta-code binding on Arkiv.
 * Links wallet addresses to beta codes for audit and access control.
 * 
 * Reference: refs/docs/beta_code_gating_plan.md
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { getPrivateKey, SPACE_ID } from "@/lib/config";
import { handleTransactionWithTimeout } from "./transaction-utils";

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
  const { privateKeyToAccount } = await import('@arkiv-network/sdk/accounts');
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
    throw new Error(`[createBetaAccess] Wallet client account mismatch: expected ${serverSignerAddress}, got ${walletClientAddress}`);
  }
  
  console.log('[createBetaAccess] Using server signer wallet:', {
    serverSignerAddress: `${serverSignerAddress.substring(0, 6)}...${serverSignerAddress.substring(serverSignerAddress.length - 4)}`,
    walletClientAddress: `${walletClientAddress.substring(0, 6)}...${walletClientAddress.substring(walletClientAddress.length - 4)}`,
    wallet: `${wallet.toLowerCase().substring(0, 6)}...${wallet.toLowerCase().substring(wallet.length - 4)}`,
    note: 'wallet is the grant recipient, serverSignerAddress signs the transaction',
  });
  
  const enc = new TextEncoder();
  const grantedAt = new Date().toISOString();
  const normalizedCode = code.toLowerCase().trim();
  const normalizedWallet = wallet.toLowerCase();

  const payload = {
    wallet: normalizedWallet,
    code: normalizedCode,
    grantedAt,
  };

  // 1 year TTL (effectively permanent for beta)
  const expiresIn = 31536000;

  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'beta_access' },
        { key: 'wallet', value: normalizedWallet },
        { key: 'code', value: normalizedCode },
        { key: 'spaceId', value: spaceId },
        { key: 'grantedAt', value: grantedAt },
      ],
      expiresIn,
    });
  });

  // Create separate txhash entity (optional metadata, don't wait)
  walletClient.createEntity({
    payload: enc.encode(JSON.stringify({ txHash })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'beta_access_txhash' },
      { key: 'accessKey', value: entityKey },
      { key: 'wallet', value: normalizedWallet },
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn,
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
export async function getBetaAccessByWallet(wallet: string, spaceId?: string): Promise<BetaAccess | null> {
  const publicClient = getPublicClient();
  const normalizedWallet = wallet.toLowerCase();
  const finalSpaceId = spaceId || SPACE_ID;

  try {
    const result = await publicClient.buildQuery()
      .where(eq('type', 'beta_access'))
      .where(eq('wallet', normalizedWallet))
      .where(eq('spaceId', finalSpaceId))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch();

    if (!result?.entities || result.entities.length === 0) {
      return null;
    }

    const entity = result.entities[0];
    let payload: any = {};
    try {
      if (entity.payload) {
        const decoded = entity.payload instanceof Uint8Array
          ? new TextDecoder().decode(entity.payload)
          : typeof entity.payload === 'string'
          ? entity.payload
          : JSON.stringify(entity.payload);
        payload = JSON.parse(decoded);
      }
    } catch (e) {
      console.error('[getBetaAccessByWallet] Error decoding payload:', e);
    }

    const attrs = entity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };

    // Get txHash
    const txHashResult = await publicClient.buildQuery()
      .where(eq('type', 'beta_access_txhash'))
      .where(eq('accessKey', entity.key))
      .where(eq('spaceId', finalSpaceId))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch();

    let txHash: string | undefined;
    if (txHashResult.entities && txHashResult.entities.length > 0) {
      try {
        const txHashEntity = txHashResult.entities[0];
        const txHashPayload = txHashEntity.payload instanceof Uint8Array
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
      grantedAt: getAttr('grantedAt') || payload.grantedAt || new Date().toISOString(),
      spaceId: getAttr('spaceId') || payload.spaceId || SPACE_ID,
      txHash,
    };
  } catch (error: any) {
    console.error('[getBetaAccessByWallet] Arkiv query failed:', {
      message: error?.message,
      stack: error?.stack,
      error
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
    const result = await publicClient.buildQuery()
      .where(eq('type', 'beta_access'))
      .where(eq('code', normalizedCode))
      .where(eq('spaceId', finalSpaceId))
      .withAttributes(true)
      .withPayload(true)
      .limit(1000)
      .fetch();

    if (!result?.entities || !Array.isArray(result.entities)) {
      return [];
    }

    return result.entities.map((entity: any) => {
      let payload: any = {};
      try {
        if (entity.payload) {
          const decoded = entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
            ? entity.payload
            : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('[listBetaAccessByCode] Error decoding payload:', e);
      }

      const attrs = entity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };

      // Always use normalized wallet from attributes (Arkiv-native pattern)
      // Attributes are queryable and normalized, payload may contain original case
      const walletAttr = getAttr('wallet') || '';
      const normalizedWallet = walletAttr ? walletAttr.toLowerCase() : (payload.wallet ? payload.wallet.toLowerCase() : '');

      return {
        key: entity.key,
        wallet: normalizedWallet,
        code: getAttr('code') || payload.code || normalizedCode,
        grantedAt: getAttr('grantedAt') || payload.grantedAt || new Date().toISOString(),
        spaceId: getAttr('spaceId') || payload.spaceId || SPACE_ID,
      };
    });
  } catch (error: any) {
    console.error('[listBetaAccessByCode] Arkiv query failed:', {
      message: error?.message,
      stack: error?.stack,
      error
    });
    return [];
  }
}
