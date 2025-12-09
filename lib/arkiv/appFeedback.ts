/**
 * App Feedback CRUD helpers
 * 
 * Handles user feedback about the app itself (for builders/admin).
 * Separate from session feedback (peer-to-peer).
 * 
 * Reference: refs/docs/sprint2.md Section 4.1
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";

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
}

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
  spaceId = 'local-dev',
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
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();

  // Validate rating if provided
  if (rating !== undefined && (rating < 1 || rating > 5)) {
    throw new Error('Rating must be between 1 and 5');
  }

  // Validate message is not empty
  if (!message || message.trim().length === 0) {
    throw new Error('Feedback message is required');
  }

  // App feedback should persist (1 year) for admin review
  const expiresIn = 31536000; // 1 year in seconds

  const { entityKey, txHash } = await walletClient.createEntity({
    payload: enc.encode(JSON.stringify({
      message: message.trim(),
      rating: rating || undefined,
      createdAt,
    })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'app_feedback' },
      { key: 'wallet', value: wallet.toLowerCase() },
      { key: 'page', value: page },
      { key: 'feedbackType', value: feedbackType }, // 'feedback' or 'issue'
      { key: 'spaceId', value: spaceId },
      { key: 'createdAt', value: createdAt },
      ...(rating ? [{ key: 'rating', value: String(rating) }] : []),
    ],
    expiresIn,
  });

  // Store txHash in a separate entity for reliable querying (similar to asks.ts pattern)
  await walletClient.createEntity({
    payload: enc.encode(JSON.stringify({ txHash })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'app_feedback_txhash' },
      { key: 'feedbackKey', value: entityKey },
      { key: 'wallet', value: wallet.toLowerCase() },
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn,
  });

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
  spaceId = 'local-dev',
}: {
  feedbackKey: string;
  resolvedByWallet: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const resolvedAt = new Date().toISOString();

  // Resolution entities should persist as long as the feedback (1 year)
  const expiresIn = 31536000; // 1 year in seconds

  const { entityKey, txHash } = await walletClient.createEntity({
    payload: enc.encode(JSON.stringify({
      resolvedAt,
    })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'app_feedback_resolution' },
      { key: 'feedbackKey', value: feedbackKey },
      { key: 'resolvedBy', value: resolvedByWallet.toLowerCase() },
      { key: 'spaceId', value: spaceId },
      { key: 'createdAt', value: resolvedAt },
    ],
    expiresIn,
  });

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

    // Fetch feedback entities, txHash entities, and resolution entities in parallel
    const [result, txHashResult, resolutionResult] = await Promise.all([
      publicClient.buildQuery()
        .where(eq('type', 'app_feedback'))
        .withAttributes(true)
        .withPayload(true)
        .limit(limit || 100)
        .fetch(),
      publicClient.buildQuery()
        .where(eq('type', 'app_feedback_txhash'))
        .withAttributes(true)
        .withPayload(true)
        .fetch(),
      publicClient.buildQuery()
        .where(eq('type', 'app_feedback_resolution'))
        .withAttributes(true)
        .withPayload(true)
        .fetch(),
    ]);

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.error('Invalid result from Arkiv query:', result);
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
        const feedbackKey = getAttr('feedbackKey');
        try {
          if (entity.payload) {
            const decoded = entity.payload instanceof Uint8Array
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
        const attrs = entity.attributes || {};
        const getAttr = (key: string): string => {
          if (Array.isArray(attrs)) {
            const attr = attrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(attrs[key] || '');
        };
        const feedbackKey = getAttr('feedbackKey');
        try {
          let payload: any = {};
          if (entity.payload) {
            const decoded = entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
              ? entity.payload
              : JSON.stringify(entity.payload);
            payload = JSON.parse(decoded);
          }
          if (feedbackKey) {
            resolutionMap[feedbackKey] = {
              resolvedAt: payload.resolvedAt || getAttr('createdAt') || getAttr('resolvedAt'),
              resolvedBy: payload.resolvedBy || getAttr('resolvedBy'),
            };
          }
        } catch (e) {
          // Ignore decode errors
        }
      });
    }

    let feedbacks = result.entities.map((entity: any) => {
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
      console.error('Error decoding app feedback payload:', e);
    }

    const attrs = entity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };

    const feedbackKey = entity.key;
    const resolution = resolutionMap[feedbackKey];

    return {
      key: feedbackKey,
      wallet: getAttr('wallet'),
      page: getAttr('page'),
      message: payload.message || '',
      rating: payload.rating || (getAttr('rating') ? parseInt(getAttr('rating'), 10) : undefined),
      feedbackType: (getAttr('feedbackType') || 'feedback') as 'feedback' | 'issue',
      spaceId: getAttr('spaceId') || 'local-dev',
      createdAt: getAttr('createdAt'),
      txHash: txHashMap[feedbackKey] || payload.txHash || entity.txHash || undefined,
      resolved: !!resolution,
      resolvedAt: resolution?.resolvedAt,
      resolvedBy: resolution?.resolvedBy,
    };
  });

  // Filter by page if provided
  if (page) {
    feedbacks = feedbacks.filter(f => f.page === page);
  }

  // Filter by wallet if provided
  if (wallet) {
    const normalizedWallet = wallet.toLowerCase();
    feedbacks = feedbacks.filter(f => f.wallet.toLowerCase() === normalizedWallet);
  }

  // Filter by feedbackType if provided
  if (feedbackType) {
    feedbacks = feedbacks.filter(f => f.feedbackType === feedbackType);
  }

  // Filter by since date if provided
  if (since) {
    const sinceTime = new Date(since).getTime();
    feedbacks = feedbacks.filter(f => new Date(f.createdAt).getTime() >= sinceTime);
  }

    // Sort by most recent first
    return feedbacks.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error: any) {
    console.error('Error in listAppFeedback:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    // Always return an array, never null/undefined
    return [];
  }
}

