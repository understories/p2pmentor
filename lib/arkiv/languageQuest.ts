/**
 * Language Assessment Quest CRUD helpers
 *
 * Arkiv-native implementation for language assessment quests.
 * Supports text-only questions (no audio/images in MVP).
 *
 * Reference: refs/language-quest-implementation-plan.md
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { handleTransactionWithTimeout } from "./transaction-utils";

export type QuestionType = 'multiple_choice' | 'fill_blank' | 'matching' | 'true_false' | 'sentence_order';

export type LanguageAssessmentQuestion = {
  id: string;
  type: QuestionType;
  question: string;
  // Optional fields for future phases (not used in MVP):
  audioUrl?: string;
  imageUrl?: string;
  // Question content:
  options?: Array<{ id: string; text: string; correct: boolean }>; // For multiple_choice
  correctAnswer: string | string[]; // For fill_blank, matching, true_false, sentence_order
  wordBank?: string[]; // For fill_blank questions
  matchingPairs?: Array<{ left: string; right: string }>; // For matching questions
  sentences?: string[]; // For sentence_order questions
  points: number;
  explanation?: string;
  timeLimit?: number;
};

export type LanguageAssessmentSection = {
  id: string;
  title: string;
  description: string;
  questions: LanguageAssessmentQuestion[];
  timeLimit: number;
  points: number;
};

export type LanguageAssessmentQuest = {
  questType: 'language_assessment';
  language: string;
  proficiencyLevel: string;
  sections: LanguageAssessmentSection[];
  metadata: {
    totalQuestions: number;
    totalPoints: number;
    passingScore: number;
    timeLimit: number;
    certificationName: string;
  };
};

/**
 * Validate language assessment quest structure
 */
export function validateLanguageAssessmentQuest(quest: LanguageAssessmentQuest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (quest.questType !== 'language_assessment') {
    errors.push('questType must be "language_assessment"');
  }

  if (!quest.language || quest.language.length === 0) {
    errors.push('language is required');
  }

  if (!quest.proficiencyLevel || quest.proficiencyLevel.length === 0) {
    errors.push('proficiencyLevel is required');
  }

  if (!quest.sections || quest.sections.length === 0) {
    errors.push('At least one section is required');
  }

  let totalQuestions = 0;
  let totalPoints = 0;

  quest.sections.forEach((section, sectionIndex) => {
    if (!section.id) {
      errors.push(`Section ${sectionIndex + 1}: id is required`);
    }

    if (!section.title) {
      errors.push(`Section ${sectionIndex + 1}: title is required`);
    }

    if (!section.questions || section.questions.length === 0) {
      errors.push(`Section ${sectionIndex + 1}: At least one question is required`);
    }

    let sectionPoints = 0;

    section.questions.forEach((question, questionIndex) => {
      if (!question.id) {
        errors.push(`Section ${sectionIndex + 1}, Question ${questionIndex + 1}: id is required`);
      }

      if (!question.type) {
        errors.push(`Section ${sectionIndex + 1}, Question ${questionIndex + 1}: type is required`);
      }

      if (!question.question || question.question.length === 0) {
        errors.push(`Section ${sectionIndex + 1}, Question ${questionIndex + 1}: question text is required`);
      }

      if (question.points <= 0) {
        errors.push(`Section ${sectionIndex + 1}, Question ${questionIndex + 1}: points must be positive`);
      }

      // Validate question type-specific fields
      if (question.type === 'multiple_choice') {
        if (!question.options || question.options.length < 2) {
          errors.push(`Section ${sectionIndex + 1}, Question ${questionIndex + 1}: multiple_choice requires at least 2 options`);
        } else {
          const correctCount = question.options.filter(o => o.correct).length;
          if (correctCount !== 1) {
            errors.push(`Section ${sectionIndex + 1}, Question ${questionIndex + 1}: multiple_choice must have exactly one correct option`);
          }
        }
      } else if (question.type === 'fill_blank') {
        if (!question.wordBank || question.wordBank.length === 0) {
          errors.push(`Section ${sectionIndex + 1}, Question ${questionIndex + 1}: fill_blank requires wordBank`);
        }
        if (!question.correctAnswer || typeof question.correctAnswer !== 'string') {
          errors.push(`Section ${sectionIndex + 1}, Question ${questionIndex + 1}: fill_blank requires correctAnswer (string)`);
        }
        if (question.wordBank && question.correctAnswer && !question.wordBank.includes(question.correctAnswer as string)) {
          errors.push(`Section ${sectionIndex + 1}, Question ${questionIndex + 1}: correctAnswer must be in wordBank`);
        }
      } else if (question.type === 'matching') {
        if (!question.matchingPairs || question.matchingPairs.length < 2) {
          errors.push(`Section ${sectionIndex + 1}, Question ${questionIndex + 1}: matching requires at least 2 matching pairs`);
        }
        if (!question.correctAnswer || !Array.isArray(question.correctAnswer)) {
          errors.push(`Section ${sectionIndex + 1}, Question ${questionIndex + 1}: matching requires correctAnswer (array)`);
        }
      } else if (question.type === 'true_false') {
        if (question.correctAnswer !== 'true' && question.correctAnswer !== 'false') {
          errors.push(`Section ${sectionIndex + 1}, Question ${questionIndex + 1}: true_false requires correctAnswer to be "true" or "false"`);
        }
      } else if (question.type === 'sentence_order') {
        if (!question.sentences || question.sentences.length < 3) {
          errors.push(`Section ${sectionIndex + 1}, Question ${questionIndex + 1}: sentence_order requires at least 3 sentences`);
        }
        if (!question.correctAnswer || !Array.isArray(question.correctAnswer)) {
          errors.push(`Section ${sectionIndex + 1}, Question ${questionIndex + 1}: sentence_order requires correctAnswer (array)`);
        }
      }

      sectionPoints += question.points;
      totalQuestions += 1;
    });

    if (section.points !== sectionPoints) {
      errors.push(`Section ${sectionIndex + 1}: points (${section.points}) does not match sum of question points (${sectionPoints})`);
    }

    totalPoints += sectionPoints;
  });

  if (quest.metadata.totalQuestions !== totalQuestions) {
    errors.push(`metadata.totalQuestions (${quest.metadata.totalQuestions}) does not match actual question count (${totalQuestions})`);
  }

  if (quest.metadata.totalPoints !== totalPoints) {
    errors.push(`metadata.totalPoints (${quest.metadata.totalPoints}) does not match actual point total (${totalPoints})`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create language assessment quest
 *
 * Creates a learner_quest entity with questType='language_assessment'.
 * The quest data is stored in the payload following the LanguageAssessmentQuest structure.
 */
export async function createLanguageAssessmentQuest({
  questId,
  title,
  description,
  source,
  language,
  proficiencyLevel,
  sections,
  metadata,
  privateKey,
  spaceId = 'local-dev',
}: {
  questId: string;
  title: string;
  description: string;
  source: string;
  language: string;
  proficiencyLevel: string;
  sections: LanguageAssessmentSection[];
  metadata: {
    totalQuestions: number;
    totalPoints: number;
    passingScore: number;
    timeLimit: number;
    certificationName: string;
  };
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string } | null> {
  try {
    // Build the language assessment quest structure
    const languageQuest: LanguageAssessmentQuest = {
      questType: 'language_assessment',
      language,
      proficiencyLevel,
      sections,
      metadata,
    };

    // Validate the quest structure
    const validation = validateLanguageAssessmentQuest(languageQuest);
    if (!validation.valid) {
      console.error('[createLanguageAssessmentQuest] Validation errors:', validation.errors);
      throw new Error(`Invalid language assessment quest: ${validation.errors.join(', ')}`);
    }

    const walletClient = getWalletClientFromPrivateKey(privateKey);
    if (!walletClient) {
      throw new Error('Failed to get wallet client');
    }

    const enc = new TextEncoder();
    const createdAt = new Date().toISOString();

    const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify(languageQuest)),
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'learner_quest' },
          { key: 'questId', value: questId },
          { key: 'title', value: title },
          { key: 'description', value: description },
          { key: 'source', value: source },
          { key: 'questType', value: 'language_assessment' },
          { key: 'language', value: language },
          { key: 'proficiencyLevel', value: proficiencyLevel },
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
      console.warn('[createLanguageAssessmentQuest] Failed to create txhash entity:', error);
    }

    return { key: entityKey, txHash };
  } catch (error: any) {
    console.error('[createLanguageAssessmentQuest] Error:', error);
    return null;
  }
}

/**
 * Parse language assessment quest from learner quest entity
 *
 * Helper to extract language assessment data from a LearnerQuest entity.
 */
export function parseLanguageAssessmentQuest(quest: any): LanguageAssessmentQuest | null {
  try {
    if (quest.questType !== 'language_assessment') {
      return null;
    }

    // The language assessment data is stored in the payload
    // For reading list quests, payload contains materials
    // For language assessment quests, payload contains the LanguageAssessmentQuest structure
    if (quest.payload) {
      const payload = typeof quest.payload === 'string'
        ? JSON.parse(quest.payload)
        : quest.payload;

      if (payload.questType === 'language_assessment') {
        return payload as LanguageAssessmentQuest;
      }
    }

    return null;
  } catch (error: any) {
    console.error('[parseLanguageAssessmentQuest] Error:', error);
    return null;
  }
}

