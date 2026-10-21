/**
 * Garden Note CRUD helpers
 *
 * Public Garden Bulletin - short, playful messages pinned to the shared "garden wall"
 *
 * Features:
 * - Public by design (anyone can read)
 * - On-chain / on-Arkiv (stored as Arkiv entity, immutable-ish, auditable)
 * - Educational (every step shows this is data you're publishing, not a DM)
 *
 * Based on existing Arkiv entity patterns.
 */

import { eqAttr } from '@/lib/arkiv/schema';
import {
  arkivSelect,
  fetchAll,
  getAttr as readAttr,
  getEntityByKey,
  parsePayload,
} from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { addSignerMetadata } from './signer-metadata';
import { createArkivEntity } from './write';
import { SPACE_ID } from '@/lib/config';

export const GARDEN_NOTE_MAX_LENGTH = 500; // Max message length
export const GARDEN_NOTE_DAILY_LIMIT = 10; // Max notes per profile per day
export const GARDEN_NOTE_TTL_SECONDS = 31536000; // Legacy constant; entity lifetime now comes from schema.ts (garden_note)

export type GardenNote = {
  key: string;
  authorWallet: string;
  targetWallet?: string; // Optional: for "note to a specific profile" use-case
  message: string;
  tags: string[]; // Array of tag strings (e.g. ["#gratitude", "#looking-for-mentor"])
  channel: string; // "public_garden_board"
  visibility: string; // "public"
  publishConsent: boolean; // Must be explicit; default false
  moderationState?: string; // "active" | "hidden_by_moderator"
  replyToNoteId?: string; // Optional: for threaded comments
  spaceId: string;
  createdAt: string;
  txHash?: string;
};

/**
 * Create a garden note (public bulletin)
 *
 * @param data - Garden note data
 * @param privateKey - Private key for signing
 * @returns Entity key and transaction hash
 */
export async function createGardenNote({
  authorWallet,
  targetWallet,
  message,
  tags = [],
  replyToNoteId,
  privateKey,
  spaceId = SPACE_ID,
  publishConsent = false,
}: {
  authorWallet: string;
  targetWallet?: string;
  message: string;
  tags?: string[];
  replyToNoteId?: string;
  privateKey: `0x${string}`;
  spaceId?: string;
  publishConsent?: boolean;
}): Promise<{ key: string; txHash: string }> {
  // Validate message length
  if (!message || message.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }
  if (message.length > GARDEN_NOTE_MAX_LENGTH) {
    throw new Error(`Message cannot exceed ${GARDEN_NOTE_MAX_LENGTH} characters`);
  }

  // Validate publish consent (must be explicit)
  if (!publishConsent) {
    throw new Error('Publish consent must be explicitly granted');
  }

  // Normalize tags (remove # if present, lowercase)
  const normalizedTags = tags
    .map((tag) => tag.replace(/^#/, '').trim().toLowerCase())
    .filter((tag) => tag.length > 0);

  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const createdAt = new Date().toISOString();
  const channel = 'public_garden_board';
  const visibility = 'public';
  const moderationState = 'active';

  // Attributes: short, queryable fields only (message and tags live in the payload)
  // Add signer metadata (U1.x.2: Central Signer Metadata)
  const attributes = addSignerMetadata(
    {
      author_wallet: authorWallet.toLowerCase(),
      channel,
      visibility,
      publish_consent: String(publishConsent),
      moderation_state: moderationState,
      space_id: spaceId,
      created_at: createdAt,
      target_wallet: targetWallet ? targetWallet.toLowerCase() : undefined,
      reply_to_note_id: replyToNoteId,
    },
    privateKey
  );

  const result = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: 'garden_note',
      attributes,
      payload: {
        message: message.trim(),
        tags: normalizedTags,
        createdAt,
      },
    });
  });

  const { entityKey, txHash } = result;

  // Structured logging (U1.x.1: Explorer Independence)
  const { logEntityWrite } = await import('./write-logging');
  logEntityWrite({
    entityType: 'garden_note',
    entityKey,
    txHash,
    wallet: authorWallet.toLowerCase(),
    timestamp: createdAt,
    operation: 'create',
    spaceId,
  });

  // Create separate txhash entity (following existing pattern)
  createArkivEntity(walletClient, {
    type: 'garden_note_txhash',
    attributes: {
      garden_note_key: entityKey,
      author_wallet: authorWallet.toLowerCase(),
      space_id: spaceId,
    },
    payload: { txHash },
  }).catch((error: any) => {
    console.warn('[createGardenNote] Failed to create garden_note_txhash entity:', error);
  });

  // Create notifications for all profiles when a new public garden note is created
  // This notifies everyone about new messages on the public board
  try {
    const { createNotification } = await import('./notifications');
    const { listUserProfiles } = await import('./profile');

    // Get all profiles to notify
    const allProfiles = await listUserProfiles();
    const uniqueWallets = new Set<string>();
    allProfiles.forEach((profile) => {
      // Ensure wallet is normalized and not empty
      const wallet = profile.wallet?.trim();
      if (wallet && wallet.length > 0) {
        uniqueWallets.add(wallet.toLowerCase());
      }
    });

    // Create notification for each profile (excluding the author for 'new_garden_note' type)
    const authorWalletLower = authorWallet.toLowerCase();
    const notificationPromises = Array.from(uniqueWallets)
      .filter((wallet) => wallet !== authorWalletLower)
      .map((wallet) =>
        createNotification({
          wallet,
          notificationType: 'new_garden_note',
          sourceEntityType: 'garden_note',
          sourceEntityKey: entityKey,
          title: 'New Message on Public Board',
          message:
            message.trim().length > 100 ? message.trim().substring(0, 100) + '...' : message.trim(),
          link: '/garden/public-board',
          metadata: {
            gardenNoteKey: entityKey,
            authorWallet: authorWallet.toLowerCase(),
            message: message.trim(),
            tags: normalizedTags,
            createdAt,
            txHash,
          },
          privateKey,
          spaceId,
        }).catch((err: any) => {
          console.warn(`[createGardenNote] Failed to create notification for ${wallet}:`, err);
        })
      );

    // Create notification for the author (confirmation that their note was posted)
    const authorNotificationPromise = createNotification({
      wallet: authorWalletLower,
      notificationType: 'entity_created',
      sourceEntityType: 'garden_note',
      sourceEntityKey: entityKey,
      title: 'Garden Note Posted',
      message: targetWallet
        ? 'You posted a garden note'
        : 'You posted a garden note to the public board',
      link: targetWallet ? `/profiles/${targetWallet}` : '/garden/public-board',
      metadata: {
        gardenNoteKey: entityKey,
        targetWallet: targetWallet || undefined,
        tags: normalizedTags,
        createdAt,
        txHash,
      },
      privateKey,
      spaceId,
    }).catch((err: any) => {
      console.warn(
        `[createGardenNote] Failed to create notification for author ${authorWalletLower}:`,
        err
      );
    });

    // Add author notification to the promises array
    notificationPromises.push(authorNotificationPromise);

    // Don't wait for all notifications - fire and forget (non-blocking)
    Promise.all(notificationPromises).catch((err: any) => {
      console.warn('[createGardenNote] Some notifications failed to create:', err);
    });
  } catch (err: any) {
    // Notification creation failure shouldn't block garden note creation
    console.warn('[createGardenNote] Error creating notifications:', err);
  }

  return { key: entityKey, txHash };
}

/**
 * List garden notes
 *
 * @param params - Optional filters (channel, targetWallet, authorWallet, tags, spaceId, spaceIds)
 * @returns Array of garden notes
 */
export async function listGardenNotes({
  channel = 'public_garden_board',
  targetWallet,
  authorWallet,
  tags,
  spaceId,
  spaceIds,
  limit = 100,
}: {
  channel?: string;
  targetWallet?: string;
  authorWallet?: string;
  tags?: string[];
  spaceId?: string;
  spaceIds?: string[];
  limit?: number;
} = {}): Promise<GardenNote[]> {
  const publicClient = getPublicClient();
  const notes: GardenNote[] = [];

  try {
    // Query by type and channel
    let queryBuilder = arkivSelect('garden_note', publicClient)
      .where(eqAttr('channel', channel))
      .where(eqAttr('moderation_state', 'active')); // Only show active notes

    // Filter by author server-side so small limits (e.g. daily limit check) see the author's notes
    if (authorWallet) {
      queryBuilder = queryBuilder.where(eqAttr('author_wallet', authorWallet.toLowerCase()));
    }

    // Support multiple spaceIds (builder mode) or single spaceId
    if (spaceIds && spaceIds.length > 0) {
      // Query all, filter client-side (OR queries are not used here)
    } else {
      // Use provided spaceId or default to SPACE_ID from config
      const finalSpaceId = spaceId || SPACE_ID;
      queryBuilder = queryBuilder.where(eqAttr('space_id', finalSpaceId));
    }

    const result = await fetchAll(queryBuilder, limit, publicClient);
    let entities = result?.entities || [];

    // Filter by spaceIds client-side if multiple requested
    if (spaceIds && spaceIds.length > 0) {
      entities = entities.filter((entity: any) => {
        const spaceIdAttr = readAttr(entity, 'space_id') || SPACE_ID;
        return spaceIds.includes(spaceIdAttr);
      });
    }

    for (const entity of entities) {
      try {
        const payload = parsePayload(entity);

        // Extract attributes (strings; wallets lowercase)
        const authorWalletAttr = readAttr(entity, 'author_wallet');
        const targetWalletAttr = readAttr(entity, 'target_wallet');
        // Tags: payload array (current), CSV attribute (legacy)
        const tagsAttr = Array.isArray(payload.tags)
          ? payload.tags.join(',')
          : readAttr(entity, 'tags');
        const replyToNoteIdAttr = readAttr(entity, 'reply_to_note_id');
        const createdAtAttr = readAttr(entity, 'created_at') || payload.createdAt || '';
        const spaceIdAttr = readAttr(entity, 'space_id') || SPACE_ID;

        // Apply filters
        if (targetWallet) {
          // When filtering by targetWallet, only show notes that have a matching targetWallet
          // Notes without a targetWallet (public notes) should be excluded
          if (!targetWalletAttr) {
            continue; // Skip notes without a targetWallet when filtering by targetWallet
          }
          const targetWalletStr = String(targetWalletAttr);
          if (targetWalletStr.toLowerCase() !== targetWallet.toLowerCase()) {
            continue;
          }
        }
        if (authorWallet && authorWalletAttr.toLowerCase() !== authorWallet.toLowerCase()) {
          continue;
        }
        if (tags && tags.length > 0) {
          const noteTags = tagsAttr.split(',').map((t: string) => t.trim().toLowerCase());
          const hasMatchingTag = tags.some((tag) =>
            noteTags.includes(tag.replace(/^#/, '').trim().toLowerCase())
          );
          if (!hasMatchingTag) {
            continue;
          }
        }

        // Parse tags array
        const noteTags = tagsAttr
          ? tagsAttr
              .split(',')
              .map((t: string) => t.trim())
              .filter((t: string) => t.length > 0)
          : [];

        notes.push({
          key: entity.key,
          authorWallet: authorWalletAttr,
          targetWallet: targetWalletAttr ? String(targetWalletAttr) : undefined,
          message: payload.message || '',
          tags: noteTags,
          channel,
          visibility: 'public',
          publishConsent: true, // Only published notes are in the system
          moderationState: 'active',
          replyToNoteId: replyToNoteIdAttr ? String(replyToNoteIdAttr) : undefined,
          spaceId: spaceIdAttr,
          createdAt: createdAtAttr,
        });
      } catch (err) {
        console.error(`Error parsing garden note entity ${entity.key}:`, err);
        continue;
      }
    }
  } catch (error) {
    console.error('Error listing garden notes:', error);
    throw error;
  }

  // Sort by createdAt (newest first)
  return notes.sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return timeB - timeA;
  });
}

/**
 * Get a single garden note by key
 */
export async function getGardenNoteByKey(key: string): Promise<GardenNote | null> {
  const publicClient = getPublicClient();

  try {
    const entity = await getEntityByKey(key, publicClient);
    if (!entity || readAttr(entity, 'type') !== 'garden_note') return null;

    const payload = parsePayload(entity);

    const authorWalletAttr = readAttr(entity, 'author_wallet');
    const targetWalletAttr = readAttr(entity, 'target_wallet');
    // Tags: payload array (current), CSV attribute (legacy)
    const tagsAttr = Array.isArray(payload.tags)
      ? payload.tags.join(',')
      : readAttr(entity, 'tags');
    const replyToNoteIdAttr = readAttr(entity, 'reply_to_note_id');
    const createdAtAttr = readAttr(entity, 'created_at') || payload.createdAt || '';
    const spaceIdAttr = readAttr(entity, 'space_id') || SPACE_ID;
    const channelAttr = readAttr(entity, 'channel') || 'public_garden_board';

    const noteTags = tagsAttr
      ? tagsAttr
          .split(',')
          .map((t: string) => t.trim())
          .filter((t: string) => t.length > 0)
      : [];

    return {
      key: entity.key,
      authorWallet: authorWalletAttr,
      targetWallet: targetWalletAttr ? String(targetWalletAttr) : undefined,
      message: payload.message || '',
      tags: noteTags,
      channel: channelAttr,
      visibility: 'public',
      publishConsent: true,
      moderationState: 'active',
      replyToNoteId: replyToNoteIdAttr ? String(replyToNoteIdAttr) : undefined,
      spaceId: spaceIdAttr,
      createdAt: createdAtAttr,
    };
  } catch (error) {
    console.error(`Error getting garden note ${key}:`, error);
    return null;
  }
}

/**
 * Check if user has exceeded daily limit
 *
 * @param authorWallet - Wallet address to check
 * @returns True if user has exceeded daily limit
 */
export async function hasExceededDailyLimit(authorWallet: string): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const notes = await listGardenNotes({
    authorWallet,
    limit: GARDEN_NOTE_DAILY_LIMIT + 1, // Get one extra to check if limit exceeded
  });

  // Count notes created today
  const todayNotes = notes.filter((note) => {
    const noteDate = new Date(note.createdAt);
    return noteDate >= today;
  });

  return todayNotes.length >= GARDEN_NOTE_DAILY_LIMIT;
}
