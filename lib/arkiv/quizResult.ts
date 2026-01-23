/**
 * Quiz Result Entity Functions
 *
 * Stores quiz attempt results as separate Arkiv entities for detailed tracking
 * and verification. Links to quest_step_progress entities via evidenceRef.
 *
 * Week 2 (Feb 8-14) - Quiz engine v1
 */

import { getPublicClient, getWalletClientFromPrivateKey } from '@/lib/arkiv/client';
import { buildQuery, eq } from '@arkiv/sdk';
import { handleTransactionWithTimeout } from './transaction-utils';
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
  ttlSeconds = 31536000, // 1 year default
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
    const enc = new TextEncoder();

    // Build attributes (queryable fields)
    const attributes = [
      { key: 'type', value: 'learner_quest_assessment_result' },
      { key: 'wallet', value: normalizedWallet },
      { key: 'questId', value: questId },
      { key: 'stepId', value: stepId },
      { key: 'rubricVersion', value: rubricVersion },
      { key: 'spaceId', value: finalSpaceId },
      { key: 'createdAt', value: createdAt },
      { key: 'passed', value: passed ? 'true' : 'false' },
    ];

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

    const { txHash } = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify(payload)),
        contentType: 'application/json',
        attributes,
        expiresIn: ttlSeconds,
      });
    });

    // Create txhash entity for observability (fire and forget)
    walletClient.createEntity({
      payload: enc.encode(JSON.stringify({ txHash, resultKey: entityKey })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'learner_quest_assessment_result_txhash' },
        { key: 'resultKey', value: entityKey },
        { key: 'txHash', value: txHash },
        { key: 'spaceId', value: finalSpaceId },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn: ttlSeconds,
    }).catch((err) => {
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
    const query = publicClient.buildQuery();

    let queryBuilder = query
      .where(eq('type', 'learner_quest_assessment_result'))
      .where(eq('spaceId', finalSpaceId));

    if (wallet) {
      queryBuilder = queryBuilder.where(eq('wallet', wallet.toLowerCase()));
    }
    if (questId) {
      queryBuilder = queryBuilder.where(eq('questId', questId));
    }
    if (stepId) {
      queryBuilder = queryBuilder.where(eq('stepId', stepId));
    }
    if (rubricVersion) {
      queryBuilder = queryBuilder.where(eq('rubricVersion', rubricVersion));
    }

    const result = await queryBuilder
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch();

    // Defensive check
    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.warn('[getQuizResults] Invalid result structure, returning empty array');
      return [];
    }

    // Transform entities to QuizResult objects
    const quizResults: QuizResult[] = [];

    for (const entity of result.entities) {
      try {
        const payload = entity.payload
          ? JSON.parse(new TextDecoder().decode(entity.payload))
          : {};

        const quizResult: QuizResult = {
          key: entity.key,
          wallet: entity.attributes.find((a) => a.key === 'wallet')?.value || '',
          questId: entity.attributes.find((a) => a.key === 'questId')?.value || '',
          stepId: entity.attributes.find((a) => a.key === 'stepId')?.value || '',
          rubricVersion: entity.attributes.find((a) => a.key === 'rubricVersion')?.value || '',
          questionIds: payload.questionIds || [],
          answers: payload.answers || {},
          score: payload.score || 0,
          maxScore: payload.maxScore || 0,
          percentage: payload.percentage || 0,
          passed: entity.attributes.find((a) => a.key === 'passed')?.value === 'true',
          progressEntityKey: payload.progressEntityKey || '',
          completedAt: payload.completedAt || entity.attributes.find((a) => a.key === 'createdAt')?.value || '',
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
