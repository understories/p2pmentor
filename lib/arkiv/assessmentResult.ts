/**
 * Assessment Result and Certification
 *
 * Handles assessment completion, scoring, and certification issuance.
 *
 * Reference: refs/language-quest-implementation-plan.md
 */

import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr, parsePayload } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';
import { getArkivExplorerEntityUrl } from './explorer';
import { getAssessmentProgress } from './languageQuest';
import { getLearnerQuest, learnerQuestSelect } from './learnerQuest';
import { parseLanguageAssessmentQuest } from './languageQuest';
import type { LanguageAssessmentQuest } from './languageQuest';
import { SPACE_ID } from '@/lib/config';

export type AssessmentResult = {
  key: string;
  wallet: string;
  questId: string;
  questType: 'language_assessment';
  language: string;
  proficiencyLevel: string;
  status: 'in_progress' | 'completed' | 'passed' | 'failed';
  sections: Array<{
    sectionId: string;
    questionsAnswered: number;
    questionsCorrect: number;
    pointsEarned: number;
    pointsPossible: number;
    timeSpent: number;
  }>;
  totalScore: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  certification?: {
    issued: boolean;
    certificateId: string;
    issuedAt: string;
    verificationUrl: string;
  };
  metadata: {
    attemptNumber: number;
    totalTimeSpent: number;
    startedAt: string;
    completedAt?: string;
  };
  createdAt: string;
  completedAt?: string;
  txHash?: string;
};

/**
 * Calculate assessment score from progress
 */
export async function calculateAssessmentScore({
  wallet,
  questId,
}: {
  wallet: string;
  questId: string;
}): Promise<{
  totalScore: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  sections: Array<{
    sectionId: string;
    questionsAnswered: number;
    questionsCorrect: number;
    pointsEarned: number;
    pointsPossible: number;
    timeSpent: number;
  }>;
  totalTimeSpent: number;
} | null> {
  try {
    // Get quest definition
    const quest = await getLearnerQuest(questId);
    if (!quest || quest.questType !== 'language_assessment') {
      throw new Error('Quest not found or not a language assessment');
    }

    // Get full quest entity to parse language assessment data
    const publicClient = getPublicClient();
    const result = await learnerQuestSelect(publicClient)
      .where(eqAttr('quest_id', questId))
      .where(eqAttr('status', 'active'))
      .limit(1)
      .fetch();

    if (!result?.entities || result.entities.length === 0) {
      throw new Error('Quest entity not found');
    }

    const entity = result.entities[0];
    const payload = parsePayload<any>(entity);

    if (payload.questType !== 'language_assessment') {
      throw new Error('Quest is not a language assessment');
    }

    const languageQuest = payload as LanguageAssessmentQuest;

    // Get user progress
    const progress = await getAssessmentProgress({ wallet, questId });

    // Calculate scores per section
    const sectionScores = languageQuest.sections.map((section) => {
      let questionsAnswered = 0;
      let questionsCorrect = 0;
      let pointsEarned = 0;
      let timeSpent = 0;

      // Calculate points possible from actual questions (not section.points which may be incorrect)
      let pointsPossible = 0;

      section.questions.forEach((question) => {
        pointsPossible += question.points; // Sum of all question points in section

        const progressKey = `${section.id}:${question.id}`;
        const answerProgress = progress[progressKey];

        if (answerProgress) {
          questionsAnswered += 1;
          if (answerProgress.correct) {
            questionsCorrect += 1;
            pointsEarned += answerProgress.score || question.points; // Use stored score or question points
          }
          timeSpent += answerProgress.timeSpent || 0;
        }
      });

      return {
        sectionId: section.id,
        questionsAnswered,
        questionsCorrect,
        pointsEarned,
        pointsPossible, // Sum of question points, not section.points
        timeSpent,
      };
    });

    const totalScore = sectionScores.reduce((sum, s) => sum + s.pointsEarned, 0);
    // Calculate totalPoints from actual section pointsPossible (more accurate than metadata)
    const totalPoints = sectionScores.reduce((sum, s) => sum + s.pointsPossible, 0);
    // Fallback to metadata if calculation is 0 (shouldn't happen, but defensive)
    const finalTotalPoints = totalPoints > 0 ? totalPoints : languageQuest.metadata.totalPoints;
    const percentage = finalTotalPoints > 0 ? Math.round((totalScore / finalTotalPoints) * 100) : 0;
    // Use calculated totalPoints for passing check (more accurate)
    const passingScore = languageQuest.metadata.passingScore;
    const passed = totalScore >= passingScore;
    const totalTimeSpent = sectionScores.reduce((sum, s) => sum + s.timeSpent, 0);

    return {
      totalScore,
      totalPoints: finalTotalPoints, // Use calculated totalPoints
      percentage,
      passed,
      sections: sectionScores,
      totalTimeSpent,
    };
  } catch (error: any) {
    console.error('[calculateAssessmentScore] Error:', error);
    return null;
  }
}

/**
 * Complete assessment and create result entity
 */
export async function completeAssessment({
  wallet,
  questId,
  startedAt,
  privateKey,
  spaceId = SPACE_ID,
}: {
  wallet: string;
  questId: string;
  startedAt: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string; result: AssessmentResult } | null> {
  try {
    // Calculate score
    const scoreData = await calculateAssessmentScore({ wallet, questId });
    if (!scoreData) {
      throw new Error('Failed to calculate score');
    }

    // Get quest for metadata
    const quest = await getLearnerQuest(questId);
    if (!quest || quest.questType !== 'language_assessment') {
      throw new Error('Quest not found or not a language assessment');
    }

    // Get full quest entity
    const publicClient = getPublicClient();
    const result = await learnerQuestSelect(publicClient)
      .where(eqAttr('quest_id', questId))
      .where(eqAttr('status', 'active'))
      .limit(1)
      .fetch();

    if (!result?.entities || result.entities.length === 0) {
      throw new Error('Quest entity not found');
    }

    const entity = result.entities[0];
    const payload = parsePayload<any>(entity);

    if (payload.questType !== 'language_assessment') {
      throw new Error('Quest is not a language assessment');
    }

    const languageQuest = payload as LanguageAssessmentQuest;

    // Get existing results to determine attempt number
    const normalizedWallet = wallet.toLowerCase();
    const existingResults = await arkivSelect('learner_quest_assessment_result', publicClient)
      .where(eqAttr('wallet', normalizedWallet))
      .where(eqAttr('quest_id', questId))
      .limit(100)
      .fetch();

    const attemptNumber = (existingResults?.entities?.length || 0) + 1;

    const now = new Date().toISOString();
    const status = scoreData.passed ? 'passed' : 'failed';

    const walletClient = getWalletClientFromPrivateKey(privateKey);
    if (!walletClient) {
      throw new Error('Failed to get wallet client');
    }

    // Attributes shared by the result entity and the certification entity
    const resultAttributes = {
      wallet: normalizedWallet,
      quest_id: questId,
      quest_type: 'language_assessment',
      language: languageQuest.language,
      proficiency_level: languageQuest.proficiencyLevel,
      status,
      space_id: spaceId,
      created_at: now,
      completed_at: now,
    };

    const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
      return await createArkivEntity(walletClient, {
        type: 'learner_quest_assessment_result',
        attributes: resultAttributes,
        payload: {
          wallet: normalizedWallet,
          questId,
          questType: 'language_assessment',
          language: languageQuest.language,
          proficiencyLevel: languageQuest.proficiencyLevel,
          status,
          sections: scoreData.sections,
          totalScore: scoreData.totalScore,
          totalPoints: scoreData.totalPoints,
          percentage: scoreData.percentage,
          passed: scoreData.passed,
          // Certification will be added in second entity if passed
          certification: undefined,
          metadata: {
            attemptNumber,
            totalTimeSpent: scoreData.totalTimeSpent,
            startedAt,
            completedAt: now,
          },
        },
      });
    });

    // Build result object with correct verification URL
    // Create a new entity with certification if passed (immutability pattern)
    let finalEntityKey = entityKey;
    let finalTxHash = txHash;

    // Generate certificate ID if passed
    const certificateIdBase = scoreData.passed
      ? `cert_${questId}_${normalizedWallet.slice(2, 10)}_${now.slice(0, 10).replace(/-/g, '')}`
      : undefined;

    // Create txhash entity
    try {
      await handleTransactionWithTimeout(async () => {
        return await createArkivEntity(walletClient, {
          type: 'learner_quest_assessment_result_txhash',
          attributes: {
            result_key: entityKey,
            tx_hash: txHash,
            space_id: spaceId,
            created_at: now,
          },
          payload: {},
        });
      });
    } catch (error) {
      console.warn('[completeAssessment] Failed to create txhash entity:', error);
    }

    if (scoreData.passed && certificateIdBase) {
      const certResult = await handleTransactionWithTimeout(async () => {
        return await createArkivEntity(walletClient, {
          type: 'learner_quest_assessment_result',
          attributes: resultAttributes,
          payload: {
            wallet: normalizedWallet,
            questId,
            questType: 'language_assessment',
            language: languageQuest.language,
            proficiencyLevel: languageQuest.proficiencyLevel,
            status,
            sections: scoreData.sections,
            totalScore: scoreData.totalScore,
            totalPoints: scoreData.totalPoints,
            percentage: scoreData.percentage,
            passed: scoreData.passed,
            certification: {
              issued: true,
              certificateId: certificateIdBase,
              issuedAt: now,
              verificationUrl: getArkivExplorerEntityUrl(entityKey),
            },
            metadata: {
              attemptNumber,
              totalTimeSpent: scoreData.totalTimeSpent,
              startedAt,
              completedAt: now,
            },
          },
        });
      });

      finalEntityKey = certResult.entityKey;
      finalTxHash = certResult.txHash;

      // Create txhash entity for certification result
      try {
        await handleTransactionWithTimeout(async () => {
          return await createArkivEntity(walletClient, {
            type: 'learner_quest_assessment_result_txhash',
            attributes: {
              result_key: finalEntityKey,
              tx_hash: finalTxHash,
              space_id: spaceId,
              created_at: now,
            },
            payload: {},
          });
        });
      } catch (error) {
        console.warn('[completeAssessment] Failed to create certification txhash entity:', error);
      }
    }

    const assessmentResult: AssessmentResult = {
      key: finalEntityKey,
      wallet: normalizedWallet,
      questId,
      questType: 'language_assessment',
      language: languageQuest.language,
      proficiencyLevel: languageQuest.proficiencyLevel,
      status,
      sections: scoreData.sections,
      totalScore: scoreData.totalScore,
      totalPoints: scoreData.totalPoints,
      percentage: scoreData.percentage,
      passed: scoreData.passed,
      certification:
        scoreData.passed && certificateIdBase
          ? {
              issued: true,
              certificateId: certificateIdBase,
              issuedAt: now,
              verificationUrl: getArkivExplorerEntityUrl(finalEntityKey),
            }
          : undefined,
      metadata: {
        attemptNumber,
        totalTimeSpent: scoreData.totalTimeSpent,
        startedAt,
        completedAt: now,
      },
      createdAt: now,
      completedAt: now,
      txHash: finalTxHash,
    };

    return { key: finalEntityKey, txHash: finalTxHash, result: assessmentResult };
  } catch (error: any) {
    console.error('[completeAssessment] Error:', error);
    return null;
  }
}

/**
 * Get assessment result for a user
 */
export async function getAssessmentResult({
  wallet,
  questId,
}: {
  wallet: string;
  questId: string;
}): Promise<AssessmentResult | null> {
  try {
    const publicClient = getPublicClient();
    const normalizedWallet = wallet.toLowerCase();
    const result = await arkivSelect('learner_quest_assessment_result', publicClient)
      .where(eqAttr('wallet', normalizedWallet))
      .where(eqAttr('quest_id', questId))
      .limit(100)
      .fetch();

    if (!result?.entities || !Array.isArray(result.entities) || result.entities.length === 0) {
      return null;
    }

    // Helper to get attribute value
    const getAttr = (entity: any, key: string): string => readAttr(entity, key);

    // Get most recent result (immutability pattern)
    const results = result.entities
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
            questType: 'language_assessment' as const,
            language: getAttr(entity, 'language'),
            proficiencyLevel: getAttr(entity, 'proficiency_level'),
            status: getAttr(entity, 'status') as 'in_progress' | 'completed' | 'passed' | 'failed',
            sections: payload.sections || [],
            totalScore: payload.totalScore || 0,
            totalPoints: payload.totalPoints || 0,
            percentage: payload.percentage || 0,
            passed: payload.passed || false,
            certification: payload.certification,
            metadata: payload.metadata || {},
            createdAt: getAttr(entity, 'created_at'),
            completedAt: getAttr(entity, 'completed_at'),
            txHash: (entity as any).txHash || undefined,
          } as AssessmentResult;
        } catch (e) {
          console.error('[getAssessmentResult] Error decoding payload:', e);
          return null;
        }
      })
      .filter((r): r is AssessmentResult => r !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return results[0] || null;
  } catch (error: any) {
    console.error('[getAssessmentResult] Error:', error);
    return null;
  }
}

/**
 * List all assessment results across all users (for explorer).
 */
export async function listAllAssessmentResults({
  spaceIds,
  limit = 1000,
}: {
  spaceIds?: string[];
  limit?: number;
} = {}): Promise<AssessmentResult[]> {
  try {
    const publicClient = getPublicClient();

    const fetchForSpace = async (spaceId: string): Promise<AssessmentResult[]> => {
      const result = await fetchAll(
        arkivSelect('learner_quest_assessment_result', publicClient).where(
          eqAttr('space_id', spaceId)
        ),
        limit,
        publicClient
      );

      if (!result?.entities || !Array.isArray(result.entities)) return [];

      return (
        result.entities
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((entity: any) => {
            try {
              const getAttr = (key: string): string => readAttr(entity, key);

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              let payload: any = {};
              try {
                if (entity.payload) {
                  const decoded =
                    entity.payload instanceof Uint8Array
                      ? new TextDecoder().decode(entity.payload)
                      : typeof entity.payload === 'string'
                        ? entity.payload
                        : JSON.stringify(entity.payload);
                  payload = JSON.parse(decoded);
                }
              } catch {
                // Silently ignore
              }

              return {
                key: entity.key,
                wallet: getAttr('wallet'),
                questId: getAttr('quest_id'),
                questType: 'language_assessment' as const,
                language: getAttr('language'),
                proficiencyLevel: getAttr('proficiency_level'),
                status: (getAttr('status') || 'completed') as AssessmentResult['status'],
                sections: payload.sections || [],
                totalScore: payload.totalScore || 0,
                totalPoints: payload.totalPoints || 0,
                percentage: payload.percentage || 0,
                passed: payload.passed || false,
                certification: payload.certification,
                metadata: payload.metadata || {},
                createdAt: getAttr('created_at'),
                completedAt: getAttr('completed_at') || undefined,
                txHash: entity.txHash || undefined,
              } as AssessmentResult;
            } catch {
              return null;
            }
          })
          .filter((r): r is AssessmentResult => r !== null)
      );
    };

    if (spaceIds && spaceIds.length > 0) {
      const results = await Promise.all(spaceIds.map(fetchForSpace));
      return results.flat();
    }

    return await fetchForSpace(SPACE_ID);
  } catch (error: unknown) {
    console.error('[listAllAssessmentResults] Error:', error);
    return [];
  }
}
