/**
 * Quiz Result Entity Functions
 *
 * Stores quiz attempt results as separate Arkiv entities for detailed tracking
 * and verification. Links to quest_step_progress entities via evidenceRef.
 *
 * Week 2 (Feb 8-14) - Quiz engine v1
 */

import { getPublicClient, getWalletClientFromPrivateKey } from '@/lib/arkiv/client';
import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, getAttr as readAttr, parsePayload } from '@/lib/arkiv/read';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';
import { SPACE_ID } from '@/lib/config';

/**
 * Quiz result entity interface
 */
export interface QuizResult {
  key: string;
  wallet: string;
  questId: string;
  stepId: string;
  rubricVersion: string;
  questionIds: string[];
  answers: Record<string, string | string[]>; // questionId -> answer(s)
  score: number; // Points earned
  maxScore: number; // Maximum possible points
  percentage: number; // score / maxScore (0-1)
  passed: boolean; // Whether passing score was achieved
  progressEntityKey: string; // Link to quest_step_progress entity
  completedAt: string; // ISO timestamp
  spaceId: string;
  txHash?: string;
}

/**
 * Create a quiz result entity
 *
 * Entity key pattern (Pattern B - stable keys):
 * learner_quest_assessment_result:${spaceId}:${wallet}:${questId}:${stepId}:${timestamp}
 *
 * Note: Includes timestamp to allow multiple attempts if retakes are allowed
 */
export async function createQuizResult({
  wallet,
  questId,
  stepId,
  rubricVersion,
  questionIds,
  answers,
  score,
  maxScore,
  passingScore,
  progressEntityKey,
  privateKey,
  spaceId = SPACE_ID,
  ttlSeconds, // Optional lifetime override; defaults to the type lifetime (schema.ts)
}: {
  wallet: string;
  questId: string;
  stepId: string;
  rubricVersion: string;
  questionIds: string[];
  answers: Record<string, string | string[]>;
  score: number;
  maxScore: number;
  passingScore: number; // 0-1 (e.g., 0.7 = 70%)
  progressEntityKey: string;
  privateKey: `0x${string}`;
  spaceId?: string;
  ttlSeconds?: number;
}): Promise<{ key: string; txHash: string }> {
  const normalizedWallet = wallet.toLowerCase();
  const finalSpaceId = spaceId || SPACE_ID;
  const createdAt = new Date().toISOString();

  // Calculate percentage and passed status
  const percentage = maxScore > 0 ? score / maxScore : 0;
  const passed = percentage >= passingScore;

  // Generate entity key with timestamp to allow multiple attempts
  const timestamp = Date.now();
  const entityKey = `learner_quest_assessment_result:${finalSpaceId}:${normalizedWallet}:${questId}:${stepId}:${timestamp}`;

  try {
    const walletClient = getWalletClientFromPrivateKey(privateKey);

    // Build attributes (queryable fields)
    const attributes = {
      wallet: normalizedWallet,
      quest_id: questId,
      step_id: stepId,
      rubric_version: rubricVersion,
      space_id: finalSpaceId,
      created_at: createdAt,
      passed: String(passed),
    };

    // Build payload (non-queryable content)
    const payload = {
      questionIds,
      answers,
      score,
      maxScore,
      percentage,
      passingScore,
      progressEntityKey,
      completedAt: createdAt,
    };

    const { entityKey: arkivEntityKey, txHash } = await handleTransactionWithTimeout(async () => {
      return await createArkivEntity(walletClient, {
        type: 'learner_quest_assessment_result',
        attributes,
        payload,
        lifetimeSeconds: ttlSeconds,
      });
    });

    // Create txhash entity for observability (fire and forget)
    // result_key is the Arkiv entity key: the stable key string exceeds the 128-byte
    // attribute limit, so it is kept in the payload only.
    createArkivEntity(walletClient, {
      type: 'learner_quest_assessment_result_txhash',
      attributes: {
        result_key: arkivEntityKey,
        tx_hash: txHash,
        space_id: finalSpaceId,
        created_at: createdAt,
      },
      payload: { txHash, resultKey: entityKey },
      lifetimeSeconds: ttlSeconds,
    })
      .catch((err) => {
        console.warn('[createQuizResult] Failed to create txhash entity:', err);
      });

    return { key: entityKey, txHash };
  } catch (error: any) {
    console.error('[createQuizResult] Error:', error);
    throw error;
  }
}

/**
 * Get quiz results for a user
 */
export async function getQuizResults({
  wallet,
  questId,
  stepId,
  rubricVersion,
  spaceId = SPACE_ID,
}: {
  wallet?: string;
  questId?: string;
  stepId?: string;
  rubricVersion?: string;
  spaceId?: string;
}): Promise<QuizResult[]> {
  const finalSpaceId = spaceId || SPACE_ID;

  try {
    const publicClient = getPublicClient();
    const query = arkivSelect('learner_quest_assessment_result', publicClient);

    let queryBuilder = query.where(eqAttr('space_id', finalSpaceId));

    if (wallet) {
      queryBuilder = queryBuilder.where(eqAttr('wallet', wallet.toLowerCase()));
    }
    if (questId) {
      queryBuilder = queryBuilder.where(eqAttr('quest_id', questId));
    }
    if (stepId) {
      queryBuilder = queryBuilder.where(eqAttr('step_id', stepId));
    }
    if (rubricVersion) {
      queryBuilder = queryBuilder.where(eqAttr('rubric_version', rubricVersion));
    }

    const result = await queryBuilder.limit(100).fetch();

    // Defensive check
    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.warn('[getQuizResults] Invalid result structure, returning empty array');
      return [];
    }

    // Transform entities to QuizResult objects
    const quizResults: QuizResult[] = [];

    for (const entity of result.entities) {
      try {
        const payload: any = parsePayload(entity);

        const passedAttr = readAttr(entity, 'passed');
        const createdAtAttr = readAttr(entity, 'created_at');

        const quizResult: QuizResult = {
          key: entity.key,
          wallet: readAttr(entity, 'wallet'),
          questId: readAttr(entity, 'quest_id'),
          stepId: readAttr(entity, 'step_id'),
          rubricVersion: readAttr(entity, 'rubric_version'),
          questionIds: payload.questionIds || [],
          answers: payload.answers || {},
          score: payload.score || 0,
          maxScore: payload.maxScore || 0,
          percentage: payload.percentage || 0,
          passed: passedAttr === 'true' || passedAttr === '1',
          progressEntityKey: payload.progressEntityKey || '',
          completedAt:
            payload.completedAt || createdAtAttr || '',
          spaceId: finalSpaceId,
          txHash: undefined, // Would need to query txhash entity to get this
        };

        quizResults.push(quizResult);
      } catch (err) {
        console.warn('[getQuizResults] Failed to parse entity:', entity.key, err);
      }
    }

    // Sort by completedAt descending (most recent first)
    quizResults.sort((a, b) => {
      const timeA = new Date(a.completedAt).getTime();
      const timeB = new Date(b.completedAt).getTime();
      return timeB - timeA;
    });

    return quizResults;
  } catch (error: any) {
    console.error('[getQuizResults] Error:', error);
    // Return empty array on error (graceful degradation)
    return [];
  }
}
