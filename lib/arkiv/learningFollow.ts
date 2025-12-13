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
  spaceId = 'local-dev',
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
  limit = 100,
}: {
  profile_wallet?: string;
  skill_id?: string;
  active?: boolean;
  limit?: number;
} = {}): Promise<LearningFollow[]> {
  try {
    const publicClient = getPublicClient();
    
    // Fetch follow entities and txHash entities in parallel
    const [result, txHashResult] = await Promise.all([
      publicClient.buildQuery()
        .where(eq('type', 'learning_follow'))
        .withAttributes(true)
        .withPayload(true)
        .limit(limit || 100)
        .fetch(),
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
        spaceId: getAttr('spaceId') || 'local-dev',
        createdAt: getAttr('createdAt') || payload.createdAt,
        txHash: txHashMap[entity.key] || payload.txHash || undefined,
      };
    });

    // Apply filters
    if (profile_wallet) {
      const normalizedWallet = profile_wallet.toLowerCase();
      follows = follows.filter(f => f.profile_wallet.toLowerCase() === normalizedWallet);
    }
    if (skill_id) {
      follows = follows.filter(f => f.skill_id === skill_id);
    }
    if (active !== undefined) {
      follows = follows.filter(f => f.active === active);
    }

    // Sort by most recent first
    return follows.sort((a, b) => 
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
  spaceId = 'local-dev',
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
