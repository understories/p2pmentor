/**
 * Sessions CRUD helpers
 * 
 * Handles mentorship session creation, listing, and confirmation.
 * 
 * Based on mentor-graph implementation.
 * 
 * Reference: refs/mentor-graph/src/arkiv/sessions.ts
 */

import { eq } from "@arkiv-network/sdk/query"
import { getPublicClient, getWalletClientFromPrivateKey } from "./client"
import { generateJitsiMeeting } from "../jitsi"
import { JITSI_BASE_URL, SPACE_ID } from "../config"

export type Session = {
  key: string;
  mentorWallet: string;
  learnerWallet: string;
  skill: string; // Legacy: skill name (deprecated, use skill_id)
  skill_id?: string; // Skill entity key (preferred)
  spaceId: string;
  createdAt: string;
  sessionDate: string; // ISO timestamp when session is/was scheduled
  status: 'pending' | 'scheduled' | 'in-progress' | 'completed' | 'declined' | 'cancelled';
  duration?: number; // Duration in minutes
  notes?: string;
  feedbackKey?: string; // Reference to feedback entity
  txHash?: string; // Session creation transaction hash
  mentorConfirmed?: boolean;
  learnerConfirmed?: boolean;
  // Community session fields (for virtual gathering RSVPs)
  gatheringKey?: string; // Virtual gathering entity key
  gatheringTitle?: string; // Virtual gathering title
  community?: string; // Skill slug/community name
  // Payment flow fields
  requiresPayment?: boolean; // Whether this session requires payment
  paymentAddress?: string; // Payment receiving address (if paid)
  cost?: string; // Cost amount (if paid)
  paymentTxHash?: string; // Transaction hash for payment (if paid session) - submitted by learner after mentor confirms
  paymentValidated?: boolean; // Whether payment has been validated by mentor
  paymentValidatedBy?: string; // Wallet that validated the payment
  // Jitsi video meeting fields
  videoProvider?: 'jitsi' | 'none' | 'custom';
  videoRoomName?: string;
  videoJoinUrl?: string;
  videoJwtToken?: string; // For future JWT-secured deployments
}

/**
 * Create a session (meeting request)
 * 
 * @param data - Session data
 * @param privateKey - Private key for signing
 * @returns Entity key and transaction hash
 */
export async function createSession({
  mentorWallet,
  learnerWallet,
  skill,
  skill_id,
  sessionDate,
  duration,
  notes,
  requiresPayment,
  paymentAddress,
  cost,
  requesterWallet,
  privateKey,
}: {
  mentorWallet: string;
  learnerWallet: string;
  skill: string; // Legacy: skill name (deprecated)
  skill_id?: string; // Skill entity key (preferred)
  sessionDate: string; // ISO timestamp
  duration?: number;
  notes?: string;
  requiresPayment?: boolean; // Whether this session requires payment
  paymentAddress?: string; // Payment receiving address (if paid)
  cost?: string; // Cost amount (if paid)
  requesterWallet?: string; // Wallet of the requester (will be auto-confirmed)
  privateKey: `0x${string}`;
}): Promise<{ key: string; txHash: string }> {
  // Normalize wallet addresses to lowercase for consistency
  const normalizedMentorWallet = mentorWallet.toLowerCase();
  const normalizedLearnerWallet = learnerWallet.toLowerCase();
  
  // Validate that mentor and learner are different
  if (normalizedMentorWallet === normalizedLearnerWallet) {
    throw new Error('Mentor and learner must be different wallets');
  }
  
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const spaceId = SPACE_ID;
  const status = 'pending'; // Start as pending, requires confirmation
  const createdAt = new Date().toISOString();

  const payload = {
    sessionDate,
    duration: duration || 60, // Default 60 minutes
    notes: notes || '',
    requiresPayment: requiresPayment || false,
    paymentAddress: paymentAddress || undefined,
    cost: cost || undefined,
    // Note: paymentTxHash is NOT included here - it will be submitted later after mentor confirms
  };

  // Calculate expiration: sessionDate + duration + 1 hour buffer for wrap-up
  const sessionStartTime = Math.floor(new Date(sessionDate).getTime()); // Ensure integer milliseconds
  // Ensure duration is always an integer to prevent float propagation
  const durationMinutes = Math.floor(typeof duration === 'number' ? duration : parseInt(String(duration || 60), 10));
  const sessionDurationMs = durationMinutes * 60 * 1000; // Convert minutes to milliseconds
  const bufferMs = 60 * 60 * 1000; // 1 hour buffer after session ends
  const expirationTime = Math.floor(sessionStartTime + sessionDurationMs + bufferMs); // Ensure integer
  const now = Math.floor(Date.now()); // Ensure integer milliseconds
  // Calculate expiresIn and ensure it's always an integer (BigInt requirement)
  const expiresInSecondsRaw = (expirationTime - now) / 1000;
  // Use Math.trunc to ensure integer, then Math.floor for safety, then parseInt to guarantee integer type
  const expiresInSecondsInt = parseInt(Math.floor(Math.max(1, Math.trunc(expiresInSecondsRaw))).toString(), 10);

  let entityKey: string;
  let txHash: string;
  
  try {
    const result = await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'session' },
        { key: 'mentorWallet', value: normalizedMentorWallet },
        { key: 'learnerWallet', value: normalizedLearnerWallet },
        { key: 'skill', value: skill }, // Legacy: keep for backward compatibility
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
      { key: 'sessionDate', value: sessionDate },
      { key: 'status', value: status },
      ...(skill_id ? [{ key: 'skill_id', value: skill_id }] : []),
      ...(requiresPayment ? [{ key: 'requiresPayment', value: 'true' }] : []),
      ...(paymentAddress ? [{ key: 'paymentAddress', value: paymentAddress }] : []),
      ...(cost ? [{ key: 'cost', value: cost }] : []),
    ],
    expiresIn: expiresInSecondsInt,
  });
    entityKey = result.entityKey;
    txHash = result.txHash;
  } catch (error: any) {
    // Handle transaction receipt timeout - common on testnets
    // If error mentions receipt not found, the transaction was likely submitted
    // Check if we can extract txHash from error message
    const receiptError = error.message?.includes('Transaction receipt') && 
                         error.message?.includes('could not be found');
    
    if (receiptError) {
      // Try to extract txHash from error message (format: "hash 0x...")
      const txHashMatch = error.message?.match(/0x[a-fA-F0-9]{40,64}/);
      if (txHashMatch) {
        // We have a txHash, transaction was submitted - treat as success
        // Note: We can't get entityKey from a failed receipt wait, so we'll need to handle this differently
        // For now, throw a more user-friendly error that indicates partial success
        throw new Error(`Transaction submitted (${txHashMatch[0].slice(0, 10)}...) but confirmation pending. The session may appear shortly.`);
      }
      // No txHash found, throw generic error
      throw new Error('Transaction submitted but confirmation pending. Please wait a moment and check your sessions.');
    }
    throw error;
  }

  // Store txHash in a separate entity for verifiability (same expiration)
  try {
    await walletClient.createEntity({
    payload: enc.encode(JSON.stringify({
      txHash,
    })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'session_txhash' },
      { key: 'sessionKey', value: entityKey },
      { key: 'mentorWallet', value: normalizedMentorWallet },
      { key: 'learnerWallet', value: normalizedLearnerWallet },
      { key: 'spaceId', value: spaceId },
      ],
      expiresIn: expiresInSecondsInt,
    });
  } catch (error: any) {
    // If txHash entity creation fails but we have the main entity, log and continue
    // The main session entity is more important
    console.warn('Failed to create session_txhash entity, but session was created:', error);
  }

  // Auto-confirm requester if provided
  if (requesterWallet) {
    const requesterWalletNormalized = requesterWallet.toLowerCase();

    // Verify requester is part of the session
    const isMentor = normalizedMentorWallet === requesterWalletNormalized;
    const isLearner = normalizedLearnerWallet === requesterWalletNormalized;

    if (!isMentor && !isLearner) {
      console.warn('[createSession] Requester wallet is not part of session, skipping auto-confirmation');
    } else {
      try {
        const confirmationEnc = new TextEncoder();
        const confirmationCreatedAt = new Date().toISOString();

        // Calculate expiration same as session
        const confirmationExpiresIn = expiresInSecondsInt;

        await walletClient.createEntity({
          payload: confirmationEnc.encode(JSON.stringify({
            confirmedAt: confirmationCreatedAt,
          })),
          contentType: 'application/json',
          attributes: [
            { key: 'type', value: 'session_confirmation' },
            { key: 'sessionKey', value: entityKey },
            { key: 'confirmedBy', value: requesterWalletNormalized },
            { key: 'mentorWallet', value: normalizedMentorWallet },
            { key: 'learnerWallet', value: normalizedLearnerWallet },
            { key: 'spaceId', value: spaceId },
            { key: 'createdAt', value: confirmationCreatedAt },
          ],
          expiresIn: confirmationExpiresIn,
        });

        console.log('[createSession] Auto-confirmed session for requester:', requesterWalletNormalized);
      } catch (confirmationError: any) {
        // Don't fail session creation if confirmation fails
        console.warn('[createSession] Failed to auto-confirm requester:', confirmationError);
      }
    }
  }

  // Create notification for the recipient (mentor or learner who didn't create the session)
  // Note: We don't know who created it, so we'll create notifications for both
  // The notification system will deduplicate or we can determine creator from context
  // For now, create notification for mentor (assuming learner created the request)
  try {
    const { createNotification } = await import('./notifications');
    await createNotification({
      wallet: normalizedMentorWallet,
      notificationType: 'meeting_request',
      sourceEntityType: 'session',
      sourceEntityKey: entityKey,
      title: 'New Meeting Request',
      message: `You have a new meeting request for ${skill}`,
      link: '/me/sessions',
      metadata: {
        sessionKey: entityKey,
        skill,
        skill_id: skill_id || undefined,
        otherWallet: normalizedLearnerWallet,
      },
      privateKey,
      spaceId,
    }).catch((err: any) => {
      console.warn('[createSession] Failed to create notification for mentor:', err);
    });
  } catch (err: any) {
    // Notification creation failure shouldn't block session creation
    console.warn('[createSession] Error importing or creating notification:', err);
  }

  return { key: entityKey, txHash };
}

/**
 * List sessions with optional filters
 * 
 * @param params - Optional filters
 * @returns Array of sessions
 */
export async function listSessions(params?: { 
  mentorWallet?: string; 
  learnerWallet?: string; 
  skill?: string; 
  status?: string;
  spaceId?: string;
  spaceIds?: string[];
}): Promise<Session[]> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  let queryBuilder = query.where(eq('type', 'session'));
  
  // Support multiple spaceIds (builder mode) or single spaceId
  if (params?.spaceIds && params.spaceIds.length > 0) {
    // Query all, filter client-side (Arkiv doesn't support OR queries)
    queryBuilder = queryBuilder.limit(500);
  } else {
    // Use provided spaceId or default to SPACE_ID from config
    const spaceId = params?.spaceId || SPACE_ID;
    queryBuilder = queryBuilder.where(eq('spaceId', spaceId));
  }
  if (params?.mentorWallet) {
    // Normalize wallet address to lowercase for querying
    queryBuilder = queryBuilder.where(eq('mentorWallet', params.mentorWallet.toLowerCase()));
  }
  if (params?.learnerWallet) {
    // Normalize wallet address to lowercase for querying
    queryBuilder = queryBuilder.where(eq('learnerWallet', params.learnerWallet.toLowerCase()));
  }
  if (params?.skill) {
    queryBuilder = queryBuilder.where(eq('skill', params.skill));
  }
  if (params?.status) {
    queryBuilder = queryBuilder.where(eq('status', params.status));
  }
  
  const [result, txHashResult] = await Promise.all([
    queryBuilder
      .withAttributes(true)
      .withPayload(true)
      .limit(500) // Increased limit to ensure RSVP sessions are included
      .fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'session_txhash'))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch(),
  ]);

  // Build txHash map
  const txHashMap: Record<string, string> = {};
  txHashResult.entities.forEach((entity: any) => {
    const attrs = entity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };
    const sessionKey = getAttr('sessionKey');
    if (sessionKey) {
      try {
        const payload = entity.payload instanceof Uint8Array
          ? new TextDecoder().decode(entity.payload)
          : typeof entity.payload === 'string'
          ? entity.payload
          : JSON.stringify(entity.payload);
        const decoded = JSON.parse(payload);
        if (decoded.txHash) {
          txHashMap[sessionKey] = decoded.txHash;
        }
      } catch (e) {
        console.error('Error decoding txHash payload:', e);
      }
    }
  });

  // Get all confirmations, rejections, and Jitsi info for these sessions
  const sessionKeys = result.entities.map((e: any) => e.key);
  
  // Query confirmations, rejections, payment submissions, and payment validations (can batch these)
  const [confirmationsResult, rejectionsResult, paymentSubmissionsResult, paymentValidationsResult] = await Promise.all([
    sessionKeys.length > 0
      ? publicClient.buildQuery()
          .where(eq('type', 'session_confirmation'))
          .withAttributes(true)
          .limit(100)
          .fetch()
      : { entities: [] },
    sessionKeys.length > 0
      ? publicClient.buildQuery()
          .where(eq('type', 'session_rejection'))
          .withAttributes(true)
          .limit(100)
          .fetch()
      : { entities: [] },
    sessionKeys.length > 0
      ? publicClient.buildQuery()
          .where(eq('type', 'session_payment_submission'))
          .withAttributes(true)
          .withPayload(true)
          .limit(100)
          .fetch()
      : { entities: [] },
    sessionKeys.length > 0
      ? publicClient.buildQuery()
          .where(eq('type', 'session_payment_validation'))
          .withAttributes(true)
          .withPayload(true)
          .limit(100)
          .fetch()
      : { entities: [] },
  ]);

  // Query Jitsi entities per session key (more reliable than fetching all and filtering)
  // This ensures we get Jitsi entities even if they were created for sessions not in current query
  const jitsiQueries = await Promise.all(
    sessionKeys.map(sessionKey =>
      publicClient.buildQuery()
        .where(eq('type', 'session_jitsi'))
        .where(eq('sessionKey', sessionKey))
        .withAttributes(true)
        .withPayload(true)
        .limit(1)
        .fetch()
    )
  );
  
  // Flatten results
  const jitsiResult = {
    entities: jitsiQueries.flatMap(q => q.entities)
  };

  // Build confirmation map: sessionKey -> Set of confirmedBy wallets
  const confirmationMap: Record<string, Set<string>> = {};
  confirmationsResult.entities.forEach((entity: any) => {
    const attrs = entity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };
    const sessionKey = getAttr('sessionKey');
    const confirmedBy = getAttr('confirmedBy');
    // CRITICAL: Check if sessionKey matches any of our sessions (case-insensitive comparison)
    // Also log if we're filtering out confirmations
    if (sessionKey && confirmedBy) {
      const matchingSessionKey = sessionKeys.find(sk => sk.toLowerCase() === sessionKey.toLowerCase());
      if (matchingSessionKey) {
        if (!confirmationMap[matchingSessionKey]) {
          confirmationMap[matchingSessionKey] = new Set();
        }
        confirmationMap[matchingSessionKey].add(confirmedBy.toLowerCase());
      }
    }
  });

  // Build rejection map: sessionKey -> Set of rejectedBy wallets
  const rejectionMap: Record<string, Set<string>> = {};
  rejectionsResult.entities.forEach((entity: any) => {
    const attrs = entity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };
    const sessionKey = getAttr('sessionKey');
    const rejectedBy = getAttr('rejectedBy');
    if (sessionKey && rejectedBy) {
      const matchingSessionKey = sessionKeys.find(sk => sk.toLowerCase() === sessionKey.toLowerCase());
      if (matchingSessionKey) {
        if (!rejectionMap[matchingSessionKey]) {
          rejectionMap[matchingSessionKey] = new Set();
        }
        rejectionMap[matchingSessionKey].add(rejectedBy.toLowerCase());
      }
    }
  });

  // Build payment submission map: sessionKey -> payment submission info (by learner)
  const paymentSubmissionMap: Record<string, { paymentTxHash?: string; submittedBy?: string }> = {};
  paymentSubmissionsResult.entities.forEach((entity: any) => {
    const attrs = entity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };
    
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
      console.error('Error decoding payment submission payload:', e);
    }
    
    const sessionKey = getAttr('sessionKey');
    if (sessionKey) {
      const matchingSessionKey = sessionKeys.find(sk => sk.toLowerCase() === sessionKey.toLowerCase());
      if (matchingSessionKey) {
        paymentSubmissionMap[matchingSessionKey] = {
          paymentTxHash: payload.paymentTxHash || getAttr('paymentTxHash'),
          submittedBy: payload.submittedBy || getAttr('submittedBy'),
        };
      }
    }
  });

  // Build payment validation map: sessionKey -> payment validation info (by mentor)
  const paymentValidationMap: Record<string, { paymentTxHash?: string; validatedBy?: string }> = {};
  paymentValidationsResult.entities.forEach((entity: any) => {
    const attrs = entity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };
    
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
      console.error('Error decoding payment validation payload:', e);
    }
    
    const sessionKey = getAttr('sessionKey');
    if (sessionKey) {
      const matchingSessionKey = sessionKeys.find(sk => sk.toLowerCase() === sessionKey.toLowerCase());
      if (matchingSessionKey) {
        paymentValidationMap[matchingSessionKey] = {
          paymentTxHash: payload.paymentTxHash || getAttr('paymentTxHash'),
          validatedBy: payload.validatedBy || getAttr('validatedBy'),
        };
      }
    }
  });

  // Build Jitsi info map: sessionKey -> Jitsi info
  // Since we queried Jitsi entities per session key, they're already matched
  const jitsiMap: Record<string, { videoProvider?: string; videoRoomName?: string; videoJoinUrl?: string; videoJwtToken?: string }> = {};
  
  // Match Jitsi entities to their session keys
  sessionKeys.forEach((sessionKey, idx) => {
    const jitsiEntities = jitsiQueries[idx]?.entities || [];
    if (jitsiEntities.length > 0) {
      const entity = jitsiEntities[0]; // Should only be one per session
      const attrs = entity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };
      
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
        console.error('Error decoding Jitsi payload:', e);
      }
      
      // Verify sessionKey matches (should always match since we queried by it)
      const entitySessionKey = getAttr('sessionKey');
      if (entitySessionKey && entitySessionKey.toLowerCase() === sessionKey.toLowerCase()) {
        jitsiMap[sessionKey] = {
          videoProvider: payload.videoProvider || getAttr('videoProvider') || 'jitsi',
          videoRoomName: payload.videoRoomName || getAttr('videoRoomName'),
          videoJoinUrl: payload.videoJoinUrl || getAttr('videoJoinUrl'),
          videoJwtToken: payload.videoJwtToken || getAttr('videoJwtToken'),
        };
      }
    }
  });

  const mappedSessions = result.entities.map((entity: any) => {
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
      console.error('Error decoding payload:', e);
    }

    const attrs = entity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };

    const mentorWallet = getAttr('mentorWallet');
    const learnerWallet = getAttr('learnerWallet');
    const sessionKey = entity.key;
    const confirmations = confirmationMap[sessionKey] || new Set();
    const rejections = rejectionMap[sessionKey] || new Set();
    const jitsiInfo = jitsiMap[sessionKey] || {};
    const paymentSubmission = paymentSubmissionMap[sessionKey];
    const paymentValidation = paymentValidationMap[sessionKey];
    
    const mentorConfirmed = confirmations.has(mentorWallet.toLowerCase());
    const learnerConfirmed = confirmations.has(learnerWallet.toLowerCase());
    const mentorRejected = rejections.has(mentorWallet.toLowerCase());
    const learnerRejected = rejections.has(learnerWallet.toLowerCase());
    
    // Extract payment info
    const requiresPayment = getAttr('requiresPayment') === 'true' || payload.requiresPayment === true;
    const paymentAddress = getAttr('paymentAddress') || payload.paymentAddress || undefined;
    const cost = getAttr('cost') || payload.cost || undefined;
    // Payment submission (by learner) takes precedence over session payload
    const paymentTxHash = paymentSubmission?.paymentTxHash || paymentValidation?.paymentTxHash || payload.paymentTxHash || getAttr('paymentTxHash') || undefined;
    const paymentValidated = !!paymentValidation;
    const paymentValidatedBy = paymentValidation?.validatedBy || undefined;
    
    // Determine final status:
    // - If either party rejected, mark as declined (rejecting a pending request)
    // - If both confirmed and was pending, mark as scheduled
    // - Preserve 'completed' and 'in-progress' statuses (don't overwrite)
    // - cancelled is reserved for canceling already-scheduled sessions (future feature)
    // - IMPORTANT: Don't trust the entity's status attribute - recalculate based on confirmations
    const entityStatus = (getAttr('status') || payload.status || 'pending') as Session['status'];
    let finalStatus = entityStatus;
    
    if (mentorRejected || learnerRejected) {
      // Rejection of a pending request results in 'declined' status
      // 'cancelled' is reserved for canceling already-scheduled sessions
      finalStatus = 'declined';
    } else if (mentorConfirmed && learnerConfirmed) {
      // Both confirmed - mark as scheduled only if currently pending
      // Preserve 'completed' and 'in-progress' statuses (don't overwrite)
      if (entityStatus === 'pending') {
        finalStatus = 'scheduled';
      } else if (entityStatus === 'completed' || entityStatus === 'in-progress') {
        // Preserve completed/in-progress status
        finalStatus = entityStatus;
      } else {
        // For scheduled or other statuses, ensure it's scheduled
        finalStatus = 'scheduled';
      }
    } else if (entityStatus === 'scheduled' && (!mentorConfirmed || !learnerConfirmed)) {
      // Status says scheduled but confirmations don't match - revert to pending
      finalStatus = 'pending';
    }

    // Extract skill_id and community session fields
    const skill_id = getAttr('skill_id') || payload.skill_id || undefined;
    const gatheringKey = getAttr('gatheringKey') || payload.gatheringKey || undefined;
    const gatheringTitle = payload.gatheringTitle || undefined;
    const community = payload.community || (payload.notes?.includes('community:') 
      ? payload.notes.split('community:')[1]?.split(',')[0]?.trim() 
      : undefined);

    return {
      key: sessionKey,
      mentorWallet,
      learnerWallet,
      skill: getAttr('skill'),
      skill_id,
      spaceId: getAttr('spaceId') || SPACE_ID, // Use SPACE_ID from config as fallback (entities should always have spaceId)
      createdAt: getAttr('createdAt'),
      sessionDate: getAttr('sessionDate') || payload.sessionDate || '',
      status: finalStatus,
      duration: payload.duration || undefined,
      notes: payload.notes || undefined,
      feedbackKey: payload.feedbackKey || undefined,
      txHash: txHashMap[sessionKey],
      mentorConfirmed,
      learnerConfirmed,
      requiresPayment,
      paymentAddress,
      cost,
      paymentTxHash,
      paymentValidated,
      paymentValidatedBy,
      videoProvider: jitsiInfo.videoProvider as 'jitsi' | 'none' | 'custom' | undefined,
      videoRoomName: jitsiInfo.videoRoomName,
      videoJoinUrl: jitsiInfo.videoJoinUrl,
      videoJwtToken: jitsiInfo.videoJwtToken,
      gatheringKey,
      gatheringTitle,
      community,
    };
  });

  // Filter by spaceIds client-side if multiple requested
  let sessions = mappedSessions;
  if (params?.spaceIds && params.spaceIds.length > 0) {
    sessions = mappedSessions.filter((session: Session) => params.spaceIds!.includes(session.spaceId));
  }

  return sessions;
}

/**
 * List sessions for a specific wallet (as mentor or learner)
 * 
 * @param wallet - Wallet address
 * @returns Array of sessions
 */
export async function listSessionsForWallet(wallet: string, spaceId?: string): Promise<Session[]> {
  // Normalize wallet address to lowercase
  const normalizedWallet = wallet.toLowerCase();
  
  // Use provided spaceId or default to SPACE_ID from config
  const finalSpaceId = spaceId || SPACE_ID;
  
  // Get sessions where wallet is either mentor or learner
  const [asMentor, asLearner] = await Promise.all([
    listSessions({ mentorWallet: normalizedWallet, spaceId: finalSpaceId }),
    listSessions({ learnerWallet: normalizedWallet, spaceId: finalSpaceId }),
  ]);

  // Combine and deduplicate by key
  const sessionMap = new Map<string, Session>();
  [...asMentor, ...asLearner].forEach(session => {
    sessionMap.set(session.key, session);
  });

  const allSessions = Array.from(sessionMap.values());
  
  // Debug: Log RSVP sessions found
  const rsvpSessions = allSessions.filter(s => 
    s.skill === 'virtual_gathering_rsvp' || 
    s.notes?.includes('virtual_gathering_rsvp:') ||
    s.gatheringKey
  );
  if (rsvpSessions.length > 0) {
    console.log('[listSessionsForWallet] Found RSVP sessions:', {
      wallet: normalizedWallet.slice(0, 8) + '...',
      spaceId: finalSpaceId,
      totalSessions: allSessions.length,
      rsvpSessions: rsvpSessions.length,
      rsvpKeys: rsvpSessions.map(s => s.key),
    });
  }

  return allSessions;
}

/**
 * Get a single session by key
 * 
 * @param key - Session entity key
 * @returns Session or null if not found
 */
export async function getSessionByKey(key: string): Promise<Session | null> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  const result = await query
    .where(eq('type', 'session'))
    .where(eq('key', key))
    .withAttributes(true)
    .withPayload(true)
    .limit(1)
    .fetch();

  if (result.entities.length === 0) return null;

  const entity = result.entities[0];
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
    console.error('Error decoding payload:', e);
  }

  const attrs = entity.attributes || {};
  const getAttr = (key: string): string => {
    if (Array.isArray(attrs)) {
      const attr = attrs.find((a: any) => a.key === key);
      return String(attr?.value || '');
    }
    return String(attrs[key] || '');
  };

  // Get txHash
  const txHashResult = await publicClient.buildQuery()
    .where(eq('type', 'session_txhash'))
    .where(eq('sessionKey', entity.key))
    .withAttributes(true)
    .withPayload(true)
    .limit(1)
    .fetch();

  let txHash: string | undefined;
  if (txHashResult.entities.length > 0) {
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

  // Check for confirmations, rejections, payment validation, and Jitsi info
  const [mentorConfirmations, learnerConfirmations, mentorRejections, learnerRejections, paymentSubmission, paymentValidation, jitsiInfo] = await Promise.all([
    publicClient.buildQuery()
      .where(eq('type', 'session_confirmation'))
      .where(eq('sessionKey', entity.key))
      .where(eq('confirmedBy', getAttr('mentorWallet')))
      .withAttributes(true)
      .limit(1)
      .fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'session_confirmation'))
      .where(eq('sessionKey', entity.key))
      .where(eq('confirmedBy', getAttr('learnerWallet')))
      .withAttributes(true)
      .limit(1)
      .fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'session_rejection'))
      .where(eq('sessionKey', entity.key))
      .where(eq('rejectedBy', getAttr('mentorWallet')))
      .withAttributes(true)
      .limit(1)
      .fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'session_rejection'))
      .where(eq('sessionKey', entity.key))
      .where(eq('rejectedBy', getAttr('learnerWallet')))
      .withAttributes(true)
      .limit(1)
      .fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'session_payment_submission'))
      .where(eq('sessionKey', entity.key))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'session_payment_validation'))
      .where(eq('sessionKey', entity.key))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'session_jitsi'))
      .where(eq('sessionKey', entity.key))
      .withAttributes(true)
      .limit(1)
      .fetch(),
  ]);

  const mentorConfirmed = mentorConfirmations.entities.length > 0;
  const learnerConfirmed = learnerConfirmations.entities.length > 0;
  const mentorRejected = mentorRejections.entities.length > 0;
  const learnerRejected = learnerRejections.entities.length > 0;
  
  // Extract payment submission info (by learner)
  let paymentTxHash: string | undefined;
  if (paymentSubmission.entities.length > 0) {
    const paymentEntity = paymentSubmission.entities[0];
    const paymentAttrs = paymentEntity.attributes || {};
    const getPaymentAttr = (key: string): string => {
      if (Array.isArray(paymentAttrs)) {
        const attr = paymentAttrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(paymentAttrs[key] || '');
    };
    
    let paymentPayload: any = {};
    try {
      if (paymentEntity.payload) {
        const decoded = paymentEntity.payload instanceof Uint8Array
          ? new TextDecoder().decode(paymentEntity.payload)
          : typeof paymentEntity.payload === 'string'
          ? paymentEntity.payload
          : JSON.stringify(paymentEntity.payload);
        paymentPayload = JSON.parse(decoded);
      }
    } catch (e) {
      console.error('Error decoding payment submission payload:', e);
    }
    
    paymentTxHash = paymentPayload.paymentTxHash || getPaymentAttr('paymentTxHash') || undefined;
  }
  
  // Extract payment validation info (by mentor)
  let paymentValidated = false;
  let paymentValidatedBy: string | undefined;
  
  if (paymentValidation.entities.length > 0) {
    const paymentEntity = paymentValidation.entities[0];
    const paymentAttrs = paymentEntity.attributes || {};
    const getPaymentAttr = (key: string): string => {
      if (Array.isArray(paymentAttrs)) {
        const attr = paymentAttrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(paymentAttrs[key] || '');
    };
    
    let paymentPayload: any = {};
    try {
      if (paymentEntity.payload) {
        const decoded = paymentEntity.payload instanceof Uint8Array
          ? new TextDecoder().decode(paymentEntity.payload)
          : typeof paymentEntity.payload === 'string'
          ? paymentEntity.payload
          : JSON.stringify(paymentEntity.payload);
        paymentPayload = JSON.parse(decoded);
      }
    } catch (e) {
      console.error('Error decoding payment payload:', e);
    }
    
    // Payment validation overrides submission (mentor validates the submitted payment)
    if (!paymentTxHash) {
      paymentTxHash = paymentPayload.paymentTxHash || getPaymentAttr('paymentTxHash') || undefined;
    }
    paymentValidated = true; // If entity exists, payment is validated
    paymentValidatedBy = paymentPayload.validatedBy || getPaymentAttr('validatedBy') || undefined;
  } else if (!paymentTxHash) {
    // Fallback: Check if paymentTxHash is in session payload/attributes (legacy)
    paymentTxHash = payload.paymentTxHash || getAttr('paymentTxHash') || undefined;
  }
  
  // Extract payment requirement info
  const requiresPayment = getAttr('requiresPayment') === 'true' || payload.requiresPayment === true;
  const paymentAddress = getAttr('paymentAddress') || payload.paymentAddress || undefined;
  const cost = getAttr('cost') || payload.cost || undefined;
  
  // Determine final status:
  // - If either party rejected, mark as declined (rejecting a pending request)
  // - If both confirmed, mark as scheduled (unless already completed/in-progress)
  // - Preserve 'completed' and 'in-progress' statuses (don't overwrite)
  // - cancelled is reserved for canceling already-scheduled sessions (future feature)
  // - IMPORTANT: Don't trust the entity's status attribute - recalculate based on confirmations
  const entityStatus = (getAttr('status') || payload.status || 'pending') as Session['status'];
  let finalStatus = entityStatus;
  
  if (mentorRejected || learnerRejected) {
    // Rejection of a pending request results in 'declined' status
    // 'cancelled' is reserved for canceling already-scheduled sessions
    finalStatus = 'declined';
  } else if (mentorConfirmed && learnerConfirmed) {
    // Both confirmed - mark as scheduled only if currently pending
    // Preserve 'completed' and 'in-progress' statuses (don't overwrite)
    if (entityStatus === 'pending') {
      finalStatus = 'scheduled';
    } else if (entityStatus === 'completed' || entityStatus === 'in-progress') {
      // Preserve completed/in-progress status
      finalStatus = entityStatus;
    } else {
      // For scheduled or other statuses, ensure it's scheduled
      finalStatus = 'scheduled';
    }
  } else if (entityStatus === 'scheduled' && (!mentorConfirmed || !learnerConfirmed)) {
    // Status says scheduled but confirmations don't match - revert to pending
    finalStatus = 'pending';
  }

  // Extract Jitsi info if available
  let jitsiData: { videoProvider?: string; videoRoomName?: string; videoJoinUrl?: string; videoJwtToken?: string } = {};
  if (jitsiInfo.entities.length > 0) {
    const jitsiEntity = jitsiInfo.entities[0];
    let jitsiPayload: any = {};
    try {
      if (jitsiEntity.payload) {
        const decoded = jitsiEntity.payload instanceof Uint8Array
          ? new TextDecoder().decode(jitsiEntity.payload)
          : typeof jitsiEntity.payload === 'string'
          ? jitsiEntity.payload
          : JSON.stringify(jitsiEntity.payload);
        jitsiPayload = JSON.parse(decoded);
      }
    } catch (e) {
      console.error('Error decoding Jitsi payload:', e);
    }
    const jitsiAttrs = jitsiEntity.attributes || {};
    const getJitsiAttr = (key: string): string => {
      if (Array.isArray(jitsiAttrs)) {
        const attr = jitsiAttrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(jitsiAttrs[key] || '');
    };
    jitsiData = {
      videoProvider: jitsiPayload.videoProvider || getJitsiAttr('videoProvider'),
      videoRoomName: jitsiPayload.videoRoomName || getJitsiAttr('videoRoomName'),
      videoJoinUrl: jitsiPayload.videoJoinUrl || getJitsiAttr('videoJoinUrl'),
      videoJwtToken: jitsiPayload.videoJwtToken || getJitsiAttr('videoJwtToken'),
    };
  }

  return {
    key: entity.key,
    mentorWallet: getAttr('mentorWallet'),
    learnerWallet: getAttr('learnerWallet'),
    skill: getAttr('skill'),
    spaceId: getAttr('spaceId') || SPACE_ID,
    createdAt: getAttr('createdAt'),
    sessionDate: getAttr('sessionDate') || payload.sessionDate || '',
    status: finalStatus,
    duration: payload.duration || undefined,
    notes: payload.notes || undefined,
    feedbackKey: payload.feedbackKey || undefined,
    txHash,
    mentorConfirmed,
    learnerConfirmed,
    paymentTxHash,
    paymentValidated,
    paymentValidatedBy,
    videoProvider: jitsiData.videoProvider as 'jitsi' | 'none' | 'custom' | undefined,
    videoRoomName: jitsiData.videoRoomName,
    videoJoinUrl: jitsiData.videoJoinUrl,
    videoJwtToken: jitsiData.videoJwtToken,
  };
}

/**
 * Confirm a session
 * 
 * When both parties confirm, Jitsi meeting is automatically generated.
 * 
 * @param data - Confirmation data
 * @param privateKey - Private key for signing
 * @returns Entity key and transaction hash
 */
export async function confirmSession({
  sessionKey,
  confirmedByWallet,
  privateKey,
  mentorWallet,
  learnerWallet,
  spaceId: providedSpaceId,
}: {
  sessionKey: string;
  confirmedByWallet: string;
  privateKey: `0x${string}`;
  mentorWallet?: string;
  learnerWallet?: string;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  // Try to get the session, but if not found, use provided wallet info
  let session: Session | null = null;
  let spaceId = providedSpaceId || SPACE_ID;
  let verifiedMentorWallet = mentorWallet;
  let verifiedLearnerWallet = learnerWallet;

  try {
    session = await getSessionByKey(sessionKey);
    if (session) {
      spaceId = session.spaceId;
      verifiedMentorWallet = session.mentorWallet;
      verifiedLearnerWallet = session.learnerWallet;
    }
  } catch (e) {
    console.warn('Could not fetch session by key, using provided info:', e);
  }

  // If we have wallet info (either from session or provided), verify the wallet is part of the session
  if (verifiedMentorWallet && verifiedLearnerWallet) {
    const isMentor = verifiedMentorWallet.toLowerCase() === confirmedByWallet.toLowerCase();
    const isLearner = verifiedLearnerWallet.toLowerCase() === confirmedByWallet.toLowerCase();
    
    if (!isMentor && !isLearner) {
      throw new Error('Wallet is not part of this session');
    }
  } else if (!session) {
    // If we don't have session and no wallet info provided, try to query by wallet
    const publicClient = getPublicClient();
    const sessionsAsMentor = await listSessions({ mentorWallet: confirmedByWallet });
    const sessionsAsLearner = await listSessions({ learnerWallet: confirmedByWallet });
    const allSessions = [...sessionsAsMentor, ...sessionsAsLearner];
    const matchingSession = allSessions.find(s => s.key === sessionKey);
    
    if (matchingSession) {
      spaceId = matchingSession.spaceId;
      verifiedMentorWallet = matchingSession.mentorWallet;
      verifiedLearnerWallet = matchingSession.learnerWallet;
    } else {
      throw new Error('Session not found and could not verify wallet ownership');
    }
  }

  if (!verifiedMentorWallet || !verifiedLearnerWallet) {
    throw new Error('Could not determine session participants');
  }

  // Check if already confirmed
  const publicClient = getPublicClient();
  const existingConfirmations = await publicClient.buildQuery()
    .where(eq('type', 'session_confirmation'))
    .where(eq('sessionKey', sessionKey))
    .where(eq('confirmedBy', confirmedByWallet))
    .withAttributes(true)
    .limit(1)
    .fetch();

  if (existingConfirmations.entities.length > 0) {
    throw new Error('Session already confirmed by this wallet');
  }

  // Get session to calculate expiration based on sessionDate + duration
  let sessionExpiration = 31536000; // Default 1 year fallback
  try {
    const session = await getSessionByKey(sessionKey);
    if (session && session.sessionDate) {
      const sessionStartTime = new Date(session.sessionDate).getTime();
      // Ensure duration is always an integer to prevent float propagation
      const durationMinutes = Math.floor(typeof session.duration === 'number' ? session.duration : parseInt(String(session.duration || 60), 10));
      const sessionDurationMs = durationMinutes * 60 * 1000;
      const bufferMs = 60 * 60 * 1000; // 1 hour buffer
      const expirationTime = sessionStartTime + sessionDurationMs + bufferMs;
      const now = Date.now();
      // Calculate expiresIn and ensure it's always an integer (BigInt requirement)
      const expiresInSecondsRaw = (expirationTime - now) / 1000;
      const calculatedExpiration = Math.max(1, Math.floor(expiresInSecondsRaw));
      // Final safety check: ensure it's definitely an integer
      sessionExpiration = Number.isInteger(calculatedExpiration) ? calculatedExpiration : Math.floor(calculatedExpiration);
    }
  } catch (e) {
    console.warn('Could not fetch session for expiration calculation, using default:', e);
  }
  // Final safety check: ensure sessionExpiration is always an integer
  sessionExpiration = Math.floor(sessionExpiration);

  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();

  const { entityKey, txHash } = await walletClient.createEntity({
    payload: enc.encode(JSON.stringify({
      confirmedAt: createdAt,
    })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'session_confirmation' },
      { key: 'sessionKey', value: sessionKey },
      { key: 'confirmedBy', value: confirmedByWallet },
      { key: 'mentorWallet', value: verifiedMentorWallet },
      { key: 'learnerWallet', value: verifiedLearnerWallet },
      { key: 'spaceId', value: spaceId },
      { key: 'createdAt', value: createdAt },
    ],
    expiresIn: sessionExpiration,
  });

  // Check if both parties have now confirmed - if so, generate Jitsi meeting
  // IMPORTANT: Include the current confirmation we just created in the check
  // because the query might not immediately return it due to eventual consistency
  const allConfirmations = await publicClient.buildQuery()
    .where(eq('type', 'session_confirmation'))
    .where(eq('sessionKey', sessionKey))
    .withAttributes(true)
    .fetch();

  const confirmedWallets = new Set(
    allConfirmations.entities.map((e: any) => {
      const attrs = e.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };
      return getAttr('confirmedBy').toLowerCase();
    })
  );

  // CRITICAL: Add the current confirmation to the set since we just created it
  // This ensures we detect both confirmations even if the query hasn't updated yet
  confirmedWallets.add(confirmedByWallet.toLowerCase());

  const mentorConfirmed = confirmedWallets.has(verifiedMentorWallet.toLowerCase());
  const learnerConfirmed = confirmedWallets.has(verifiedLearnerWallet.toLowerCase());
  
  // If both confirmed, generate Jitsi meeting and store it
  if (mentorConfirmed && learnerConfirmed) {
    
    // Check if Jitsi info already exists
    const existingJitsi = await publicClient.buildQuery()
      .where(eq('type', 'session_jitsi'))
      .where(eq('sessionKey', sessionKey))
      .withAttributes(true)
      .limit(1)
      .fetch();

    if (existingJitsi.entities.length === 0) {
      try {
        // Generate Jitsi meeting info
        const jitsiInfo = generateJitsiMeeting(sessionKey, JITSI_BASE_URL);

        // Use the same expiration as the session (calculated above)
        // Ensure it's an integer for BigInt conversion
        const jitsiExpiration = Math.floor(sessionExpiration);
        await walletClient.createEntity({
          payload: enc.encode(JSON.stringify({
            videoProvider: jitsiInfo.videoProvider,
            videoRoomName: jitsiInfo.videoRoomName,
            videoJoinUrl: jitsiInfo.videoJoinUrl,
            generatedAt: createdAt,
          })),
          contentType: 'application/json',
          attributes: [
            { key: 'type', value: 'session_jitsi' },
            { key: 'sessionKey', value: sessionKey },
            { key: 'mentorWallet', value: verifiedMentorWallet },
            { key: 'learnerWallet', value: verifiedLearnerWallet },
            { key: 'spaceId', value: spaceId },
            { key: 'createdAt', value: createdAt },
          ],
          expiresIn: jitsiExpiration, // Same expiration as session, ensured to be integer
        });
      } catch (jitsiError: any) {
        // Handle transaction receipt timeout for Jitsi entity creation
        // This is common on testnets - the entity is likely created, just waiting for confirmation
        if (jitsiError.message?.includes('Transaction receipt') || 
            jitsiError.message?.includes('could not be found') ||
            jitsiError.message?.includes('not be processed')) {
          // Transaction receipt timeout - entity was likely created, just waiting for confirmation
          // This is common on testnets, don't throw
        } else {
          console.error(`[confirmSession] Error creating Jitsi entity:`, jitsiError);
          // Don't throw - confirmation succeeded, Jitsi is optional
        }
      }
    }
  }

  return { key: entityKey, txHash };
}

/**
 * Reject a session
 * 
 * @param data - Rejection data
 * @param privateKey - Private key for signing
 * @returns Entity key and transaction hash
 */
export async function rejectSession({
  sessionKey,
  rejectedByWallet,
  privateKey,
  mentorWallet,
  learnerWallet,
  spaceId: providedSpaceId,
}: {
  sessionKey: string;
  rejectedByWallet: string;
  privateKey: `0x${string}`;
  mentorWallet?: string;
  learnerWallet?: string;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  // Try to get the session, but if not found, use provided wallet info
  let session: Session | null = null;
  let spaceId = providedSpaceId || SPACE_ID;
  let verifiedMentorWallet = mentorWallet;
  let verifiedLearnerWallet = learnerWallet;

  try {
    session = await getSessionByKey(sessionKey);
    if (session) {
      spaceId = session.spaceId;
      verifiedMentorWallet = session.mentorWallet;
      verifiedLearnerWallet = session.learnerWallet;
    }
  } catch (e) {
    console.warn('Could not fetch session by key, using provided info:', e);
  }

  // If we have wallet info (either from session or provided), verify the wallet is part of the session
  if (verifiedMentorWallet && verifiedLearnerWallet) {
    const isMentor = verifiedMentorWallet.toLowerCase() === rejectedByWallet.toLowerCase();
    const isLearner = verifiedLearnerWallet.toLowerCase() === rejectedByWallet.toLowerCase();
    
    if (!isMentor && !isLearner) {
      throw new Error('Wallet is not part of this session');
    }
  } else if (!session) {
    // If we don't have session and no wallet info provided, try to query by wallet
    const publicClient = getPublicClient();
    const sessionsAsMentor = await listSessions({ mentorWallet: rejectedByWallet });
    const sessionsAsLearner = await listSessions({ learnerWallet: rejectedByWallet });
    const allSessions = [...sessionsAsMentor, ...sessionsAsLearner];
    const matchingSession = allSessions.find(s => s.key === sessionKey);
    
    if (matchingSession) {
      spaceId = matchingSession.spaceId;
      verifiedMentorWallet = matchingSession.mentorWallet;
      verifiedLearnerWallet = matchingSession.learnerWallet;
    } else {
      throw new Error('Session not found and could not verify wallet ownership');
    }
  }

  if (!verifiedMentorWallet || !verifiedLearnerWallet) {
    throw new Error('Could not determine session participants');
  }

  // Get session to calculate expiration based on sessionDate + duration
  let sessionExpiration = 31536000; // Default 1 year fallback
  try {
    const session = await getSessionByKey(sessionKey);
    if (session && session.sessionDate) {
      const sessionStartTime = new Date(session.sessionDate).getTime();
      // Ensure duration is always an integer to prevent float propagation
      const durationMinutes = Math.floor(typeof session.duration === 'number' ? session.duration : parseInt(String(session.duration || 60), 10));
      const sessionDurationMs = durationMinutes * 60 * 1000;
      const bufferMs = 60 * 60 * 1000; // 1 hour buffer
      const expirationTime = sessionStartTime + sessionDurationMs + bufferMs;
      const now = Date.now();
      // Calculate expiresIn and ensure it's always an integer (BigInt requirement)
      const expiresInSecondsRaw = (expirationTime - now) / 1000;
      const calculatedExpiration = Math.max(1, Math.floor(expiresInSecondsRaw));
      // Final safety check: ensure it's definitely an integer
      sessionExpiration = Number.isInteger(calculatedExpiration) ? calculatedExpiration : Math.floor(calculatedExpiration);
    }
  } catch (e) {
    console.warn('Could not fetch session for expiration calculation, using default:', e);
  }
  // Final safety check: ensure sessionExpiration is always an integer
  sessionExpiration = Math.floor(sessionExpiration);

  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();

  const { entityKey, txHash } = await walletClient.createEntity({
    payload: enc.encode(JSON.stringify({
      rejectedAt: createdAt,
    })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'session_rejection' },
      { key: 'sessionKey', value: sessionKey },
      { key: 'rejectedBy', value: rejectedByWallet },
      { key: 'mentorWallet', value: verifiedMentorWallet },
      { key: 'learnerWallet', value: verifiedLearnerWallet },
      { key: 'spaceId', value: spaceId },
      { key: 'createdAt', value: createdAt },
    ],
    expiresIn: sessionExpiration,
  });

  return { key: entityKey, txHash };
}

/**
 * Submit payment transaction hash for a session
 * 
 * This is called by the learner after the mentor has confirmed the session.
 * The payment transaction hash is stored in the session entity.
 * 
 * @param data - Payment submission data
 * @param privateKey - Private key for signing
 * @returns Entity key and transaction hash
 */
export async function submitPayment({
  sessionKey,
  paymentTxHash,
  submittedByWallet,
  privateKey,
  mentorWallet,
  learnerWallet,
  spaceId: providedSpaceId,
}: {
  sessionKey: string;
  paymentTxHash: string;
  submittedByWallet: string;
  privateKey: `0x${string}`;
  mentorWallet?: string;
  learnerWallet?: string;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  // Get the session to verify it exists and get wallet info
  let session: Session | null = null;
  let spaceId = providedSpaceId || SPACE_ID;
  let verifiedMentorWallet = mentorWallet;
  let verifiedLearnerWallet = learnerWallet;

  try {
    session = await getSessionByKey(sessionKey);
    if (session) {
      spaceId = session.spaceId;
      verifiedMentorWallet = session.mentorWallet;
      verifiedLearnerWallet = session.learnerWallet;
      
      // Verify the session requires payment
      if (!session.requiresPayment) {
        throw new Error('This session does not require payment');
      }
      
      // Verify the session is confirmed by mentor
      if (!session.mentorConfirmed) {
        throw new Error('Session must be confirmed by mentor before payment can be submitted');
      }
      
      // Verify payment hasn't already been submitted
      if (session.paymentTxHash) {
        throw new Error('Payment has already been submitted for this session');
      }
      
      // Verify the submitter is the learner
      if (session.learnerWallet.toLowerCase() !== submittedByWallet.toLowerCase()) {
        throw new Error('Only the learner can submit payment');
      }
    }
  } catch (e) {
    console.warn('Could not fetch session by key, using provided info:', e);
  }

  if (!verifiedMentorWallet || !verifiedLearnerWallet) {
    throw new Error('Could not determine session participants');
  }

  // Verify the wallet is the learner
  const isLearner = verifiedLearnerWallet.toLowerCase() === submittedByWallet.toLowerCase();
  
  if (!isLearner) {
    throw new Error('Only the learner can submit payment');
  }

  // Get session expiration for the payment submission entity
  let sessionExpiration = 31536000; // Default 1 year fallback
  try {
    const session = await getSessionByKey(sessionKey);
    if (session && session.sessionDate) {
      const sessionStartTime = new Date(session.sessionDate).getTime();
      const durationMinutes = typeof session.duration === 'number' ? session.duration : parseInt(String(session.duration || 60), 10);
      const sessionDurationMs = durationMinutes * 60 * 1000;
      const bufferMs = 60 * 60 * 1000; // 1 hour buffer
      const expirationTime = sessionStartTime + sessionDurationMs + bufferMs;
      const now = Date.now();
      const calculatedExpiration = Math.max(1, Math.floor((expirationTime - now) / 1000));
      sessionExpiration = Number.isInteger(calculatedExpiration) ? calculatedExpiration : Math.floor(calculatedExpiration);
    }
  } catch (e) {
    console.warn('Could not fetch session for expiration calculation, using default:', e);
  }
  sessionExpiration = Math.floor(sessionExpiration);

  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();

  // Create payment submission entity (updates session with paymentTxHash)
  // We create a separate entity to track payment submission, similar to confirmations
  const { entityKey, txHash } = await walletClient.createEntity({
    payload: enc.encode(JSON.stringify({
      paymentTxHash,
      submittedAt: createdAt,
    })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'session_payment_submission' },
      { key: 'sessionKey', value: sessionKey },
      { key: 'paymentTxHash', value: paymentTxHash },
      { key: 'submittedBy', value: submittedByWallet },
      { key: 'mentorWallet', value: verifiedMentorWallet },
      { key: 'learnerWallet', value: verifiedLearnerWallet },
      { key: 'spaceId', value: spaceId },
      { key: 'createdAt', value: createdAt },
    ],
    expiresIn: sessionExpiration,
  });

  return { key: entityKey, txHash };
}

/**
 * Validate payment transaction and update session
 * 
 * For paid sessions, the confirmer validates the payment transaction hash.
 * 
 * @param data - Payment validation data
 * @param privateKey - Private key for signing
 * @returns Entity key and transaction hash
 */
export async function validatePayment({
  sessionKey,
  paymentTxHash,
  validatedByWallet,
  privateKey,
  mentorWallet,
  learnerWallet,
  spaceId: providedSpaceId,
}: {
  sessionKey: string;
  paymentTxHash: string;
  validatedByWallet: string;
  privateKey: `0x${string}`;
  mentorWallet?: string;
  learnerWallet?: string;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  // Get the session to verify it exists and get wallet info
  let session: Session | null = null;
  let spaceId = providedSpaceId || SPACE_ID;
  let verifiedMentorWallet = mentorWallet;
  let verifiedLearnerWallet = learnerWallet;

  try {
    session = await getSessionByKey(sessionKey);
    if (session) {
      spaceId = session.spaceId;
      verifiedMentorWallet = session.mentorWallet;
      verifiedLearnerWallet = session.learnerWallet;
      
      // Verify payment tx hash matches
      if (session.paymentTxHash && session.paymentTxHash.toLowerCase() !== paymentTxHash.toLowerCase()) {
        throw new Error('Payment transaction hash does not match session');
      }
    }
  } catch (e) {
    console.warn('Could not fetch session by key, using provided info:', e);
  }

  if (!verifiedMentorWallet || !verifiedLearnerWallet) {
    throw new Error('Could not determine session participants');
  }

  // Verify the wallet is part of the session (confirmer should be the one receiving payment)
  const isMentor = verifiedMentorWallet.toLowerCase() === validatedByWallet.toLowerCase();
  const isLearner = verifiedLearnerWallet.toLowerCase() === validatedByWallet.toLowerCase();
  
  if (!isMentor && !isLearner) {
    throw new Error('Wallet is not part of this session');
  }

  // Get session expiration for the payment validation entity
  let sessionExpiration = 31536000; // Default 1 year fallback
  try {
    const session = await getSessionByKey(sessionKey);
    if (session && session.sessionDate) {
      const sessionStartTime = new Date(session.sessionDate).getTime();
      const durationMinutes = typeof session.duration === 'number' ? session.duration : parseInt(String(session.duration || 60), 10);
      const sessionDurationMs = durationMinutes * 60 * 1000;
      const bufferMs = 60 * 60 * 1000; // 1 hour buffer
      const expirationTime = sessionStartTime + sessionDurationMs + bufferMs;
      const now = Date.now();
      const calculatedExpiration = Math.max(1, Math.floor((expirationTime - now) / 1000));
      // Ensure it's a proper integer (not a float) for BigInt conversion
      sessionExpiration = Number.isInteger(calculatedExpiration) ? calculatedExpiration : Math.floor(calculatedExpiration);
    }
  } catch (e) {
    console.warn('Could not fetch session for expiration calculation, using default:', e);
  }
  // Final safety check: ensure sessionExpiration is always an integer
  sessionExpiration = Math.floor(sessionExpiration);

  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();

  // Create payment validation entity
  const { entityKey, txHash } = await walletClient.createEntity({
    payload: enc.encode(JSON.stringify({
      paymentTxHash,
      validatedAt: createdAt,
    })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'session_payment_validation' },
      { key: 'sessionKey', value: sessionKey },
      { key: 'paymentTxHash', value: paymentTxHash },
      { key: 'validatedBy', value: validatedByWallet },
      { key: 'mentorWallet', value: verifiedMentorWallet },
      { key: 'learnerWallet', value: verifiedLearnerWallet },
      { key: 'spaceId', value: spaceId },
      { key: 'createdAt', value: createdAt },
    ],
    expiresIn: sessionExpiration,
  });

  return { key: entityKey, txHash };
}

