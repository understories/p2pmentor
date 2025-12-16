/**
 * Assessment Result and Certification
 *
 * Handles assessment completion, scoring, and certification issuance.
 *
 * Reference: refs/language-quest-implementation-plan.md
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { handleTransactionWithTimeout } from "./transaction-utils";
import { getAssessmentProgress } from "./languageQuest";
import { getLearnerQuest } from "./learnerQuest";
import { parseLanguageAssessmentQuest } from "./languageQuest";
import type { LanguageAssessmentQuest } from "./languageQuest";

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
    const result = await publicClient.buildQuery()
      .where(eq('type', 'learner_quest'))
      .where(eq('questId', questId))
      .where(eq('status', 'active'))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch();

    if (!result?.entities || result.entities.length === 0) {
      throw new Error('Quest entity not found');
    }

    const entity = result.entities[0];
    const decoded = entity.payload instanceof Uint8Array
      ? new TextDecoder().decode(entity.payload)
      : typeof entity.payload === 'string'
      ? entity.payload
      : JSON.stringify(entity.payload);
    const payload = JSON.parse(decoded);

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

      section.questions.forEach((question) => {
        const progressKey = `${section.id}:${question.id}`;
        const answerProgress = progress[progressKey];

        if (answerProgress) {
          questionsAnswered += 1;
          if (answerProgress.correct) {
            questionsCorrect += 1;
            pointsEarned += answerProgress.score;
          }
          timeSpent += answerProgress.timeSpent || 0;
        }
      });

      return {
        sectionId: section.id,
        questionsAnswered,
        questionsCorrect,
        pointsEarned,
        pointsPossible: section.points,
        timeSpent,
      };
    });

    const totalScore = sectionScores.reduce((sum, s) => sum + s.pointsEarned, 0);
    const totalPoints = languageQuest.metadata.totalPoints;
    const percentage = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;
    const passed = totalScore >= languageQuest.metadata.passingScore;
    const totalTimeSpent = sectionScores.reduce((sum, s) => sum + s.timeSpent, 0);

    return {
      totalScore,
      totalPoints,
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
  spaceId = 'local-dev',
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
    const result = await publicClient.buildQuery()
      .where(eq('type', 'learner_quest'))
      .where(eq('questId', questId))
      .where(eq('status', 'active'))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch();

    if (!result?.entities || result.entities.length === 0) {
      throw new Error('Quest entity not found');
    }

    const entity = result.entities[0];
    const decoded = entity.payload instanceof Uint8Array
      ? new TextDecoder().decode(entity.payload)
      : typeof entity.payload === 'string'
      ? entity.payload
      : JSON.stringify(entity.payload);
    const payload = JSON.parse(decoded);

    if (payload.questType !== 'language_assessment') {
      throw new Error('Quest is not a language assessment');
    }

    const languageQuest = payload as LanguageAssessmentQuest;

    // Get existing results to determine attempt number
    const normalizedWallet = wallet.toLowerCase();
    const existingResults = await publicClient.buildQuery()
      .where(eq('type', 'learner_quest_assessment_result'))
      .where(eq('wallet', normalizedWallet))
      .where(eq('questId', questId))
      .withAttributes(true)
      .limit(100)
      .fetch();

    const attemptNumber = (existingResults?.entities?.length || 0) + 1;

    const now = new Date().toISOString();
    const status = scoreData.passed ? 'passed' : 'failed';

    const walletClient = getWalletClientFromPrivateKey(privateKey);
    if (!walletClient) {
      throw new Error('Failed to get wallet client');
    }

    const enc = new TextEncoder();

    const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify({
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
        })),
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'learner_quest_assessment_result' },
          { key: 'wallet', value: normalizedWallet },
          { key: 'questId', value: questId },
          { key: 'questType', value: 'language_assessment' },
          { key: 'language', value: languageQuest.language },
          { key: 'proficiencyLevel', value: languageQuest.proficiencyLevel },
          { key: 'status', value: status },
          { key: 'spaceId', value: spaceId },
          { key: 'createdAt', value: now },
          { key: 'completedAt', value: now },
        ],
        expiresIn: 31536000, // 1 year
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
        return await walletClient.createEntity({
          payload: enc.encode(JSON.stringify({})),
          contentType: 'application/json',
          attributes: [
            { key: 'type', value: 'learner_quest_assessment_result_txhash' },
            { key: 'resultKey', value: entityKey },
            { key: 'txHash', value: txHash },
            { key: 'spaceId', value: spaceId },
            { key: 'createdAt', value: now },
          ],
          expiresIn: 31536000, // 1 year
        });
      });
    } catch (error) {
      console.warn('[completeAssessment] Failed to create txhash entity:', error);
    }

    if (scoreData.passed && certificateIdBase) {
      const certResult = await handleTransactionWithTimeout(async () => {
        return await walletClient.createEntity({
          payload: enc.encode(JSON.stringify({
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
              verificationUrl: `https://explorer.mendoza.hoodi.arkiv.network/entity/${entityKey}`,
            },
            metadata: {
              attemptNumber,
              totalTimeSpent: scoreData.totalTimeSpent,
              startedAt,
              completedAt: now,
            },
          })),
          contentType: 'application/json',
          attributes: [
            { key: 'type', value: 'learner_quest_assessment_result' },
            { key: 'wallet', value: normalizedWallet },
            { key: 'questId', value: questId },
            { key: 'questType', value: 'language_assessment' },
            { key: 'language', value: languageQuest.language },
            { key: 'proficiencyLevel', value: languageQuest.proficiencyLevel },
            { key: 'status', value: status },
            { key: 'spaceId', value: spaceId },
            { key: 'createdAt', value: now },
            { key: 'completedAt', value: now },
          ],
          expiresIn: 31536000, // 1 year
        });
      });

      finalEntityKey = certResult.entityKey;
      finalTxHash = certResult.txHash;

      // Create txhash entity for certification result
      try {
        await handleTransactionWithTimeout(async () => {
          return await walletClient.createEntity({
            payload: enc.encode(JSON.stringify({})),
            contentType: 'application/json',
            attributes: [
              { key: 'type', value: 'learner_quest_assessment_result_txhash' },
              { key: 'resultKey', value: finalEntityKey },
              { key: 'txHash', value: finalTxHash },
              { key: 'spaceId', value: spaceId },
              { key: 'createdAt', value: now },
            ],
            expiresIn: 31536000, // 1 year
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
      certification: scoreData.passed && certificateIdBase
        ? {
            issued: true,
            certificateId: certificateIdBase,
            issuedAt: now,
            verificationUrl: `https://explorer.mendoza.hoodi.arkiv.network/entity/${finalEntityKey}`,
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
    const result = await publicClient.buildQuery()
      .where(eq('type', 'learner_quest_assessment_result'))
      .where(eq('wallet', normalizedWallet))
      .where(eq('questId', questId))
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

    // Get most recent result (immutability pattern)
    const results = result.entities
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
            questType: 'language_assessment' as const,
            language: getAttr(entity, 'language'),
            proficiencyLevel: getAttr(entity, 'proficiencyLevel'),
            status: getAttr(entity, 'status') as 'in_progress' | 'completed' | 'passed' | 'failed',
            sections: payload.sections || [],
            totalScore: payload.totalScore || 0,
            totalPoints: payload.totalPoints || 0,
            percentage: payload.percentage || 0,
            passed: payload.passed || false,
            certification: payload.certification,
            metadata: payload.metadata || {},
            createdAt: getAttr(entity, 'createdAt'),
            completedAt: getAttr(entity, 'completedAt'),
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

