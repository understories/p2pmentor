/**
 * Quest Authoring Format
 *
 * Defines the JSON schema for quest definitions that can be
 * authored by non-engineers using a simple JSON/MD hybrid format.
 *
 * Quest content lives in content/quests/<trackId>/quest.json
 * with step content in content/quests/<trackId>/steps/<stepId>.md
 *
 * Reference: refs/docs/jan26plan.md - Week 1 Day 5-7
 */

import type { QuestStepType } from '@/lib/arkiv/questStep';

/**
 * Difficulty levels for quests
 */
export type QuestDifficulty = 'beginner' | 'intermediate' | 'advanced';

/**
 * Quest track categories
 */
export type QuestTrack =
  | 'arkiv'
  | 'mandarin'
  | 'spanish'
  | 'cryptography'
  | 'privacy'
  | 'ai'
  | 'meta_learning';

/**
 * Quiz question format for QUIZ steps
 */
export interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'fill_blank' | 'matching';
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  points: number;
  explanation?: string;
}

/**
 * Quiz rubric for scoring
 */
export interface QuizRubric {
  version: string;
  passingScore: number; // 0-1 (e.g., 0.7 = 70%)
  questions: QuizQuestion[];
}

/**
 * Step definition within a quest
 */
export interface QuestStepDefinition {
  stepId: string;
  type: QuestStepType;
  title: string;
  description: string;
  contentFile?: string; // Path to markdown file, e.g., "steps/01-intro.md"
  duration?: number; // Estimated minutes
  order: number;
  required: boolean;

  // Type-specific configurations
  quizRubricId?: string; // Reference to rubric in quest.rubrics
  actionType?: 'create_entity' | 'query_entity' | 'external_action';
  entityType?: string;
  externalUrl?: string;
  verificationMethod?: 'entity_exists' | 'field_match' | 'count_check';

  // Optional concept card for learning principle
  conceptCard?: {
    title: string;
    body: string;
  } | null;
}

/**
 * Complete quest definition
 *
 * This is the JSON format for quest.json files.
 */
export interface QuestDefinition {
  // Identity
  questId: string;
  version: string;
  track: QuestTrack;

  // Metadata
  title: string;
  description: string;
  source?: string; // Attribution URL
  estimatedDuration: string; // e.g., "60 minutes"
  difficulty: QuestDifficulty;

  // Content
  steps: QuestStepDefinition[];

  // Quiz rubrics (referenced by stepId)
  rubrics?: Record<string, QuizRubric>;

  // Badge configuration
  badge?: {
    id: string;
    name: string;
    description: string;
    requiredSteps?: string[]; // If not specified, all required steps must be completed
  };
}

/**
 * Loaded quest with resolved content
 */
export interface LoadedQuest extends QuestDefinition {
  // Resolved step content (markdown)
  stepContent: Record<string, string>;
}

/**
 * Quest summary for list views
 */
export interface QuestSummary {
  questId: string;
  track: QuestTrack;
  title: string;
  description: string;
  estimatedDuration: string;
  difficulty: QuestDifficulty;
  stepCount: number;
  hasBadge: boolean;
}

/**
 * Validate quest definition structure
 */
export function validateQuestDefinition(quest: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!quest || typeof quest !== 'object') {
    return { valid: false, errors: ['Quest must be an object'] };
  }

  const q = quest as Record<string, unknown>;

  // Required fields
  if (!q.questId || typeof q.questId !== 'string') {
    errors.push('questId is required and must be a string');
  }
  if (!q.version || typeof q.version !== 'string') {
    errors.push('version is required and must be a string');
  }
  if (!q.title || typeof q.title !== 'string') {
    errors.push('title is required and must be a string');
  }
  if (!q.description || typeof q.description !== 'string') {
    errors.push('description is required and must be a string');
  }
  if (!q.steps || !Array.isArray(q.steps)) {
    errors.push('steps is required and must be an array');
  }

  // Validate steps
  if (Array.isArray(q.steps)) {
    const stepIds = new Set<string>();
    q.steps.forEach((step: unknown, index: number) => {
      if (!step || typeof step !== 'object') {
        errors.push(`Step ${index} must be an object`);
        return;
      }
      const s = step as Record<string, unknown>;
      if (!s.stepId || typeof s.stepId !== 'string') {
        errors.push(`Step ${index}: stepId is required`);
      } else {
        if (stepIds.has(s.stepId as string)) {
          errors.push(`Step ${index}: duplicate stepId "${s.stepId}"`);
        }
        stepIds.add(s.stepId as string);
      }
      if (!s.type || typeof s.type !== 'string') {
        errors.push(`Step ${index}: type is required`);
      }
      if (!s.title || typeof s.title !== 'string') {
        errors.push(`Step ${index}: title is required`);
      }
      if (typeof s.order !== 'number') {
        errors.push(`Step ${index}: order is required and must be a number`);
      }
      if (typeof s.required !== 'boolean') {
        errors.push(`Step ${index}: required is required and must be a boolean`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Create a quest summary from a full definition
 */
export function createQuestSummary(quest: QuestDefinition): QuestSummary {
  return {
    questId: quest.questId,
    track: quest.track,
    title: quest.title,
    description: quest.description,
    estimatedDuration: quest.estimatedDuration,
    difficulty: quest.difficulty,
    stepCount: quest.steps.length,
    hasBadge: !!quest.badge,
  };
}
