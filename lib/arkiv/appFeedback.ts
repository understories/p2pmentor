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
import { listAdminResponses } from "./adminResponse";

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

  // Validate: either message OR rating must be provided (at least one)
  const hasMessage = message && message.trim().length > 0;
  const hasRating = rating !== undefined && rating >= 1 && rating <= 5;
  if (!hasMessage && !hasRating) {
    throw new Error('Either a rating or feedback message is required');
  }

  // App feedback should persist (1 year) for admin review
  const expiresIn = 31536000; // 1 year in seconds

  const { entityKey, txHash } = await walletClient.createEntity({
    payload: enc.encode(JSON.stringify({
      message: hasMessage ? message.trim() : undefined, // Allow empty if rating provided
      rating: hasRating ? rating : undefined,
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

  // Create notification for the user who submitted the feedback (tied to their profile wallet)
  // This confirms their feedback/issue was successfully submitted
  try {
    const { createNotification } = await import('./notifications');
    
    // Build notification message from feedback data
    const feedbackPreview = hasMessage 
      ? (message.trim().length > 100 ? message.trim().substring(0, 100) + '...' : message.trim())
      : `Rating: ${rating}/5`;
    
    const notificationTitle = feedbackType === 'issue' 
      ? 'Issue Reported' 
      : 'Feedback Submitted';
    
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

  // Get feedback to find the user wallet
  try {
    const publicClient = getPublicClient();
    const result = await publicClient.buildQuery()
      .where(eq('type', 'app_feedback'))
      .withAttributes(true)
      .withPayload(true)
      .limit(1000)
      .fetch();
    
    if (result?.entities && Array.isArray(result.entities)) {
      const feedbackEntity = result.entities.find((e: any) => e.key === feedbackKey);
      if (feedbackEntity) {
        const attrs = feedbackEntity.attributes || {};
        const getAttr = (key: string): string => {
          if (Array.isArray(attrs)) {
            const attr = attrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(attrs[key] || '');
        };
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
    const fetchLimit = limit && limit < 50 ? Math.max(limit * 10, 100) : (limit || 100);

    // Fetch feedback entities, txHash entities, and resolution entities in parallel
    const [result, txHashResult, resolutionResult] = await Promise.all([
      publicClient.buildQuery()
        .where(eq('type', 'app_feedback'))
        .withAttributes(true)
        .withPayload(true)
        .limit(fetchLimit)
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
    const response = responseMap[feedbackKey];

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
      hasResponse: !!response,
      responseAt: response?.responseAt,
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
    // Query by key using where clause
    const result = await publicClient.buildQuery()
      .where(eq('type', 'app_feedback'))
      .where(eq('key', key))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch();

    if (!result || !result.entities || result.entities.length === 0) {
      return null;
    }

    const entity = result.entities[0];
    
    // Fetch txHash, resolution, and response in parallel
    const [txHashResult, resolutionResult] = await Promise.all([
      publicClient.buildQuery()
        .where(eq('type', 'app_feedback_txhash'))
        .where(eq('feedbackKey', key))
        .withAttributes(true)
        .withPayload(true)
        .limit(1)
        .fetch(),
      publicClient.buildQuery()
        .where(eq('type', 'app_feedback_resolution'))
        .where(eq('feedbackKey', key))
        .withAttributes(true)
        .withPayload(true)
        .limit(1)
        .fetch(),
    ]);

    // Build txHash
    let txHash: string | undefined;
    if (txHashResult?.entities && Array.isArray(txHashResult.entities) && txHashResult.entities.length > 0) {
      try {
        const txHashEntity = txHashResult.entities[0];
        const txHashPayload = txHashEntity.payload instanceof Uint8Array
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
    if (resolutionResult?.entities && Array.isArray(resolutionResult.entities) && resolutionResult.entities.length > 0) {
      try {
        const resolutionEntity = resolutionResult.entities[0];
        const resolutionAttrs = resolutionEntity.attributes || {};
        const getResolutionAttr = (key: string): string => {
          if (Array.isArray(resolutionAttrs)) {
            const attr = resolutionAttrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(resolutionAttrs[key] || '');
        };
        resolution = {
          resolvedAt: getResolutionAttr('resolvedAt'),
          resolvedBy: getResolutionAttr('resolvedBy'),
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

    return {
      key: entity.key,
      wallet: getAttr('wallet'),
      page: getAttr('page'),
      message: payload.message || '',
      rating: payload.rating || (getAttr('rating') ? parseInt(getAttr('rating'), 10) : undefined),
      feedbackType: (getAttr('feedbackType') || 'feedback') as 'feedback' | 'issue',
      spaceId: getAttr('spaceId') || 'local-dev',
      createdAt: getAttr('createdAt'),
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

