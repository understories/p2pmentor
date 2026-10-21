/**
 * Learner Quest CRUD helpers
 *
 * Arkiv-native implementation for learner quests and progress tracking.
 * Tracks reading materials and user progress through curated quests.
 *
 * Reference: refs/learner-quests-implementation-plan.md
 */

import { eqAttr, lifetimeSecondsFor } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr, parsePayload } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';
import { SERVER_SIGNER_ADDRESS, SPACE_ID } from '../config';

/**
 * Start a query over learner_quest entities.
 *
 * Learner quest definitions are only written with the server key (admin seed scripts and
 * /api/learner-quests/create), so reads are scoped to the server signer when it is known.
 */
export function learnerQuestSelect(
  publicClient: ReturnType<typeof getPublicClient> = getPublicClient()
) {
  const q = arkivSelect('learner_quest', publicClient);
  return SERVER_SIGNER_ADDRESS ? q.createdBy(SERVER_SIGNER_ADDRESS) : q;
}

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
    minimumTimeGapSeconds?: number; // in seconds (from JSON)
    conceptCard?: {
      title: string;
      body: string;
    } | null;
  }[];
  // TTL UI configuration (for meta_learning quests loaded from JSON)
  ui?: {
    ttl?: {
      defaultTtlSeconds: number;
      presetsSeconds: number[];
      allowCustom: boolean;
      showAdvancedToggleByDefault: boolean;
      allowApplyToRemainingSteps: boolean;
    };
  };
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

    const createdAt = new Date().toISOString();

    // For meta_learning quests, store steps in payload instead of materials
    // title/description/source are long text or URLs, so they live in the payload (not attributes)
    const payloadData =
      questType === 'meta_learning'
        ? {
            title,
            description,
            source,
            steps: steps || [],
            metadata: metadata || {},
          }
        : {
            title,
            description,
            source,
            materials: materials || [],
            metadata: {
              totalMaterials: (materials || []).length,
              categories: [...new Set((materials || []).map((m) => m.category))],
              lastUpdated: createdAt,
            },
          };

    const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
      // Lifetime: learner_quest type default (curated content, renewed)
      return await createArkivEntity(walletClient, {
        type: 'learner_quest',
        attributes: {
          quest_id: questId,
          quest_type: questType,
          quest_version: questVersion || '1', // Default to '1' for backward compatibility
          creator_wallet: creatorWallet ? creatorWallet.toLowerCase() : undefined, // Normalize wallet
          status: 'active',
          space_id: spaceId,
          created_at: createdAt,
        },
        payload: payloadData,
      });
    });

    // Create txhash entity
    try {
      await handleTransactionWithTimeout(async () => {
        return await createArkivEntity(walletClient, {
          type: 'learner_quest_txhash',
          attributes: {
            quest_key: entityKey,
            tx_hash: txHash,
            space_id: spaceId,
            created_at: createdAt,
          },
          payload: {},
          lifetimeSeconds: lifetimeSecondsFor('learner_quest'), // matches quest entity
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
    let queryBuilder = learnerQuestSelect(publicClient).where(eqAttr('status', 'active'));

    // Support multiple spaceIds (builder mode) or single spaceId
    if (options?.spaceIds && options.spaceIds.length > 0) {
      // Query all, filter client-side (Arkiv doesn't support OR queries)
      console.log('[listLearnerQuests] Querying multiple spaceIds:', options.spaceIds);
    } else {
      // Use provided spaceId or default to SPACE_ID from config
      const finalSpaceId = options?.spaceId || SPACE_ID;
      console.log('[listLearnerQuests] Querying with spaceId:', finalSpaceId, {
        providedSpaceId: options?.spaceId,
        defaultSPACE_ID: SPACE_ID,
      });
      queryBuilder = queryBuilder.where(eqAttr('space_id', finalSpaceId));
    }

    // Filter by quest type if specified (but exclude meta_learning since we load from JSON)
    if (options?.questType && options.questType !== 'meta_learning') {
      queryBuilder = queryBuilder.where(eqAttr('quest_type', options.questType));
    }

    const result = await queryBuilder.limit(100).fetch();

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
    const getAttr = (entity: any, key: string): string => readAttr(entity, key);

    // Map entities to quest objects
    const quests: LearnerQuest[] = result.entities
      .map((entity: any) => {
        try {
          const decoded =
            entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
                ? entity.payload
                : JSON.stringify(entity.payload);
          const payload = JSON.parse(decoded);

          // Default to 'reading_list' for backward compatibility
          const questType = (getAttr(entity, 'quest_type') || 'reading_list') as
            | 'reading_list'
            | 'language_assessment'
            | 'meta_learning';

          const quest: LearnerQuest = {
            key: entity.key,
            questId: getAttr(entity, 'quest_id'),
            // title/description/source live in the payload (attribute fallback for legacy entities)
            title: payload.title || getAttr(entity, 'title'),
            description: payload.description || getAttr(entity, 'description'),
            source: payload.source || getAttr(entity, 'source'),
            questType,
            questVersion: getAttr(entity, 'quest_version') || '1', // Default to '1' for backward compatibility
            creatorWallet: getAttr(entity, 'creator_wallet') || undefined, // Optional
            status: getAttr(entity, 'status') as 'active' | 'archived',
            spaceId: getAttr(entity, 'space_id') || SPACE_ID,
            createdAt: getAttr(entity, 'created_at'),
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
      filteredQuests = quests.filter((quest: LearnerQuest) =>
        options.spaceIds!.includes(quest.spaceId)
      );
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
    const result = await learnerQuestSelect(publicClient)
      .where(eqAttr('quest_id', questId))
      .where(eqAttr('status', 'active'))
      .limit(100)
      .fetch();

    if (!result?.entities || !Array.isArray(result.entities) || result.entities.length === 0) {
      return null;
    }

    // Helper to get attribute value
    const getAttr = (entity: any, key: string): string => readAttr(entity, key);

    // Get most recent quest definition (immutability pattern)
    const quests: LearnerQuest[] = result.entities
      .map((entity: any) => {
        try {
          const decoded =
            entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
                ? entity.payload
                : JSON.stringify(entity.payload);
          const payload = JSON.parse(decoded);

          // Default to 'reading_list' for backward compatibility
          const questType = (getAttr(entity, 'quest_type') || 'reading_list') as
            | 'reading_list'
            | 'language_assessment'
            | 'meta_learning';

          // For reading_list quests, payload contains materials
          // For language_assessment quests, payload contains the full LanguageAssessmentQuest structure
          const quest: LearnerQuest = {
            key: entity.key,
            questId: getAttr(entity, 'quest_id'),
            // title/description/source live in the payload (attribute fallback for legacy entities)
            title: payload.title || getAttr(entity, 'title'),
            description: payload.description || getAttr(entity, 'description'),
            source: payload.source || getAttr(entity, 'source'),
            questType,
            questVersion: getAttr(entity, 'quest_version') || '1', // Default to '1' for backward compatibility
            creatorWallet: getAttr(entity, 'creator_wallet') || undefined, // Optional
            status: getAttr(entity, 'status') as 'active' | 'archived',
            spaceId: getAttr(entity, 'space_id') || SPACE_ID,
            createdAt: getAttr(entity, 'created_at'),
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

    const now = new Date().toISOString();
    const normalizedWallet = wallet.toLowerCase();

    const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
      return await createArkivEntity(walletClient, {
        type: 'learner_quest_progress',
        attributes: {
          wallet: normalizedWallet,
          quest_id: questId,
          material_id: materialId,
          status: 'read',
          space_id: spaceId,
          created_at: now,
        },
        payload: {
          wallet: normalizedWallet,
          questId,
          materialId,
          status: 'read',
          readAt: now,
          metadata: {
            clickedAt: now,
            sourceUrl,
          },
        },
      });
    });

    // Create txhash entity
    try {
      await handleTransactionWithTimeout(async () => {
        return await createArkivEntity(walletClient, {
          type: 'learner_quest_progress_txhash',
          attributes: {
            progress_key: entityKey,
            tx_hash: txHash,
            space_id: spaceId,
            created_at: now,
          },
          payload: {},
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
    const result = await fetchAll(
      arkivSelect('learner_quest_progress', publicClient)
        .where(eqAttr('wallet', normalizedWallet))
        .where(eqAttr('quest_id', questId)),
      1000,
      publicClient
    );

    if (!result?.entities || !Array.isArray(result.entities) || result.entities.length === 0) {
      return {};
    }

    // Helper to get attribute value
    const getAttr = (entity: any, key: string): string => readAttr(entity, key);

    // Map entities to progress objects
    const allProgress = result.entities
      .map((entity: any) => {
        try {
          const decoded =
            entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
                ? entity.payload
                : JSON.stringify(entity.payload);
          const payload = JSON.parse(decoded);

          return {
            key: entity.key,
            wallet: getAttr(entity, 'wallet'),
            questId: getAttr(entity, 'quest_id'),
            materialId: getAttr(entity, 'material_id'),
            status: getAttr(entity, 'status') as 'read' | 'in_progress' | 'not_started',
            readAt: payload.readAt,
            createdAt: getAttr(entity, 'created_at'),
            txHash: (entity as any).txHash || undefined,
          };
        } catch (e) {
          console.error('[getLearnerQuestProgress] Error decoding payload:', e);
          return null;
        }
      })
      .filter(Boolean) as LearnerQuestProgress[];

    // Sort by most recent first
    allProgress.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
    const result = await learnerQuestSelect(publicClient)
      .where(eqAttr('quest_id', questId))
      .where(eqAttr('status', 'active'))
      .limit(100)
      .fetch();

    if (!result?.entities || result.entities.length === 0) {
      throw new Error(`Quest entity ${questId} not found`);
    }

    // Get most recent entity (already sorted by createdAt descending in getLearnerQuest)
    const entity = result.entities
      .map((e: any) => {
        const createdAt = readAttr(e, 'created_at');
        return { ...e, createdAt };
      })
      .sort(
        (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

    // 3. Parse current payload
    const currentPayload = parsePayload<any>(entity);

    // 4. Merge updates
    const updatedPayload = {
      ...currentPayload,
      ...updates,
      metadata: {
        ...currentPayload.metadata,
        lastUpdated: new Date().toISOString(),
        ...(updates.materials
          ? {
              totalMaterials: updates.materials.length,
              categories: [
                ...new Set(updates.materials.map((m: LearnerQuestMaterial) => m.category)),
              ],
            }
          : {}),
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
