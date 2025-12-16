/**
 * Learner Quest CRUD helpers
 *
 * Arkiv-native implementation for learner quests and progress tracking.
 * Tracks reading materials and user progress through curated quests.
 *
 * Reference: refs/learner-quests-implementation-plan.md
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { handleTransactionWithTimeout } from "./transaction-utils";

export type LearnerQuestMaterial = {
  id: string;
  title: string;
  author: string;
  year?: number;
  url: string;
  category: 'foundational' | 'recent' | 'book';
  description: string;
};

export type LearnerQuest = {
  key: string;
  questId: string;
  title: string;
  description: string;
  source: string;
  questType: 'reading_list' | 'language_assessment';
  materials: LearnerQuestMaterial[];
  metadata: {
    totalMaterials: number;
    categories: string[];
    lastUpdated: string;
  };
  createdAt: string;
  status: 'active' | 'archived';
  txHash?: string;
};

export type LearnerQuestProgress = {
  key: string;
  wallet: string;
  questId: string;
  materialId: string;
  status: 'read' | 'in_progress' | 'not_started';
  readAt?: string;
  createdAt: string;
  txHash?: string;
};

/**
 * Create learner quest definition
 *
 * Used by admins to create/update quest definitions.
 */
export async function createLearnerQuest({
  questId,
  title,
  description,
  source,
  materials,
  questType = 'reading_list',
  privateKey,
  spaceId = 'local-dev',
}: {
  questId: string;
  title: string;
  description: string;
  source: string;
  materials: LearnerQuestMaterial[];
  questType?: 'reading_list' | 'language_assessment';
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string } | null> {
  try {
    const walletClient = getWalletClientFromPrivateKey(privateKey);
    if (!walletClient) {
      throw new Error('Failed to get wallet client');
    }

    const enc = new TextEncoder();
    const createdAt = new Date().toISOString();

    const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify({
          materials,
          metadata: {
            totalMaterials: materials.length,
            categories: [...new Set(materials.map(m => m.category))],
            lastUpdated: createdAt,
          },
        })),
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'learner_quest' },
          { key: 'questId', value: questId },
          { key: 'title', value: title },
          { key: 'description', value: description },
          { key: 'source', value: source },
          { key: 'questType', value: questType },
          { key: 'status', value: 'active' },
          { key: 'spaceId', value: spaceId },
          { key: 'createdAt', value: createdAt },
        ],
        // Long-term TTL (10 years - quest definitions are curated content)
        expiresIn: 315360000, // 10 years in seconds
      });
    });

    // Create txhash entity
    try {
      await handleTransactionWithTimeout(async () => {
        return await walletClient.createEntity({
          payload: enc.encode(JSON.stringify({})),
          contentType: 'application/json',
          attributes: [
            { key: 'type', value: 'learner_quest_txhash' },
            { key: 'questKey', value: entityKey },
            { key: 'txHash', value: txHash },
            { key: 'spaceId', value: spaceId },
            { key: 'createdAt', value: createdAt },
          ],
          expiresIn: 315360000, // 10 years (matches quest entity)
        });
      });
    } catch (error) {
      console.warn('[createLearnerQuest] Failed to create txhash entity:', error);
    }

    return { key: entityKey, txHash };
  } catch (error: any) {
    console.error('[createLearnerQuest] Error:', error);
    return null;
  }
}

/**
 * List all active learner quests
 *
 * Returns all active quest definitions, sorted by most recent first.
 * Optionally filter by quest type.
 */
export async function listLearnerQuests(options?: {
  questType?: 'reading_list' | 'language_assessment';
}): Promise<LearnerQuest[]> {
  try {
    const publicClient = getPublicClient();
    let query = publicClient.buildQuery()
      .where(eq('type', 'learner_quest'))
      .where(eq('status', 'active'));

    // Filter by quest type if specified
    if (options?.questType) {
      query = query.where(eq('questType', options.questType));
    }

    const result = await query
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch();

    if (!result?.entities || !Array.isArray(result.entities) || result.entities.length === 0) {
      return [];
    }

    // Helper to get attribute value
    const getAttr = (entity: any, key: string): string => {
      const attrs = entity.attributes || {};
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };

    // Map entities to quest objects
    const quests: LearnerQuest[] = result.entities
      .map((entity: any) => {
        try {
          const decoded = entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
            ? entity.payload
            : JSON.stringify(entity.payload);
          const payload = JSON.parse(decoded);

          return {
            key: entity.key,
            questId: getAttr(entity, 'questId'),
            title: getAttr(entity, 'title'),
            description: getAttr(entity, 'description'),
            source: getAttr(entity, 'source'),
            status: getAttr(entity, 'status') as 'active' | 'archived',
            materials: payload.materials || [],
            metadata: payload.metadata || {},
            createdAt: getAttr(entity, 'createdAt'),
            txHash: (entity as any).txHash || undefined,
          } as LearnerQuest;
        } catch (e) {
          console.error('[listLearnerQuests] Error decoding payload:', e);
          return null;
        }
      })
      .filter((q): q is LearnerQuest => q !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Deduplicate by questId (keep most recent version of each quest)
    const questMap = new Map<string, LearnerQuest>();
    for (const quest of quests) {
      if (!questMap.has(quest.questId)) {
        questMap.set(quest.questId, quest);
      }
    }

    return Array.from(questMap.values());
  } catch (error: any) {
    console.error('[listLearnerQuests] Error:', error);
    return [];
  }
}

/**
 * Get active learner quest by ID
 */
export async function getLearnerQuest(questId: string): Promise<LearnerQuest | null> {
  try {
    const publicClient = getPublicClient();
    const result = await publicClient.buildQuery()
      .where(eq('type', 'learner_quest'))
      .where(eq('questId', questId))
      .where(eq('status', 'active'))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch();

    if (!result?.entities || !Array.isArray(result.entities) || result.entities.length === 0) {
      return null;
    }

    // Helper to get attribute value
    const getAttr = (entity: any, key: string): string => {
      const attrs = entity.attributes || {};
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };

    // Get most recent quest definition (immutability pattern)
    const quests: LearnerQuest[] = result.entities
      .map((entity: any) => {
        try {
          const decoded = entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
            ? entity.payload
            : JSON.stringify(entity.payload);
          const payload = JSON.parse(decoded);

          // Default to 'reading_list' for backward compatibility
          const questType = (getAttr(entity, 'questType') || 'reading_list') as 'reading_list' | 'language_assessment';

          return {
            key: entity.key,
            questId: getAttr(entity, 'questId'),
            title: getAttr(entity, 'title'),
            description: getAttr(entity, 'description'),
            source: getAttr(entity, 'source'),
            questType,
            status: getAttr(entity, 'status') as 'active' | 'archived',
            materials: payload.materials || [],
            metadata: payload.metadata || {},
            createdAt: getAttr(entity, 'createdAt'),
            txHash: (entity as any).txHash || undefined,
          } as LearnerQuest;
        } catch (e) {
          console.error('[getLearnerQuest] Error decoding payload:', e);
          return null;
        }
      })
      .filter((q): q is LearnerQuest => q !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return quests[0] || null;
  } catch (error: any) {
    console.error('[getLearnerQuest] Error:', error);
    return null;
  }
}

/**
 * Mark material as read
 *
 * Creates a new progress entity when user clicks external link.
 */
export async function markMaterialAsRead({
  wallet,
  questId,
  materialId,
  sourceUrl,
  privateKey,
  spaceId = 'local-dev',
}: {
  wallet: string;
  questId: string;
  materialId: string;
  sourceUrl: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string } | null> {
  try {
    const walletClient = getWalletClientFromPrivateKey(privateKey);
    if (!walletClient) {
      throw new Error('Failed to get wallet client');
    }

    const enc = new TextEncoder();
    const now = new Date().toISOString();
    const normalizedWallet = wallet.toLowerCase();

    const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify({
          wallet: normalizedWallet,
          questId,
          materialId,
          status: 'read',
          readAt: now,
          metadata: {
            clickedAt: now,
            sourceUrl,
          },
        })),
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'learner_quest_progress' },
          { key: 'wallet', value: normalizedWallet },
          { key: 'questId', value: questId },
          { key: 'materialId', value: materialId },
          { key: 'status', value: 'read' },
          { key: 'spaceId', value: spaceId },
          { key: 'createdAt', value: now },
        ],
        expiresIn: 31536000, // 1 year (same as onboarding events)
      });
    });

    // Create txhash entity
    try {
      await handleTransactionWithTimeout(async () => {
        return await walletClient.createEntity({
          payload: enc.encode(JSON.stringify({})),
          contentType: 'application/json',
          attributes: [
            { key: 'type', value: 'learner_quest_progress_txhash' },
            { key: 'progressKey', value: entityKey },
            { key: 'txHash', value: txHash },
            { key: 'spaceId', value: spaceId },
            { key: 'createdAt', value: now },
          ],
          expiresIn: 31536000, // 1 year
        });
      });
    } catch (error) {
      console.warn('[markMaterialAsRead] Failed to create txhash entity:', error);
    }

    return { key: entityKey, txHash };
  } catch (error: any) {
    console.error('[markMaterialAsRead] Error:', error);
    return null;
  }
}

/**
 * Get user progress for a quest
 *
 * Returns progress for all materials in the quest.
 * Uses soft-delete pattern: most recent entity per material determines current status.
 */
export async function getLearnerQuestProgress({
  wallet,
  questId,
}: {
  wallet: string;
  questId: string;
}): Promise<Record<string, LearnerQuestProgress>> {
  try {
    const publicClient = getPublicClient();
    const normalizedWallet = wallet.toLowerCase();
    const result = await publicClient.buildQuery()
      .where(eq('type', 'learner_quest_progress'))
      .where(eq('wallet', normalizedWallet))
      .where(eq('questId', questId))
      .withAttributes(true)
      .withPayload(true)
      .limit(1000)
      .fetch();

    if (!result?.entities || !Array.isArray(result.entities) || result.entities.length === 0) {
      return {};
    }

    // Helper to get attribute value
    const getAttr = (entity: any, key: string): string => {
      const attrs = entity.attributes || {};
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };

    // Map entities to progress objects
    const allProgress = result.entities
      .map((entity: any) => {
        try {
          const decoded = entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
            ? entity.payload
            : JSON.stringify(entity.payload);
          const payload = JSON.parse(decoded);

          return {
            key: entity.key,
            wallet: getAttr(entity, 'wallet'),
            questId: getAttr(entity, 'questId'),
            materialId: getAttr(entity, 'materialId'),
            status: getAttr(entity, 'status') as 'read' | 'in_progress' | 'not_started',
            readAt: payload.readAt,
            createdAt: getAttr(entity, 'createdAt'),
            txHash: (entity as any).txHash || undefined,
          };
        } catch (e) {
          console.error('[getLearnerQuestProgress] Error decoding payload:', e);
          return null;
        }
      })
      .filter(Boolean) as LearnerQuestProgress[];

    // Sort by most recent first
    allProgress.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Deduplicate by materialId (soft-delete pattern)
    // Most recent entity per material determines current status
    const progressMap = new Map<string, LearnerQuestProgress>();
    for (const progress of allProgress) {
      const key = progress.materialId;
      if (!progressMap.has(key)) {
        progressMap.set(key, progress);
      }
    }

    // Convert to record
    const resultMap: Record<string, LearnerQuestProgress> = {};
    progressMap.forEach((progress, materialId) => {
      resultMap[materialId] = progress;
    });

    return resultMap;
  } catch (error: any) {
    console.error('[getLearnerQuestProgress] Error:', error);
    return {};
  }
}

