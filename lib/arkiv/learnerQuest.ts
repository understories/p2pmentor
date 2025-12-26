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
import { SPACE_ID } from "../config";

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
  questType: 'reading_list' | 'language_assessment' | 'meta_learning';
  questVersion?: string; // Optional, defaults to '1' for backward compatibility
  creatorWallet?: string; // Optional, defaults to server signing wallet for admin-created
  // For reading_list quests:
  materials?: LearnerQuestMaterial[];
  metadata?: {
    totalMaterials?: number;
    categories?: string[];
    lastUpdated?: string;
    // For meta_learning quests:
    totalSteps?: number;
    estimatedTotalTime?: string;
    completionCriteria?: string;
  };
  // For meta_learning quests (loaded from JSON file):
  steps?: {
    stepId: string;
    title: string;
    description: string;
    estimatedDuration: string;
    conceptCard?: {
      title: string;
      body: string;
    } | null;
    minimumTimeGap?: number; // in milliseconds
  }[];
  // For language_assessment quests (stored in payload, not directly accessible here):
  // Use parseLanguageAssessmentQuest() from languageQuest.ts to extract
  createdAt: string;
  status: 'active' | 'archived';
  spaceId: string;
  txHash?: string;
};

export type LearnerQuestProgress = {
  key: string;
  wallet: string;
  questId: string;
  // For reading_list quests:
  materialId?: string;
  status?: 'read' | 'in_progress' | 'not_started';
  readAt?: string;
  // For language_assessment quests:
  sectionId?: string;
  questionId?: string;
  answer?: string | string[];
  correct?: boolean;
  score?: number;
  timeSpent?: number;
  answeredAt?: string;
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
  questVersion,
  creatorWallet,
  privateKey,
  spaceId = SPACE_ID,
  // For meta_learning quests, pass steps and metadata
  steps,
  metadata,
}: {
  questId: string;
  title: string;
  description: string;
  source: string;
  materials?: LearnerQuestMaterial[]; // Optional for meta_learning quests
  questType?: 'reading_list' | 'language_assessment' | 'meta_learning';
  questVersion?: string; // Optional, defaults to '1'
  creatorWallet?: string; // Optional, defaults to server signing wallet
  privateKey: `0x${string}`;
  spaceId?: string;
  steps?: Array<{
    stepId: string;
    title: string;
    description: string;
    estimatedDuration: string;
    conceptCard?: {
      title: string;
      body: string;
    } | null;
  }>;
  metadata?: {
    totalSteps?: number;
    estimatedTotalTime?: string;
    completionCriteria?: string;
  };
}): Promise<{ key: string; txHash: string } | null> {
  try {
    const walletClient = getWalletClientFromPrivateKey(privateKey);
    if (!walletClient) {
      throw new Error('Failed to get wallet client');
    }

    const enc = new TextEncoder();
    const createdAt = new Date().toISOString();

    // For meta_learning quests, store steps in payload instead of materials
    const payloadData = questType === 'meta_learning'
      ? {
          steps: steps || [],
          metadata: metadata || {},
        }
      : {
          materials: materials || [],
          metadata: {
            totalMaterials: (materials || []).length,
            categories: [...new Set((materials || []).map(m => m.category))],
            lastUpdated: createdAt,
          },
        };

    const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify(payloadData)),
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'learner_quest' },
          { key: 'questId', value: questId },
          { key: 'title', value: title },
          { key: 'description', value: description },
          { key: 'source', value: source },
          { key: 'questType', value: questType },
          { key: 'questVersion', value: questVersion || '1' }, // Default to '1' for backward compatibility
          ...(creatorWallet ? [{ key: 'creatorWallet', value: creatorWallet.toLowerCase() }] : []), // Normalize wallet
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
 * Optionally filter by quest type and spaceId.
 */
export async function listLearnerQuests(options?: {
  questType?: 'reading_list' | 'language_assessment' | 'meta_learning';
  spaceId?: string;
  spaceIds?: string[];
}): Promise<LearnerQuest[]> {
  try {
    const publicClient = getPublicClient();
    
    // Build query with space ID filtering
    let queryBuilder = publicClient.buildQuery()
      .where(eq('type', 'learner_quest'))
      .where(eq('status', 'active'));

    // Support multiple spaceIds (builder mode) or single spaceId
    if (options?.spaceIds && options.spaceIds.length > 0) {
      // Query all, filter client-side (Arkiv doesn't support OR queries)
      queryBuilder = queryBuilder.limit(100);
      console.log('[listLearnerQuests] Querying multiple spaceIds:', options.spaceIds);
    } else {
      // Use provided spaceId or default to SPACE_ID from config
      const finalSpaceId = options?.spaceId || SPACE_ID;
      console.log('[listLearnerQuests] Querying with spaceId:', finalSpaceId, {
        providedSpaceId: options?.spaceId,
        defaultSPACE_ID: SPACE_ID,
      });
      queryBuilder = queryBuilder.where(eq('spaceId', finalSpaceId)).limit(100);
    }

    // Filter by quest type if specified (but exclude meta_learning since we load from JSON)
    if (options?.questType && options.questType !== 'meta_learning') {
      queryBuilder = queryBuilder.where(eq('questType', options.questType));
    }

    const result = await queryBuilder
      .withAttributes(true)
      .withPayload(true)
      .fetch();

    console.log('[listLearnerQuests] Raw query result:', {
      entityCount: result?.entities?.length || 0,
      hasEntities: !!result?.entities,
    });

    if (!result?.entities || !Array.isArray(result.entities) || result.entities.length === 0) {
      console.log('[listLearnerQuests] No entities found');
      // Return empty array (meta_learning quest is loaded from JSON in API route)
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

          // Default to 'reading_list' for backward compatibility
          const questType = (getAttr(entity, 'questType') || 'reading_list') as 'reading_list' | 'language_assessment' | 'meta_learning';

          const quest: LearnerQuest = {
            key: entity.key,
            questId: getAttr(entity, 'questId'),
            title: getAttr(entity, 'title'),
            description: getAttr(entity, 'description'),
            source: getAttr(entity, 'source'),
            questType,
            questVersion: getAttr(entity, 'questVersion') || '1', // Default to '1' for backward compatibility
            creatorWallet: getAttr(entity, 'creatorWallet') || undefined, // Optional
            status: getAttr(entity, 'status') as 'active' | 'archived',
            spaceId: getAttr(entity, 'spaceId') || SPACE_ID,
            createdAt: getAttr(entity, 'createdAt'),
            txHash: (entity as any).txHash || undefined,
          };

          // Only include materials/metadata for reading_list quests
          if (questType === 'reading_list') {
            quest.materials = payload.materials || [];
            quest.metadata = payload.metadata || {};
          }

          return quest;
        } catch (e) {
          console.error('[listLearnerQuests] Error decoding payload:', e);
          return null;
        }
      })
      .filter((q): q is LearnerQuest => q !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Filter by spaceIds client-side if multiple requested
    let filteredQuests = quests;
    if (options?.spaceIds && options.spaceIds.length > 0) {
      filteredQuests = quests.filter((quest: LearnerQuest) => options.spaceIds!.includes(quest.spaceId));
    }

    // Deduplicate by questId (keep most recent version of each quest)
    const questMap = new Map<string, LearnerQuest>();
    for (const quest of filteredQuests) {
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
    // Note: meta_learning quest is loaded from JSON file in API route, not here
    // This keeps fs/path imports out of the library code

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
          const questType = (getAttr(entity, 'questType') || 'reading_list') as 'reading_list' | 'language_assessment' | 'meta_learning';

          // For reading_list quests, payload contains materials
          // For language_assessment quests, payload contains the full LanguageAssessmentQuest structure
          const quest: LearnerQuest = {
            key: entity.key,
            questId: getAttr(entity, 'questId'),
            title: getAttr(entity, 'title'),
            description: getAttr(entity, 'description'),
            source: getAttr(entity, 'source'),
            questType,
            questVersion: getAttr(entity, 'questVersion') || '1', // Default to '1' for backward compatibility
            creatorWallet: getAttr(entity, 'creatorWallet') || undefined, // Optional
            status: getAttr(entity, 'status') as 'active' | 'archived',
            spaceId: getAttr(entity, 'spaceId') || SPACE_ID,
            createdAt: getAttr(entity, 'createdAt'),
            txHash: (entity as any).txHash || undefined,
          };

          // Only include materials/metadata for reading_list quests
          if (questType === 'reading_list') {
            quest.materials = payload.materials || [];
            quest.metadata = payload.metadata || {};
          }

          return quest;
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
  spaceId = SPACE_ID,
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
    // Only process reading_list progress (has materialId)
    const progressMap = new Map<string, LearnerQuestProgress>();
    for (const progress of allProgress) {
      if (progress.materialId) {
        const key = progress.materialId;
        if (!progressMap.has(key)) {
          progressMap.set(key, progress);
        }
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

/**
 * Update learner quest (creates new version)
 *
 * Used to incrementally update quests without full re-seeding.
 * Follows Arkiv immutability pattern: creates new entity with incremented version.
 */
export async function updateLearnerQuest({
  questId,
  updates,
  privateKey,
  spaceId = SPACE_ID,
}: {
  questId: string;
  updates: Partial<{
    title: string;
    description: string;
    materials: LearnerQuestMaterial[]; // For reading lists
  }>;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string } | null> {
  try {
    // 1. Get current quest
    const current = await getLearnerQuest(questId);
    if (!current) {
      throw new Error(`Quest ${questId} not found`);
    }

    // 2. Get full quest entity to parse payload
    const publicClient = getPublicClient();
    const result = await publicClient.buildQuery()
      .where(eq('type', 'learner_quest'))
      .where(eq('questId', questId))
      .where(eq('status', 'active'))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch();

    if (!result?.entities || result.entities.length === 0) {
      throw new Error(`Quest entity ${questId} not found`);
    }

    // Get most recent entity (already sorted by createdAt descending in getLearnerQuest)
    const entity = result.entities
      .map((e: any) => {
        const getAttr = (ent: any, key: string): string => {
          const attrs = ent.attributes || {};
          if (Array.isArray(attrs)) {
            const attr = attrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(attrs[key] || '');
        };
        const createdAt = getAttr(e, 'createdAt');
        return { ...e, createdAt };
      })
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    // 3. Parse current payload
    const decoded = entity.payload instanceof Uint8Array
      ? new TextDecoder().decode(entity.payload)
      : typeof entity.payload === 'string'
      ? entity.payload
      : JSON.stringify(entity.payload);
    const currentPayload = JSON.parse(decoded);

    // 4. Merge updates
    const updatedPayload = {
      ...currentPayload,
      ...updates,
      metadata: {
        ...currentPayload.metadata,
        lastUpdated: new Date().toISOString(),
        ...(updates.materials ? {
          totalMaterials: updates.materials.length,
          categories: [...new Set(updates.materials.map((m: LearnerQuestMaterial) => m.category))],
        } : {}),
      },
    };

    // 5. Increment version
    const currentVersion = parseInt(current.questVersion || '1', 10);
    const newVersion = String(currentVersion + 1);

    // 6. Create new entity with updated data
    return await createLearnerQuest({
      questId,
      title: updates.title || current.title,
      description: updates.description || current.description,
      source: current.source,
      materials: updatedPayload.materials || [],
      questType: current.questType,
      questVersion: newVersion,
      creatorWallet: current.creatorWallet, // Preserve creator
      privateKey,
      spaceId,
    });
  } catch (error: any) {
    console.error('[updateLearnerQuest] Error:', error);
    return null;
  }
}

