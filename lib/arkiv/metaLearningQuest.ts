/**
 * Meta-Learning Quest helpers
 *
 * Arkiv-native implementation for meta-learning quest artifacts.
 * Tracks learning behaviors (focused sessions, diffuse breaks, retrieval attempts, reflections, spacing checks).
 *
 * Reference: refs/meta-learning-quest-implementation-plan.md
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { handleTransactionWithTimeout } from "./transaction-utils";
import { SPACE_ID } from "../config";

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
    const existingResult = await publicClient.buildQuery()
      .where(eq('type', 'meta_learning_artifact'))
      .where(eq('wallet', normalizedWallet))
      .where(eq('questId', questId))
      .where(eq('targetKey', normalizedTargetKey))
      .where(eq('stepId', stepId))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch();

    if (existingResult?.entities && existingResult.entities.length > 0) {
      // Check payload for idempotency key
      for (const entity of existingResult.entities) {
        try {
          const decoded = entity.payload instanceof Uint8Array
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

    const enc = new TextEncoder();
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
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify(payload)),
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'meta_learning_artifact' },
          { key: 'wallet', value: normalizedWallet },
          { key: 'questId', value: questId },
          { key: 'stepId', value: stepId },
          { key: 'artifactType', value: artifactType },
          { key: 'targetKey', value: normalizedTargetKey },
          { key: 'spaceId', value: spaceId },
          { key: 'createdAt', value: now },
        ],
        expiresIn: ttlSeconds,
      });
    });

    // Create txhash entity
    try {
      await handleTransactionWithTimeout(async () => {
        return await walletClient.createEntity({
          payload: enc.encode(JSON.stringify({})),
          contentType: 'application/json',
          attributes: [
            { key: 'type', value: 'meta_learning_artifact_txhash' },
            { key: 'artifactKey', value: entityKey },
            { key: 'txHash', value: txHash },
            { key: 'spaceId', value: spaceId },
            { key: 'createdAt', value: now },
          ],
          expiresIn: ttlSeconds,
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

    let queryBuilder = publicClient.buildQuery()
      .where(eq('type', 'meta_learning_artifact'))
      .where(eq('wallet', normalizedWallet))
      .where(eq('questId', questId));

    if (targetKey) {
      queryBuilder = queryBuilder.where(eq('targetKey', targetKey.toLowerCase()));
    }

    const result = await queryBuilder
      .withAttributes(true)
      .withPayload(true)
      .limit(1000)
      .fetch();

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
    const getAttr = (entity: any, key: string): string => {
      const attrs = entity.attributes || {};
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };

    // Parse artifacts
    const artifacts: MetaLearningArtifact[] = [];
    const now = Date.now();
    for (const entity of result.entities) {
      try {
        const createdAt = getAttr(entity, 'createdAt');
        if (!createdAt) {
          continue; // Skip entities without createdAt
        }

        // Check expiration if not including expired
        // Note: Arkiv SDK may filter expired entities automatically, but we check payload ttlSeconds as fallback
        if (!includeExpired) {
          try {
            const decoded = entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
              ? entity.payload
              : JSON.stringify(entity.payload);
            const payload = JSON.parse(decoded);
            if (payload.ttlSeconds) {
              const createdAtTime = new Date(createdAt).getTime();
              const expiresAt = createdAtTime + (payload.ttlSeconds * 1000);
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
          questId: getAttr(entity, 'questId'),
          stepId: getAttr(entity, 'stepId'),
          artifactType: getAttr(entity, 'artifactType'),
          targetKey: getAttr(entity, 'targetKey'),
          createdAt,
          txHash: (entity as any).txHash || undefined,
        });
      } catch (e) {
        console.error('[getMetaLearningProgress] Error parsing entity:', e);
        // Skip invalid entities
      }
    }

    // Group by targetKey
    const targetsMap = new Map<string, {
      targetKey: string;
      artifacts: Record<string, MetaLearningArtifact[]>;
    }>();

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
        completedSteps === 0 ? 'not_started' :
        completedSteps === 6 ? 'completed' :
        'in_progress';

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
      completedSteps === 0 ? 'not_started' :
      completedSteps === 6 ? 'completed' :
      'in_progress';

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
      ? progress.targets.find(t => t.targetKey.toLowerCase() === targetKey.toLowerCase())
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
    const requiredSteps: Array<keyof typeof target.artifacts> = ['choose_target', 'focused_session', 'diffuse_break', 'retrieval_attempt', 'reflection', 'spacing_check'];
    const allArtifactsExist = requiredSteps.every(stepId => {
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
        const sessionArtifact = sessionArtifacts.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        const spacingArtifact = spacingArtifacts.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        // Parse payload to get completedAt timestamps
        const publicClient = getPublicClient();
        const [sessionEntity, spacingEntity] = await Promise.all([
          publicClient.buildQuery()
            .where(eq('type', 'meta_learning_artifact'))
            .where(eq('key', sessionArtifact.key))
            .withPayload(true)
            .limit(1)
            .fetch(),
          publicClient.buildQuery()
            .where(eq('type', 'meta_learning_artifact'))
            .where(eq('key', spacingArtifact.key))
            .withPayload(true)
            .limit(1)
            .fetch(),
        ]);

        try {
          const sessionPayload = sessionEntity?.entities?.[0]?.payload;
          const spacingPayload = spacingEntity?.entities?.[0]?.payload;

          if (sessionPayload && spacingPayload) {
            const sessionDecoded = sessionPayload instanceof Uint8Array
              ? new TextDecoder().decode(sessionPayload)
              : typeof sessionPayload === 'string'
              ? sessionPayload
              : JSON.stringify(sessionPayload);
            const sessionData = JSON.parse(sessionDecoded);

            const spacingDecoded = spacingPayload instanceof Uint8Array
              ? new TextDecoder().decode(spacingPayload)
              : typeof spacingPayload === 'string'
              ? spacingPayload
              : JSON.stringify(spacingPayload);
            const spacingData = JSON.parse(spacingDecoded);

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
        const mostRecent = stepArtifacts.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        // Map stepId to artifactType for response
        const artifactTypeMap: Record<keyof typeof target.artifacts, keyof MetaLearningCompletion['artifacts']> = {
          'choose_target': 'learning_target',
          'focused_session': 'learning_session',
          'diffuse_break': 'diffuse_interval',
          'retrieval_attempt': 'retrieval_attempt',
          'reflection': 'reflection',
          'spacing_check': 'spacing_check',
        };

        const artifactType = artifactTypeMap[stepId];
        if (artifactType) {
          artifacts[artifactType] = mostRecent;
        }
      }
    }

    const isComplete = allArtifactsExist && timeSeparationMet;
    const completedAt = isComplete && artifacts.spacing_check
      ? artifacts.spacing_check.createdAt
      : undefined;

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

