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
  spaceId: string;
  createdAt: string;
  txHash?: string;
}

/**
 * Create app feedback
 */
export async function createAppFeedback({
  wallet,
  page,
  message,
  rating,
  privateKey,
  spaceId = 'local-dev',
}: {
  wallet: string;
  page: string;
  message: string;
  rating?: number;
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

  const payload = {
    message: message.trim(),
    rating: rating || undefined,
    createdAt,
  };

  // App feedback should persist (1 year) for admin review
  const expiresIn = 31536000; // 1 year in seconds

  const { entityKey, txHash } = await walletClient.createEntity({
    payload: enc.encode(JSON.stringify(payload)),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'app_feedback' },
      { key: 'wallet', value: wallet },
      { key: 'page', value: page },
      { key: 'spaceId', value: spaceId },
      { key: 'createdAt', value: createdAt },
      ...(rating ? [{ key: 'rating', value: String(rating) }] : []),
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
}: {
  page?: string;
  wallet?: string;
  limit?: number;
  since?: string;
} = {}): Promise<AppFeedback[]> {
  const publicClient = getPublicClient();
  const result = await publicClient.buildQuery()
    .where(eq('type', 'app_feedback'))
    .withAttributes(true)
    .withPayload(true)
    .limit(limit || 100)
    .fetch();

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

    return {
      key: entity.key,
      wallet: getAttr('wallet'),
      page: getAttr('page'),
      message: payload.message || '',
      rating: payload.rating || (getAttr('rating') ? parseInt(getAttr('rating'), 10) : undefined),
      spaceId: getAttr('spaceId') || 'local-dev',
      createdAt: getAttr('createdAt'),
      txHash: entity.txHash || undefined,
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

  // Filter by since date if provided
  if (since) {
    const sinceTime = new Date(since).getTime();
    feedbacks = feedbacks.filter(f => new Date(f.createdAt).getTime() >= sinceTime);
  }

  // Sort by most recent first
  return feedbacks.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

