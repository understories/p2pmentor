/**
 * Quest Progress Tracking
 *
 * Provides functions for recording quest step completion with evidence
 * and handling indexer lag gracefully.
 *
 * Uses stable entity keys (Pattern B) for reliable progress tracking.
 * All wallet addresses are normalized to lowercase.
 *
 * Reference: refs/docs/jan26plan.md - Week 1 Day 3-4
 */

import { eq } from '@arkiv-network/sdk/query';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { SPACE_ID } from '../config';
import type { QuestStepEvidence, QuestStepType } from './questStep';
import { validateStepEvidence } from './questStep';

/**
 * Progress status representing indexer state
 */
export type ProgressStatus = 'submitted' | 'indexed' | 'error' | 'pending';

/**
 * Result from creating quest progress
 */
export interface CreateProgressResult {
  key: string;
  txHash: string;
  status: ProgressStatus;
  error?: string;
}

/**
 * Stored quest progress entity
 */
export interface QuestProgress {
  key: string;
  wallet: string;
  questId: string;
  stepId: string;
  stepType: QuestStepType;
  evidence: QuestStepEvidence;
  questVersion?: string;
  createdAt: string;
  spaceId: string;
  txHash?: string;
  status: ProgressStatus;
}

/**
 * Generate stable entity key for quest progress
 *
 * Uses Pattern B from engineering guidelines: deterministic key
 * derived from stable inputs to avoid query-first patterns.
 */
export function generateProgressKey(
  spaceId: string,
  wallet: string,
  questId: string,
  stepId: string
): string {
  const normalizedWallet = wallet.toLowerCase();
  return `quest_step_progress:${spaceId}:${normalizedWallet}:${questId}:${stepId}`;
}

/**
 * Create quest step progress entity
 *
 * Records evidence of step completion to Arkiv.
 * Uses stable entity keys for reliable querying.
 * Returns "submitted" status - caller must handle indexer lag.
 */
export async function createQuestStepProgress({
  wallet,
  questId,
  stepId,
  stepType,
  evidence,
  questVersion = '1',
  privateKey,
  spaceId = SPACE_ID,
  ttlSeconds = 31536000, // 1 year default
}: {
  wallet: string;
  questId: string;
  stepId: string;
  stepType: QuestStepType;
  evidence: QuestStepEvidence;
  questVersion?: string;
  privateKey: `0x${string}`;
  spaceId?: string;
  ttlSeconds?: number;
}): Promise<CreateProgressResult> {
  const normalizedWallet = wallet.toLowerCase();
  const finalSpaceId = spaceId || SPACE_ID;

  // Validate evidence for this step type
  const validation = validateStepEvidence(stepType, evidence);
  if (!validation.valid) {
    return {
      key: '',
      txHash: '',
      status: 'error',
      error: `Invalid evidence: missing fields ${validation.missingFields.join(', ')}`,
    };
  }

  const createdAt = new Date().toISOString();

  try {
    const walletClient = getWalletClientFromPrivateKey(privateKey);
    const enc = new TextEncoder();

    // Build attributes (queryable fields)
    const attributes = [
      { key: 'type', value: 'quest_step_progress' },
      { key: 'wallet', value: normalizedWallet },
      { key: 'questId', value: questId },
      { key: 'stepId', value: stepId },
      { key: 'stepType', value: stepType },
      { key: 'spaceId', value: finalSpaceId },
      { key: 'createdAt', value: createdAt },
    ];

    // Build payload (non-queryable content)
    const payload = {
      evidence,
      questVersion,
      status: 'submitted' as ProgressStatus,
    };

    // Submit with timeout wrapper
    const result = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify(payload)),
        contentType: 'application/json',
        attributes,
        expiresIn: ttlSeconds,
      });
    });

    // Entity key is returned by the API
    const returnedEntityKey = result.entityKey;
    const txHash = result.txHash;

    // Create parallel txhash entity for observability (fire and forget)
    walletClient
      .createEntity({
        payload: enc.encode(JSON.stringify({ txHash, progressKey: returnedEntityKey })),
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'quest_step_progress_txhash' },
          { key: 'progressKey', value: returnedEntityKey },
          { key: 'txHash', value: txHash },
          { key: 'wallet', value: normalizedWallet },
          { key: 'spaceId', value: finalSpaceId },
          { key: 'createdAt', value: createdAt },
        ],
        expiresIn: ttlSeconds,
      })
      .catch((err) => {
        // Non-blocking - log but don't fail
        console.warn('[createQuestStepProgress] Failed to create txhash entity:', err);
      });

    // Return "submitted" status - caller handles indexer lag
    return {
      key: returnedEntityKey,
      txHash,
      status: 'submitted',
    };
  } catch (error: any) {
    console.error('[createQuestStepProgress] Error:', error);
    return {
      key: '',
      txHash: '',
      status: 'error',
      error: error?.message || 'Transaction failed',
    };
  }
}

/**
 * Get quest step progress for a user
 *
 * Queries all progress entities for a specific quest.
 * Returns empty array on query failure (defensive).
 */
export async function getQuestStepProgress({
  wallet,
  questId,
  spaceId = SPACE_ID,
}: {
  wallet: string;
  questId: string;
  spaceId?: string;
}): Promise<QuestProgress[]> {
  const normalizedWallet = wallet.toLowerCase();
  const finalSpaceId = spaceId || SPACE_ID;

  try {
    const publicClient = getPublicClient();
    const query = publicClient.buildQuery();

    const result = await query
      .where(eq('type', 'quest_step_progress'))
      .where(eq('wallet', normalizedWallet))
      .where(eq('questId', questId))
      .where(eq('spaceId', finalSpaceId))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch();

    // Defensive check
    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.warn('[getQuestStepProgress] Invalid result structure, returning empty array');
      return [];
    }

    return result.entities.map((entity: any) => {
      const getAttr = (key: string) => entity.attributes?.find((a: any) => a.key === key)?.value;

      let payload: any = {};
      try {
        if (entity.payload) {
          const payloadStr =
            typeof entity.payload === 'string'
              ? entity.payload
              : new TextDecoder().decode(entity.payload);
          payload = JSON.parse(payloadStr);
        }
      } catch (e) {
        console.warn('[getQuestStepProgress] Failed to parse payload:', e);
      }

      return {
        key: entity.key || '',
        wallet: getAttr('wallet') || normalizedWallet,
        questId: getAttr('questId') || questId,
        stepId: getAttr('stepId') || '',
        stepType: (getAttr('stepType') || 'READ') as QuestStepType,
        evidence: payload.evidence || {},
        questVersion: payload.questVersion,
        createdAt: getAttr('createdAt') || '',
        spaceId: getAttr('spaceId') || finalSpaceId,
        txHash: entity.txHash,
        status: 'indexed' as ProgressStatus, // If we can query it, it's indexed
      };
    });
  } catch (error: any) {
    console.error('[getQuestStepProgress] Query failed:', error);
    return [];
  }
}

/**
 * Check if a specific step is completed
 *
 * Returns the progress entity if found, null otherwise.
 */
export async function getStepCompletion({
  wallet,
  questId,
  stepId,
  spaceId = SPACE_ID,
}: {
  wallet: string;
  questId: string;
  stepId: string;
  spaceId?: string;
}): Promise<QuestProgress | null> {
  const progress = await getQuestStepProgress({ wallet, questId, spaceId });
  return progress.find((p) => p.stepId === stepId) || null;
}

/**
 * Calculate quest completion percentage
 *
 * Returns progress stats for a quest based on completed steps.
 */
export async function calculateQuestCompletion({
  wallet,
  questId,
  totalSteps,
  requiredStepIds,
  spaceId = SPACE_ID,
}: {
  wallet: string;
  questId: string;
  totalSteps: number;
  requiredStepIds: string[];
  spaceId?: string;
}): Promise<{
  completedSteps: number;
  totalSteps: number;
  progressPercent: number;
  requiredComplete: boolean;
  completedStepIds: string[];
  missingRequiredStepIds: string[];
}> {
  const progress = await getQuestStepProgress({ wallet, questId, spaceId });
  const completedStepIds = progress.map((p) => p.stepId);

  const missingRequiredStepIds = requiredStepIds.filter((id) => !completedStepIds.includes(id));

  return {
    completedSteps: completedStepIds.length,
    totalSteps,
    progressPercent: totalSteps > 0 ? Math.round((completedStepIds.length / totalSteps) * 100) : 0,
    requiredComplete: missingRequiredStepIds.length === 0,
    completedStepIds,
    missingRequiredStepIds,
  };
}

/**
 * List all quest step progress entities across all users (for explorer).
 */
export async function listAllQuestStepProgress({
  spaceIds,
  limit = 1000,
}: {
  spaceIds?: string[];
  limit?: number;
} = {}): Promise<QuestProgress[]> {
  try {
    const publicClient = getPublicClient();

    const fetchForSpace = async (spaceId: string): Promise<QuestProgress[]> => {
      const result = await publicClient
        .buildQuery()
        .where(eq('type', 'quest_step_progress'))
        .where(eq('spaceId', spaceId))
        .withAttributes(true)
        .withPayload(false)
        .limit(limit)
        .fetch();

      if (!result?.entities || !Array.isArray(result.entities)) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getAttr = (entity: any, key: string): string => {
        const attrs = entity.attributes || {};
        if (Array.isArray(attrs)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return result.entities.map((entity: any) => ({
        key: entity.key,
        wallet: getAttr(entity, 'wallet'),
        questId: getAttr(entity, 'questId'),
        stepId: getAttr(entity, 'stepId'),
        stepType: (getAttr(entity, 'stepType') || 'READ') as QuestStepType,
        evidence: {
          stepId: getAttr(entity, 'stepId'),
          completedAt: getAttr(entity, 'createdAt'),
          evidenceType: 'completion' as const,
        },
        createdAt: getAttr(entity, 'createdAt'),
        spaceId: getAttr(entity, 'spaceId'),
        txHash: entity.txHash || undefined,
        status: 'indexed' as ProgressStatus,
      }));
    };

    if (spaceIds && spaceIds.length > 0) {
      const results = await Promise.all(spaceIds.map(fetchForSpace));
      return results.flat();
    }

    return await fetchForSpace(SPACE_ID);
  } catch (error: unknown) {
    console.error('[listAllQuestStepProgress] Error:', error);
    return [];
  }
}
