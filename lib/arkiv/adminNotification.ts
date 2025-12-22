/**
 * Admin Notification Entity
 * 
 * Brand new implementation from first principles using Pattern B (update in place).
 * Stores admin notifications with read/unread/archived state.
 * 
 * Entity Type: `admin_notification`
 * Update Pattern: Pattern B (updateEntity with stable entity_key)
 * 
 * Key Design:
 * - Stable entity_key derived from (wallet, notificationId)
 * - Uses updateEntity for state changes (read/unread/archived)
 * - Full transaction history preserved
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { SPACE_ID } from "@/lib/config";
import { handleTransactionWithTimeout } from "./transaction-utils";

export type AdminNotificationType = 
  | 'feedback_response'      // Admin responded to user feedback
  | 'issue_resolved'          // Admin resolved an issue
  | 'system_alert';           // System-level alerts for admins

export type AdminNotification = {
  key: string;                    // Entity key (stable)
  wallet: string;                 // Admin wallet (normalized to lowercase)
  notificationId: string;          // Unique notification identifier
  notificationType: AdminNotificationType;
  title: string;                  // Notification title
  message: string;                // Notification message
  link?: string;                  // Optional link
  sourceEntityType?: string;       // Source entity type (e.g., 'app_feedback', 'admin_response')
  sourceEntityKey?: string;        // Source entity key
  read: boolean;                   // Read/unread state
  archived: boolean;               // Archived/deleted state
  metadata?: Record<string, any>;  // Additional context
  spaceId: string;
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp (last update)
  txHash?: string;                // Transaction hash
};

/**
 * Derive stable entity key for admin notification
 * 
 * Pattern: admin_notification:{wallet}:{notificationId}
 * This ensures one entity per (wallet, notificationId) pair
 */
function deriveAdminNotificationKey(wallet: string, notificationId: string): string {
  const normalizedWallet = wallet.toLowerCase();
  return `admin_notification:${normalizedWallet}:${notificationId}`;
}

/**
 * Create a new admin notification
 * 
 * Creates the initial notification entity. State changes (read/unread/archived)
 * should use updateAdminNotificationState instead.
 */
export async function createAdminNotification({
  wallet,
  notificationId,
  notificationType,
  title,
  message,
  link,
  sourceEntityType,
  sourceEntityKey,
  metadata,
  privateKey,
  spaceId = SPACE_ID,
}: {
  wallet: string;
  notificationId: string;
  notificationType: AdminNotificationType;
  title: string;
  message: string;
  link?: string;
  sourceEntityType?: string;
  sourceEntityKey?: string;
  metadata?: Record<string, any>;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const now = new Date().toISOString();
  const normalizedWallet = wallet.toLowerCase();

  // Derive stable entity key
  const entityKey = deriveAdminNotificationKey(normalizedWallet, notificationId);

  // Check if notification already exists
  const publicClient = getPublicClient();
  const existing = await publicClient.buildQuery()
    .where(eq('type', 'admin_notification'))
    .where(eq('wallet', normalizedWallet))
    .where(eq('notificationId', notificationId))
    .where(eq('spaceId', spaceId))
    .withAttributes(true)
    .withPayload(true)
    .limit(1)
    .fetch();

  const expiresIn = 31536000; // 1 year

  const payload = {
    title,
    message,
    link: link || undefined,
    metadata: metadata || undefined,
    read: false, // Initially unread
    archived: false, // Initially active
    createdAt: now,
    updatedAt: now,
  };

  let txHash: string;

  if (existing?.entities && existing.entities.length > 0) {
    // Notification exists - update it in place (Pattern B)
    const existingKey = existing.entities[0].key;
    const result = await handleTransactionWithTimeout(async () => {
      return await walletClient.updateEntity({
        entityKey: existingKey as `0x${string}`,
        payload: enc.encode(JSON.stringify(payload)),
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'admin_notification' },
          { key: 'wallet', value: normalizedWallet },
          { key: 'notificationId', value: notificationId },
          { key: 'notificationType', value: notificationType },
          { key: 'spaceId', value: spaceId },
          { key: 'createdAt', value: existing.entities[0].attributes && Array.isArray(existing.entities[0].attributes)
            ? (existing.entities[0].attributes.find((a: any) => a.key === 'createdAt')?.value || now)
            : (existing.entities[0].attributes as any)?.createdAt || now },
          { key: 'updatedAt', value: now },
          ...(sourceEntityType ? [{ key: 'sourceEntityType', value: sourceEntityType }] : []),
          ...(sourceEntityKey ? [{ key: 'sourceEntityKey', value: sourceEntityKey }] : []),
        ],
        expiresIn,
      });
    });
    txHash = result.txHash;
  } else {
    // Create new notification entity
    const result = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify(payload)),
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'admin_notification' },
          { key: 'wallet', value: normalizedWallet },
          { key: 'notificationId', value: notificationId },
          { key: 'notificationType', value: notificationType },
          { key: 'spaceId', value: spaceId },
          { key: 'createdAt', value: now },
          { key: 'updatedAt', value: now },
          ...(sourceEntityType ? [{ key: 'sourceEntityType', value: sourceEntityType }] : []),
          ...(sourceEntityKey ? [{ key: 'sourceEntityKey', value: sourceEntityKey }] : []),
        ],
        expiresIn,
      });
    });
    txHash = result.txHash;
    // Note: We can't set entityKey in createEntity, but we can query by wallet+notificationId
    // The derived key is for reference/logging, actual key comes from SDK
  }

  // Get the actual entity key (from update or create result)
  // Query to get the key we just created/updated
  const verifyResult = await publicClient.buildQuery()
    .where(eq('type', 'admin_notification'))
    .where(eq('wallet', normalizedWallet))
    .where(eq('notificationId', notificationId))
    .where(eq('spaceId', spaceId))
    .withAttributes(true)
    .limit(1)
    .fetch();

  const actualKey = verifyResult?.entities?.[0]?.key || entityKey;

  // Store txHash in separate entity for reliable querying (non-blocking)
  walletClient.createEntity({
    payload: enc.encode(JSON.stringify({ txHash })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'admin_notification_txhash' },
      { key: 'notificationKey', value: actualKey },
      { key: 'wallet', value: normalizedWallet },
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn,
  }).catch((err: any) => {
    console.warn('[createAdminNotification] Failed to create txHash entity (non-critical):', err);
  });

  return { key: actualKey, txHash };
}

/**
 * Update admin notification state (read/unread/archived)
 * 
 * Uses Pattern B: updateEntity with stable entity_key
 * This updates the existing entity in place rather than creating a new one.
 */
export async function updateAdminNotificationState({
  wallet,
  notificationId,
  read,
  archived,
  privateKey,
  spaceId = SPACE_ID,
}: {
  wallet: string;
  notificationId: string;
  read?: boolean;
  archived?: boolean;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const now = new Date().toISOString();
  const normalizedWallet = wallet.toLowerCase();

  // Get current notification state by wallet + notificationId (stable query)
  const publicClient = getPublicClient();
  const result = await publicClient.buildQuery()
    .where(eq('type', 'admin_notification'))
    .where(eq('wallet', normalizedWallet))
    .where(eq('notificationId', notificationId))
    .withAttributes(true)
    .withPayload(true)
    .limit(1)
    .fetch();

  if (!result?.entities || result.entities.length === 0) {
    throw new Error(`Admin notification not found: ${notificationId} for wallet ${normalizedWallet}`);
  }

  const entity = result.entities[0];
  const entityKey = entity.key;
  
  // Decode current payload
  let currentPayload: any = {};
  try {
    if (entity.payload) {
      const decoded = entity.payload instanceof Uint8Array
        ? new TextDecoder().decode(entity.payload)
        : typeof entity.payload === 'string'
        ? entity.payload
        : JSON.stringify(entity.payload);
      currentPayload = JSON.parse(decoded);
    }
  } catch (e) {
    console.error('[updateAdminNotificationState] Error decoding payload:', e);
  }

  // Get current attributes
  const attrs = entity.attributes || {};
  const getAttr = (key: string): string => {
    if (Array.isArray(attrs)) {
      const attr = attrs.find((a: any) => a.key === key);
      return String(attr?.value || '');
    }
    return String(attrs[key] || '');
  };

  // Build updated payload
  const updatedPayload = {
    ...currentPayload,
    read: read !== undefined ? read : currentPayload.read ?? false,
    archived: archived !== undefined ? archived : currentPayload.archived ?? false,
    updatedAt: now,
  };

  // Update entity in place (Pattern B)
  const expiresIn = 31536000; // 1 year
  const { txHash } = await handleTransactionWithTimeout(async () => {
    return await walletClient.updateEntity({
      entityKey: entityKey as `0x${string}`,
      payload: enc.encode(JSON.stringify(updatedPayload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'admin_notification' },
        { key: 'wallet', value: normalizedWallet },
        { key: 'notificationId', value: notificationId },
        { key: 'notificationType', value: getAttr('notificationType') },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: getAttr('createdAt') || now },
        { key: 'updatedAt', value: now },
        ...(getAttr('sourceEntityType') ? [{ key: 'sourceEntityType', value: getAttr('sourceEntityType') }] : []),
        ...(getAttr('sourceEntityKey') ? [{ key: 'sourceEntityKey', value: getAttr('sourceEntityKey') }] : []),
      ],
      expiresIn,
    });
  });

  return { key: entityKey, txHash };
}

/**
 * Get admin notification by key
 */
export async function getAdminNotificationByKey(
  key: string
): Promise<AdminNotification | null> {
  const publicClient = getPublicClient();

  const result = await publicClient.buildQuery()
    .where(eq('type', 'admin_notification'))
    .where(eq('key', key))
    .withAttributes(true)
    .withPayload(true)
    .limit(1)
    .fetch();

  if (!result?.entities || result.entities.length === 0) {
    return null;
  }

  const entity = result.entities[0];
  return decodeAdminNotificationEntity(entity);
}

/**
 * List admin notifications
 */
export async function listAdminNotifications({
  wallet,
  notificationType,
  read,
  archived,
  limit = 100,
  spaceId,
}: {
  wallet?: string;
  notificationType?: AdminNotificationType;
  read?: boolean;
  archived?: boolean;
  limit?: number;
  spaceId?: string;
} = {}): Promise<AdminNotification[]> {
  const publicClient = getPublicClient();

  const query = publicClient.buildQuery()
    .where(eq('type', 'admin_notification'))
    .withAttributes(true)
    .withPayload(true)
    .limit(limit || 100);

  if (wallet) {
    query.where(eq('wallet', wallet.toLowerCase()));
  }

  if (notificationType) {
    query.where(eq('notificationType', notificationType));
  }

  if (spaceId) {
    query.where(eq('spaceId', spaceId));
  }

  const result = await query.fetch();

  if (!result?.entities || !Array.isArray(result.entities)) {
    return [];
  }

  let notifications = result.entities.map(decodeAdminNotificationEntity);

  // Client-side filters (read/archived are in payload)
  if (read !== undefined) {
    notifications = notifications.filter(n => n.read === read);
  }

  if (archived !== undefined) {
    notifications = notifications.filter(n => n.archived === archived);
  }

  // Sort by updatedAt descending (most recent first)
  return notifications.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Decode admin notification entity from Arkiv response
 */
function decodeAdminNotificationEntity(entity: any): AdminNotification {
  const attrs = entity.attributes || {};
  const getAttr = (key: string): string => {
    if (Array.isArray(attrs)) {
      const attr = attrs.find((a: any) => a.key === key);
      return String(attr?.value || '');
    }
    return String(attrs[key] || '');
  };

  // Decode payload
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
    console.error('[decodeAdminNotificationEntity] Error decoding payload:', e);
  }

  return {
    key: entity.key,
    wallet: getAttr('wallet'),
    notificationId: getAttr('notificationId'),
    notificationType: getAttr('notificationType') as AdminNotificationType,
    title: payload.title || '',
    message: payload.message || '',
    link: payload.link,
    sourceEntityType: getAttr('sourceEntityType') || undefined,
    sourceEntityKey: getAttr('sourceEntityKey') || undefined,
    read: payload.read ?? false,
    archived: payload.archived ?? false,
    metadata: payload.metadata,
    spaceId: getAttr('spaceId'),
    createdAt: getAttr('createdAt'),
    updatedAt: payload.updatedAt || getAttr('updatedAt') || getAttr('createdAt'),
  };
}

