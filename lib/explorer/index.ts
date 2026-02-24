/**
 * Explorer index cache
 *
 * Builds an ephemeral index of all public entities for the explorer.
 * Cache duration: ~60s (ephemeral, rebuilds on cold start).
 *
 * This index is used for:
 * - Summary counts
 * - Entity listing with pagination
 * - Search functionality
 *
 * All entities are serialized through public serializers to ensure
 * private data is never exposed.
 */

import { listUserProfiles } from '@/lib/arkiv/profile';
import { listAsks } from '@/lib/arkiv/asks';
import { listOffers } from '@/lib/arkiv/offers';
import { listSkills } from '@/lib/arkiv/skill';
import { listLiteAsks } from '@/lib/arkiv/liteAsks';
import { listLiteOffers } from '@/lib/arkiv/liteOffers';
import { listMetaLearningArtifacts } from '@/lib/arkiv/metaLearningQuest';
import { listLearnerQuestProgress } from '@/lib/arkiv/languageQuest';
import { listQuestDefinitions } from '@/lib/arkiv/questDefinition';
import { listAllQuestStepProgress } from '@/lib/arkiv/questProgress';
import { listAllBadges } from '@/lib/arkiv/badge';
import { listAllAssessmentResults } from '@/lib/arkiv/assessmentResult';
import { listAllTelemetryEvents } from '@/lib/arkiv/questTelemetry';
import { listAllReflections } from '@/lib/arkiv/reflection';
import { listAllQuestSkillLinks } from '@/lib/arkiv/questSkillLink';
import {
  serializePublicProfile,
  serializePublicAsk,
  serializePublicOffer,
  serializePublicSkill,
  serializePublicLiteAsk,
  serializePublicLiteOffer,
  serializePublicMetaLearningArtifact,
  serializePublicLearnerQuestProgress,
  serializePublicQuestDefinition,
  serializePublicQuestStepProgress,
  serializePublicBadge,
  serializePublicAssessmentResult,
  serializePublicTelemetryEvent,
  serializePublicReflection,
  serializePublicQuestSkillLink,
} from './serializers';
import type { PublicEntity } from './types';

/**
 * Normalized explorer entity (for index)
 */
export interface ExplorerEntity extends Omit<PublicEntity, 'title' | 'summary'> {
  title: string;
  summary?: string;
  versionCount?: number; // For profiles: number of versions (if > 1)
}

/**
 * Explorer index structure
 */
export interface ExplorerIndex {
  version: string; // Cache version (timestamp-based)
  generatedAt: Date;
  entities: ExplorerEntity[];
  counts: {
    profiles: number;
    asks: number;
    offers: number;
    skills: number;
    total: number;
  };
}

/**
 * Ephemeral cache for explorer index
 */
let cachedIndex: ExplorerIndex | null = null;
let cacheExpiresAt: number = 0;

/**
 * Cache duration: 60 seconds
 */
const CACHE_DURATION_MS = 60 * 1000;

/**
 * Generate title for an entity (for search/indexing)
 */
function generateEntityTitle(entity: PublicEntity): string {
  switch (entity.type) {
    case 'profile': {
      const profile = entity as import('./types').PublicProfile;
      return profile.displayName || profile.wallet || entity.key;
    }
    case 'ask': {
      const ask = entity as import('./types').PublicAsk;
      return `${ask.skill || ask.skill_label || 'Ask'}: ${ask.message?.substring(0, 50) || ''}`;
    }
    case 'offer': {
      const offer = entity as import('./types').PublicOffer;
      return `${offer.skill || offer.skill_label || 'Offer'}: ${offer.message?.substring(0, 50) || ''}`;
    }
    case 'skill': {
      const skill = entity as import('./types').PublicSkill;
      return skill.name_canonical || skill.slug || entity.key;
    }
    case 'lite_ask': {
      const liteAsk = entity as import('./types').PublicLiteAsk;
      return `${liteAsk.skill || 'Lite Ask'}: ${liteAsk.name} (${liteAsk.discordHandle})`;
    }
    case 'lite_offer': {
      const liteOffer = entity as import('./types').PublicLiteOffer;
      return `${liteOffer.skill || 'Lite Offer'}: ${liteOffer.name} (${liteOffer.discordHandle})`;
    }
    case 'meta_learning_artifact': {
      const artifact = entity as import('./types').PublicMetaLearningArtifact;
      const stepLabel = artifact.stepId.replace(/_/g, ' ');
      return `Quest Artifact: ${stepLabel}`;
    }
    case 'learner_quest_progress': {
      const progress = entity as import('./types').PublicLearnerQuestProgress;
      return `Quest Answer: ${progress.questId}${progress.sectionId ? ` / ${progress.sectionId}` : ''}`;
    }
    case 'quest_definition': {
      const def = entity as import('./types').PublicQuestDefinition;
      return `Quest: ${def.track} v${def.version}`;
    }
    case 'quest_step_progress': {
      const step = entity as import('./types').PublicQuestStepProgress;
      return `Step Complete: ${step.questId} / ${step.stepId}`;
    }
    case 'proof_of_skill_badge': {
      const badge = entity as import('./types').PublicBadge;
      return `Badge: ${badge.badgeType.replace(/_/g, ' ')}`;
    }
    case 'learner_quest_assessment_result': {
      const result = entity as import('./types').PublicAssessmentResult;
      return `Assessment: ${result.questId} (${result.passed ? 'Passed' : 'Not passed'})`;
    }
    case 'quest_telemetry': {
      const tel = entity as import('./types').PublicTelemetryEvent;
      return `Telemetry: ${tel.eventType} on ${tel.questId}`;
    }
    case 'quest_reflection': {
      const ref = entity as import('./types').PublicReflection;
      return `Reflection: ${ref.questId} / ${ref.stepId}`;
    }
    case 'quest_completion_skill_link': {
      const link = entity as import('./types').PublicQuestSkillLink;
      return `Skill Link: ${link.skillId} from ${link.questId}`;
    }
    default:
      return entity.key;
  }
}

/**
 * Generate summary for an entity (for search/indexing)
 */
function generateEntitySummary(entity: PublicEntity): string | undefined {
  switch (entity.type) {
    case 'profile': {
      const profile = entity as import('./types').PublicProfile;
      return profile.bioShort;
    }
    case 'ask': {
      const ask = entity as import('./types').PublicAsk;
      return ask.message;
    }
    case 'offer': {
      const offer = entity as import('./types').PublicOffer;
      return offer.message;
    }
    case 'skill': {
      const skill = entity as import('./types').PublicSkill;
      return skill.description;
    }
    case 'lite_ask': {
      const liteAsk = entity as import('./types').PublicLiteAsk;
      return liteAsk.description;
    }
    case 'lite_offer': {
      const liteOffer = entity as import('./types').PublicLiteOffer;
      return liteOffer.description;
    }
    case 'meta_learning_artifact': {
      const artifact = entity as import('./types').PublicMetaLearningArtifact;
      return `Target: ${artifact.targetKey} | Type: ${artifact.artifactType}`;
    }
    case 'learner_quest_progress': {
      const progress = entity as import('./types').PublicLearnerQuestProgress;
      return progress.questionId ? `Question: ${progress.questionId}` : undefined;
    }
    case 'quest_definition': {
      const def = entity as import('./types').PublicQuestDefinition;
      return `Track: ${def.track}${def.language ? ` (${def.language})` : ''}`;
    }
    case 'quest_step_progress': {
      const step = entity as import('./types').PublicQuestStepProgress;
      return `${step.stepType} step by ${step.wallet?.slice(0, 10)}...`;
    }
    case 'proof_of_skill_badge': {
      const badge = entity as import('./types').PublicBadge;
      return `Issued for ${badge.questId} to ${badge.wallet?.slice(0, 10)}...`;
    }
    case 'learner_quest_assessment_result': {
      const result = entity as import('./types').PublicAssessmentResult;
      return `${result.language} ${result.proficiencyLevel} — ${result.percentage}%`;
    }
    case 'quest_telemetry': {
      const tel = entity as import('./types').PublicTelemetryEvent;
      return `Step: ${tel.stepId}`;
    }
    case 'quest_reflection': {
      const ref = entity as import('./types').PublicReflection;
      return `Visibility: ${ref.visibility}`;
    }
    case 'quest_completion_skill_link': {
      const link = entity as import('./types').PublicQuestSkillLink;
      return `Step: ${link.stepId}`;
    }
    default:
      return undefined;
  }
}

/**
 * Normalize entity for explorer index
 */
function normalizeEntity(entity: PublicEntity, versionCount?: number): ExplorerEntity {
  return {
    ...entity,
    title: generateEntityTitle(entity),
    summary: generateEntitySummary(entity),
    ...(versionCount !== undefined && { versionCount }),
  };
}

/**
 * Group profiles by wallet and deduplicate
 *
 * Returns canonical profiles (most recent per wallet) with version count metadata.
 * This ensures explorer shows one profile per wallet (like /profiles page) while
 * preserving information about version history.
 */
function deduplicateProfiles(profiles: ExplorerEntity[]): ExplorerEntity[] {
  const byWallet = new Map<string, ExplorerEntity[]>();

  // Group profiles by wallet
  profiles.forEach((profile) => {
    if (profile.type === 'profile' && profile.wallet) {
      const wallet = profile.wallet.toLowerCase();
      const existing = byWallet.get(wallet) || [];
      existing.push(profile);
      byWallet.set(wallet, existing);
    }
  });

  // For each wallet, keep canonical (most recent) and add version count
  const canonicalProfiles: ExplorerEntity[] = [];

  for (const [_wallet, walletProfiles] of byWallet.entries()) {
    if (walletProfiles.length === 0) continue;

    // Sort by createdAt descending (most recent first)
    // Also consider lastActiveTimestamp if available (for Pattern B updates)
    walletProfiles.sort((a, b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aRecord = a as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bRecord = b as any;
      const aTime = aRecord.lastActiveTimestamp
        ? new Date(aRecord.lastActiveTimestamp).getTime()
        : a.createdAt
          ? new Date(a.createdAt).getTime()
          : 0;
      const bTime = bRecord.lastActiveTimestamp
        ? new Date(bRecord.lastActiveTimestamp).getTime()
        : b.createdAt
          ? new Date(b.createdAt).getTime()
          : 0;
      return bTime - aTime;
    });

    // Canonical is the most recent
    const canonical = walletProfiles[0];
    const versionCount = walletProfiles.length;

    // Add version count metadata if multiple versions exist
    canonicalProfiles.push({
      ...canonical,
      versionCount: versionCount > 1 ? versionCount : undefined,
    });
  }

  return canonicalProfiles;
}

/**
 * Build explorer index from Arkiv entities
 *
 * Fetches entities from ALL known spaces to support spaceId filtering.
 * Uses spaceIds array to fetch from multiple spaces in one query.
 */
async function buildExplorerIndex(): Promise<ExplorerIndex> {
  // Known spaceIds - fetch from all spaces to support filtering
  // Includes: production spaces (beta-launch), dev spaces (local-dev, local-dev-seed), and lite spaces (nsfeb26, nsjan26, test)
  const allSpaceIds = ['beta-launch', 'local-dev', 'local-dev-seed', 'nsfeb26', 'nsjan26', 'test'];

  // Fetch all entity types in parallel from all spaces
  // Note: lite entities are queried per spaceId since they don't support spaceIds array
  // Quest definitions use 'global' spaceId
  const [
    profiles,
    asks,
    offers,
    skills,
    liteAsksAll,
    liteOffersAll,
    metaArtifactsAll,
    questProgressAll,
    questDefs,
    stepProgressAll,
    badgesAll,
    assessmentResultsAll,
    telemetryAll,
    reflectionsAll,
    skillLinksAll,
  ] = await Promise.all([
    listUserProfiles({ spaceIds: allSpaceIds }).catch(() => []),
    listAsks({ spaceIds: allSpaceIds, limit: 1000, includeExpired: false }).catch(() => []),
    listOffers({ spaceIds: allSpaceIds, limit: 1000, includeExpired: false }).catch(() => []),
    listSkills({ spaceIds: allSpaceIds, limit: 1000, status: 'active' }).catch(() => []),
    Promise.all(
      allSpaceIds.map((spaceId) =>
        listLiteAsks({ spaceId, limit: 1000, includeExpired: false }).catch(() => [])
      )
    ).then((results) => results.flat()),
    Promise.all(
      allSpaceIds.map((spaceId) =>
        listLiteOffers({ spaceId, limit: 1000, includeExpired: false }).catch(() => [])
      )
    ).then((results) => results.flat()),
    listMetaLearningArtifacts({ spaceIds: allSpaceIds, limit: 1000 }).catch(() => []),
    listLearnerQuestProgress({ spaceIds: allSpaceIds, limit: 1000 }).catch(() => []),
    listQuestDefinitions({}).catch(() => []),
    listAllQuestStepProgress({ spaceIds: allSpaceIds, limit: 1000 }).catch(() => []),
    listAllBadges({ spaceIds: allSpaceIds, limit: 1000 }).catch(() => []),
    listAllAssessmentResults({ spaceIds: allSpaceIds, limit: 1000 }).catch(() => []),
    listAllTelemetryEvents({ spaceIds: allSpaceIds, limit: 1000 }).catch(() => []),
    listAllReflections({ spaceIds: allSpaceIds, limit: 1000 }).catch(() => []),
    listAllQuestSkillLinks({ spaceIds: allSpaceIds, limit: 1000 }).catch(() => []),
  ]);

  // Serialize all entities using public serializers
  const serializedProfiles = profiles.map(serializePublicProfile);
  const serializedAsks = asks.map(serializePublicAsk);
  const serializedOffers = offers.map(serializePublicOffer);
  const serializedSkills = skills.map(serializePublicSkill);
  const serializedLiteAsks = liteAsksAll.map(serializePublicLiteAsk);
  const serializedLiteOffers = liteOffersAll.map(serializePublicLiteOffer);
  const serializedMetaArtifacts = metaArtifactsAll.map(serializePublicMetaLearningArtifact);
  const serializedQuestProgress = questProgressAll.map(serializePublicLearnerQuestProgress);
  const serializedQuestDefs = questDefs.map(serializePublicQuestDefinition);
  const serializedStepProgress = stepProgressAll.map(serializePublicQuestStepProgress);
  const serializedBadges = badgesAll.map(serializePublicBadge);
  const serializedAssessments = assessmentResultsAll.map(serializePublicAssessmentResult);
  const serializedTelemetry = telemetryAll.map(serializePublicTelemetryEvent);
  const serializedReflections = reflectionsAll.map(serializePublicReflection);
  const serializedSkillLinks = skillLinksAll.map(serializePublicQuestSkillLink);

  // Normalize profiles first (before deduplication)
  const normalizedProfiles = serializedProfiles.map(normalizeEntity);

  // Deduplicate profiles by wallet (keep canonical, add version count)
  // This ensures explorer shows one profile per wallet (like /profiles page)
  const deduplicatedProfiles = deduplicateProfiles(normalizedProfiles);

  // Normalize other entity types
  const normalizedAsks = serializedAsks.map(normalizeEntity);
  const normalizedOffers = serializedOffers.map(normalizeEntity);
  const normalizedSkills = serializedSkills.map(normalizeEntity);
  const normalizedLiteAsks = serializedLiteAsks.map(normalizeEntity);
  const normalizedLiteOffers = serializedLiteOffers.map(normalizeEntity);
  const normalizedMetaArtifacts = serializedMetaArtifacts.map(normalizeEntity);
  const normalizedQuestProgress = serializedQuestProgress.map(normalizeEntity);
  const normalizedQuestDefs = serializedQuestDefs.map(normalizeEntity);
  const normalizedStepProgress = serializedStepProgress.map(normalizeEntity);
  const normalizedBadges = serializedBadges.map(normalizeEntity);
  const normalizedAssessments = serializedAssessments.map(normalizeEntity);
  const normalizedTelemetry = serializedTelemetry.map(normalizeEntity);
  const normalizedReflections = serializedReflections.map(normalizeEntity);
  const normalizedSkillLinks = serializedSkillLinks.map(normalizeEntity);

  // Combine all entities (profiles are now deduplicated)
  const allEntities: ExplorerEntity[] = [
    ...deduplicatedProfiles,
    ...normalizedAsks,
    ...normalizedOffers,
    ...normalizedSkills,
    ...normalizedLiteAsks,
    ...normalizedLiteOffers,
    ...normalizedMetaArtifacts,
    ...normalizedQuestProgress,
    ...normalizedQuestDefs,
    ...normalizedStepProgress,
    ...normalizedBadges,
    ...normalizedAssessments,
    ...normalizedTelemetry,
    ...normalizedReflections,
    ...normalizedSkillLinks,
  ];

  // Sort by createdAt (newest first)
  allEntities.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  // Generate version (timestamp-based)
  const version = Date.now().toString();
  const generatedAt = new Date();

  return {
    version,
    generatedAt,
    entities: allEntities,
    counts: {
      // Count deduplicated profiles (one per wallet)
      profiles: deduplicatedProfiles.length,
      asks: serializedAsks.length + serializedLiteAsks.length, // Include lite asks in ask count
      offers: serializedOffers.length + serializedLiteOffers.length, // Include lite offers in offer count
      skills: serializedSkills.length,
      total: allEntities.length,
    },
  };
}

/**
 * Get explorer index (cached)
 *
 * Returns cached index if available and not expired, otherwise rebuilds.
 * If spaceId is provided, filters the cached index by spaceId.
 */
export async function getExplorerIndex(spaceId?: string): Promise<ExplorerIndex> {
  const now = Date.now();

  // Check if cache is valid
  let index = cachedIndex;
  if (!index || now >= cacheExpiresAt) {
    // Rebuild index
    index = await buildExplorerIndex();
    // Update cache
    cachedIndex = index;
    cacheExpiresAt = now + CACHE_DURATION_MS;
  }

  // Filter by spaceId if provided
  if (spaceId) {
    const filteredEntities = index.entities.filter((entity) => {
      // Check if entity has spaceId field (all entities should have it)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entitySpaceId = (entity as any).spaceId;
      return entitySpaceId === spaceId;
    });

    // After filtering, counts are based on filtered entities
    // Note: profiles are already deduplicated in the index
    return {
      ...index,
      entities: filteredEntities,
      counts: {
        profiles: filteredEntities.filter((e) => e.type === 'profile').length,
        asks: filteredEntities.filter((e) => e.type === 'ask' || e.type === 'lite_ask').length,
        offers: filteredEntities.filter((e) => e.type === 'offer' || e.type === 'lite_offer')
          .length,
        skills: filteredEntities.filter((e) => e.type === 'skill').length,
        total: filteredEntities.length,
      },
    };
  }

  return index;
}
