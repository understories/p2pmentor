/**
 * Public data contracts for the explorer
 *
 * Defines the shape of public entities exposed via the explorer API.
 * All entities include ALL data stored on Arkiv to demonstrate transparency.
 * All data shown here is verifiable via transaction hashes.
 */

/**
 * Transaction provenance metadata
 */
export interface Provenance {
  txHash: string;
  explorerTxUrl: string;
  blockNumber: string | null;
  blockTimestamp: number | null;
  status: 'success' | 'failed' | 'pending' | null;
}

/**
 * Base public entity structure
 */
export interface PublicEntity {
  key: string;
  type:
    | 'profile'
    | 'ask'
    | 'offer'
    | 'skill'
    | 'lite_ask'
    | 'lite_offer'
    | 'meta_learning_artifact'
    | 'learner_quest_progress'
    | 'quest_definition'
    | 'quest_step_progress'
    | 'proof_of_skill_badge'
    | 'learner_quest_assessment_result'
    | 'quest_telemetry'
    | 'quest_reflection'
    | 'quest_completion_skill_link';
  wallet?: string;
  title?: string;
  summary?: string;
  createdAt?: string;
  txHash?: string;
  provenance?: Provenance | null;
}

/**
 * Public profile (all fields stored on Arkiv)
 */
export interface PublicProfile extends PublicEntity {
  type: 'profile';
  wallet: string;
  displayName: string;
  username?: string;
  profileImage?: string;
  identity_seed?: string;
  exploringStatement?: string;
  bio?: string;
  bioShort?: string;
  bioLong?: string;
  skills?: string;
  skillsArray?: string[];
  skillExpertise?: Record<string, number>;
  timezone?: string;
  languages?: string[];
  contactLinks?: {
    twitter?: string;
    github?: string;
    telegram?: string;
    discord?: string;
  };
  seniority?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  domainsOfInterest?: string[];
  mentorRoles?: string[];
  learnerRoles?: string[];
  availabilityWindow?: string;
  sessionsCompleted?: number;
  sessionsGiven?: number;
  sessionsReceived?: number;
  npsScore?: number;
  topSkillsUsage?: Array<{ skill: string; count: number }>;
  peerTestimonials?: Array<{ text: string; timestamp: string; fromWallet: string }>;
  trustEdges?: Array<{ toWallet: string; strength: number; createdAt: string }>;
  communityAffiliations?: string[];
  reputationScore?: number;
  lastActiveTimestamp?: string;
  spaceId?: string;
}

/**
 * Public ask (all fields are public by design)
 */
export interface PublicAsk extends PublicEntity {
  type: 'ask';
  wallet: string;
  skill: string;
  skill_id?: string;
  skill_label?: string;
  message: string;
  status: string;
  spaceId?: string;
}

/**
 * Public offer (all fields are public by design)
 */
export interface PublicOffer extends PublicEntity {
  type: 'offer';
  wallet: string;
  skill: string;
  skill_id?: string;
  skill_label?: string;
  message: string;
  availabilityWindow: string;
  status: string;
  isPaid: boolean;
  cost?: string;
  paymentAddress?: string;
  spaceId?: string;
}

/**
 * Public skill (all fields are public by design)
 */
export interface PublicSkill extends PublicEntity {
  type: 'skill';
  name_canonical: string;
  slug: string;
  description?: string;
  status: 'active' | 'archived';
  spaceId?: string;
}

/**
 * Public lite ask (all fields are public by design)
 */
export interface PublicLiteAsk extends PublicEntity {
  type: 'lite_ask';
  name: string;
  discordHandle: string;
  skill: string;
  description?: string;
  status: string;
  spaceId: string;
  ttlSeconds: number;
}

/**
 * Public lite offer (all fields are public by design)
 */
export interface PublicLiteOffer extends PublicEntity {
  type: 'lite_offer';
  name: string;
  discordHandle: string;
  skill: string;
  description?: string;
  cost?: string;
  status: string;
  spaceId: string;
  ttlSeconds: number;
}

/**
 * Public meta-learning artifact (quest step submissions)
 */
export interface PublicMetaLearningArtifact extends PublicEntity {
  type: 'meta_learning_artifact';
  wallet: string;
  questId: string;
  stepId: string;
  artifactType: string;
  targetKey: string;
  spaceId?: string;
}

/**
 * Public learner quest progress (assessment answers)
 */
export interface PublicLearnerQuestProgress extends PublicEntity {
  type: 'learner_quest_progress';
  wallet: string;
  questId: string;
  sectionId?: string;
  questionId?: string;
  spaceId?: string;
}

/**
 * Public quest definition
 */
export interface PublicQuestDefinition extends PublicEntity {
  type: 'quest_definition';
  questId: string;
  track: string;
  version: string;
  language?: string;
  status: string;
  spaceId?: string;
}

/**
 * Public quest step progress (step completions)
 */
export interface PublicQuestStepProgress extends PublicEntity {
  type: 'quest_step_progress';
  wallet: string;
  questId: string;
  stepId: string;
  stepType: string;
  spaceId?: string;
}

/**
 * Public proof of skill badge
 */
export interface PublicBadge extends PublicEntity {
  type: 'proof_of_skill_badge';
  wallet: string;
  badgeType: string;
  questId: string;
  issuedAt: string;
  spaceId?: string;
}

/**
 * Public assessment result (quiz/exam results)
 */
export interface PublicAssessmentResult extends PublicEntity {
  type: 'learner_quest_assessment_result';
  wallet: string;
  questId: string;
  language: string;
  proficiencyLevel: string;
  status: string;
  percentage: number;
  passed: boolean;
  spaceId?: string;
}

/**
 * Public quest telemetry event
 */
export interface PublicTelemetryEvent extends PublicEntity {
  type: 'quest_telemetry';
  eventType: string;
  questId: string;
  stepId: string;
  spaceId?: string;
}

/**
 * Public quest reflection
 */
export interface PublicReflection extends PublicEntity {
  type: 'quest_reflection';
  wallet: string;
  questId: string;
  stepId: string;
  visibility: string;
  spaceId?: string;
}

/**
 * Public quest completion skill link
 */
export interface PublicQuestSkillLink extends PublicEntity {
  type: 'quest_completion_skill_link';
  wallet: string;
  questId: string;
  stepId: string;
  skillId: string;
  spaceId?: string;
}
