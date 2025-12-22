/**
 * Feedback CRUD helpers
 * 
 * Handles post-session feedback (ratings, notes, technical DX feedback).
 * 
 * Based on mentor-graph patterns.
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { SPACE_ID } from "@/lib/config";

export type Feedback = {
  key: string;
  sessionKey: string;
  mentorWallet: string;
  learnerWallet: string;
  feedbackFrom: string; // Wallet of person giving feedback
  feedbackTo: string; // Wallet of person receiving feedback
  rating?: number; // 1-5 stars
  notes?: string; // Qualitative feedback
  technicalDxFeedback?: string; // Technical developer experience feedback
  spaceId: string;
  createdAt: string;
  txHash?: string;
}

/**
 * Check if user has already given feedback for a session
 */
export async function hasUserGivenFeedbackForSession(
  sessionKey: string,
  feedbackFrom: string
): Promise<boolean> {
  const feedbacks = await listFeedbackForSession(sessionKey);
  const normalizedFrom = feedbackFrom.toLowerCase();
  return feedbacks.some(f => f.feedbackFrom.toLowerCase() === normalizedFrom);
}

/**
 * Create feedback for a session
 * 
 * Validates:
 * - Session must be confirmed (both mentor and learner confirmed)
 * - User must be a participant
 * - User cannot give feedback to themselves
 * - User cannot give duplicate feedback
 */
export async function createFeedback({
  sessionKey,
  mentorWallet,
  learnerWallet,
  feedbackFrom,
  feedbackTo,
  rating,
  notes,
  technicalDxFeedback,
  privateKey,
  spaceId = SPACE_ID,
  sessionStatus,
  mentorConfirmed,
  learnerConfirmed,
}: {
  sessionKey: string;
  mentorWallet: string;
  learnerWallet: string;
  feedbackFrom: string;
  feedbackTo: string;
  rating?: number;
  notes?: string;
  technicalDxFeedback?: string;
  privateKey: `0x${string}`;
  spaceId?: string;
  sessionStatus?: 'pending' | 'scheduled' | 'in-progress' | 'completed' | 'declined' | 'cancelled';
  mentorConfirmed?: boolean;
  learnerConfirmed?: boolean;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();

  // Validate rating if provided
  if (rating !== undefined && (rating < 1 || rating > 5)) {
    throw new Error('Rating must be between 1 and 5');
  }

  // Verify feedbackFrom is part of the session
  const normalizedMentor = mentorWallet.toLowerCase();
  const normalizedLearner = learnerWallet.toLowerCase();
  const normalizedFrom = feedbackFrom.toLowerCase();
  
  if (normalizedFrom !== normalizedMentor && normalizedFrom !== normalizedLearner) {
    throw new Error('Feedback can only be given by session participants');
  }

  // Verify feedbackTo is the other participant
  const normalizedTo = feedbackTo.toLowerCase();
  if (normalizedTo !== normalizedMentor && normalizedTo !== normalizedLearner) {
    throw new Error('Feedback can only be given to the other session participant');
  }

  if (normalizedFrom === normalizedTo) {
    throw new Error('Cannot give feedback to yourself');
  }

  // CRITICAL: Validate notes (description) is required - reuse app feedback pattern
  if (!notes || !notes.trim()) {
    throw new Error('Feedback description is required');
  }

  // CRITICAL: Validate session is confirmed (both sides)
  // Note: For past sessions, this check is skipped in canGiveFeedbackForSessionSync
  // But we still validate here for consistency
  if (mentorConfirmed !== undefined && learnerConfirmed !== undefined) {
    if (!mentorConfirmed || !learnerConfirmed) {
      throw new Error('Feedback can only be given for confirmed sessions (both mentor and learner must confirm)');
    }
  }

  // CRITICAL: Validate session status
  if (sessionStatus) {
    if (sessionStatus === 'pending' || sessionStatus === 'declined' || sessionStatus === 'cancelled') {
      throw new Error('Feedback can only be given for scheduled or completed sessions');
    }
  }

  // CRITICAL: Check for duplicate feedback
  const hasGivenFeedback = await hasUserGivenFeedbackForSession(sessionKey, feedbackFrom);
  if (hasGivenFeedback) {
    throw new Error('You have already given feedback for this session');
  }

  const payload = {
    rating: rating || undefined,
    notes: notes.trim(), // Required - already validated above
    technicalDxFeedback: technicalDxFeedback || undefined,
    createdAt,
  };

  // Feedback entities should persist long-term (1 year) since they're historical records
  const expiresIn = 31536000; // 1 year in seconds

  // Build attributes array
  const attributes: Array<{ key: string; value: string }> = [
    { key: 'type', value: 'session_feedback' },
    { key: 'sessionKey', value: sessionKey },
    { key: 'mentorWallet', value: mentorWallet },
    { key: 'learnerWallet', value: learnerWallet },
    { key: 'feedbackFrom', value: feedbackFrom },
    { key: 'feedbackTo', value: feedbackTo },
    { key: 'spaceId', value: spaceId },
    { key: 'createdAt', value: createdAt },
    ...(rating ? [{ key: 'rating', value: String(rating) }] : []),
  ];

  // Add signer metadata (U1.x.2: Central Signer Metadata)
  const { addSignerMetadata } = await import('./signer-metadata');
  const attributesWithSigner = addSignerMetadata(attributes, privateKey);

  const result = await walletClient.createEntity({
    payload: enc.encode(JSON.stringify(payload)),
    contentType: 'application/json',
    attributes: attributesWithSigner,
    expiresIn,
  });

  const { entityKey, txHash } = result;

  // Structured logging (U1.x.1: Explorer Independence)
  const { logEntityWrite } = await import('./write-logging');
  logEntityWrite({
    entityType: 'session_feedback',
    entityKey,
    txHash,
    wallet: normalizedFrom,
    timestamp: createdAt,
    operation: 'create',
    spaceId,
  });

  // Store txHash in a separate entity for reliable querying (similar to asks.ts pattern)
  walletClient.createEntity({
    payload: enc.encode(JSON.stringify({ txHash })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'session_feedback_txhash' },
      { key: 'feedbackKey', value: entityKey },
      { key: 'spaceId', value: spaceId },
      { key: 'createdAt', value: createdAt },
    ],
    expiresIn,
  }).catch((error: any) => {
    console.warn('[createFeedback] Failed to create session_feedback_txhash entity:', error);
  });

  return { key: entityKey, txHash };
}

/**
 * List feedback for a session
 */
export async function listFeedbackForSession(sessionKey: string, spaceId?: string): Promise<Feedback[]> {
  const publicClient = getPublicClient();
  
  // Use provided spaceId or default to SPACE_ID from config
  const finalSpaceId = spaceId || SPACE_ID;
  
  const result = await publicClient.buildQuery()
    .where(eq('type', 'session_feedback'))
    .where(eq('sessionKey', sessionKey))
    .where(eq('spaceId', finalSpaceId))
    .withAttributes(true)
    .withPayload(true)
    .limit(10)
    .fetch();

  return result.entities.map((entity: any) => {
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
      console.error('Error decoding feedback payload:', e);
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
      sessionKey: getAttr('sessionKey'),
      mentorWallet: getAttr('mentorWallet'),
      learnerWallet: getAttr('learnerWallet'),
      feedbackFrom: getAttr('feedbackFrom'),
      feedbackTo: getAttr('feedbackTo'),
      rating: payload.rating || (getAttr('rating') ? parseInt(getAttr('rating'), 10) : undefined),
      notes: payload.notes || undefined,
      technicalDxFeedback: payload.technicalDxFeedback || undefined,
      spaceId: getAttr('spaceId') || SPACE_ID, // Use SPACE_ID from config as fallback (entities should always have spaceId)
      createdAt: getAttr('createdAt'),
    };
  });
}

/**
 * List feedback for a wallet (all feedback given or received)
 */
export async function listFeedbackForWallet(wallet: string, spaceId?: string): Promise<Feedback[]> {
  const publicClient = getPublicClient();
  
  // Use provided spaceId or default to SPACE_ID from config
  const finalSpaceId = spaceId || SPACE_ID;
  
  // Query feedback where wallet is either feedbackFrom or feedbackTo
  // Filter by spaceId to ensure cross-environment isolation
  const [fromResult, toResult] = await Promise.all([
    publicClient.buildQuery()
      .where(eq('type', 'session_feedback'))
      .where(eq('spaceId', finalSpaceId))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'session_feedback'))
      .where(eq('spaceId', finalSpaceId))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch(),
  ]);

  const allEntities = [...fromResult.entities, ...toResult.entities];
  const normalizedWallet = wallet.toLowerCase();
  
  // Filter and deduplicate
  const seenKeys = new Set<string>();
  const feedbacks: Feedback[] = [];

  allEntities.forEach((entity: any) => {
    if (seenKeys.has(entity.key)) return;
    
    const attrs = entity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };

    const feedbackFrom = getAttr('feedbackFrom').toLowerCase();
    const feedbackTo = getAttr('feedbackTo').toLowerCase();

    if (feedbackFrom === normalizedWallet || feedbackTo === normalizedWallet) {
      seenKeys.add(entity.key);
      
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
        console.error('Error decoding feedback payload:', e);
      }

      feedbacks.push({
        key: entity.key,
        sessionKey: getAttr('sessionKey'),
        mentorWallet: getAttr('mentorWallet'),
        learnerWallet: getAttr('learnerWallet'),
        feedbackFrom: getAttr('feedbackFrom'),
        feedbackTo: getAttr('feedbackTo'),
        rating: payload.rating || (getAttr('rating') ? parseInt(getAttr('rating'), 10) : undefined),
        notes: payload.notes || undefined,
        technicalDxFeedback: payload.technicalDxFeedback || undefined,
        spaceId: getAttr('spaceId') || SPACE_ID, // Use SPACE_ID from config as fallback (entities should always have spaceId)
        createdAt: getAttr('createdAt'),
      });
    }
  });

  return feedbacks.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Get a single session feedback by key
 * 
 * @param key - Session feedback entity key
 * @returns Feedback or null if not found
 */
export async function getFeedbackByKey(key: string): Promise<Feedback | null> {
  const publicClient = getPublicClient();
  
  try {
    // Query by key using where clause
    const result = await publicClient.buildQuery()
      .where(eq('type', 'session_feedback'))
      .where(eq('key', key))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch();

    if (!result || !result.entities || result.entities.length === 0) {
      return null;
    }

    const entity = result.entities[0];
    
    // Fetch txHash in parallel
    const txHashResult = await publicClient.buildQuery()
      .where(eq('type', 'session_feedback_txhash'))
      .where(eq('feedbackKey', key))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch();

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
      console.error('Error decoding feedback payload:', e);
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
      sessionKey: getAttr('sessionKey'),
      mentorWallet: getAttr('mentorWallet'),
      learnerWallet: getAttr('learnerWallet'),
      feedbackFrom: getAttr('feedbackFrom'),
      feedbackTo: getAttr('feedbackTo'),
      rating: payload.rating || (getAttr('rating') ? parseInt(getAttr('rating'), 10) : undefined),
      notes: payload.notes || undefined,
      technicalDxFeedback: payload.technicalDxFeedback || undefined,
      spaceId: getAttr('spaceId') || SPACE_ID, // Use SPACE_ID from config as fallback (entities should always have spaceId)
      createdAt: getAttr('createdAt'),
      txHash: txHash || undefined,
    };
  } catch (error: any) {
    console.error(`[getFeedbackByKey] Error getting feedback by key ${key}:`, error);
    return null;
  }
}

