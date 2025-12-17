/**
 * LearningFollow CRUD helpers
 * 
 * Tracks which skills (topics) a user is following for learning communities.
 * 
 * Reference: refs/doc/learner_communities.md
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { handleTransactionWithTimeout } from "./transaction-utils";
import { SPACE_ID } from "@/lib/config";

export type LearningFollow = {
  key: string;
  profile_wallet: string; // Wallet address (reference to Profile.wallet)
  skill_id: string; // Skill entity key (reference to Skill.key)
  mode: 'learning' | 'teaching' | 'both'; // Future-proof, even if not used heavily in beta
  active: boolean; // Soft delete flag
  spaceId: string;
  createdAt: string;
  txHash?: string;
}

/**
 * Create a LearningFollow entity
 */
export async function createLearningFollow({
  profile_wallet,
  skill_id,
  mode = 'learning',
  privateKey,
  spaceId = SPACE_ID,
}: {
  profile_wallet: string;
  skill_id: string;
  mode?: 'learning' | 'teaching' | 'both';
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();
  const active = true;

  // LearningFollow should persist long-term (1 year)
  const expiresIn = 31536000; // 1 year in seconds

  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({
        mode,
        active,
        createdAt,
      })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'learning_follow' },
        { key: 'profile_wallet', value: profile_wallet.toLowerCase() },
        { key: 'skill_id', value: skill_id },
        { key: 'mode', value: mode },
        { key: 'active', value: String(active) },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn,
    });
  });

  const { entityKey, txHash } = result;

  // Store txHash in separate entity for reliable querying
  try {
    await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({ txHash })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'learning_follow_txhash' },
        { key: 'followKey', value: entityKey },
        { key: 'profile_wallet', value: profile_wallet.toLowerCase() },
        { key: 'skill_id', value: skill_id },
        { key: 'spaceId', value: spaceId },
      ],
      expiresIn,
    });
  } catch (error: any) {
    console.warn('[learningFollow] Failed to create learning_follow_txhash entity, but follow was created:', error);
  }

  return { key: entityKey, txHash };
}

/**
 * List LearningFollow entities
 */
export async function listLearningFollows({
  profile_wallet,
  skill_id,
  active = true,
  spaceId,
  spaceIds,
  limit = 100,
}: {
  profile_wallet?: string;
  skill_id?: string;
  active?: boolean;
  spaceId?: string;
  spaceIds?: string[];
  limit?: number;
} = {}): Promise<LearningFollow[]> {
  try {
    const publicClient = getPublicClient();
    
    // Build query with space ID filtering
    let queryBuilder = publicClient.buildQuery()
      .where(eq('type', 'learning_follow'))
      .withAttributes(true)
      .withPayload(true);
    
    // Support multiple spaceIds (builder mode) or single spaceId
    if (spaceIds && spaceIds.length > 0) {
      // Query all, filter client-side (Arkiv doesn't support OR queries)
      queryBuilder = queryBuilder.limit(limit || 100);
    } else {
      // Use provided spaceId or default to SPACE_ID from config
      const finalSpaceId = spaceId || SPACE_ID;
      queryBuilder = queryBuilder.where(eq('spaceId', finalSpaceId)).limit(limit || 100);
    }
    
    // Fetch follow entities and txHash entities in parallel
    const [result, txHashResult] = await Promise.all([
      queryBuilder.fetch(),
      publicClient.buildQuery()
        .where(eq('type', 'learning_follow_txhash'))
        .withAttributes(true)
        .withPayload(true)
        .fetch(),
    ]);

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.error('[listLearningFollows] Invalid result from Arkiv query:', result);
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
        const followKey = getAttr('followKey');
        try {
          if (entity.payload) {
            const decoded = entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
              ? entity.payload
              : JSON.stringify(entity.payload);
            const payload = JSON.parse(decoded);
            if (payload.txHash && followKey) {
              txHashMap[followKey] = payload.txHash;
            }
          }
        } catch (e) {
          // Ignore decode errors
        }
      });
    }

    let follows = result.entities.map((entity: any) => {
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
        console.error('[listLearningFollows] Error decoding payload:', e);
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
        profile_wallet: getAttr('profile_wallet'),
        skill_id: getAttr('skill_id'),
        mode: (getAttr('mode') || 'learning') as 'learning' | 'teaching' | 'both',
        active: getAttr('active') === 'true' || payload.active === true,
        spaceId: getAttr('spaceId') || SPACE_ID, // Use SPACE_ID from config as fallback (entities should always have spaceId)
        createdAt: getAttr('createdAt') || payload.createdAt,
        txHash: txHashMap[entity.key] || payload.txHash || undefined,
      };
    });

    // Apply wallet and skill filters first
    if (profile_wallet) {
      const normalizedWallet = profile_wallet.toLowerCase();
      follows = follows.filter(f => f.profile_wallet.toLowerCase() === normalizedWallet);
    }
    if (skill_id) {
      follows = follows.filter(f => f.skill_id === skill_id);
    }

    // Sort by most recent first
    follows = follows.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Handle soft-delete pattern: Since Arkiv is immutable, unfollow creates a new entity with active=false
    // but the old entity with active=true still exists. We need to deduplicate by taking the most recent
    // entity for each profile_wallet + skill_id combination (most recent entity = current state).
    //
    // Group by profile_wallet + skill_id and take the most recent entity for each combination
    const followMap = new Map<string, LearningFollow>();
    for (const follow of follows) {
      const key = `${follow.profile_wallet.toLowerCase()}:${follow.skill_id}`;
      const existing = followMap.get(key);
      if (!existing || new Date(follow.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        followMap.set(key, follow);
      }
    }

    // Get deduplicated follows (most recent per profile+skill)
    const currentFollows = Array.from(followMap.values());

    // Now apply active filter if specified
    if (active !== undefined) {
      const filtered = currentFollows.filter(f => f.active === active);
      // Sort again after filtering
      return filtered.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    // Return sorted by most recent first
    return currentFollows.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error: any) {
    console.error('[listLearningFollows] Error:', error);
    return [];
  }
}

/**
 * Unfollow a skill (soft delete by setting active = false)
 * 
 * Note: For beta, we use soft delete. Future: could create an "unfollow" entity for audit trail.
 */
export async function unfollowSkill({
  profile_wallet,
  skill_id,
  privateKey,
  spaceId = SPACE_ID,
}: {
  profile_wallet: string;
  skill_id: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  // For beta: Create a new entity with active = false
  // This maintains immutability while allowing "unfollow" functionality
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();
  const active = false;

  const expiresIn = 31536000; // 1 year in seconds

  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({
        mode: 'learning', // Default mode
        active,
        createdAt,
        unfollowed: true, // Flag to indicate this is an unfollow
      })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'learning_follow' },
        { key: 'profile_wallet', value: profile_wallet.toLowerCase() },
        { key: 'skill_id', value: skill_id },
        { key: 'mode', value: 'learning' },
        { key: 'active', value: String(active) },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn,
    });
  });

  const { entityKey, txHash } = result;

  return { key: entityKey, txHash };
}
