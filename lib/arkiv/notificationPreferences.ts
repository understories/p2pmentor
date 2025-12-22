/**
 * Notification Preferences CRUD helpers
 * 
 * Stores user notification preferences and read/unread state as Arkiv entities.
 * This allows users to customize their notification experience while staying Arkiv-native.
 */

import { eq, and } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { SPACE_ID, ENTITY_UPDATE_MODE } from "@/lib/config";
import { arkivUpsertEntity } from "./entity-utils";
import { handleTransactionWithTimeout } from "./transaction-utils";

export type NotificationPreferenceType = 
  | 'meeting_request'
  | 'profile_match'
  | 'ask_offer_match'
  | 'new_offer'
  | 'admin_response';

export type NotificationPreference = {
  key: string;
  wallet: string;
  notificationId: string; // The notification ID (e.g., "meeting_request_sessionKey123")
  notificationType: NotificationPreferenceType;
  read: boolean; // true = read, false = unread
  archived: boolean; // true = deleted/hidden
  createdAt: string;
  updatedAt: string;
  txHash?: string;
};

/**
 * Get notification preference by deterministic key
 *
 * Deterministic key derivation: (wallet, notification_id) is unique identity.
 * This ensures we can find the canonical preference entity.
 * 
 * Uses direct query filtering for efficiency instead of client-side filtering.
 */
async function getNotificationPreferenceByKey(
  wallet: string,
  notificationId: string,
  spaceId: string = SPACE_ID
): Promise<NotificationPreference | null> {
  const normalizedWallet = wallet.toLowerCase();
  try {
    const publicClient = getPublicClient();
    
    let query = publicClient.buildQuery()
      .where(eq('type', 'notification_preference'))
      .where(eq('wallet', normalizedWallet))
      .where(eq('notificationId', notificationId))
      .where(eq('spaceId', spaceId))
      .withAttributes(true)
      .withPayload(true)
      .limit(100); // Get multiple to find latest by updatedAt
    
    const result = await query.fetch();
    
    if (!result || !result.entities || !Array.isArray(result.entities) || result.entities.length === 0) {
      return null;
    }
    
    // Parse entities and get the latest one (by updatedAt)
    const preferences = result.entities.map((entity: any) => {
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
        console.error('Error decoding notification preference payload:', e);
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
        notificationId: getAttr('notificationId'),
        notificationType: getAttr('notificationType') as NotificationPreferenceType,
        read: getAttr('read') === 'true' || payload.read === true,
        archived: getAttr('archived') === 'true' || payload.archived === true,
        createdAt: getAttr('createdAt') || payload.createdAt,
        updatedAt: getAttr('updatedAt') || payload.updatedAt,
        txHash: entity.txHash || payload.txHash,
      };
    });
    
    // Sort by updatedAt descending and return the latest
    preferences.sort((a, b) => 
      new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    );
    
    return preferences.length > 0 ? preferences[0] : null;
  } catch (error: any) {
    console.error('Error in getNotificationPreferenceByKey:', error);
    return null;
  }
}

/**
 * Create or update a notification preference
 *
 * PRIORITY FIX: Uses stable entity_key to prevent state persistence issues.
 * Deterministic key derivation: (wallet, notification_id) is unique identity.
 *
 * Key Rule: Reject/ignore writes that would create a second preference entity
 * for the same (wallet, notification_id) identity.
 */
export async function upsertNotificationPreference({
  wallet,
  notificationId,
  notificationType,
  read,
  archived = false,
  preferenceKey, // NEW: Direct-update key if known
  privateKey,
  spaceId = SPACE_ID,
}: {
  wallet: string;
  notificationId: string;
  notificationType: NotificationPreferenceType;
  read: boolean;
  archived?: boolean;
  preferenceKey?: string; // NEW: Direct-update key if known
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const normalizedWallet = wallet.toLowerCase().trim();
  const enc = new TextEncoder();
  const now = new Date().toISOString();
  const finalSpaceId = spaceId || SPACE_ID;

  console.log('[upsertNotificationPreference] Starting upsert:', {
    wallet: normalizedWallet,
    notificationId,
    notificationType,
    read,
    archived,
    preferenceKey, // NEW
    spaceId: finalSpaceId,
    ENTITY_UPDATE_MODE,
  });

  // (A) NEW: Direct update by key (bypasses query, eliminates race condition)
  if (preferenceKey) {
    // Try to preserve createdAt if we can fetch it, but not required for correctness
    let createdAt = now;
    try {
      const existing = await getNotificationPreferenceByKey(normalizedWallet, notificationId, finalSpaceId);
      if (existing && existing.createdAt) {
        createdAt = existing.createdAt;
      }
    } catch (error) {
      // If fetch fails, use current time - not critical
      console.warn('[upsertNotificationPreference] Could not fetch existing createdAt, using current time:', error);
    }

    const payload = {
      wallet: normalizedWallet,
      notificationId,
      notificationType,
      read,
      archived,
      createdAt,
      updatedAt: now,
    };

    const updateResult = await arkivUpsertEntity({
      type: 'notification_preference',
      key: preferenceKey, // Direct update by key - no query needed
      attributes: [
        { key: 'type', value: 'notification_preference' },
        { key: 'wallet', value: normalizedWallet },
        { key: 'notificationId', value: notificationId },
        { key: 'notificationType', value: notificationType },
        { key: 'read', value: String(read) },
        { key: 'archived', value: String(archived) },
        { key: 'spaceId', value: finalSpaceId },
        { key: 'createdAt', value: createdAt },
        { key: 'updatedAt', value: now },
      ],
      payload: enc.encode(JSON.stringify(payload)),
      expiresIn: 31536000, // 1 year
      privateKey,
    });

    // Structured logging (U1.x.1)
    const { logEntityWrite } = await import('./write-logging');
    logEntityWrite({
      entityType: 'notification_preference',
      entityKey: updateResult.key,
      txHash: updateResult.txHash,
      wallet: normalizedWallet,
      timestamp: now,
      operation: 'update',
      spaceId: finalSpaceId,
    });

    console.log('[upsertNotificationPreference] Successfully updated preference by key:', {
      key: updateResult.key,
      txHash: updateResult.txHash,
      preferenceKey,
    });
    return updateResult;
  }

  // (B) Legacy fallback: Query-first path (for older clients without preferenceKey)
  const existing = await getNotificationPreferenceByKey(normalizedWallet, notificationId, finalSpaceId);

  console.log('[upsertNotificationPreference] Existing preference found:', existing ? {
    key: existing.key,
    read: existing.read,
    updatedAt: existing.updatedAt,
  } : null);

  // Check for duplicates: reject if another preference exists for same (wallet, notification_id)
  // This prevents creating multiple preference entities for the same identity
  if (existing && existing.key) {
    // Deterministic check: If entity exists, use Pattern B
    const shouldUpdate = ENTITY_UPDATE_MODE === 'on' || ENTITY_UPDATE_MODE === 'shadow';

    console.log('[upsertNotificationPreference] Should update?', shouldUpdate, '(ENTITY_UPDATE_MODE:', ENTITY_UPDATE_MODE, ')');

    if (shouldUpdate) {
      // Use canonical helper to update existing entity (Pattern B)
      const payload = {
        wallet: normalizedWallet,
        notificationId,
        notificationType,
        read,
        archived,
        createdAt: existing.createdAt,
        updatedAt: now,
      };

      const updateResult = await arkivUpsertEntity({
        type: 'notification_preference',
        key: existing.key, // Stable entity_key
        attributes: [
          { key: 'type', value: 'notification_preference' },
          { key: 'wallet', value: normalizedWallet },
          { key: 'notificationId', value: notificationId },
          { key: 'notificationType', value: notificationType },
          { key: 'read', value: String(read) },
          { key: 'archived', value: String(archived) },
          { key: 'spaceId', value: finalSpaceId },
          { key: 'createdAt', value: existing.createdAt },
          { key: 'updatedAt', value: now },
        ],
        payload: enc.encode(JSON.stringify(payload)),
        expiresIn: 31536000, // 1 year
        privateKey,
      });

      // Structured logging (U1.x.1)
      const { logEntityWrite } = await import('./write-logging');
      logEntityWrite({
        entityType: 'notification_preference',
        entityKey: updateResult.key,
        txHash: updateResult.txHash,
        wallet: normalizedWallet,
        timestamp: now,
        operation: 'update',
        spaceId: finalSpaceId,
      });

      console.log('[upsertNotificationPreference] Successfully updated preference:', {
        key: updateResult.key,
        txHash: updateResult.txHash,
      });
      return updateResult;
    }
    // Fall through to create-new-entity path if update mode is off
    console.log('[upsertNotificationPreference] Update mode is off, falling through to create');
  }

  // Create new preference (old behavior or fallback)
  console.log('[upsertNotificationPreference] Creating new preference entity');
  // This path is used when:
  // - No existing preference found
  // - Update mode is 'off' and wallet not migrated
  // - Update mode is 'shadow' but wallet not migrated yet
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const payload = {
    wallet: normalizedWallet,
    notificationId,
    notificationType,
    read,
    archived,
    createdAt: now,
    updatedAt: now,
  };

  const { addSignerMetadata } = await import('./signer-metadata');
  const baseAttributes = [
    { key: 'type', value: 'notification_preference' },
    { key: 'wallet', value: normalizedWallet },
    { key: 'notificationId', value: notificationId },
    { key: 'notificationType', value: notificationType },
    { key: 'read', value: String(read) },
    { key: 'archived', value: String(archived) },
    { key: 'spaceId', value: finalSpaceId },
    { key: 'createdAt', value: now },
    { key: 'updatedAt', value: now },
  ];
  const attributesWithSigner = addSignerMetadata(baseAttributes, privateKey);
  
  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: attributesWithSigner,
      expiresIn: 31536000, // 1 year
    });
  });

  console.log('[upsertNotificationPreference] Successfully created new preference:', {
    key: result.entityKey,
    txHash: result.txHash,
  });

  return { key: result.entityKey, txHash: result.txHash };
}

/**
 * List notification preferences for a user
 */
export async function listNotificationPreferences({
  wallet,
  notificationId,
  notificationType,
  read,
  archived,
  spaceId,
  limit = 1000,
}: {
  wallet?: string;
  notificationId?: string;
  notificationType?: NotificationPreferenceType;
  read?: boolean;
  archived?: boolean;
  spaceId?: string;
  limit?: number;
} = {}): Promise<NotificationPreference[]> {
  try {
    const publicClient = getPublicClient();
    
    let query = publicClient.buildQuery()
      .where(eq('type', 'notification_preference'))
      .withAttributes(true)
      .withPayload(true);
    
    // Filter by spaceId if provided (important for cross-environment isolation)
    if (spaceId) {
      query = query.where(eq('spaceId', spaceId));
    }
    
    query = query.limit(limit);

    const result = await query.fetch();

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      return [];
    }

    const preferences = result.entities.map((entity: any) => {
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
        console.error('Error decoding notification preference payload:', e);
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
        notificationId: getAttr('notificationId'),
        notificationType: getAttr('notificationType') as NotificationPreferenceType,
        read: getAttr('read') === 'true' || payload.read === true,
        archived: getAttr('archived') === 'true' || payload.archived === true,
        createdAt: getAttr('createdAt') || payload.createdAt,
        updatedAt: getAttr('updatedAt') || payload.updatedAt,
        txHash: entity.txHash || payload.txHash,
      };
    });

    // Apply filters
    let filtered = preferences;
    if (wallet) {
      filtered = filtered.filter(p => p.wallet.toLowerCase() === wallet.toLowerCase());
    }
    if (spaceId) {
      // Filter by spaceId (client-side if not filtered in query)
      filtered = filtered.filter(p => {
        const attrs = (p as any).attributes || {};
        const getAttr = (key: string): string => {
          if (Array.isArray(attrs)) {
            const attr = attrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(attrs[key] || '');
        };
        const prefSpaceId = getAttr('spaceId') || (p as any).spaceId;
        return prefSpaceId === spaceId;
      });
    }
    if (notificationType) {
      filtered = filtered.filter(p => p.notificationType === notificationType);
    }
    if (read !== undefined) {
      filtered = filtered.filter(p => p.read === read);
    }
    if (archived !== undefined) {
      filtered = filtered.filter(p => p.archived === archived);
    }

    // If filtering by specific notificationId, get the most recent preference for that notification
    if (notificationId) {
      filtered = filtered.filter(p => p.notificationId === notificationId);
      // Sort by most recent and return the latest one
      filtered.sort((a, b) => 
        new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      );
      return filtered.length > 0 ? [filtered[0]] : [];
    }

    // For general queries, deduplicate by notificationId (keep most recent)
    const preferenceMap = new Map<string, NotificationPreference>();
    filtered.forEach(pref => {
      const existing = preferenceMap.get(pref.notificationId);
      if (!existing || new Date(pref.updatedAt || pref.createdAt).getTime() > 
          new Date(existing.updatedAt || existing.createdAt).getTime()) {
        preferenceMap.set(pref.notificationId, pref);
      }
    });

    // Sort by most recent first
    return Array.from(preferenceMap.values()).sort((a, b) => 
      new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    );
  } catch (error: any) {
    console.error('Error in listNotificationPreferences:', error);
    return [];
  }
}

/**
 * Get notification preference for a specific notification
 */
export async function getNotificationPreference(
  wallet: string,
  notificationId: string
): Promise<NotificationPreference | null> {
  const preferences = await listNotificationPreferences({ wallet, notificationId, limit: 1 });
  return preferences.length > 0 ? preferences[0] : null;
}

