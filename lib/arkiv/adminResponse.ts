/**
 * Admin Response CRUD helpers
 * 
 * Handles admin responses to user feedback.
 * Creates Arkiv entities that trigger notifications for users.
 * 
 * Reference: Admin feedback response system
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";

export type AdminResponse = {
  key: string;
  feedbackKey: string; // Key of the original feedback
  wallet: string; // Wallet of the user who gave feedback
  message: string; // Admin's response message
  adminWallet: string; // Wallet of the admin responding
  spaceId: string;
  createdAt: string;
  txHash?: string;
}

/**
 * Create an admin response to user feedback
 */
export async function createAdminResponse({
  feedbackKey,
  wallet,
  message,
  adminWallet,
  privateKey,
  spaceId = 'local-dev',
}: {
  feedbackKey: string;
  wallet: string;
  message: string;
  adminWallet: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();

  // Validate message is not empty
  if (!message || message.trim().length === 0) {
    throw new Error('Response message is required');
  }

  const payload = {
    message: message.trim(),
    createdAt,
  };

  // Admin responses should persist (1 year) for record keeping
  const expiresIn = 31536000; // 1 year in seconds

  const { entityKey, txHash } = await walletClient.createEntity({
    payload: enc.encode(JSON.stringify(payload)),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'admin_response' },
      { key: 'feedbackKey', value: feedbackKey },
      { key: 'wallet', value: wallet.toLowerCase() },
      { key: 'adminWallet', value: adminWallet.toLowerCase() },
      { key: 'spaceId', value: spaceId },
      { key: 'createdAt', value: createdAt },
    ],
    expiresIn,
  });

  // Store txHash in a separate entity for reliable querying
  await walletClient.createEntity({
    payload: enc.encode(JSON.stringify({ txHash })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'admin_response_txhash' },
      { key: 'responseKey', value: entityKey },
      { key: 'wallet', value: wallet.toLowerCase() },
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn,
  });

  return { key: entityKey, txHash };
}

/**
 * List admin responses
 */
export async function listAdminResponses({
  feedbackKey,
  wallet,
  limit = 100,
  since,
}: {
  feedbackKey?: string;
  wallet?: string;
  limit?: number;
  since?: string;
} = {}): Promise<AdminResponse[]> {
  try {
    const publicClient = getPublicClient();
    
    // Fetch response entities and txHash entities in parallel
    const [result, txHashResult] = await Promise.all([
      publicClient.buildQuery()
        .where(eq('type', 'admin_response'))
        .withAttributes(true)
        .withPayload(true)
        .limit(limit || 100)
        .fetch(),
      publicClient.buildQuery()
        .where(eq('type', 'admin_response_txhash'))
        .withAttributes(true)
        .withPayload(true)
        .fetch(),
    ]);

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.error('Invalid result from Arkiv query:', result);
      return [];
    }

    // Build txHash map
    const txHashMap: Record<string, string> = {};
    if (txHashResult?.entities && Array.isArray(txHashResult.entities)) {
      txHashResult.entities.forEach((entity: any) => {
        const attrs = entity.attributes || {};
        const getAttr = (key: string): string => {
          if (Array.isArray(attrs)) {
            const attr = attrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(attrs[key] || '');
        };
        const responseKey = getAttr('responseKey');
        try {
          if (entity.payload) {
            const decoded = entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
              ? entity.payload
              : JSON.stringify(entity.payload);
            const payload = JSON.parse(decoded);
            if (payload.txHash && responseKey) {
              txHashMap[responseKey] = payload.txHash;
            }
          }
        } catch (e) {
          // Ignore decode errors
        }
      });
    }

    let responses = result.entities.map((entity: any) => {
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
        console.error('Error decoding admin response payload:', e);
      }

      const attrs = entity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };

      return {
        key: entity.key,
        feedbackKey: getAttr('feedbackKey'),
        wallet: getAttr('wallet'),
        message: payload.message || '',
        adminWallet: getAttr('adminWallet'),
        spaceId: getAttr('spaceId') || 'local-dev',
        createdAt: getAttr('createdAt'),
        txHash: txHashMap[entity.key] || payload.txHash || entity.txHash || undefined,
      };
    });

    // Filter by feedbackKey if provided
    if (feedbackKey) {
      responses = responses.filter(r => r.feedbackKey === feedbackKey);
    }

    // Filter by wallet if provided
    if (wallet) {
      const normalizedWallet = wallet.toLowerCase();
      responses = responses.filter(r => r.wallet.toLowerCase() === normalizedWallet);
    }

    // Filter by since date if provided
    if (since) {
      const sinceTime = new Date(since).getTime();
      responses = responses.filter(r => new Date(r.createdAt).getTime() >= sinceTime);
    }

    // Sort by most recent first
    return responses.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error: any) {
    console.error('Error in listAdminResponses:', error);
    return [];
  }
}

