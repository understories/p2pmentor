/**
 * Meta-Learning Quest helpers
 *
 * Arkiv-native implementation for meta-learning quest artifacts.
 * Tracks learning behaviors (focused sessions, diffuse breaks, retrieval attempts, reflections, spacing checks).
 *
 * Reference: refs/meta-learning-quest-implementation-plan.md
 */

import { eqAttr } from '@/lib/arkiv/schema';
import {
  arkivSelect,
  fetchAll,
  getAttr as readAttr,
  getEntityByKey,
  parsePayload,
} from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';
import { SPACE_ID } from '../config';

export type MetaLearningArtifact = {
  key: string;
  wallet: string;
  questId: string;
  stepId: string;
  artifactType: string;
  targetKey: string;
  createdAt: string;
  txHash?: string;
};

export type MetaLearningProgress = {
  questId: string;
  wallet: string;
  status: 'not_started' | 'in_progress' | 'completed';
  progressPercent: number;
  completedSteps: number;
  totalSteps: number;
  targets: Array<{
    targetKey: string;
    status: 'not_started' | 'in_progress' | 'completed';
    progressPercent: number;
    artifacts: {
      choose_target?: MetaLearningArtifact[];
      focused_session?: MetaLearningArtifact[];
      diffuse_break?: MetaLearningArtifact[];
      retrieval_attempt?: MetaLearningArtifact[];
      reflection?: MetaLearningArtifact[];
      spacing_check?: MetaLearningArtifact[];
    };
  }>;
};

export type MetaLearningCompletion = {
  isComplete: boolean;
  completedAt?: string;
  targetKey: string;
  allArtifactsExist: boolean;
  timeSeparationMet: boolean;
  artifacts: {
    learning_target?: MetaLearningArtifact;
    learning_session?: MetaLearningArtifact;
    diffuse_interval?: MetaLearningArtifact;
    retrieval_attempt?: MetaLearningArtifact;
    reflection?: MetaLearningArtifact;
    spacing_check?: MetaLearningArtifact;
  };
};

/**
 * Create meta-learning artifact (idempotent)
 *
 * Creates a new artifact entity. If an artifact with the same idempotency key exists, returns it.
 */
export async function createMetaLearningArtifact({
  wallet,
  questId,
  stepId,
  artifactType,
  targetKey,
  ttlSeconds,
  idempotencyKey,
  data,
  privateKey,
  spaceId = SPACE_ID,
}: {
  wallet: string;
  questId: string;
  stepId: string;
  artifactType: string;
  targetKey: string;
  ttlSeconds: number;
  idempotencyKey: string;
  data: Record<string, any>;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string } | null> {
  try {
    const normalizedWallet = wallet.toLowerCase();
    const normalizedTargetKey = targetKey.toLowerCase();

    // Check for existing artifact with same idempotency key
    const publicClient = getPublicClient();
    const existingResult = await arkivSelect('meta_learning_artifact', publicClient)
      .where(eqAttr('wallet', normalizedWallet))
      .where(eqAttr('quest_id', questId))
      .where(eqAttr('target_key', normalizedTargetKey))
      .where(eqAttr('step_id', stepId))
      .limit(100)
      .fetch();

    if (existingResult?.entities && existingResult.entities.length > 0) {
      // Check payload for idempotency key
      for (const entity of existingResult.entities) {
        try {
          const decoded =
            entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
                ? entity.payload
                : JSON.stringify(entity.payload);
          const payload = JSON.parse(decoded);

          if (payload.idempotencyKey === idempotencyKey) {
            // Return existing artifact
            return {
              key: entity.key,
              txHash: (entity as any).txHash || undefined,
            };
          }
        } catch (e) {
          // Continue checking other entities
        }
      }
    }

    // Create new artifact
    const walletClient = getWalletClientFromPrivateKey(privateKey);
    if (!walletClient) {
      throw new Error('Failed to get wallet client');
    }

    const now = new Date().toISOString();

    const payload = {
      questId,
      targetKey: normalizedTargetKey,
      stepId,
      artifactType,
      ttlSeconds,
      idempotencyKey,
      data,
    };

    const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
      return await createArkivEntity(walletClient, {
        type: 'meta_learning_artifact',
        attributes: {
          wallet: normalizedWallet,
          quest_id: questId,
          step_id: stepId,
          artifact_type: artifactType,
          target_key: normalizedTargetKey,
          space_id: spaceId,
          created_at: now,
        },
        payload,
        lifetimeSeconds: ttlSeconds, // User-chosen TTL
      });
    });

    // Create txhash entity
    try {
      await handleTransactionWithTimeout(async () => {
        return await createArkivEntity(walletClient, {
          type: 'meta_learning_artifact_txhash',
          attributes: {
            artifact_key: entityKey,
            tx_hash: txHash,
            space_id: spaceId,
            created_at: now,
          },
          payload: {},
          lifetimeSeconds: ttlSeconds,
        });
      });
    } catch (error) {
      console.warn('[createMetaLearningArtifact] Failed to create txhash entity:', error);
    }

    return { key: entityKey, txHash };
  } catch (error: any) {
    console.error('[createMetaLearningArtifact] Error:', error);
    return null;
  }
}

/**
 * Get meta-learning progress for user
 *
 * Fetches all artifacts for a user and computes progress.
 */
export async function getMetaLearningProgress({
  wallet,
  questId,
  targetKey,
  includeExpired = false,
}: {
  wallet: string;
  questId: string;
  targetKey?: string;
  includeExpired?: boolean;
}): Promise<MetaLearningProgress | null> {
  try {
    const publicClient = getPublicClient();
    const normalizedWallet = wallet.toLowerCase();

    let queryBuilder = arkivSelect('meta_learning_artifact', publicClient)
      .where(eqAttr('wallet', normalizedWallet))
      .where(eqAttr('quest_id', questId));

    if (targetKey) {
      queryBuilder = queryBuilder.where(eqAttr('target_key', targetKey.toLowerCase()));
    }

    const result = await fetchAll(queryBuilder, 1000, publicClient);

    if (!result?.entities || !Array.isArray(result.entities) || result.entities.length === 0) {
      return {
        questId,
        wallet: normalizedWallet,
        status: 'not_started',
        progressPercent: 0,
        completedSteps: 0,
        totalSteps: 6,
        targets: [],
      };
    }

    // Helper to get attribute value
    const getAttr = (entity: any, key: string): string => readAttr(entity, key);

    // Parse artifacts
    const artifacts: MetaLearningArtifact[] = [];
    const now = Date.now();
    for (const entity of result.entities) {
      try {
        const createdAt = getAttr(entity, 'created_at');
        if (!createdAt) {
          continue; // Skip entities without createdAt
        }

        // Check expiration if not including expired
        // Note: Arkiv SDK may filter expired entities automatically, but we check payload ttlSeconds as fallback
        if (!includeExpired) {
          try {
            const decoded =
              entity.payload instanceof Uint8Array
                ? new TextDecoder().decode(entity.payload)
                : typeof entity.payload === 'string'
                  ? entity.payload
                  : JSON.stringify(entity.payload);
            const payload = JSON.parse(decoded);
            if (payload.ttlSeconds) {
              const createdAtTime = new Date(createdAt).getTime();
              const expiresAt = createdAtTime + payload.ttlSeconds * 1000;
              if (now > expiresAt) {
                continue; // Skip expired artifacts
              }
            }
          } catch (e) {
            // If we can't parse payload, include the artifact (better to show than hide)
          }
        }

        artifacts.push({
          key: entity.key,
          wallet: getAttr(entity, 'wallet'),
          questId: getAttr(entity, 'quest_id'),
          stepId: getAttr(entity, 'step_id'),
          artifactType: getAttr(entity, 'artifact_type'),
          targetKey: getAttr(entity, 'target_key'),
          createdAt,
          txHash: (entity as any).txHash || undefined,
        });
      } catch (e) {
        console.error('[getMetaLearningProgress] Error parsing entity:', e);
        // Skip invalid entities
      }
    }

    // Group by targetKey
    const targetsMap = new Map<
      string,
      {
        targetKey: string;
        artifacts: Record<string, MetaLearningArtifact[]>;
      }
    >();

    for (const artifact of artifacts) {
      if (!targetsMap.has(artifact.targetKey)) {
        targetsMap.set(artifact.targetKey, {
          targetKey: artifact.targetKey,
          artifacts: {},
        });
      }

      const target = targetsMap.get(artifact.targetKey)!;
      if (!target.artifacts[artifact.stepId]) {
        target.artifacts[artifact.stepId] = [];
      }
      target.artifacts[artifact.stepId].push(artifact);
    }

    // Compute progress for each target
    const targets = Array.from(targetsMap.values()).map((target) => {
      const stepIds = new Set<string>();
      for (const stepArtifacts of Object.values(target.artifacts)) {
        if (stepArtifacts.length > 0) {
          stepIds.add(stepArtifacts[0].stepId);
        }
      }

      const completedSteps = stepIds.size;
      const progressPercent = Math.round((completedSteps / 6) * 100);
      const status: 'not_started' | 'in_progress' | 'completed' =
        completedSteps === 0 ? 'not_started' : completedSteps === 6 ? 'completed' : 'in_progress';

      return {
        ...target,
        status,
        progressPercent,
      };
    });

    // Compute overall progress
    const allStepIds = new Set<string>();
    for (const artifact of artifacts) {
      allStepIds.add(artifact.stepId);
    }

    const completedSteps = allStepIds.size;
    const progressPercent = Math.round((completedSteps / 6) * 100);
    const status: 'not_started' | 'in_progress' | 'completed' =
      completedSteps === 0 ? 'not_started' : completedSteps === 6 ? 'completed' : 'in_progress';

    return {
      questId,
      wallet: normalizedWallet,
      status,
      progressPercent,
      completedSteps,
      totalSteps: 6,
      targets,
    };
  } catch (error: any) {
    console.error('[getMetaLearningProgress] Error:', error);
    return null;
  }
}

/**
 * Check quest completion status
 *
 * Verifies that all required artifacts exist and time separation is met.
 */
export async function checkMetaLearningCompletion({
  wallet,
  questId,
  targetKey,
}: {
  wallet: string;
  questId: string;
  targetKey?: string;
}): Promise<MetaLearningCompletion | null> {
  try {
    const progress = await getMetaLearningProgress({
      wallet,
      questId,
      targetKey,
      includeExpired: false,
    });

    if (!progress || progress.targets.length === 0) {
      return {
        isComplete: false,
        targetKey: targetKey || '',
        allArtifactsExist: false,
        timeSeparationMet: false,
        artifacts: {},
      };
    }

    // Check completion for first target (or specified target)
    const target = targetKey
      ? progress.targets.find((t) => t.targetKey.toLowerCase() === targetKey.toLowerCase())
      : progress.targets[0];

    if (!target) {
      return {
        isComplete: false,
        targetKey: targetKey || '',
        allArtifactsExist: false,
        timeSeparationMet: false,
        artifacts: {},
      };
    }

    // Check if all artifact types exist
    const requiredSteps: Array<keyof typeof target.artifacts> = [
      'choose_target',
      'focused_session',
      'diffuse_break',
      'retrieval_attempt',
      'reflection',
      'spacing_check',
    ];
    const allArtifactsExist = requiredSteps.every((stepId) => {
      const stepArtifacts = target.artifacts[stepId];
      return stepArtifacts && stepArtifacts.length > 0;
    });

    // Check time separation (spacing_check must be ≥24h after focused_session)
    let timeSeparationMet = false;
    if (allArtifactsExist) {
      const sessionArtifacts = target.artifacts.focused_session || [];
      const spacingArtifacts = target.artifacts.spacing_check || [];

      if (sessionArtifacts.length > 0 && spacingArtifacts.length > 0) {
        // Get the most recent artifacts
        const sessionArtifact = sessionArtifacts.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        const spacingArtifact = spacingArtifacts.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        // Parse payload to get completedAt timestamps
        const publicClient = getPublicClient();
        const [sessionEntity, spacingEntity] = await Promise.all([
          getEntityByKey(sessionArtifact.key, publicClient),
          getEntityByKey(spacingArtifact.key, publicClient),
        ]);

        try {
          const isArtifact = (e: typeof sessionEntity) =>
            !!e && readAttr(e, 'type') === 'meta_learning_artifact';

          if (
            isArtifact(sessionEntity) &&
            isArtifact(spacingEntity) &&
            sessionEntity?.payload &&
            spacingEntity?.payload
          ) {
            const sessionData = parsePayload<any>(sessionEntity);
            const spacingData = parsePayload<any>(spacingEntity);

            const sessionCompletedAt = sessionData.data?.completedAt || sessionArtifact.createdAt;
            const spacingCompletedAt = spacingData.data?.completedAt || spacingArtifact.createdAt;

            const sessionTime = new Date(sessionCompletedAt).getTime();
            const spacingTime = new Date(spacingCompletedAt).getTime();
            const timeGap = spacingTime - sessionTime;
            const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

            timeSeparationMet = timeGap >= twentyFourHours;
          }
        } catch (e) {
          console.warn('[checkMetaLearningCompletion] Error parsing payloads:', e);
        }
      }
    }

    // Get most recent artifact for each step
    const artifacts: MetaLearningCompletion['artifacts'] = {};
    for (const stepId of requiredSteps) {
      const stepArtifacts = target.artifacts[stepId];
      if (stepArtifacts && stepArtifacts.length > 0) {
        const mostRecent = stepArtifacts.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        // Map stepId to artifactType for response
        const artifactTypeMap: Record<
          keyof typeof target.artifacts,
          keyof MetaLearningCompletion['artifacts']
        > = {
          choose_target: 'learning_target',
          focused_session: 'learning_session',
          diffuse_break: 'diffuse_interval',
          retrieval_attempt: 'retrieval_attempt',
          reflection: 'reflection',
          spacing_check: 'spacing_check',
        };

        const artifactType = artifactTypeMap[stepId];
        if (artifactType) {
          artifacts[artifactType] = mostRecent;
        }
      }
    }

    const isComplete = allArtifactsExist && timeSeparationMet;
    const completedAt =
      isComplete && artifacts.spacing_check ? artifacts.spacing_check.createdAt : undefined;

    return {
      isComplete,
      completedAt,
      targetKey: target.targetKey,
      allArtifactsExist,
      timeSeparationMet,
      artifacts,
    };
  } catch (error: any) {
    console.error('[checkMetaLearningCompletion] Error:', error);
    return null;
  }
}

/**
 * List all meta-learning artifacts across all users (for explorer).
 */
export async function listMetaLearningArtifacts({
  spaceIds,
  limit = 1000,
  includeExpired = false,
}: {
  spaceIds?: string[];
  limit?: number;
  includeExpired?: boolean;
} = {}): Promise<MetaLearningArtifact[]> {
  try {
    const publicClient = getPublicClient();

    const fetchForSpace = async (spaceId: string): Promise<MetaLearningArtifact[]> => {
      const result = await fetchAll(
        arkivSelect('meta_learning_artifact', publicClient).where(eqAttr('space_id', spaceId)),
        limit,
        publicClient
      );

      if (!result?.entities || !Array.isArray(result.entities)) return [];

      const getAttr = (entity: any, key: string): string => readAttr(entity, key);

      return result.entities.map((entity: any) => ({
        key: entity.key,
        wallet: getAttr(entity, 'wallet'),
        questId: getAttr(entity, 'quest_id'),
        stepId: getAttr(entity, 'step_id'),
        artifactType: getAttr(entity, 'artifact_type'),
        targetKey: getAttr(entity, 'target_key'),
        createdAt: getAttr(entity, 'created_at'),
        spaceId: getAttr(entity, 'space_id'),
        txHash: (entity as any).txHash || undefined,
      }));
    };

    if (spaceIds && spaceIds.length > 0) {
      const results = await Promise.all(spaceIds.map(fetchForSpace));
      return results.flat();
    }

    return await fetchForSpace(SPACE_ID);
  } catch (error: any) {
    console.error('[listMetaLearningArtifacts] Error:', error);
    return [];
  }
}
