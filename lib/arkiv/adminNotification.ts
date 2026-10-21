/**
 * Admin Notification Entity
 *
 * Brand new implementation from first principles using Pattern B (update in place).
 * Stores admin notifications with read/unread/archived state.
 *
 * Entity Type: `admin_notification`
 * Update Pattern: Pattern B (patchEntity via replaceArkivEntity with stable entity_key)
 *
 * Key Design:
 * - Stable entity_key derived from (wallet, notificationId)
 * - Uses replaceArkivEntity (patchEntity) for state changes (read/unread/archived)
 * - Full transaction history preserved
 * - Always written with the server signer key; reads are scoped with
 *   `.createdBy(SERVER_SIGNER_ADDRESS)` so copied attributes cannot spoof notifications
 */

import { PROJECT, eqAttr } from '@/lib/arkiv/schema';
import {
  arkivSelect,
  fetchAll,
  getAttr as readAttr,
  getEntityByKey,
  parsePayload,
} from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { SERVER_SIGNER_ADDRESS, SPACE_ID } from '@/lib/config';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity, replaceArkivEntity } from './write';

/**
 * Start an admin_notification query, scoped to the server signer when known
 * (admin notifications are only ever written with the server key).
 */
function adminNotificationQuery(publicClient: ReturnType<typeof getPublicClient>) {
  const q = arkivSelect('admin_notification', publicClient);
  return SERVER_SIGNER_ADDRESS ? q.createdBy(SERVER_SIGNER_ADDRESS) : q;
}

export type AdminNotificationType =
  | 'feedback_response' // Admin responded to user feedback
  | 'issue_resolved' // Admin resolved an issue
  | 'system_alert'; // System-level alerts for admins

export type AdminNotification = {
  key: string; // Entity key (stable)
  wallet: string; // Admin wallet (normalized to lowercase)
  notificationId: string; // Unique notification identifier
  notificationType: AdminNotificationType;
  title: string; // Notification title
  message: string; // Notification message
  link?: string; // Optional link
  sourceEntityType?: string; // Source entity type (e.g., 'app_feedback', 'admin_response')
  sourceEntityKey?: string; // Source entity key
  read: boolean; // Read/unread state
  archived: boolean; // Archived/deleted state
  metadata?: Record<string, any>; // Additional context
  spaceId: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp (last update)
  txHash?: string; // Transaction hash
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
  const now = new Date().toISOString();
  const normalizedWallet = wallet.toLowerCase();

  // Derive stable entity key
  const entityKey = deriveAdminNotificationKey(normalizedWallet, notificationId);

  // Check if notification already exists
  const publicClient = getPublicClient();
  const existing = await adminNotificationQuery(publicClient)
    .where(eqAttr('wallet', normalizedWallet))
    .where(eqAttr('notification_id', notificationId))
    .where(eqAttr('space_id', spaceId))
    .limit(1)
    .fetch();

  // Lifetime: admin_notification type default (see lib/arkiv/schema.ts)
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
      return await replaceArkivEntity(walletClient, {
        entityKey: existingKey,
        type: 'admin_notification',
        attributes: {
          wallet: normalizedWallet,
          notification_id: notificationId,
          notification_type: notificationType,
          space_id: spaceId,
          created_at: readAttr(existing.entities[0], 'created_at') || now,
          updated_at: now,
          source_entity_type: sourceEntityType,
          source_entity_key: sourceEntityKey,
        },
        payload,
      });
    });
    txHash = result.txHash;
  } else {
    // Create new notification entity
    const result = await handleTransactionWithTimeout(async () => {
      return await createArkivEntity(walletClient, {
        type: 'admin_notification',
        attributes: {
          wallet: normalizedWallet,
          notification_id: notificationId,
          notification_type: notificationType,
          space_id: spaceId,
          created_at: now,
          updated_at: now,
          source_entity_type: sourceEntityType,
          source_entity_key: sourceEntityKey,
        },
        payload,
      });
    });
    txHash = result.txHash;
    // Note: We can't set entityKey in createEntity, but we can query by wallet+notificationId
    // The derived key is for reference/logging, actual key comes from SDK
  }

  // Get the actual entity key (from update or create result)
  // Query to get the key we just created/updated
  const verifyResult = await adminNotificationQuery(publicClient)
    .where(eqAttr('wallet', normalizedWallet))
    .where(eqAttr('notification_id', notificationId))
    .where(eqAttr('space_id', spaceId))
    .limit(1)
    .fetch();

  const actualKey = verifyResult?.entities?.[0]?.key || entityKey;

  // Store txHash in separate entity for reliable querying (non-blocking)
  createArkivEntity(walletClient, {
    type: 'admin_notification_txhash',
    attributes: {
      notification_key: actualKey,
      wallet: normalizedWallet,
      space_id: spaceId,
    },
    payload: { txHash },
  }).catch((err: any) => {
      console.warn('[createAdminNotification] Failed to create txHash entity (non-critical):', err);
    });

  return { key: actualKey, txHash };
}

/**
 * Update admin notification state (read/unread/archived)
 *
 * Uses Pattern B: replaceArkivEntity (patchEntity) with stable entity_key
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
  const now = new Date().toISOString();
  const normalizedWallet = wallet.toLowerCase();

  // Get current notification state by wallet + notificationId (stable query)
  const publicClient = getPublicClient();
  const result = await adminNotificationQuery(publicClient)
    .where(eqAttr('wallet', normalizedWallet))
    .where(eqAttr('notification_id', notificationId))
    .limit(1)
    .fetch();

  if (!result?.entities || result.entities.length === 0) {
    throw new Error(
      `Admin notification not found: ${notificationId} for wallet ${normalizedWallet}`
    );
  }

  const entity = result.entities[0];
  const entityKey = entity.key;

  // Decode current payload
  const currentPayload: any = parsePayload(entity);

  // Get current attributes
  const getAttr = (key: string): string => readAttr(entity, key);

  // Build updated payload
  const updatedPayload = {
    ...currentPayload,
    read: read !== undefined ? read : (currentPayload.read ?? false),
    archived: archived !== undefined ? archived : (currentPayload.archived ?? false),
    updatedAt: now,
  };

  // Update entity in place (Pattern B; patches do not change expiry)
  const { txHash } = await handleTransactionWithTimeout(async () => {
    return await replaceArkivEntity(walletClient, {
      entityKey,
      type: 'admin_notification',
      attributes: {
        wallet: normalizedWallet,
        notification_id: notificationId,
        notification_type: getAttr('notification_type'),
        space_id: spaceId,
        created_at: getAttr('created_at') || now,
        updated_at: now,
        source_entity_type: getAttr('source_entity_type'),
        source_entity_key: getAttr('source_entity_key'),
      },
      payload: updatedPayload,
    });
  });

  return { key: entityKey, txHash };
}

/**
 * Get admin notification by key
 */
export async function getAdminNotificationByKey(key: string): Promise<AdminNotification | null> {
  const publicClient = getPublicClient();

  const entity = await getEntityByKey(key, publicClient);
  if (
    !entity ||
    readAttr(entity, 'type') !== 'admin_notification' ||
    readAttr(entity, 'project') !== PROJECT ||
    (SERVER_SIGNER_ADDRESS && entity.creator?.toLowerCase() !== SERVER_SIGNER_ADDRESS)
  ) {
    return null;
  }

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

  const query = adminNotificationQuery(publicClient);

  if (wallet) {
    query.where(eqAttr('wallet', wallet.toLowerCase()));
  }

  if (notificationType) {
    query.where(eqAttr('notification_type', notificationType));
  }

  if (spaceId) {
    query.where(eqAttr('space_id', spaceId));
  }

  const result = await fetchAll(query, limit || 100, publicClient);

  if (!result?.entities || !Array.isArray(result.entities)) {
    return [];
  }

  let notifications = result.entities.map(decodeAdminNotificationEntity);

  // Client-side filters (read/archived are in payload)
  if (read !== undefined) {
    notifications = notifications.filter((n) => n.read === read);
  }

  if (archived !== undefined) {
    notifications = notifications.filter((n) => n.archived === archived);
  }

  // Sort by updatedAt descending (most recent first)
  return notifications.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Decode admin notification entity from Arkiv response
 */
function decodeAdminNotificationEntity(entity: any): AdminNotification {
  const getAttr = (key: string): string => readAttr(entity, key);

  // Decode payload
  const payload: any = parsePayload(entity);

  return {
    key: entity.key,
    wallet: getAttr('wallet'),
    notificationId: getAttr('notification_id'),
    notificationType: getAttr('notification_type') as AdminNotificationType,
    title: payload.title || '',
    message: payload.message || '',
    link: payload.link,
    sourceEntityType: getAttr('source_entity_type') || undefined,
    sourceEntityKey: getAttr('source_entity_key') || undefined,
    read: payload.read ?? false,
    archived: payload.archived ?? false,
    metadata: payload.metadata,
    spaceId: getAttr('space_id'),
    createdAt: getAttr('created_at'),
    updatedAt: payload.updatedAt || getAttr('updated_at') || getAttr('created_at'),
  };
}
