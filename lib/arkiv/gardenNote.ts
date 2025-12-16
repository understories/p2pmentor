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

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { handleTransactionWithTimeout } from "./transaction-utils";

export const GARDEN_NOTE_MAX_LENGTH = 500; // Max message length
export const GARDEN_NOTE_DAILY_LIMIT = 10; // Max notes per profile per day
export const GARDEN_NOTE_TTL_SECONDS = 31536000; // 1 year (or no TTL for permanent)

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
}

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
  spaceId = 'local-dev',
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
    .map(tag => tag.replace(/^#/, '').trim().toLowerCase())
    .filter(tag => tag.length > 0);

  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();
  const channel = 'public_garden_board';
  const visibility = 'public';
  const moderationState = 'active';

  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({
        message: message.trim(),
        tags: normalizedTags,
        createdAt,
      })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'garden_note' },
        { key: 'authorWallet', value: authorWallet.toLowerCase() },
        { key: 'channel', value: channel },
        { key: 'visibility', value: visibility },
        { key: 'publishConsent', value: String(publishConsent) },
        { key: 'moderationState', value: moderationState },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
        ...(targetWallet ? [{ key: 'targetWallet', value: targetWallet.toLowerCase() }] : []),
        ...(replyToNoteId ? [{ key: 'replyToNoteId', value: replyToNoteId }] : []),
        ...(normalizedTags.length > 0 ? [{ key: 'tags', value: normalizedTags.join(',') }] : []),
      ],
      expiresIn: GARDEN_NOTE_TTL_SECONDS, // 1 year TTL (or could be undefined for permanent)
    });
  });

  const { entityKey, txHash } = result;

  // Create separate txhash entity (following existing pattern)
  walletClient.createEntity({
    payload: enc.encode(JSON.stringify({
      txHash,
    })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'garden_note_txhash' },
      { key: 'gardenNoteKey', value: entityKey },
      { key: 'authorWallet', value: authorWallet.toLowerCase() },
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn: GARDEN_NOTE_TTL_SECONDS,
  });

  // Create notifications for all profiles when a new public garden note is created
  // This notifies everyone about new messages on the public board
  try {
    const { createNotification } = await import('./notifications');
    const { listUserProfiles } = await import('./profile');
    
    // Get all profiles to notify
    const allProfiles = await listUserProfiles();
    const uniqueWallets = new Set<string>();
    allProfiles.forEach(profile => {
      // Ensure wallet is normalized and not empty
      const wallet = profile.wallet?.trim();
      if (wallet && wallet.length > 0) {
        uniqueWallets.add(wallet.toLowerCase());
      }
    });

    // Create notification for each profile (excluding the author for 'new_garden_note' type)
    const authorWalletLower = authorWallet.toLowerCase();
    const notificationPromises = Array.from(uniqueWallets)
      .filter(wallet => wallet !== authorWalletLower)
      .map(wallet => 
        createNotification({
          wallet,
          notificationType: 'new_garden_note',
          sourceEntityType: 'garden_note',
          sourceEntityKey: entityKey,
          title: 'New Message on Public Board',
          message: message.trim().length > 100 
            ? message.trim().substring(0, 100) + '...' 
            : message.trim(),
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
      console.warn(`[createGardenNote] Failed to create notification for author ${authorWalletLower}:`, err);
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
 * @param params - Optional filters (channel, targetWallet, authorWallet, tags)
 * @returns Array of garden notes
 */
export async function listGardenNotes({
  channel = 'public_garden_board',
  targetWallet,
  authorWallet,
  tags,
  limit = 100,
}: {
  channel?: string;
  targetWallet?: string;
  authorWallet?: string;
  tags?: string[];
  limit?: number;
} = {}): Promise<GardenNote[]> {
  const publicClient = getPublicClient();
  const notes: GardenNote[] = [];

  try {
    // Query by type and channel
    const queryBuilder = publicClient.buildQuery()
      .where(eq('type', 'garden_note'))
      .where(eq('channel', channel))
      .where(eq('moderationState', 'active')) // Only show active notes
      .withAttributes(true)
      .withPayload(true)
      .limit(limit);

    const result = await queryBuilder.fetch();
    const entities = result?.entities || [];

    for (const entity of entities) {
      try {
        const payload = JSON.parse(new TextDecoder().decode(entity.payload));
        const attributes = entity.attributes || [];

        // Extract attributes (convert to string if needed)
        const authorWalletAttr = String(attributes.find((a: any) => a.key === 'authorWallet')?.value || '');
        const targetWalletAttr = attributes.find((a: any) => a.key === 'targetWallet')?.value;
        const tagsAttr = String(attributes.find((a: any) => a.key === 'tags')?.value || '');
        const replyToNoteIdAttr = attributes.find((a: any) => a.key === 'replyToNoteId')?.value;
        const createdAtAttr = String(attributes.find((a: any) => a.key === 'createdAt')?.value || '');
        const spaceIdAttr = String(attributes.find((a: any) => a.key === 'spaceId')?.value || 'local-dev');

        // Apply filters
        if (targetWallet && targetWalletAttr) {
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
          const hasMatchingTag = tags.some(tag => 
            noteTags.includes(tag.replace(/^#/, '').trim().toLowerCase())
          );
          if (!hasMatchingTag) {
            continue;
          }
        }

        // Parse tags array
        const noteTags = tagsAttr ? tagsAttr.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [];

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
    const entity = await publicClient.getEntity(key as `0x${string}`);
    if (!entity) return null;

    const payload = JSON.parse(new TextDecoder().decode(entity.payload));
    const attributes = entity.attributes || [];

    const authorWalletAttr = String(attributes.find((a: any) => a.key === 'authorWallet')?.value || '');
    const targetWalletAttr = attributes.find((a: any) => a.key === 'targetWallet')?.value;
    const tagsAttr = String(attributes.find((a: any) => a.key === 'tags')?.value || '');
    const replyToNoteIdAttr = attributes.find((a: any) => a.key === 'replyToNoteId')?.value;
    const createdAtAttr = String(attributes.find((a: any) => a.key === 'createdAt')?.value || '');
    const spaceIdAttr = String(attributes.find((a: any) => a.key === 'spaceId')?.value || 'local-dev');
    const channelAttr = String(attributes.find((a: any) => a.key === 'channel')?.value || 'public_garden_board');

    const noteTags = tagsAttr ? tagsAttr.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [];

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
  const todayNotes = notes.filter(note => {
    const noteDate = new Date(note.createdAt);
    return noteDate >= today;
  });

  return todayNotes.length >= GARDEN_NOTE_DAILY_LIMIT;
}

