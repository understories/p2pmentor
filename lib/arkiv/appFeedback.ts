/**
 * App Feedback CRUD helpers
 *
 * Handles user feedback about the app itself (for builders/admin).
 * Separate from session feedback (peer-to-peer).
 *
 * Reference: refs/docs/sprint2.md Section 4.1
 */

import { MAX_ATTR_STRING_BYTES, PROJECT, eqAttr } from '@/lib/arkiv/schema';
import {
  arkivSelect,
  fetchAll,
  getAttr as readAttr,
  getEntityByKey,
  parsePayload,
} from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { createArkivEntity } from './write';
import { listAdminResponses } from './adminResponse';
import { SPACE_ID } from '@/lib/config';
import { handleTransactionWithTimeout } from './transaction-utils';

export type AppFeedback = {
  key: string;
  wallet: string;
  page: string; // Page where feedback was given (e.g., "/network", "/me")
  message: string;
  rating?: number; // Optional 1-5 stars for app experience
  feedbackType?: 'feedback' | 'issue'; // Type of feedback: 'feedback' or 'issue'
  spaceId: string;
  createdAt: string;
  txHash?: string;
  // Resolution tracking (arkiv-native: separate resolution entities)
  resolved?: boolean; // Whether this issue/feedback has been resolved
  resolvedAt?: string; // When it was resolved (ISO timestamp)
  resolvedBy?: string; // Admin wallet that resolved it
  // Response tracking (arkiv-native: query admin_response entities)
  hasResponse?: boolean; // Whether admin has responded to this feedback/issue
  responseAt?: string; // When the response was created (ISO timestamp)
};

/**
 * Create app feedback
 */
export async function createAppFeedback({
  wallet,
  page,
  message,
  rating,
  feedbackType = 'feedback',
  privateKey,
  spaceId = SPACE_ID,
}: {
  wallet: string;
  page: string;
  message: string;
  rating?: number;
  feedbackType?: 'feedback' | 'issue';
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const createdAt = new Date().toISOString();

  // Validate rating if provided
  if (rating !== undefined && (rating < 1 || rating > 5)) {
    throw new Error('Rating must be between 1 and 5');
  }

  // Validate: either message OR rating must be provided (at least one)
  const hasMessage = message && message.trim().length > 0;
  const hasRating = rating !== undefined && rating >= 1 && rating <= 5;
  if (!hasMessage && !hasRating) {
    throw new Error('Either a rating or feedback message is required');
  }

  // App feedback lifetime: type default (see lib/arkiv/schema.ts). app_feedback is readonly:
  // resolutions and responses are separate entities, never patches.
  // The page path is always in the payload; it is also an attribute when it fits (≤ 128 bytes).
  const pageFitsAttr = new TextEncoder().encode(page).length <= MAX_ATTR_STRING_BYTES;
  const { entityKey, txHash } = await createArkivEntity(walletClient, {
    type: 'app_feedback',
    attributes: {
      wallet: wallet.toLowerCase(),
      page: pageFitsAttr ? page : undefined,
      feedback_type: feedbackType, // 'feedback' or 'issue'
      space_id: spaceId,
      created_at: createdAt,
      rating: rating ? String(rating) : undefined,
    },
    payload: {
      message: hasMessage ? message.trim() : undefined, // Allow empty if rating provided
      rating: hasRating ? rating : undefined,
      page,
      createdAt,
    },
  });

  // Store txHash in a separate entity for reliable querying (similar to asks.ts pattern)
  await createArkivEntity(walletClient, {
    type: 'app_feedback_txhash',
    attributes: {
      feedback_key: entityKey,
      wallet: wallet.toLowerCase(),
      space_id: spaceId,
    },
    payload: { txHash },
  });

  // Create notification for the user who submitted the feedback (tied to their profile wallet)
  // This confirms their feedback/issue was successfully submitted
  try {
    const { createNotification } = await import('./notifications');

    // Build notification message from feedback data
    const feedbackPreview = hasMessage
      ? message.trim().length > 100
        ? message.trim().substring(0, 100) + '...'
        : message.trim()
      : `Rating: ${rating}/5`;

    const notificationTitle = feedbackType === 'issue' ? 'Issue Reported' : 'Feedback Submitted';

    await createNotification({
      wallet: wallet.toLowerCase(), // Use profile wallet (user who submitted feedback)
      notificationType: 'app_feedback_submitted',
      sourceEntityType: 'app_feedback',
      sourceEntityKey: entityKey,
      title: notificationTitle,
      message: feedbackPreview,
      link: '/notifications',
      metadata: {
        feedbackKey: entityKey,
        userWallet: wallet.toLowerCase(),
        page,
        message: hasMessage ? message.trim() : undefined,
        rating: hasRating ? rating : undefined,
        feedbackType,
        createdAt,
        txHash,
      },
      privateKey,
      spaceId,
    }).catch((err: any) => {
      console.warn('[createAppFeedback] Failed to create notification:', err);
    });
  } catch (err: any) {
    // Notification creation failure shouldn't block feedback creation
    console.warn('[createAppFeedback] Error creating notification:', err);
  }

  return { key: entityKey, txHash };
}

/**
 * Mark feedback/issue as resolved (arkiv-native)
 *
 * Creates a resolution entity to track that an issue has been resolved.
 * This follows the immutability principle - we don't modify the original entity.
 *
 * @param data - Resolution data
 * @param privateKey - Private key for signing
 * @returns Entity key and transaction hash
 */
export async function resolveAppFeedback({
  feedbackKey,
  resolvedByWallet,
  privateKey,
  spaceId = SPACE_ID,
}: {
  feedbackKey: string;
  resolvedByWallet: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const resolvedAt = new Date().toISOString();

  // Resolution entities use the type default lifetime (see lib/arkiv/schema.ts)
  // Wrap in handleTransactionWithTimeout for graceful timeout handling
  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: 'app_feedback_resolution',
      attributes: {
        feedback_key: feedbackKey,
        resolved_by: resolvedByWallet.toLowerCase(),
        space_id: spaceId,
        created_at: resolvedAt,
      },
      payload: { resolvedAt },
    });
  });

  // Get feedback to find the user wallet
  try {
    const publicClient = getPublicClient();
    const feedbackEntity = await getEntityByKey(feedbackKey, publicClient);

    if (
      feedbackEntity &&
      readAttr(feedbackEntity, 'type') === 'app_feedback' &&
      readAttr(feedbackEntity, 'project') === PROJECT
    ) {
      const getAttr = (key: string): string => readAttr(feedbackEntity, key);
      const userWallet = getAttr('wallet');

      if (userWallet) {
        const { createNotification } = await import('./notifications');
        await createNotification({
          wallet: userWallet.toLowerCase(),
          notificationType: 'issue_resolved',
          sourceEntityType: 'app_feedback',
          sourceEntityKey: feedbackKey,
          title: 'Issue Resolved',
          message: 'Your reported issue has been resolved',
          link: '/notifications',
          metadata: {
            feedbackKey,
            resolutionKey: entityKey,
            resolvedBy: resolvedByWallet.toLowerCase(),
          },
          privateKey,
          spaceId,
        }).catch((err: any) => {
          console.warn('[resolveAppFeedback] Failed to create notification:', err);
        });
      }
    }
  } catch (err: any) {
    // Notification creation failure shouldn't block resolution
    console.warn('[resolveAppFeedback] Error creating notification:', err);
  }

  return { key: entityKey, txHash };
}

/**
 * List app feedback
 */
export async function listAppFeedback({
  page,
  wallet,
  limit = 100,
  since,
  feedbackType,
}: {
  page?: string;
  wallet?: string;
  limit?: number;
  since?: string;
  feedbackType?: 'feedback' | 'issue';
} = {}): Promise<AppFeedback[]> {
  try {
    const publicClient = getPublicClient();

    // For small limits, fetch more entities to ensure we get the most recent ones
    // Arkiv doesn't guarantee order, so we need to fetch more and sort client-side
    const fetchLimit = limit && limit < 50 ? Math.max(limit * 10, 100) : limit || 100;

    // Fetch feedback entities, txHash entities, and resolution entities in parallel
    const [result, txHashResult, resolutionResult] = await Promise.all([
      fetchAll(arkivSelect('app_feedback', publicClient), fetchLimit, publicClient),
      fetchAll(arkivSelect('app_feedback_txhash', publicClient), 1000, publicClient),
      fetchAll(arkivSelect('app_feedback_resolution', publicClient), 1000, publicClient),
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
        const feedbackKey = getAttr('feedback_key');
        try {
          if (entity.payload) {
            const decoded =
              entity.payload instanceof Uint8Array
                ? new TextDecoder().decode(entity.payload)
                : typeof entity.payload === 'string'
                  ? entity.payload
                  : JSON.stringify(entity.payload);
            const payload = JSON.parse(decoded);
            if (payload.txHash && feedbackKey) {
              txHashMap[feedbackKey] = payload.txHash;
            }
          }
        } catch (e) {
          // Ignore decode errors
        }
      });
    }

    // Build resolution map: feedbackKey -> resolution info
    const resolutionMap: Record<string, { resolvedAt: string; resolvedBy: string }> = {};
    if (resolutionResult?.entities && Array.isArray(resolutionResult.entities)) {
      resolutionResult.entities.forEach((entity: any) => {
        const getAttr = (key: string): string => readAttr(entity, key);
        const feedbackKey = getAttr('feedback_key');
        try {
          let payload: any = {};
          if (entity.payload) {
            const decoded =
              entity.payload instanceof Uint8Array
                ? new TextDecoder().decode(entity.payload)
                : typeof entity.payload === 'string'
                  ? entity.payload
                  : JSON.stringify(entity.payload);
            payload = JSON.parse(decoded);
          }
          if (feedbackKey) {
            resolutionMap[feedbackKey] = {
              resolvedAt: payload.resolvedAt || getAttr('created_at') || getAttr('resolved_at'),
              resolvedBy: payload.resolvedBy || getAttr('resolved_by'),
            };
          }
        } catch (e) {
          // Ignore decode errors
        }
      });
    }

    // Build response map: feedbackKey -> response info (arkiv-native: query admin responses)
    // Query all admin responses and map by feedbackKey
    let responseMap: Record<string, { responseAt: string }> = {};
    try {
      const allResponses = await listAdminResponses({ limit: 1000 }); // Get all responses
      allResponses.forEach((response) => {
        if (response.feedbackKey) {
          responseMap[response.feedbackKey] = {
            responseAt: response.createdAt,
          };
        }
      });
    } catch (error) {
      console.error('[listAppFeedback] Error querying admin responses:', error);
      // Continue without response data - don't fail the entire query
    }

    let feedbacks = result.entities.map((entity: any) => {
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
        console.error('Error decoding app feedback payload:', e);
      }

      const getAttr = (key: string): string => readAttr(entity, key);

      const feedbackKey = entity.key;
      const resolution = resolutionMap[feedbackKey];
      const response = responseMap[feedbackKey];

      return {
        key: feedbackKey,
        wallet: getAttr('wallet'),
        page: payload.page || getAttr('page'),
        message: payload.message || '',
        rating: payload.rating || (getAttr('rating') ? parseInt(getAttr('rating'), 10) : undefined),
        feedbackType: (getAttr('feedback_type') || 'feedback') as 'feedback' | 'issue',
        spaceId: getAttr('space_id') || SPACE_ID,
        createdAt: getAttr('created_at'),
        txHash: txHashMap[feedbackKey] || payload.txHash || entity.txHash || undefined,
        resolved: !!resolution,
        resolvedAt: resolution?.resolvedAt,
        resolvedBy: resolution?.resolvedBy,
        hasResponse: !!response,
        responseAt: response?.responseAt,
      };
    });

    // Filter by page if provided
    if (page) {
      feedbacks = feedbacks.filter((f) => f.page === page);
    }

    // Filter by wallet if provided
    if (wallet) {
      const normalizedWallet = wallet.toLowerCase();
      feedbacks = feedbacks.filter((f) => f.wallet.toLowerCase() === normalizedWallet);
    }

    // Filter by feedbackType if provided
    if (feedbackType) {
      feedbacks = feedbacks.filter((f) => f.feedbackType === feedbackType);
    }

    // Filter by since date if provided
    if (since) {
      const sinceTime = new Date(since).getTime();
      feedbacks = feedbacks.filter((f) => new Date(f.createdAt).getTime() >= sinceTime);
    }

    // Sort by most recent first (by createdAt descending)
    feedbacks.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime; // Most recent first
    });

    // Apply limit after sorting to ensure we get the most recent N items
    if (limit && limit > 0) {
      feedbacks = feedbacks.slice(0, limit);
    }

    return feedbacks;
  } catch (error: any) {
    console.error('Error in listAppFeedback:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    // Always return an array, never null/undefined
    return [];
  }
}

/**
 * Get a single app feedback by key
 *
 * @param key - App feedback entity key
 * @returns AppFeedback or null if not found
 */
export async function getAppFeedbackByKey(key: string): Promise<AppFeedback | null> {
  const publicClient = getPublicClient();

  try {
    const entity = await getEntityByKey(key, publicClient);
    if (
      !entity ||
      readAttr(entity, 'type') !== 'app_feedback' ||
      readAttr(entity, 'project') !== PROJECT
    ) {
      return null;
    }

    // Fetch txHash, resolution, and response in parallel
    const [txHashResult, resolutionResult] = await Promise.all([
      arkivSelect(undefined, publicClient)
        .where(eqAttr('type', 'app_feedback_txhash'))
        .where(eqAttr('feedback_key', key))
        .limit(1)
        .fetch(),
      arkivSelect(undefined, publicClient)
        .where(eqAttr('type', 'app_feedback_resolution'))
        .where(eqAttr('feedback_key', key))
        .limit(1)
        .fetch(),
    ]);

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

    // Build resolution
    let resolution: { resolvedAt: string; resolvedBy: string } | undefined;
    if (
      resolutionResult?.entities &&
      Array.isArray(resolutionResult.entities) &&
      resolutionResult.entities.length > 0
    ) {
      try {
        const resolutionEntity = resolutionResult.entities[0];
        const resolutionPayload = parsePayload(resolutionEntity);
        resolution = {
          resolvedAt:
            resolutionPayload.resolvedAt ||
            readAttr(resolutionEntity, 'created_at') ||
            readAttr(resolutionEntity, 'resolved_at'),
          resolvedBy: resolutionPayload.resolvedBy || readAttr(resolutionEntity, 'resolved_by'),
        };
      } catch (e) {
        console.error('Error decoding resolution:', e);
      }
    }

    // Check for admin response
    let hasResponse = false;
    let responseAt: string | undefined;
    try {
      const { listAdminResponses } = await import('./adminResponse');
      const responses = await listAdminResponses({ feedbackKey: key, limit: 1 });
      if (responses.length > 0) {
        hasResponse = true;
        responseAt = responses[0].createdAt;
      }
    } catch (error) {
      console.error('Error loading admin response:', error);
      // Continue without response data - don't fail the entire query
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
      console.error('Error decoding app feedback payload:', e);
    }

    const getAttr = (key: string): string => readAttr(entity, key);

    return {
      key: entity.key,
      wallet: getAttr('wallet'),
      page: payload.page || getAttr('page'),
      message: payload.message || '',
      rating: payload.rating || (getAttr('rating') ? parseInt(getAttr('rating'), 10) : undefined),
      feedbackType: (getAttr('feedback_type') || 'feedback') as 'feedback' | 'issue',
      spaceId: getAttr('space_id') || SPACE_ID,
      createdAt: getAttr('created_at'),
      txHash: txHash || payload.txHash || undefined,
      resolved: !!resolution,
      resolvedAt: resolution?.resolvedAt,
      resolvedBy: resolution?.resolvedBy,
      hasResponse,
      responseAt,
    };
  } catch (error: any) {
    console.error(`Error getting app feedback by key ${key}:`, error);
    return null;
  }
}
