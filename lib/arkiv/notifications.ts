/**
 * Notification entity CRUD helpers
 * 
 * Notifications are first-class Arkiv entities created server-side when events occur.
 * This replaces client-side detection with Arkiv-native entity storage.
 * 
 * Reference: refs/docs/notifications-arkiv-analysis.md
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { handleTransactionWithTimeout } from "./transaction-utils";

export type NotificationType = 
  | 'meeting_request'
  | 'profile_match'
  | 'ask_offer_match'
  | 'new_offer'
  | 'admin_response'
  | 'issue_resolved'
  | 'app_feedback_submitted';

export type Notification = {
  key: string;
  wallet: string; // Recipient wallet (lowercase)
  notificationType: NotificationType;
  sourceEntityType: string; // 'session' | 'ask' | 'offer' | 'user_profile' | 'admin_response' | 'app_feedback'
  sourceEntityKey: string; // Key of the source entity
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
  status: 'active' | 'archived';
  spaceId: string;
  createdAt: string;
  txHash?: string;
};

/**
 * Create a notification entity
 * 
 * @param data - Notification data
 * @param privateKey - Private key for signing (server-side wallet)
 * @returns Entity key and transaction hash
 */
export async function createNotification({
  wallet,
  notificationType,
  sourceEntityType,
  sourceEntityKey,
  title,
  message,
  link,
  metadata,
  privateKey,
  spaceId = 'local-dev',
}: {
  wallet: string;
  notificationType: NotificationType;
  sourceEntityType: string;
  sourceEntityKey: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();
  const status = 'active';

  // 1 year TTL (effectively permanent for beta)
  const expiresIn = 31536000;

  const payload = {
    title,
    message,
    link: link || undefined,
    metadata: metadata || undefined,
  };

  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'notification' },
        { key: 'wallet', value: wallet.toLowerCase() },
        { key: 'notificationType', value: notificationType },
        { key: 'sourceEntityType', value: sourceEntityType },
        { key: 'sourceEntityKey', value: sourceEntityKey },
        { key: 'status', value: status },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn,
    });
  });

  const { entityKey, txHash } = result;

  // Create separate txhash entity for reliable querying
  walletClient.createEntity({
    payload: enc.encode(JSON.stringify({ txHash })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'notification_txhash' },
      { key: 'notificationKey', value: entityKey },
      { key: 'wallet', value: wallet.toLowerCase() },
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn,
  }).catch((error: any) => {
    console.warn('[createNotification] Failed to create notification_txhash entity:', error);
  });

  return { key: entityKey, txHash };
}

/**
 * List notifications for a wallet
 * 
 * @param params - Query parameters
 * @returns Array of notifications
 */
export async function listNotifications({
  wallet,
  notificationType,
  status,
  sourceEntityType,
  limit = 100,
}: {
  wallet?: string;
  notificationType?: NotificationType;
  status?: 'active' | 'archived';
  sourceEntityType?: string;
  limit?: number;
} = {}): Promise<Notification[]> {
  try {
    const publicClient = getPublicClient();
    
    // Build query with wallet filter at Arkiv level for efficiency
    // This ensures we only fetch notifications for the specified wallet
    let notificationQuery = publicClient.buildQuery()
      .where(eq('type', 'notification'));
    
    if (wallet) {
      notificationQuery = notificationQuery.where(eq('wallet', wallet.toLowerCase()));
    }
    
    // Fetch notification entities and txHash entities in parallel
    const [result, txHashResult] = await Promise.all([
      notificationQuery
        .withAttributes(true)
        .withPayload(true)
        .limit(limit || 100)
        .fetch(),
      publicClient.buildQuery()
        .where(eq('type', 'notification_txhash'))
        .withAttributes(true)
        .withPayload(true)
        .fetch(),
    ]);

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.warn('[listNotifications] Invalid result structure, returning empty array', { result });
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
        const notificationKey = getAttr('notificationKey');
        try {
          if (entity.payload) {
            const decoded = entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
              ? entity.payload
              : JSON.stringify(entity.payload);
            const payload = JSON.parse(decoded);
            if (payload.txHash && notificationKey) {
              txHashMap[notificationKey] = payload.txHash;
            }
          }
        } catch (e) {
          // Ignore decode errors
        }
      });
    }

    let notifications = result.entities.map((entity: any) => {
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
        console.error('[listNotifications] Error decoding notification payload:', e);
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
        wallet: getAttr('wallet'),
        notificationType: getAttr('notificationType') as NotificationType,
        sourceEntityType: getAttr('sourceEntityType'),
        sourceEntityKey: getAttr('sourceEntityKey'),
        title: payload.title || '',
        message: payload.message || '',
        link: payload.link || undefined,
        metadata: payload.metadata || undefined,
        status: (getAttr('status') || 'active') as 'active' | 'archived',
        spaceId: getAttr('spaceId') || 'local-dev',
        createdAt: getAttr('createdAt'),
        txHash: txHashMap[entity.key] || payload.txHash || entity.txHash || undefined,
      };
    });

    // Apply filters
    if (wallet) {
      notifications = notifications.filter(n => n.wallet.toLowerCase() === wallet.toLowerCase());
    }
    if (notificationType) {
      notifications = notifications.filter(n => n.notificationType === notificationType);
    }
    if (status) {
      notifications = notifications.filter(n => n.status === status);
    }
    if (sourceEntityType) {
      notifications = notifications.filter(n => n.sourceEntityType === sourceEntityType);
    }

    // Sort by most recent first
    return notifications.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error: any) {
    console.error('[listNotifications] Error:', error);
    return [];
  }
}

/**
 * Archive a notification (soft delete)
 * 
 * Creates a new notification entity with status='archived'
 * 
 * @param notificationKey - Key of the notification to archive
 * @param wallet - Wallet address of the notification recipient
 * @param privateKey - Private key for signing
 * @returns Entity key and transaction hash
 */
export async function archiveNotification({
  notificationKey,
  wallet,
  privateKey,
  spaceId = 'local-dev',
}: {
  notificationKey: string;
  wallet: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  // Get existing notification
  const notifications = await listNotifications({ wallet, limit: 1000 });
  const existing = notifications.find(n => n.key === notificationKey);
  
  if (!existing) {
    throw new Error('Notification not found');
  }

  // Create new entity with status='archived'
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();
  const status = 'archived';
  const expiresIn = 31536000;

  const payload = {
    title: existing.title,
    message: existing.message,
    link: existing.link || undefined,
    metadata: existing.metadata || undefined,
  };

  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'notification' },
        { key: 'wallet', value: wallet.toLowerCase() },
        { key: 'notificationType', value: existing.notificationType },
        { key: 'sourceEntityType', value: existing.sourceEntityType },
        { key: 'sourceEntityKey', value: existing.sourceEntityKey },
        { key: 'status', value: status },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn,
    });
  });

  return { key: result.entityKey, txHash: result.txHash };
}

