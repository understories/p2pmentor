/**
 * Quest Step Types and Evidence Definitions
 *
 * Defines the standardized step types for the Learning Quest engine
 * and the evidence structures that get written to Arkiv for each step type.
 *
 * Reference: refs/docs/jan26plan.md - Week 1 QuestStep Primitive Spec
 */

/**
 * Supported quest step types
 *
 * READ - Content + reflection (mark as read)
 * DO - Perform an action (e.g., create Arkiv entity)
 * QUIZ - Auto-scored assessment
 * SUBMIT - User submits artifact (link/hash/text)
 * SESSION - Complete a mentorship session
 * VERIFY - Client-side verification of Arkiv query result
 */
export type QuestStepType = 'READ' | 'DO' | 'QUIZ' | 'SUBMIT' | 'SESSION' | 'VERIFY';

/**
 * Quiz configuration for QUIZ step type
 */
export interface QuizConfig {
  rubricVersion: string;
  passingScore: number; // 0-1 (e.g., 0.7 = 70%)
  questionIds: string[];
  timeLimit?: number; // seconds
  allowRetake?: boolean;
}

/**
 * Action configuration for DO step type
 */
export interface ActionConfig {
  actionType: 'create_entity' | 'query_entity' | 'external_action';
  entityType?: string; // For create_entity actions
  requiredFields?: string[]; // Fields required in the created entity
  validationRules?: Record<string, string>; // Field validation rules
  externalUrl?: string; // For external_action type
}

/**
 * Verification configuration for VERIFY step type
 */
export interface VerifyConfig {
  queryType: string; // The type of entity to query
  expectedFields?: string[]; // Fields that should exist in results
  minResults?: number; // Minimum number of results expected
  verificationMethod: 'entity_exists' | 'field_match' | 'count_check';
}

/**
 * Session configuration for SESSION step type
 */
export interface SessionConfig {
  sessionType: 'mentorship' | 'peer' | 'group';
  minDurationMinutes?: number;
  requireFeedback?: boolean;
}

/**
 * Submit configuration for SUBMIT step type
 */
export interface SubmitConfig {
  submitType: 'url' | 'hash' | 'text' | 'file_reference';
  validationPattern?: string; // Regex for URL/hash validation
  maxLength?: number; // For text submissions
  requiredPrefix?: string; // e.g., "https://" for URLs
}

/**
 * Quest Step definition
 *
 * Represents a single step within a learning quest track.
 */
export interface QuestStep {
  stepId: string;
  type: QuestStepType;
  title: string;
  description: string;
  duration?: number; // Estimated minutes
  order: number;
  contentFile?: string; // e.g., 'steps/01-intro.md'
  required: boolean;

  // Type-specific configurations
  quizConfig?: QuizConfig;
  actionConfig?: ActionConfig;
  verifyConfig?: VerifyConfig;
  sessionConfig?: SessionConfig;
  submitConfig?: SubmitConfig;

  // Optional concept card for learning principle
  conceptCard?: {
    title: string;
    body: string;
  } | null;
}

/**
 * Evidence types that can be stored for step completion
 */
export type QuestEvidenceType =
  | 'completion'           // Simple completion (READ steps)
  | 'entity_created'       // Entity was created on Arkiv (DO steps)
  | 'quiz_result'          // Quiz was completed with score (QUIZ steps)
  | 'submission'           // User submitted an artifact (SUBMIT steps)
  | 'session_completed'    // Mentorship session completed (SESSION steps)
  | 'query_proof';         // Query was verified (VERIFY steps)

/**
 * Evidence record for a completed quest step
 *
 * This structure is stored in the payload of quest_progress entities.
 */
export interface QuestStepEvidence {
  stepId: string;
  completedAt: string; // ISO timestamp
  evidenceType: QuestEvidenceType;
  questVersion?: string; // Track which quest version was completed

  // Evidence pointers (populated based on evidenceType)
  entityKey?: string;        // For entity_created
  txHash?: string;           // Transaction hash for verification
  queryFingerprint?: string; // Hash of normalized query params (for query_proof)
  resultKeys?: string[];     // Entity keys returned by query (for query_proof)

  // Quiz-specific evidence
  score?: number;            // Points earned (for quiz_result)
  maxScore?: number;         // Max possible points (for quiz_result)
  rubricVersion?: string;    // Which rubric was used (for quiz_result)
  questionIds?: string[];    // Which questions were answered (for quiz_result)

  // Submission-specific evidence
  submittedValue?: string;   // The submitted URL/hash/text (for submission)
  submittedType?: 'url' | 'hash' | 'text' | 'file_reference';

  // Session-specific evidence
  sessionEntityKey?: string; // Reference to the session entity (for session_completed)
  sessionDurationMinutes?: number;
}

/**
 * Evidence mapping by step type
 *
 * Defines what evidence is expected for each step type.
 * This is used for validation when recording progress.
 */
export const EVIDENCE_BY_STEP_TYPE: Record<QuestStepType, {
  evidenceType: QuestEvidenceType;
  requiredFields: (keyof QuestStepEvidence)[];
  optionalFields: (keyof QuestStepEvidence)[];
}> = {
  READ: {
    evidenceType: 'completion',
    requiredFields: ['stepId', 'completedAt', 'evidenceType'],
    optionalFields: ['questVersion'],
  },
  DO: {
    evidenceType: 'entity_created',
    requiredFields: ['stepId', 'completedAt', 'evidenceType', 'entityKey'],
    optionalFields: ['txHash', 'questVersion'],
  },
  QUIZ: {
    evidenceType: 'quiz_result',
    requiredFields: ['stepId', 'completedAt', 'evidenceType', 'score', 'rubricVersion'],
    optionalFields: ['maxScore', 'questionIds', 'questVersion'],
  },
  SUBMIT: {
    evidenceType: 'submission',
    requiredFields: ['stepId', 'completedAt', 'evidenceType', 'submittedValue', 'submittedType'],
    optionalFields: ['questVersion'],
  },
  SESSION: {
    evidenceType: 'session_completed',
    requiredFields: ['stepId', 'completedAt', 'evidenceType', 'sessionEntityKey'],
    optionalFields: ['sessionDurationMinutes', 'questVersion'],
  },
  VERIFY: {
    evidenceType: 'query_proof',
    requiredFields: ['stepId', 'completedAt', 'evidenceType', 'queryFingerprint'],
    optionalFields: ['resultKeys', 'questVersion'],
  },
};

/**
 * Validate evidence for a step type
 *
 * Checks that required fields are present for the given step type.
 */
export function validateStepEvidence(
  stepType: QuestStepType,
  evidence: Partial<QuestStepEvidence>
): { valid: boolean; missingFields: string[] } {
  const config = EVIDENCE_BY_STEP_TYPE[stepType];
  const missingFields: string[] = [];

  for (const field of config.requiredFields) {
    if (evidence[field] === undefined || evidence[field] === null) {
      missingFields.push(field);
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Create evidence for a completed step
 *
 * Helper to create properly typed evidence objects.
 */
export function createStepEvidence(
  stepType: QuestStepType,
  stepId: string,
  additionalFields: Partial<Omit<QuestStepEvidence, 'stepId' | 'completedAt' | 'evidenceType'>> = {}
): QuestStepEvidence {
  const config = EVIDENCE_BY_STEP_TYPE[stepType];

  return {
    stepId,
    completedAt: new Date().toISOString(),
    evidenceType: config.evidenceType,
    ...additionalFields,
  };
}
