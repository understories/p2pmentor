/**
 * Admin Response CRUD helpers
 *
 * Handles admin responses to user feedback.
 * Creates Arkiv entities that trigger notifications for users.
 *
 * Reference: Admin feedback response system
 */

import { PROJECT, eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr, getEntityByKey } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { createArkivEntity } from './write';
import { SPACE_ID } from '@/lib/config';
import { handleTransactionWithTimeout } from './transaction-utils';

export type AdminResponse = {
  key: string;
  feedbackKey: string; // Key of the original feedback
  wallet: string; // Wallet of the user who gave feedback
  message: string; // Admin's response message
  adminWallet: string; // Wallet of the admin responding
  spaceId: string;
  createdAt: string;
  txHash?: string;
};

/**
 * Create an admin response to user feedback
 */
export async function createAdminResponse({
  feedbackKey,
  wallet,
  message,
  adminWallet,
  privateKey,
  spaceId = SPACE_ID,
}: {
  feedbackKey: string;
  wallet: string;
  message: string;
  adminWallet: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const createdAt = new Date().toISOString();

  // Validate message is not empty
  if (!message || message.trim().length === 0) {
    throw new Error('Response message is required');
  }

  const payload = {
    message: message.trim(),
    createdAt,
  };

  // Admin responses use the type default lifetime (see lib/arkiv/schema.ts)
  // Wrap in handleTransactionWithTimeout for graceful timeout handling
  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: 'admin_response',
      attributes: {
        feedback_key: feedbackKey,
        wallet: wallet.toLowerCase(),
        admin_wallet: adminWallet.toLowerCase(),
        space_id: spaceId,
        created_at: createdAt,
      },
      payload,
    });
  });

  // Store txHash in a separate entity for reliable querying (don't wait for this)
  createArkivEntity(walletClient, {
    type: 'admin_response_txhash',
    attributes: {
      response_key: entityKey,
      wallet: wallet.toLowerCase(),
      space_id: spaceId,
    },
    payload: { txHash },
  }).catch((err: any) => {
      console.warn('[createAdminResponse] Failed to create txHash entity:', err);
      // Don't throw - txHash entity is optional metadata
    });

  // Create notification for the user
  try {
    const { createNotification } = await import('./notifications');
    await createNotification({
      wallet: wallet.toLowerCase(),
      notificationType: 'admin_response',
      sourceEntityType: 'admin_response',
      sourceEntityKey: entityKey,
      title: 'Admin Response',
      message:
        message.trim().length > 100 ? message.trim().substring(0, 100) + '...' : message.trim(),
      link: '/notifications',
      metadata: {
        feedbackKey,
        responseKey: entityKey,
        adminWallet: adminWallet.toLowerCase(),
      },
      privateKey,
      spaceId,
    }).catch((err: any) => {
      console.warn('[createAdminResponse] Failed to create notification:', err);
    });
  } catch (err: any) {
    // Notification creation failure shouldn't block response creation
    console.warn('[createAdminResponse] Error importing or creating notification:', err);
  }

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
      fetchAll(arkivSelect('admin_response', publicClient), limit || 100, publicClient),
      fetchAll(arkivSelect('admin_response_txhash', publicClient), 1000, publicClient),
    ]);

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.error('Invalid result from Arkiv query:', result);
      return [];
    }

    // Build txHash map
    const txHashMap: Record<string, string> = {};
    if (txHashResult?.entities && Array.isArray(txHashResult.entities)) {
      txHashResult.entities.forEach((entity: any) => {
        const getAttr = (key: string): string => readAttr(entity, key);
        const responseKey = getAttr('response_key');
        try {
          if (entity.payload) {
            const decoded =
              entity.payload instanceof Uint8Array
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
          const decoded =
            entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
                ? entity.payload
                : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('Error decoding admin response payload:', e);
      }

      const getAttr = (key: string): string => readAttr(entity, key);

      return {
        key: entity.key,
        feedbackKey: getAttr('feedback_key'),
        wallet: getAttr('wallet'),
        message: payload.message || '',
        adminWallet: getAttr('admin_wallet'),
        spaceId: getAttr('space_id') || SPACE_ID,
        createdAt: getAttr('created_at'),
        txHash: txHashMap[entity.key] || payload.txHash || entity.txHash || undefined,
      };
    });

    // Filter by feedbackKey if provided
    if (feedbackKey) {
      responses = responses.filter((r) => r.feedbackKey === feedbackKey);
    }

    // Filter by wallet if provided
    if (wallet) {
      const normalizedWallet = wallet.toLowerCase();
      responses = responses.filter((r) => r.wallet.toLowerCase() === normalizedWallet);
    }

    // Filter by since date if provided
    if (since) {
      const sinceTime = new Date(since).getTime();
      responses = responses.filter((r) => new Date(r.createdAt).getTime() >= sinceTime);
    }

    // Sort by most recent first
    return responses.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error: any) {
    console.error('Error in listAdminResponses:', error);
    return [];
  }
}

/**
 * Get a single admin response by key
 *
 * @param key - Admin response entity key
 * @returns AdminResponse or null if not found
 */
export async function getAdminResponseByKey(key: string): Promise<AdminResponse | null> {
  const publicClient = getPublicClient();

  try {
    const entity = await getEntityByKey(key, publicClient);
    if (
      !entity ||
      readAttr(entity, 'type') !== 'admin_response' ||
      readAttr(entity, 'project') !== PROJECT
    ) {
      return null;
    }

    // Fetch txHash
    const txHashResult = await arkivSelect(undefined, publicClient)
      .where(eqAttr('type', 'admin_response_txhash'))
      .where(eqAttr('response_key', key))
      .limit(1)
      .fetch();

    // Build txHash
    let txHash: string | undefined;
    if (
      txHashResult?.entities &&
      Array.isArray(txHashResult.entities) &&
      txHashResult.entities.length > 0
    ) {
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
        console.error('Error decoding txHash:', e);
      }
    }

    // Decode payload
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
      console.error('Error decoding admin response payload:', e);
    }

    const getAttr = (key: string): string => readAttr(entity, key);

    return {
      key: entity.key,
      feedbackKey: getAttr('feedback_key'),
      wallet: getAttr('wallet'),
      message: payload.message || '',
      adminWallet: getAttr('admin_wallet'),
      spaceId: getAttr('space_id') || SPACE_ID,
      createdAt: getAttr('created_at'),
      txHash: txHash || payload.txHash || undefined,
    };
  } catch (error: any) {
    console.error(`Error getting admin response by key ${key}:`, error);
    return null;
  }
}
