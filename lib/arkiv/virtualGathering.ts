/**
 * Virtual Gathering CRUD helpers
 * 
 * Handles community virtual gatherings (public meetings).
 * Anyone can suggest a gathering, anyone can RSVP.
 * Jitsi is generated immediately (no confirmation needed).
 * 
 * Reference: Learner community feature
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { generateJitsiMeeting } from "../jitsi";
import { JITSI_BASE_URL, SPACE_ID } from "../config";
import { handleTransactionWithTimeout } from "./transaction-utils";

export type VirtualGathering = {
  key: string;
  organizerWallet: string;
  community: string; // e.g., "beta_users"
  title: string;
  description?: string;
  sessionDate: string; // ISO timestamp
  duration: number; // Duration in minutes
  spaceId: string;
  createdAt: string;
  txHash?: string;
  // Jitsi video meeting fields (generated immediately)
  videoProvider?: 'jitsi' | 'none' | 'custom';
  videoRoomName?: string;
  videoJoinUrl?: string;
  videoJwtToken?: string;
  // RSVP tracking
  rsvpCount?: number; // Number of RSVPs (computed from session entities)
};

/**
 * Create a virtual gathering
 * 
 * Jitsi meeting is generated immediately (no confirmation needed).
 * 
 * @param data - Gathering data
 * @param privateKey - Private key for signing
 * @returns Entity key and transaction hash
 */
export async function createVirtualGathering({
  organizerWallet,
  community,
  title,
  description,
  sessionDate,
  duration = 60,
  privateKey,
}: {
  organizerWallet: string;
  community: string;
  title: string;
  description?: string;
  sessionDate: string; // ISO timestamp
  duration?: number;
  privateKey: `0x${string}`;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const spaceId = 'local-dev';
  const createdAt = new Date().toISOString();

  // We'll generate Jitsi with a temporary key first, then update if needed
  // The room name will be based on a stable identifier
  const tempKey = `vg-${community}-${Date.now()}`;
  const jitsiInfo = generateJitsiMeeting(tempKey, JITSI_BASE_URL);

  const payload = {
    title,
    description: description || '',
    sessionDate,
    duration: duration || 60,
    videoProvider: jitsiInfo.videoProvider,
    videoRoomName: jitsiInfo.videoRoomName,
    videoJoinUrl: jitsiInfo.videoJoinUrl,
    createdAt,
  };

  // Calculate expiration: sessionDate + duration + 1 hour buffer
  const sessionStartTime = new Date(sessionDate).getTime();
  // Ensure duration is always an integer to prevent float propagation
  const durationMinutes = Math.floor(typeof duration === 'number' ? duration : parseInt(String(duration || 60), 10));
  const sessionDurationMs = durationMinutes * 60 * 1000;
  const bufferMs = 60 * 60 * 1000; // 1 hour buffer
  const expirationTime = sessionStartTime + sessionDurationMs + bufferMs;
  const now = Date.now();
  // Calculate expiresIn and ensure it's always an integer (BigInt requirement)
  const expiresInSecondsRaw = (expirationTime - now) / 1000;
  const expiresInSeconds = Math.max(1, Math.floor(expiresInSecondsRaw));
  // Final safety check: ensure it's definitely an integer
  const expiresInSecondsInt = Number.isInteger(expiresInSeconds) ? expiresInSeconds : Math.floor(expiresInSeconds);

  // Create gathering entity
  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'virtual_gathering' },
        { key: 'organizerWallet', value: organizerWallet.toLowerCase() },
        { key: 'community', value: community },
        { key: 'title', value: title },
        { key: 'sessionDate', value: sessionDate },
        { key: 'duration', value: String(duration || 60) },
        { key: 'videoProvider', value: jitsiInfo.videoProvider },
        { key: 'videoRoomName', value: jitsiInfo.videoRoomName },
        { key: 'videoJoinUrl', value: jitsiInfo.videoJoinUrl },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn: expiresInSecondsInt,
    });
  });

  // Note: Jitsi room is already generated and stored in the entity
  // The room name uses a stable pattern based on community and timestamp

  // Store txHash
  try {
    await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({ txHash })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'virtual_gathering_txhash' },
        { key: 'gatheringKey', value: entityKey },
        { key: 'organizerWallet', value: organizerWallet.toLowerCase() },
        { key: 'community', value: community },
        { key: 'spaceId', value: spaceId },
      ],
      expiresIn: expiresInSecondsInt,
    });
  } catch (error: any) {
    console.warn('[virtualGathering] Failed to create txhash entity:', error);
  }

  // Create notifications for all members of the learner community when a new meeting is scheduled
  try {
    const { createNotification } = await import('./notifications');
    const { listLearningFollows } = await import('./learningFollow');
    const { getSkillBySlug } = await import('./skill');
    
    // Get the skill entity to find its key
    const skillEntity = await getSkillBySlug(community);
    if (!skillEntity) {
      console.warn(`[createVirtualGathering] Skill not found for community: ${community}`);
      return { key: entityKey, txHash };
    }

    // Get all learning follows for this skill (community members)
    const learningFollows = await listLearningFollows({
      skill_id: skillEntity.key,
      active: true,
      limit: 1000, // Max 1000 community members
    });

    // Create notification for each community member (excluding the organizer)
    const organizerWalletLower = organizerWallet.toLowerCase();
    const notificationPromises = learningFollows
      .filter(follow => follow.profile_wallet.toLowerCase() !== organizerWalletLower)
      .map(follow => 
        createNotification({
          wallet: follow.profile_wallet.toLowerCase(),
          notificationType: 'community_meeting_scheduled',
          sourceEntityType: 'virtual_gathering',
          sourceEntityKey: entityKey,
          title: 'New Community Meeting',
          message: `${title} - ${new Date(sessionDate).toLocaleDateString()}`,
          link: `/topic/${community}`,
          metadata: {
            gatheringKey: entityKey,
            community,
            skillKey: skillEntity.key,
            skillName: skillEntity.name_canonical,
            title,
            description: description || undefined,
            sessionDate,
            duration: durationMinutes,
            organizerWallet: organizerWallet.toLowerCase(),
            createdAt,
            txHash,
          },
          privateKey,
          spaceId,
        }).catch((err: any) => {
          console.warn(`[createVirtualGathering] Failed to create notification for ${follow.profile_wallet}:`, err);
        })
      );

    // Don't wait for all notifications - fire and forget (non-blocking)
    Promise.all(notificationPromises).catch((err: any) => {
      console.warn('[createVirtualGathering] Some notifications failed to create:', err);
    });
  } catch (err: any) {
    // Notification creation failure shouldn't block gathering creation
    console.warn('[createVirtualGathering] Error creating notifications:', err);
  }

  return { key: entityKey, txHash };
}

/**
 * List virtual gatherings
 * 
 * @param params - Optional filters (community, organizerWallet)
 * @returns Array of virtual gatherings
 */
export async function listVirtualGatherings({
  community,
  organizerWallet,
  limit = 100,
}: {
  community?: string;
  organizerWallet?: string;
  limit?: number;
} = {}): Promise<VirtualGathering[]> {
  const publicClient = getPublicClient();
  const gatherings: VirtualGathering[] = [];

  try {
    const queryBuilder = publicClient.buildQuery()
      .where(eq('type', 'virtual_gathering'))
      .withAttributes(true)
      .withPayload(true)
      .limit(limit || 100);

    const result = await queryBuilder.fetch();
    const entities = result?.entities || [];

    // Get txHashes
    const txHashResult = await publicClient.buildQuery()
      .where(eq('type', 'virtual_gathering_txhash'))
      .withAttributes(true)
      .withPayload(true)
      .fetch();

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
        const gatheringKey = getAttr('gatheringKey');
        try {
          if (entity.payload) {
            const decoded = entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
              ? entity.payload
              : JSON.stringify(entity.payload);
            const payload = JSON.parse(decoded);
            if (payload.txHash && gatheringKey) {
              txHashMap[gatheringKey] = payload.txHash;
            }
          }
        } catch (e) {
          // Ignore decode errors
        }
      });
    }

    // Get RSVP counts (from session entities linked to gatherings)
    const rsvpCounts: Record<string, number> = {};
    try {
      const rsvpResult = await publicClient.buildQuery()
        .where(eq('type', 'session'))
        .where(eq('skill', 'virtual_gathering_rsvp')) // Use skill field to mark RSVP sessions
        .withAttributes(true)
        .limit(1000)
        .fetch();

      if (rsvpResult?.entities) {
        rsvpResult.entities.forEach((entity: any) => {
          const attrs = entity.attributes || {};
          const getAttr = (key: string): string => {
            if (Array.isArray(attrs)) {
              const attr = attrs.find((a: any) => a.key === key);
              return String(attr?.value || '');
            }
            return String(attrs[key] || '');
          };
          // Store gathering key in gatheringKey attribute or notes field
          const gatheringKey = getAttr('gatheringKey') || 
            (getAttr('notes')?.includes('virtual_gathering_rsvp:') 
              ? getAttr('notes').split('virtual_gathering_rsvp:')[1]?.split(',')[0]?.trim()
              : null);
          if (gatheringKey) {
            rsvpCounts[gatheringKey] = (rsvpCounts[gatheringKey] || 0) + 1;
          }
        });
      }
    } catch (e) {
      console.warn('[listVirtualGatherings] Error counting RSVPs:', e);
    }

    for (const entity of entities) {
      try {
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
          console.error('[listVirtualGatherings] Error decoding payload:', e);
        }

        const attrs = entity.attributes || {};
        const getAttr = (key: string): string => {
          if (Array.isArray(attrs)) {
            const attr = attrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(attrs[key] || '');
        };

        // Ensure duration is always an integer (prevent BigInt conversion errors)
        const durationRaw = payload.duration || getAttr('duration') || 60;
        const durationInt = Math.floor(
          typeof durationRaw === 'number' 
            ? durationRaw 
            : parseInt(String(durationRaw), 10) || 60
        );

        const gathering: VirtualGathering = {
          key: entity.key,
          organizerWallet: getAttr('organizerWallet') || payload.organizerWallet,
          community: getAttr('community') || payload.community,
          title: getAttr('title') || payload.title,
          description: payload.description,
          sessionDate: getAttr('sessionDate') || payload.sessionDate,
          duration: durationInt,
          spaceId: getAttr('spaceId') || payload.spaceId || SPACE_ID,
          createdAt: getAttr('createdAt') || payload.createdAt,
          txHash: txHashMap[entity.key] || payload.txHash,
          videoProvider: (getAttr('videoProvider') || payload.videoProvider || 'jitsi') as 'jitsi' | 'none' | 'custom',
          videoRoomName: getAttr('videoRoomName') || payload.videoRoomName,
          videoJoinUrl: getAttr('videoJoinUrl') || payload.videoJoinUrl,
          videoJwtToken: payload.videoJwtToken,
          rsvpCount: rsvpCounts[entity.key] || 0,
        };

        // Apply filters
        if (community && gathering.community !== community) continue;
        if (organizerWallet && gathering.organizerWallet.toLowerCase() !== organizerWallet.toLowerCase()) continue;

        gatherings.push(gathering);
      } catch (e) {
        console.error('[listVirtualGatherings] Error processing entity:', e);
      }
    }

    // Sort by sessionDate (upcoming first)
    return gatherings.sort((a, b) => 
      new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime()
    );
  } catch (error: any) {
    console.error('[listVirtualGatherings] Error:', error);
    return [];
  }
}

/**
 * Get virtual gathering by key
 */
export async function getVirtualGatheringByKey(key: string): Promise<VirtualGathering | null> {
  const gatherings = await listVirtualGatherings({ limit: 1000 });
  return gatherings.find(g => g.key === key) || null;
}

/**
 * RSVP to a virtual gathering
 * 
 * Creates a session entity linked to the gathering (for user's profile).
 * This is a "self-confirmed" session - no mentor/learner confirmation needed.
 * 
 * @param data - RSVP data
 * @param privateKey - Private key for signing
 * @returns Entity key and transaction hash
 */
export async function rsvpToGathering({
  gatheringKey,
  wallet,
  privateKey,
}: {
  gatheringKey: string;
  wallet: string;
  privateKey: `0x${string}`;
}): Promise<{ key: string; txHash: string }> {
  // Get the gathering to get session details
  const gathering = await getVirtualGatheringByKey(gatheringKey);
  if (!gathering) {
    throw new Error('Gathering not found');
  }

  // Try to resolve community slug to skill_id
  let skill_id: string | undefined;
  try {
    const { getSkillBySlug } = await import('./skill');
    const skillEntity = await getSkillBySlug(gathering.community);
    if (skillEntity) {
      skill_id = skillEntity.key;
    }
  } catch (e) {
    console.warn('[rsvpToGathering] Could not resolve skill_id from community:', e);
    // Fallback: use community slug as skill_id (will show as skill_id in display)
    skill_id = gathering.community;
  }

  // Create a session entity for the RSVP
  // Use a special skill marker to identify RSVP sessions
  // Store gathering key in notes
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  // Use the gathering's spaceId to ensure consistency
  const spaceId = gathering.spaceId || SPACE_ID;
  const createdAt = new Date().toISOString();

  // For RSVP sessions, we use the wallet as both mentor and learner (self-confirmed)
  // This is a special case for community gatherings
  const normalizedWallet = wallet.toLowerCase();

  // Ensure duration in payload is also an integer (defensive - prevents float in payload)
  const payloadDuration = Math.floor(
    typeof gathering.duration === 'number' 
      ? gathering.duration 
      : parseInt(String(gathering.duration || 60), 10)
  );

  const payload = {
    sessionDate: gathering.sessionDate,
    duration: payloadDuration, // Use integer duration (prevents float propagation)
    notes: `virtual_gathering_rsvp:${gatheringKey},community:${gathering.community}`,
    // Mark as self-confirmed (no confirmation needed)
    selfConfirmed: true,
    gatheringKey,
    gatheringTitle: gathering.title,
    community: gathering.community, // Store community (skill slug) for easy access
    createdAt,
  };

  // Calculate expiration same as gathering
  // CRITICAL: Ensure all numeric values are integers before any calculations
  // This prevents float propagation that causes BigInt conversion errors
  
  // Step 1: Ensure duration is an integer (defensive - even though it should be from listVirtualGatherings)
  const durationRaw = gathering.duration;
  const durationMinutes = Math.floor(
    typeof durationRaw === 'number' 
      ? durationRaw 
      : parseInt(String(durationRaw || 60), 10)
  );
  // Final check: duration must be integer
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
    throw new Error(`Duration must be a positive integer, got: ${durationRaw} (resolved to: ${durationMinutes})`);
  }
  
  // Step 2: Calculate time values (all should be integers)
  const sessionStartTime = Math.floor(new Date(gathering.sessionDate).getTime());
  const sessionDurationMs = durationMinutes * 60 * 1000; // Integer * integer = integer
  const bufferMs = 60 * 60 * 1000; // Integer constant
  const expirationTime = sessionStartTime + sessionDurationMs + bufferMs; // All integers
  const now = Math.floor(Date.now()); // Ensure integer
  
  // Step 3: Calculate expiresIn (division produces float, must floor immediately)
  const timeDiffMs = expirationTime - now; // Integer - integer = integer
  const expiresInSecondsRaw = timeDiffMs / 1000; // Division produces float
  // Floor immediately and ensure minimum of 1 second
  const expiresInSeconds = Math.max(1, Math.floor(expiresInSecondsRaw));
  
  // Step 4: Final safety checks - must be integer for BigInt
  if (!Number.isInteger(expiresInSeconds)) {
    throw new Error(`expiresIn calculation produced non-integer: ${expiresInSeconds} (raw: ${expiresInSecondsRaw}, timeDiffMs: ${timeDiffMs})`);
  }
  
  // Step 5: One more defensive floor (should be no-op but ensures integer type)
  const expiresInSecondsInt = Math.floor(expiresInSeconds);
  
  // Step 6: Final validation before use
  if (!Number.isInteger(expiresInSecondsInt) || expiresInSecondsInt < 1) {
    throw new Error(`expiresIn must be a positive integer, got: ${expiresInSecondsInt} (type: ${typeof expiresInSecondsInt})`);
  }

  // Create session entity for RSVP
  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'session' },
        { key: 'mentorWallet', value: normalizedWallet },
        { key: 'learnerWallet', value: normalizedWallet },
        { key: 'skill', value: 'virtual_gathering_rsvp' }, // Special marker
        { key: 'gatheringKey', value: gatheringKey },
        { key: 'sessionDate', value: gathering.sessionDate },
        { key: 'status', value: 'scheduled' }, // Immediately scheduled (self-confirmed)
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
        ...(skill_id ? [{ key: 'skill_id', value: skill_id }] : []),
      ],
      expiresIn: expiresInSecondsInt,
    });
  });

  // Also create a confirmation entity to mark it as confirmed
  try {
    await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({
        confirmedAt: createdAt,
        selfConfirmed: true,
      })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'session_confirmation' },
        { key: 'sessionKey', value: entityKey },
        { key: 'confirmedBy', value: normalizedWallet },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn: expiresInSecondsInt,
    });
  } catch (error: any) {
    console.warn('[rsvpToGathering] Failed to create confirmation entity:', error);
  }

  return { key: entityKey, txHash };
}

/**
 * Check if wallet has RSVP'd to a gathering
 * 
 * @param gatheringKey - The gathering entity key
 * @param wallet - Wallet address to check
 * @param spaceId - Space ID to filter by (required for accurate results)
 */
export async function hasRsvpdToGathering(
  gatheringKey: string,
  wallet: string,
  spaceId?: string
): Promise<boolean> {
  const publicClient = getPublicClient();
  const normalizedWallet = wallet.toLowerCase();
  const finalSpaceId = spaceId || SPACE_ID;

  try {
    // Query for RSVP sessions - check both learnerWallet and mentorWallet (since it's self-confirmed)
    // CRITICAL: Filter by spaceId to ensure we're checking the correct environment
    const [learnerResult, mentorResult] = await Promise.all([
      publicClient.buildQuery()
        .where(eq('type', 'session'))
        .where(eq('skill', 'virtual_gathering_rsvp'))
        .where(eq('gatheringKey', gatheringKey))
        .where(eq('learnerWallet', normalizedWallet))
        .where(eq('spaceId', finalSpaceId))
        .withAttributes(true)
        .limit(1)
        .fetch(),
      publicClient.buildQuery()
        .where(eq('type', 'session'))
        .where(eq('skill', 'virtual_gathering_rsvp'))
        .where(eq('gatheringKey', gatheringKey))
        .where(eq('mentorWallet', normalizedWallet))
        .where(eq('spaceId', finalSpaceId))
        .withAttributes(true)
        .limit(1)
        .fetch(),
    ]);

    return (learnerResult?.entities?.length || 0) > 0 || (mentorResult?.entities?.length || 0) > 0;
  } catch (error) {
    console.error('[hasRsvpdToGathering] Error:', error);
    return false;
  }
}

/**
 * List all wallets that have RSVP'd to a gathering
 * 
 * @param gatheringKey - The gathering entity key
 * @param spaceId - Space ID to filter by (required for accurate results)
 * @returns Array of wallet addresses (normalized to lowercase)
 */
export async function listRsvpWalletsForGathering(
  gatheringKey: string,
  spaceId?: string
): Promise<string[]> {
  const publicClient = getPublicClient();
  const finalSpaceId = spaceId || SPACE_ID;

  try {
    // Query all RSVP sessions for this gathering
    // CRITICAL: Filter by spaceId to ensure we're checking the correct environment
    const rsvpResult = await publicClient.buildQuery()
      .where(eq('type', 'session'))
      .where(eq('skill', 'virtual_gathering_rsvp'))
      .where(eq('gatheringKey', gatheringKey))
      .where(eq('spaceId', finalSpaceId))
      .withAttributes(true)
      .limit(1000)
      .fetch();

    if (!rsvpResult?.entities || !Array.isArray(rsvpResult.entities)) {
      return [];
    }

    // Extract unique wallets from learnerWallet (they're the same as mentorWallet for RSVPs)
    const wallets = new Set<string>();
    rsvpResult.entities.forEach((entity: any) => {
      const attrs = entity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };
      
      // For RSVP sessions, learnerWallet and mentorWallet are the same (self-confirmed)
      // Use learnerWallet as the source of truth
      const wallet = getAttr('learnerWallet') || getAttr('mentorWallet');
      if (wallet) {
        wallets.add(wallet.toLowerCase());
      }
    });

    return Array.from(wallets);
  } catch (error) {
    console.error('[listRsvpWalletsForGathering] Error:', error);
    return [];
  }
}
