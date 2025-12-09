/**
 * Notification Preferences CRUD helpers
 * 
 * Stores user notification preferences and read/unread state as Arkiv entities.
 * This allows users to customize their notification experience while staying Arkiv-native.
 */

import { eq, and } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";

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
 * Create or update a notification preference
 * 
 * Stores read/unread state for a specific notification as an Arkiv entity.
 */
export async function upsertNotificationPreference({
  wallet,
  notificationId,
  notificationType,
  read,
  archived = false,
  privateKey,
  spaceId = 'local-dev',
}: {
  wallet: string;
  notificationId: string;
  notificationType: NotificationPreferenceType;
  read: boolean;
  archived?: boolean;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const now = new Date().toISOString();

  // Check if preference already exists
  const existing = await listNotificationPreferences({ 
    wallet, 
    notificationId,
    limit: 1 
  });

  let entityKey: string;
  let txHash: string;

  if (existing.length > 0) {
    // Update existing preference
    const existingPref = existing[0];
    const payload = {
      read,
      archived,
      updatedAt: now,
    };

    const result = await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'notification_preference' },
        { key: 'wallet', value: wallet.toLowerCase() },
        { key: 'notificationId', value: notificationId },
        { key: 'notificationType', value: notificationType },
        { key: 'read', value: String(read) },
        { key: 'archived', value: String(archived) },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: existingPref.createdAt },
        { key: 'updatedAt', value: now },
      ],
      expiresIn: 31536000, // 1 year
    });
    entityKey = result.entityKey;
    txHash = result.txHash;
  } else {
    // Create new preference
    const payload = {
      read,
      archived,
      createdAt: now,
      updatedAt: now,
    };

    const result = await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'notification_preference' },
        { key: 'wallet', value: wallet.toLowerCase() },
        { key: 'notificationId', value: notificationId },
        { key: 'notificationType', value: notificationType },
        { key: 'read', value: String(read) },
        { key: 'archived', value: String(archived) },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: now },
        { key: 'updatedAt', value: now },
      ],
      expiresIn: 31536000, // 1 year
    });
    entityKey = result.entityKey;
    txHash = result.txHash;
  }

  return { key: entityKey, txHash };
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
  limit = 1000,
}: {
  wallet?: string;
  notificationId?: string;
  notificationType?: NotificationPreferenceType;
  read?: boolean;
  archived?: boolean;
  limit?: number;
} = {}): Promise<NotificationPreference[]> {
  try {
    const publicClient = getPublicClient();
    
    const query = publicClient.buildQuery()
      .where(eq('type', 'notification_preference'))
      .withAttributes(true)
      .withPayload(true)
      .limit(limit);

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

