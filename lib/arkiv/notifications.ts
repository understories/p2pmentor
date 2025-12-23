/**
 * Notification entity CRUD helpers
 * 
 * Complete overhaul following admin notification pattern (Pattern B).
 * Uses updateEntity for state changes with stable entity keys.
 * 
 * Key Design:
 * - Stable entity_key derived from (wallet, notificationId)
 * - Uses updateEntity for state changes (read/unread/archived)
 * - State stored in payload (read, archived)
 * - Full transaction history preserved
 * 
 * Reference: refs/docs/admin-vs-regular-notifications-comparison.md
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { handleTransactionWithTimeout } from "./transaction-utils";
import { SPACE_ID } from "@/lib/config";

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
  key: string;                    // Entity key (stable)
  wallet: string;                 // Recipient wallet (normalized to lowercase)
  notificationId: string;         // Unique notification identifier (deterministic)
  notificationType: NotificationType;
  sourceEntityType: string;       // 'session' | 'ask' | 'offer' | 'user_profile' | 'admin_response' | 'app_feedback'
  sourceEntityKey: string;       // Key of the source entity
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
  read: boolean;                 // Read/unread state (stored in payload)
  archived: boolean;              // Archived/deleted state (stored in payload)
  spaceId: string;
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp (last update)
  txHash?: string;               // Transaction hash
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
  const enc = new TextEncoder();
  const now = new Date().toISOString();
  const normalizedWallet = wallet.toLowerCase();

  // Derive deterministic notificationId
  const notificationId = deriveNotificationId(sourceEntityType, sourceEntityKey);

  // Check if notification already exists
  const publicClient = getPublicClient();
  const existing = await publicClient.buildQuery()
    .where(eq('type', 'notification'))
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
  let entityKey: string;

  if (existing?.entities && existing.entities.length > 0) {
    // Notification exists - update it in place (Pattern B)
    const existingEntity = existing.entities[0];
    entityKey = existingEntity.key;
    
    // Decode current payload to preserve read/archived state
    let currentPayload: any = {};
    try {
      if (existingEntity.payload) {
        const decoded = existingEntity.payload instanceof Uint8Array
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
    const attrs = existingEntity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };

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
      return await walletClient.updateEntity({
        entityKey: entityKey as `0x${string}`,
        payload: enc.encode(JSON.stringify(updatedPayload)),
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'notification' },
          { key: 'wallet', value: normalizedWallet },
          { key: 'notificationId', value: notificationId },
          { key: 'notificationType', value: notificationType },
          { key: 'sourceEntityType', value: sourceEntityType },
          { key: 'sourceEntityKey', value: sourceEntityKey },
          { key: 'spaceId', value: spaceId },
          { key: 'createdAt', value: getAttr('createdAt') || now },
          { key: 'updatedAt', value: now },
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
        { key: 'type', value: 'notification' },
          { key: 'wallet', value: normalizedWallet },
          { key: 'notificationId', value: notificationId },
        { key: 'notificationType', value: notificationType },
        { key: 'sourceEntityType', value: sourceEntityType },
        { key: 'sourceEntityKey', value: sourceEntityKey },
        { key: 'spaceId', value: spaceId },
          { key: 'createdAt', value: now },
          { key: 'updatedAt', value: now },
      ],
      expiresIn,
    });
  });
    entityKey = result.entityKey;
    txHash = result.txHash;
  }

  // Store txHash in separate entity for reliable querying (non-blocking)
  walletClient.createEntity({
    payload: enc.encode(JSON.stringify({ txHash })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'notification_txhash' },
      { key: 'notificationKey', value: entityKey },
      { key: 'wallet', value: normalizedWallet },
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn,
  }).catch((err: any) => {
    console.warn('[createNotification] Failed to create txHash entity (non-critical):', err);
  });

  return { key: entityKey, txHash };
}

/**
 * Update notification state (read/unread/archived)
 * 
 * Uses Pattern B: updateEntity with stable entity_key
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
  const enc = new TextEncoder();
  const now = new Date().toISOString();
  const normalizedWallet = wallet.toLowerCase();

  // Get current notification state by wallet + notificationId (stable query)
  // First try querying by notificationId attribute (new notifications)
  const publicClient = getPublicClient();
  let result = await publicClient.buildQuery()
    .where(eq('type', 'notification'))
    .where(eq('wallet', normalizedWallet))
    .where(eq('notificationId', notificationId))
    .where(eq('spaceId', spaceId))
    .withAttributes(true)
    .withPayload(true)
    .limit(1)
    .fetch();

  // If not found, try querying by deriving from sourceEntityType + sourceEntityKey (old notifications)
  if (!result?.entities || result.entities.length === 0) {
    // Parse notificationId to get sourceEntityType and sourceEntityKey
    // Format: sourceEntityType_sourceEntityKey
    const parts = notificationId.split('_');
    if (parts.length >= 2) {
      const sourceEntityType = parts[0];
      const sourceEntityKey = parts.slice(1).join('_'); // Handle keys that might contain underscores
      
      console.log(`[updateNotificationState] Fallback query: searching by sourceEntityType=${sourceEntityType}, sourceEntityKey=${sourceEntityKey}`);
      
      result = await publicClient.buildQuery()
        .where(eq('type', 'notification'))
        .where(eq('wallet', normalizedWallet))
        .where(eq('sourceEntityType', sourceEntityType))
        .where(eq('sourceEntityKey', sourceEntityKey))
        .where(eq('spaceId', spaceId))
        .withAttributes(true)
        .withPayload(true)
        .limit(10) // Get more results to find the right one
        .fetch();
      
      // If still multiple, sort by most recent
      if (result?.entities && result.entities.length > 0) {
        result.entities.sort((a: any, b: any) => {
          const aTime = a.updatedAt || a.createdAt || '';
          const bTime = b.updatedAt || b.createdAt || '';
          return bTime.localeCompare(aTime);
        });
        console.log(`[updateNotificationState] Fallback query found ${result.entities.length} entities, using most recent`);
      }
    }
  }
  
  // Last resort: query all notifications for this wallet and find by notificationId in payload or derive it
  if (!result?.entities || result.entities.length === 0) {
    console.log(`[updateNotificationState] Last resort: querying all notifications for wallet ${normalizedWallet}`);
    const allResult = await publicClient.buildQuery()
      .where(eq('type', 'notification'))
      .where(eq('wallet', normalizedWallet))
      .where(eq('spaceId', spaceId))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch();
    
    if (allResult?.entities && allResult.entities.length > 0) {
      // Try to find by matching notificationId or deriving it
      const matchingEntity = allResult.entities.find((entity: any) => {
        // Check if notificationId attribute matches
        const attrs = entity.attributes || {};
        const getAttr = (key: string): string => {
          if (Array.isArray(attrs)) {
            const attr = attrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(attrs[key] || '');
        };
        
        const entityNotificationId = getAttr('notificationId');
        if (entityNotificationId === notificationId) {
          return true;
        }
        
        // Try deriving notificationId from sourceEntityType + sourceEntityKey
        const entitySourceType = getAttr('sourceEntityType');
        const entitySourceKey = getAttr('sourceEntityKey');
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
        // Use the allResult but replace entities array with just the matching one
        result = allResult;
        result.entities = [matchingEntity];
      }
    }
  }

  if (!result?.entities || result.entities.length === 0) {
    throw new Error(`Notification not found: ${notificationId} for wallet ${normalizedWallet}`);
  }

  // If multiple entities found (shouldn't happen with Pattern B, but handle it), use the most recent one
  if (result.entities.length > 1) {
    console.warn(`[updateNotificationState] Multiple entities found for notificationId ${notificationId}, using most recent`);
    result.entities.sort((a: any, b: any) => {
      const aTime = a.updatedAt || a.createdAt || '';
      const bTime = b.updatedAt || b.createdAt || '';
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
      const decoded = entity.payload instanceof Uint8Array
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
  const attrs = entity.attributes || {};
  const getAttr = (key: string): string => {
    if (Array.isArray(attrs)) {
      const attr = attrs.find((a: any) => a.key === key);
      return String(attr?.value || '');
    }
    return String(attrs[key] || '');
  };

  // Build updated payload
  // Ensure read/archived are always explicitly set (important for old notifications)
  const updatedPayload = {
    ...currentPayload,
    read: read !== undefined ? read : (currentPayload.read ?? false),
    archived: archived !== undefined ? archived : (currentPayload.archived ?? false),
    updatedAt: now,
  };

  // Log the update for debugging
  console.log(`[updateNotificationState] Updating notification ${notificationId} for wallet ${normalizedWallet}`);
  console.log(`[updateNotificationState] Current payload read: ${currentPayload.read}, archived: ${currentPayload.archived}`);
  console.log(`[updateNotificationState] New payload read: ${updatedPayload.read}, archived: ${updatedPayload.archived}`);
  console.log(`[updateNotificationState] Entity key: ${entityKey}`);

  // Update entity in place (Pattern B)
  const expiresIn = 31536000; // 1 year
  
  // Build attributes array, ensuring notificationId is always included
  const attributes = [
    { key: 'type', value: 'notification' },
    { key: 'wallet', value: normalizedWallet },
    { key: 'notificationId', value: notificationId }, // Always include notificationId
    { key: 'notificationType', value: getAttr('notificationType') || '' },
    { key: 'sourceEntityType', value: getAttr('sourceEntityType') || '' },
    { key: 'sourceEntityKey', value: getAttr('sourceEntityKey') || '' },
    { key: 'spaceId', value: spaceId },
    { key: 'createdAt', value: getAttr('createdAt') || now },
    { key: 'updatedAt', value: now },
  ];

  let txHash: string;
  try {
    const result = await handleTransactionWithTimeout(async () => {
      const updateResult = await walletClient.updateEntity({
        entityKey: entityKey as `0x${string}`,
        payload: enc.encode(JSON.stringify(updatedPayload)),
        contentType: 'application/json',
        attributes,
        expiresIn,
      });
      console.log(`[updateNotificationState] Update transaction successful, txHash: ${updateResult.txHash}`);
      return updateResult;
    });
    txHash = result.txHash;
  } catch (error: any) {
    console.error(`[updateNotificationState] Failed to update notification ${notificationId}:`, error);
    // Re-throw with more context
    throw new Error(`Failed to update notification: ${error.message || error}`);
  }

  console.log(`[updateNotificationState] Update complete for notification ${notificationId}, txHash: ${txHash}`);
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
    let notificationQuery = publicClient.buildQuery()
      .where(eq('type', 'notification'));
    
    if (wallet) {
      notificationQuery = notificationQuery.where(eq('wallet', wallet.toLowerCase()));
    }
    
    // Support multiple spaceIds (builder mode) or single spaceId
    if (spaceIds && spaceIds.length > 0) {
      // Query all, filter client-side (Arkiv doesn't support OR queries)
      notificationQuery = notificationQuery.limit(limit || 100);
    } else {
      // Use provided spaceId or default to SPACE_ID from config
      const finalSpaceId = spaceId || SPACE_ID;
      notificationQuery = notificationQuery.where(eq('spaceId', finalSpaceId)).limit(limit || 100);
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
      notifications = notifications.filter(n => spaceIds.includes(n.spaceId));
    }
    
    // Apply filters
    if (wallet) {
      notifications = notifications.filter(n => n.wallet.toLowerCase() === wallet.toLowerCase());
    }
    if (notificationType) {
      notifications = notifications.filter(n => n.notificationType === notificationType);
    }
    if (read !== undefined) {
      notifications = notifications.filter(n => n.read === read);
    }
    if (archived !== undefined) {
      notifications = notifications.filter(n => n.archived === archived);
    }
    if (sourceEntityType) {
      notifications = notifications.filter(n => n.sourceEntityType === sourceEntityType);
    }

    // Sort by most recent first
    return notifications.sort((a, b) => 
      new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    );
  } catch (error: any) {
    console.error('[listNotifications] Error:', error);
    return [];
  }
}

/**
 * Get notification by key
 */
export async function getNotificationByKey(
  key: string
): Promise<Notification | null> {
  const publicClient = getPublicClient();

  const result = await publicClient.buildQuery()
    .where(eq('type', 'notification'))
    .where(eq('key', key))
    .withAttributes(true)
    .withPayload(true)
    .limit(1)
    .fetch();

  if (!result?.entities || result.entities.length === 0) {
    return null;
  }

  return decodeNotificationEntity(result.entities[0]);
}

/**
 * Archive a notification (soft delete)
 * 
 * Uses Pattern B: updateEntity to set archived=true
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
 * Uses Pattern B: updateEntity to set archived=true for all notifications
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
  
  console.log(`[archiveAllNotifications] Archiving ${notifications.length} notifications for wallet ${normalizedWallet}`);
  
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
      console.error(`[archiveAllNotifications] Failed to archive notification ${notification.notificationId}:`, error);
      errors.push({
        notificationId: notification.notificationId,
        error: error.message || String(error),
      });
    }
  }
  
  if (errors.length > 0) {
    console.warn(`[archiveAllNotifications] ${errors.length} notifications failed to archive:`, errors);
  }
  
  console.log(`[archiveAllNotifications] Successfully archived ${results.length}/${notifications.length} notifications`);
  return results;
}

/**
 * Decode notification entity from Arkiv response
 */
function decodeNotificationEntity(entity: any): Notification {
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
    console.error('[decodeNotificationEntity] Error decoding payload:', e);
  }

  // Get notificationId from attributes, or derive it for backward compatibility
  const notificationIdAttr = getAttr('notificationId');
  const sourceEntityType = getAttr('sourceEntityType');
  const sourceEntityKey = getAttr('sourceEntityKey');
  const notificationId = notificationIdAttr || (sourceEntityType && sourceEntityKey 
    ? deriveNotificationId(sourceEntityType, sourceEntityKey) 
    : '');

  return {
    key: entity.key,
    wallet: getAttr('wallet'),
    notificationId: notificationId,
    notificationType: getAttr('notificationType') as NotificationType,
    sourceEntityType: sourceEntityType,
    sourceEntityKey: sourceEntityKey,
    title: payload.title || '',
    message: payload.message || '',
    link: payload.link,
    metadata: payload.metadata,
    read: payload.read ?? false,
    archived: payload.archived ?? false,
    spaceId: getAttr('spaceId'),
    createdAt: getAttr('createdAt'),
    updatedAt: payload.updatedAt || getAttr('updatedAt') || getAttr('createdAt'),
    txHash: entity.txHash || payload.txHash || undefined,
  };
}
