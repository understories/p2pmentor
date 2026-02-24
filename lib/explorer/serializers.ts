/**
 * Public entity serializers
 *
 * Serializers that expose ALL data stored on Arkiv.
 * The explorer demonstrates transparency by showing everything stored on-chain.
 *
 * Note: Email addresses are NOT stored on Arkiv, so they are not included.
 * All other fields stored on Arkiv are included here.
 */

import type { UserProfile } from '@/lib/arkiv/profile';
import type { Ask } from '@/lib/arkiv/asks';
import type { Offer } from '@/lib/arkiv/offers';
import type { Skill } from '@/lib/arkiv/skill';
import type { LiteAsk } from '@/lib/arkiv/liteAsks';
import type { LiteOffer } from '@/lib/arkiv/liteOffers';
import type { MetaLearningArtifact } from '@/lib/arkiv/metaLearningQuest';
import type { LearnerQuestProgressEntity } from '@/lib/arkiv/languageQuest';
import type { QuestDefinitionEntity } from '@/lib/arkiv/questDefinition';
import type { QuestProgress } from '@/lib/arkiv/questProgress';
import type { ProofOfSkillBadge } from '@/lib/arkiv/badge';
import type { AssessmentResult } from '@/lib/arkiv/assessmentResult';
import type { QuestTelemetryEvent } from '@/lib/arkiv/questTelemetry';
import type { QuestReflection } from '@/lib/arkiv/reflection';
import type { QuestCompletionSkillLink } from '@/lib/arkiv/questSkillLink';
import type {
  PublicProfile,
  PublicAsk,
  PublicOffer,
  PublicSkill,
  PublicLiteAsk,
  PublicLiteOffer,
  PublicMetaLearningArtifact,
  PublicLearnerQuestProgress,
  PublicQuestDefinition,
  PublicQuestStepProgress,
  PublicBadge,
  PublicAssessmentResult,
  PublicTelemetryEvent,
  PublicReflection,
  PublicQuestSkillLink,
} from './types';

/**
 * Serialize a user profile to public format
 *
 * Includes ALL fields stored on Arkiv to demonstrate transparency.
 * All data shown here is verifiable via transaction hashes.
 *
 * Note: Email addresses are NOT stored on Arkiv, so they are not included.
 */
export function serializePublicProfile(profile: UserProfile): PublicProfile {
  return {
    key: profile.key,
    type: 'profile',
    wallet: profile.wallet,
    displayName: profile.displayName,
    username: profile.username,
    profileImage: profile.profileImage,
    identity_seed: profile.identity_seed,
    exploringStatement: profile.exploringStatement,
    bio: profile.bio,
    bioShort: profile.bioShort,
    bioLong: profile.bioLong,
    skills: profile.skills,
    skillsArray: profile.skillsArray,
    skillExpertise: profile.skillExpertise,
    timezone: profile.timezone,
    languages: profile.languages,
    contactLinks: profile.contactLinks, // Stored on Arkiv, so we show it
    seniority: profile.seniority,
    domainsOfInterest: profile.domainsOfInterest,
    mentorRoles: profile.mentorRoles,
    learnerRoles: profile.learnerRoles,
    availabilityWindow: profile.availabilityWindow,
    sessionsCompleted: profile.sessionsCompleted,
    sessionsGiven: profile.sessionsGiven,
    sessionsReceived: profile.sessionsReceived,
    npsScore: profile.npsScore,
    topSkillsUsage: profile.topSkillsUsage,
    peerTestimonials: profile.peerTestimonials,
    trustEdges: profile.trustEdges,
    communityAffiliations: profile.communityAffiliations,
    reputationScore: profile.reputationScore,
    lastActiveTimestamp: profile.lastActiveTimestamp,
    spaceId: profile.spaceId,
    createdAt: profile.createdAt,
    txHash: profile.txHash,
  };
}

/**
 * Serialize an ask to public format
 *
 * All fields are public by design (asks are meant to be discoverable).
 */
export function serializePublicAsk(ask: Ask): PublicAsk {
  return {
    key: ask.key,
    type: 'ask',
    wallet: ask.wallet,
    skill: ask.skill,
    skill_id: ask.skill_id,
    skill_label: ask.skill_label,
    message: ask.message,
    status: ask.status,
    spaceId: ask.spaceId,
    createdAt: ask.createdAt,
    txHash: ask.txHash,
  };
}

/**
 * Serialize an offer to public format
 *
 * All fields are public by design (offers are meant to be discoverable).
 */
export function serializePublicOffer(offer: Offer): PublicOffer {
  return {
    key: offer.key,
    type: 'offer',
    wallet: offer.wallet,
    skill: offer.skill,
    skill_id: offer.skill_id,
    skill_label: offer.skill_label,
    message: offer.message,
    availabilityWindow: offer.availabilityWindow,
    status: offer.status,
    isPaid: offer.isPaid,
    cost: offer.cost,
    paymentAddress: offer.paymentAddress,
    spaceId: offer.spaceId,
    createdAt: offer.createdAt,
    txHash: offer.txHash,
  };
}

/**
 * Serialize a skill to public format
 *
 * All fields are public by design (skills are meant to be discoverable).
 */
export function serializePublicSkill(skill: Skill): PublicSkill {
  return {
    key: skill.key,
    type: 'skill',
    name_canonical: skill.name_canonical,
    slug: skill.slug,
    description: skill.description,
    status: skill.status,
    spaceId: skill.spaceId,
    createdAt: skill.createdAt,
    txHash: skill.txHash,
  };
}

/**
 * Serialize a lite ask to public format
 *
 * All fields are public by design (lite asks are meant to be discoverable).
 */
export function serializePublicLiteAsk(liteAsk: LiteAsk): PublicLiteAsk {
  return {
    key: liteAsk.key,
    type: 'lite_ask',
    name: liteAsk.name,
    discordHandle: liteAsk.discordHandle,
    skill: liteAsk.skill,
    description: liteAsk.description,
    status: liteAsk.status,
    spaceId: liteAsk.spaceId,
    ttlSeconds: liteAsk.ttlSeconds,
    createdAt: liteAsk.createdAt,
    txHash: liteAsk.txHash,
  };
}

/**
 * Serialize a lite offer to public format
 *
 * All fields are public by design (lite offers are meant to be discoverable).
 */
export function serializePublicLiteOffer(liteOffer: LiteOffer): PublicLiteOffer {
  return {
    key: liteOffer.key,
    type: 'lite_offer',
    name: liteOffer.name,
    discordHandle: liteOffer.discordHandle,
    skill: liteOffer.skill,
    description: liteOffer.description,
    cost: liteOffer.cost,
    status: liteOffer.status,
    spaceId: liteOffer.spaceId,
    ttlSeconds: liteOffer.ttlSeconds,
    createdAt: liteOffer.createdAt,
    txHash: liteOffer.txHash,
  };
}

/**
 * Serialize a meta-learning artifact to public format
 */
export function serializePublicMetaLearningArtifact(
  artifact: MetaLearningArtifact & { spaceId?: string }
): PublicMetaLearningArtifact {
  return {
    key: artifact.key,
    type: 'meta_learning_artifact',
    wallet: artifact.wallet,
    questId: artifact.questId,
    stepId: artifact.stepId,
    artifactType: artifact.artifactType,
    targetKey: artifact.targetKey,
    spaceId: artifact.spaceId,
    createdAt: artifact.createdAt,
    txHash: artifact.txHash,
  };
}

/**
 * Serialize a learner quest progress entity to public format
 */
export function serializePublicLearnerQuestProgress(
  progress: LearnerQuestProgressEntity
): PublicLearnerQuestProgress {
  return {
    key: progress.key,
    type: 'learner_quest_progress',
    wallet: progress.wallet,
    questId: progress.questId,
    sectionId: progress.sectionId,
    questionId: progress.questionId,
    spaceId: progress.spaceId,
    createdAt: progress.createdAt,
    txHash: progress.txHash,
  };
}

export function serializePublicQuestDefinition(def: QuestDefinitionEntity): PublicQuestDefinition {
  return {
    key: def.key,
    type: 'quest_definition',
    questId: def.questId,
    track: def.track,
    version: def.version,
    language: def.language,
    status: def.status,
    spaceId: def.spaceId,
    createdAt: def.createdAt,
    txHash: def.txHash,
  };
}

export function serializePublicQuestStepProgress(progress: QuestProgress): PublicQuestStepProgress {
  return {
    key: progress.key,
    type: 'quest_step_progress',
    wallet: progress.wallet,
    questId: progress.questId,
    stepId: progress.stepId,
    stepType: progress.stepType,
    spaceId: progress.spaceId,
    createdAt: progress.createdAt,
    txHash: progress.txHash,
  };
}

export function serializePublicBadge(badge: ProofOfSkillBadge): PublicBadge {
  return {
    key: badge.key,
    type: 'proof_of_skill_badge',
    wallet: badge.wallet,
    badgeType: badge.badgeType,
    questId: badge.questId,
    issuedAt: badge.issuedAt,
    spaceId: badge.spaceId,
    createdAt: badge.issuedAt,
    txHash: badge.txHash,
  };
}

export function serializePublicAssessmentResult(result: AssessmentResult): PublicAssessmentResult {
  return {
    key: result.key,
    type: 'learner_quest_assessment_result',
    wallet: result.wallet,
    questId: result.questId,
    language: result.language,
    proficiencyLevel: result.proficiencyLevel,
    status: result.status,
    percentage: result.percentage,
    passed: result.passed,
    createdAt: result.createdAt,
    txHash: result.txHash,
  };
}

export function serializePublicTelemetryEvent(event: QuestTelemetryEvent): PublicTelemetryEvent {
  return {
    key: event.key,
    type: 'quest_telemetry',
    eventType: event.eventType,
    questId: event.questId,
    stepId: event.stepId,
    spaceId: event.spaceId,
    createdAt: event.createdAt,
    txHash: event.txHash,
  };
}

export function serializePublicReflection(reflection: QuestReflection): PublicReflection {
  return {
    key: reflection.key,
    type: 'quest_reflection',
    wallet: reflection.wallet,
    questId: reflection.questId,
    stepId: reflection.stepId,
    visibility: reflection.visibility,
    spaceId: reflection.spaceId,
    createdAt: reflection.createdAt,
    txHash: reflection.txHash,
  };
}

export function serializePublicQuestSkillLink(
  link: QuestCompletionSkillLink
): PublicQuestSkillLink {
  return {
    key: link.key,
    type: 'quest_completion_skill_link',
    wallet: link.wallet,
    questId: link.questId,
    stepId: link.stepId,
    skillId: link.skillId,
    spaceId: link.spaceId,
    createdAt: link.createdAt,
    txHash: link.txHash,
  };
}
