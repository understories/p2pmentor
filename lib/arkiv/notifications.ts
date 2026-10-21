/**
 * Notification entity CRUD helpers
 *
 * Complete overhaul following admin notification pattern (Pattern B).
 * Replaces the entity in place (patchEntity via replaceArkivEntity) for state changes.
 *
 * Key Design:
 * - Stable entity_key derived from (wallet, notificationId)
 * - Replaces the entity in place for state changes (read/unread/archived)
 * - State stored in payload (read, archived)
 * - Full transaction history preserved
 *
 * Reference: refs/docs/admin-vs-regular-notifications-comparison.md
 */

import { PROJECT, eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr, getEntityByKey } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity, replaceArkivEntity } from './write';
import { SPACE_ID } from '@/lib/config';

export type NotificationType =
  | 'meeting_request'
  | 'profile_match'
  | 'ask_offer_match'
  | 'new_offer'
  | 'admin_response'
  | 'issue_resolved'
  | 'app_feedback_submitted'
  | 'new_garden_note'
  | 'new_skill_created'
  | 'community_meeting_scheduled'
  | 'session_completed_feedback_needed'
  | 'entity_created';

export type Notification = {
  key: string; // Entity key (stable)
  wallet: string; // Recipient wallet (normalized to lowercase)
  notificationId: string; // Unique notification identifier (deterministic)
  notificationType: NotificationType;
  sourceEntityType: string; // 'session' | 'ask' | 'offer' | 'user_profile' | 'admin_response' | 'app_feedback'
  sourceEntityKey: string; // Key of the source entity
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
  read: boolean; // Read/unread state (stored in payload)
  archived: boolean; // Archived/deleted state (stored in payload)
  spaceId: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp (last update)
  txHash?: string; // Transaction hash
};

/**
 * Derive stable entity key for notification
 *
 * Pattern: notification:{wallet}:{notificationId}
 * This ensures one entity per (wallet, notificationId) pair
 *
 * notificationId should be derived from sourceEntityType + sourceEntityKey
 * to ensure uniqueness per notification event.
 */
function deriveNotificationKey(wallet: string, notificationId: string): string {
  const normalizedWallet = wallet.toLowerCase();
  return `notification:${normalizedWallet}:${notificationId}`;
}

/**
 * Derive notificationId from source entity
 *
 * Creates a deterministic notificationId from source entity type and key.
 * This ensures the same source entity always generates the same notificationId.
 */
export function deriveNotificationId(sourceEntityType: string, sourceEntityKey: string): string {
  return `${sourceEntityType}_${sourceEntityKey}`;
}

/**
 * Create a new notification (upsert pattern)
 *
 * Creates the initial notification entity. State changes (read/unread/archived)
 * should use updateNotificationState instead.
 *
 * Uses upsert pattern: checks if exists, updates if found, creates if not.
 * This prevents duplicates and handles indexer delays gracefully.
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
  spaceId = SPACE_ID,
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
  const now = new Date().toISOString();
  const normalizedWallet = wallet.toLowerCase();

  // Derive deterministic notificationId
  const notificationId = deriveNotificationId(sourceEntityType, sourceEntityKey);

  // Check if notification already exists
  const publicClient = getPublicClient();
  const existing = await arkivSelect('notification', publicClient)
    .where(eqAttr('wallet', normalizedWallet))
    .where(eqAttr('notification_id', notificationId))
    .where(eqAttr('space_id', spaceId))
    .limit(1)
    .fetch();

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
  let entityKey: string;

  if (existing?.entities && existing.entities.length > 0) {
    // Notification exists - update it in place (Pattern B)
    const existingEntity = existing.entities[0];
    entityKey = existingEntity.key;

    // Decode current payload to preserve read/archived state
    let currentPayload: any = {};
    try {
      if (existingEntity.payload) {
        const decoded =
          existingEntity.payload instanceof Uint8Array
            ? new TextDecoder().decode(existingEntity.payload)
            : typeof existingEntity.payload === 'string'
              ? existingEntity.payload
              : JSON.stringify(existingEntity.payload);
        currentPayload = JSON.parse(decoded);
      }
    } catch (e) {
      console.error('[createNotification] Error decoding existing payload:', e);
    }

    // Get existing attributes
    const getAttr = (key: string): string => readAttr(existingEntity, key);

    // Preserve read/archived state, update other fields
    const updatedPayload = {
      ...currentPayload,
      title,
      message,
      link: link || currentPayload.link,
      metadata: metadata || currentPayload.metadata,
      read: currentPayload.read ?? false, // Preserve existing read state
      archived: currentPayload.archived ?? false, // Preserve existing archived state
      updatedAt: now,
    };

    const result = await handleTransactionWithTimeout(async () => {
      return await replaceArkivEntity(walletClient, {
        entityKey,
        type: 'notification',
        attributes: {
          wallet: normalizedWallet,
          notification_id: notificationId,
          notification_type: notificationType,
          source_entity_type: sourceEntityType,
          source_entity_key: sourceEntityKey,
          space_id: spaceId,
          created_at: getAttr('created_at') || now,
          updated_at: now,
        },
        payload: updatedPayload,
      });
    });
    txHash = result.txHash;
  } else {
    // Create new notification entity
    const result = await handleTransactionWithTimeout(async () => {
      return await createArkivEntity(walletClient, {
        type: 'notification',
        attributes: {
          wallet: normalizedWallet,
          notification_id: notificationId,
          notification_type: notificationType,
          source_entity_type: sourceEntityType,
          source_entity_key: sourceEntityKey,
          space_id: spaceId,
          created_at: now,
          updated_at: now,
        },
        payload,
      });
    });
    entityKey = result.entityKey;
    txHash = result.txHash;
  }

  // Store txHash in separate entity for reliable querying (non-blocking)
  createArkivEntity(walletClient, {
    type: 'notification_txhash',
    attributes: {
      notification_key: entityKey,
      wallet: normalizedWallet,
      space_id: spaceId,
    },
    payload: { txHash },
  }).catch((err: any) => {
    console.warn('[createNotification] Failed to create txHash entity (non-critical):', err);
  });

  return { key: entityKey, txHash };
}

/**
 * Update notification state (read/unread/archived)
 *
 * Uses Pattern B: replaces the entity in place (stable entity_key)
 * This updates the existing entity in place rather than creating a new one.
 */
export async function updateNotificationState({
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
  // First try querying by notificationId attribute (new notifications)
  const publicClient = getPublicClient();
  // Mutable copy of the entities (query results are read-only)
  let result: { entities: any[] } = {
    entities: [
      ...(
        await arkivSelect('notification', publicClient)
          .where(eqAttr('wallet', normalizedWallet))
          .where(eqAttr('notification_id', notificationId))
          .where(eqAttr('space_id', spaceId))
          .limit(1)
          .fetch()
      ).entities,
    ],
  };

  // If not found, try querying by deriving from sourceEntityType + sourceEntityKey (old notifications)
  if (!result?.entities || result.entities.length === 0) {
    // Parse notificationId to get sourceEntityType and sourceEntityKey
    // Format: sourceEntityType_sourceEntityKey
    const parts = notificationId.split('_');
    if (parts.length >= 2) {
      const sourceEntityType = parts[0];
      const sourceEntityKey = parts.slice(1).join('_'); // Handle keys that might contain underscores

      console.log(
        `[updateNotificationState] Fallback query: searching by sourceEntityType=${sourceEntityType}, sourceEntityKey=${sourceEntityKey}`
      );

      result = {
        entities: [
          ...(
            await arkivSelect('notification', publicClient)
              .where(eqAttr('wallet', normalizedWallet))
              .where(eqAttr('source_entity_type', sourceEntityType))
              .where(eqAttr('source_entity_key', sourceEntityKey))
              .where(eqAttr('space_id', spaceId))
              .limit(10) // Get more results to find the right one
              .fetch()
          ).entities,
        ],
      };

      // If still multiple, sort by most recent
      if (result?.entities && result.entities.length > 0) {
        result.entities.sort((a: any, b: any) => {
          const aTime = readAttr(a, 'updated_at') || readAttr(a, 'created_at');
          const bTime = readAttr(b, 'updated_at') || readAttr(b, 'created_at');
          return bTime.localeCompare(aTime);
        });
        console.log(
          `[updateNotificationState] Fallback query found ${result.entities.length} entities, using most recent`
        );
      }
    }
  }

  // Last resort: query all notifications for this wallet and find by notificationId in payload or derive it
  if (!result?.entities || result.entities.length === 0) {
    console.log(
      `[updateNotificationState] Last resort: querying all notifications for wallet ${normalizedWallet}`
    );
    const allResult = await arkivSelect('notification', publicClient)
      .where(eqAttr('wallet', normalizedWallet))
      .where(eqAttr('space_id', spaceId))
      .limit(100)
      .fetch();

    if (allResult?.entities && allResult.entities.length > 0) {
      // Try to find by matching notificationId or deriving it
      const matchingEntity = allResult.entities.find((entity: any) => {
        // Check if notificationId attribute matches
        const getAttr = (key: string): string => readAttr(entity, key);

        const entityNotificationId = getAttr('notification_id');
        if (entityNotificationId === notificationId) {
          return true;
        }

        // Try deriving notificationId from sourceEntityType + sourceEntityKey
        const entitySourceType = getAttr('source_entity_type');
        const entitySourceKey = getAttr('source_entity_key');
        if (entitySourceType && entitySourceKey) {
          const derivedId = deriveNotificationId(entitySourceType, entitySourceKey);
          if (derivedId === notificationId) {
            return true;
          }
        }

        return false;
      });

      if (matchingEntity) {
        console.log(`[updateNotificationState] Found notification via last resort query`);
        // Use just the matching entity
        result = { entities: [matchingEntity] };
      }
    }
  }

  if (!result?.entities || result.entities.length === 0) {
    throw new Error(`Notification not found: ${notificationId} for wallet ${normalizedWallet}`);
  }

  // If multiple entities found (shouldn't happen with Pattern B, but handle it), use the most recent one
  if (result.entities.length > 1) {
    console.warn(
      `[updateNotificationState] Multiple entities found for notificationId ${notificationId}, using most recent`
    );
    result.entities.sort((a: any, b: any) => {
      const aTime = readAttr(a, 'updated_at') || readAttr(a, 'created_at');
      const bTime = readAttr(b, 'updated_at') || readAttr(b, 'created_at');
      return bTime.localeCompare(aTime);
    });
  }

  const entity = result.entities[0];
  const entityKey = entity.key;

  // Validate entity key
  if (!entityKey || typeof entityKey !== 'string' || !entityKey.startsWith('0x')) {
    throw new Error(`Invalid entity key: ${entityKey} for notification ${notificationId}`);
  }

  // Decode current payload
  let currentPayload: any = {};
  try {
    if (entity.payload) {
      const decoded =
        entity.payload instanceof Uint8Array
          ? new TextDecoder().decode(entity.payload)
          : typeof entity.payload === 'string'
            ? entity.payload
            : JSON.stringify(entity.payload);
      currentPayload = JSON.parse(decoded);
    }
  } catch (e) {
    console.error('[updateNotificationState] Error decoding payload:', e);
  }

  // Get current attributes
  const getAttr = (key: string): string => readAttr(entity, key);

  // Build updated payload
  // Ensure read/archived are always explicitly set (important for old notifications)
  const updatedPayload = {
    ...currentPayload,
    read: read !== undefined ? read : (currentPayload.read ?? false),
    archived: archived !== undefined ? archived : (currentPayload.archived ?? false),
    updatedAt: now,
  };

  // Log the update for debugging
  console.log(
    `[updateNotificationState] Updating notification ${notificationId} for wallet ${normalizedWallet}`
  );
  console.log(
    `[updateNotificationState] Current payload read: ${currentPayload.read}, archived: ${currentPayload.archived}`
  );
  console.log(
    `[updateNotificationState] New payload read: ${updatedPayload.read}, archived: ${updatedPayload.archived}`
  );
  console.log(`[updateNotificationState] Entity key: ${entityKey}`);

  // Update entity in place (Pattern B)
  // Build attributes, ensuring notificationId is always included (empty values are omitted)
  const attributes = {
    wallet: normalizedWallet,
    notification_id: notificationId, // Always include notificationId
    notification_type: getAttr('notification_type'),
    source_entity_type: getAttr('source_entity_type'),
    source_entity_key: getAttr('source_entity_key'),
    space_id: spaceId,
    created_at: getAttr('created_at') || now,
    updated_at: now,
  };

  let txHash: string;
  try {
    const result = await handleTransactionWithTimeout(async () => {
      const updateResult = await replaceArkivEntity(walletClient, {
        entityKey,
        type: 'notification',
        attributes,
        payload: updatedPayload,
      });
      console.log(
        `[updateNotificationState] Update transaction successful, txHash: ${updateResult.txHash}`
      );
      return updateResult;
    });
    txHash = result.txHash;
  } catch (error: any) {
    console.error(
      `[updateNotificationState] Failed to update notification ${notificationId}:`,
      error
    );
    // Re-throw with more context
    throw new Error(`Failed to update notification: ${error.message || error}`);
  }

  console.log(
    `[updateNotificationState] Update complete for notification ${notificationId}, txHash: ${txHash}`
  );
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
  read,
  archived,
  sourceEntityType,
  spaceId,
  spaceIds,
  limit = 100,
}: {
  wallet?: string;
  notificationType?: NotificationType;
  read?: boolean;
  archived?: boolean;
  sourceEntityType?: string;
  spaceId?: string;
  spaceIds?: string[];
  limit?: number;
} = {}): Promise<Notification[]> {
  try {
    const publicClient = getPublicClient();

    // Build query with wallet filter at Arkiv level for efficiency
    let notificationQuery = arkivSelect('notification', publicClient);

    if (wallet) {
      notificationQuery = notificationQuery.where(eqAttr('wallet', wallet.toLowerCase()));
    }

    // Support multiple spaceIds (builder mode) or single spaceId
    if (spaceIds && spaceIds.length > 0) {
      // Query all, filter client-side (Arkiv doesn't support OR queries)
    } else {
      // Use provided spaceId or default to SPACE_ID from config
      const finalSpaceId = spaceId || SPACE_ID;
      notificationQuery = notificationQuery.where(eqAttr('space_id', finalSpaceId));
    }

    // Fetch notification entities and txHash entities in parallel
    let txHashQuery = arkivSelect('notification_txhash', publicClient);
    if (wallet) {
      txHashQuery = txHashQuery.where(eqAttr('wallet', wallet.toLowerCase()));
    }
    const [result, txHashResult] = await Promise.all([
      fetchAll(notificationQuery, limit || 100, publicClient),
      fetchAll(txHashQuery, limit || 100, publicClient),
    ]);

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.warn('[listNotifications] Invalid result structure, returning empty array', {
        result,
      });
      return [];
    }

    // Build txHash map
    const txHashMap: Record<string, string> = {};
    if (txHashResult?.entities && Array.isArray(txHashResult.entities)) {
      txHashResult.entities.forEach((entity: any) => {
        const getAttr = (key: string): string => readAttr(entity, key);
        const notificationKey = getAttr('notification_key');
        try {
          if (entity.payload) {
            const decoded =
              entity.payload instanceof Uint8Array
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

    let notifications = result.entities.map(decodeNotificationEntity);

    // CRITICAL: Deduplicate by notificationId (handle old Pattern A duplicates)
    // Keep only the most recent notification for each notificationId
    const notificationMap = new Map<string, Notification>();
    for (const notif of notifications) {
      const existing = notificationMap.get(notif.notificationId);
      if (!existing) {
        notificationMap.set(notif.notificationId, notif);
      } else {
        // Compare by updatedAt to keep the most recent
        const existingTime = new Date(existing.updatedAt || existing.createdAt).getTime();
        const currentTime = new Date(notif.updatedAt || notif.createdAt).getTime();
        if (currentTime > existingTime) {
          notificationMap.set(notif.notificationId, notif);
        }
      }
    }
    notifications = Array.from(notificationMap.values());

    // Filter by spaceIds client-side if multiple requested
    if (spaceIds && spaceIds.length > 0) {
      notifications = notifications.filter((n) => spaceIds.includes(n.spaceId));
    }

    // Apply filters
    if (wallet) {
      notifications = notifications.filter((n) => n.wallet.toLowerCase() === wallet.toLowerCase());
    }
    if (notificationType) {
      notifications = notifications.filter((n) => n.notificationType === notificationType);
    }
    if (read !== undefined) {
      notifications = notifications.filter((n) => n.read === read);
    }
    if (archived !== undefined) {
      notifications = notifications.filter((n) => n.archived === archived);
    }
    if (sourceEntityType) {
      notifications = notifications.filter((n) => n.sourceEntityType === sourceEntityType);
    }

    // Sort by most recent first
    return notifications.sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
    );
  } catch (error: any) {
    console.error('[listNotifications] Error:', error);
    return [];
  }
}

/**
 * Get notification by key
 */
export async function getNotificationByKey(key: string): Promise<Notification | null> {
  const publicClient = getPublicClient();

  const entity = await getEntityByKey(key, publicClient);
  if (
    !entity ||
    readAttr(entity, 'type') !== 'notification' ||
    readAttr(entity, 'project') !== PROJECT
  ) {
    return null;
  }

  return decodeNotificationEntity(entity);
}

/**
 * Archive a notification (soft delete)
 *
 * Uses Pattern B: replaces the entity in place to set archived=true
 * This updates the existing entity in place rather than creating a new one.
 */
export async function archiveNotification({
  notificationId,
  wallet,
  privateKey,
  spaceId = SPACE_ID,
}: {
  notificationId: string;
  wallet: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  return updateNotificationState({
    wallet,
    notificationId,
    archived: true,
    privateKey,
    spaceId,
  });
}

/**
 * Archive all notifications for a wallet (bulk delete)
 *
 * Uses Pattern B: replaces each entity in place to set archived=true for all notifications
 * This allows users to "nuke" all their notifications if needed.
 *
 * IMPORTANT: Uses server signing wallet (ARKIV_PRIVATE_KEY), not user's wallet.
 * The wallet parameter is the recipient wallet (whose notifications to archive).
 *
 * @param wallet - User wallet address (recipient of notifications)
 * @param privateKey - Server signing key (ARKIV_PRIVATE_KEY from getPrivateKey())
 * @param spaceId - Space ID (defaults to SPACE_ID)
 * @returns Array of results with keys and txHashes
 */
export async function archiveAllNotifications({
  wallet,
  privateKey,
  spaceId = SPACE_ID,
}: {
  wallet: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<Array<{ key: string; txHash: string; notificationId: string }>> {
  const normalizedWallet = wallet.toLowerCase();

  // Get all non-archived notifications for this wallet
  const notifications = await listNotifications({
    wallet: normalizedWallet,
    archived: false,
    spaceId,
    limit: 1000, // Get all notifications
  });

  if (notifications.length === 0) {
    return [];
  }

  console.log(
    `[archiveAllNotifications] Archiving ${notifications.length} notifications for wallet ${normalizedWallet}`
  );

  // Archive each notification
  const results: Array<{ key: string; txHash: string; notificationId: string }> = [];
  const errors: Array<{ notificationId: string; error: string }> = [];

  for (const notification of notifications) {
    try {
      const result = await updateNotificationState({
        wallet: normalizedWallet,
        notificationId: notification.notificationId,
        archived: true,
        privateKey,
        spaceId,
      });
      results.push({
        key: result.key,
        txHash: result.txHash,
        notificationId: notification.notificationId,
      });
    } catch (error: any) {
      console.error(
        `[archiveAllNotifications] Failed to archive notification ${notification.notificationId}:`,
        error
      );
      errors.push({
        notificationId: notification.notificationId,
        error: error.message || String(error),
      });
    }
  }

  if (errors.length > 0) {
    console.warn(
      `[archiveAllNotifications] ${errors.length} notifications failed to archive:`,
      errors
    );
  }

  console.log(
    `[archiveAllNotifications] Successfully archived ${results.length}/${notifications.length} notifications`
  );
  return results;
}

/**
 * Decode notification entity from Arkiv response
 */
function decodeNotificationEntity(entity: any): Notification {
  const getAttr = (key: string): string => readAttr(entity, key);

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
    console.error('[decodeNotificationEntity] Error decoding payload:', e);
  }

  // Get notificationId from attributes, or derive it for backward compatibility
  const notificationIdAttr = getAttr('notification_id');
  const sourceEntityType = getAttr('source_entity_type');
  const sourceEntityKey = getAttr('source_entity_key');
  const notificationId =
    notificationIdAttr ||
    (sourceEntityType && sourceEntityKey
      ? deriveNotificationId(sourceEntityType, sourceEntityKey)
      : '');

  return {
    key: entity.key,
    wallet: getAttr('wallet'),
    notificationId: notificationId,
    notificationType: getAttr('notification_type') as NotificationType,
    sourceEntityType: sourceEntityType,
    sourceEntityKey: sourceEntityKey,
    title: payload.title || '',
    message: payload.message || '',
    link: payload.link,
    metadata: payload.metadata,
    read: payload.read ?? false,
    archived: payload.archived ?? false,
    spaceId: getAttr('space_id'),
    createdAt: getAttr('created_at'),
    updatedAt: payload.updatedAt || getAttr('updated_at') || getAttr('created_at'),
    txHash: entity.txHash || payload.txHash || undefined,
  };
}
