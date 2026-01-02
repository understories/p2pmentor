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
import {
  serializePublicProfile,
  serializePublicAsk,
  serializePublicOffer,
  serializePublicSkill,
} from './serializers';
import type { PublicEntity } from './types';
import { SPACE_ID } from '@/lib/config';

/**
 * Normalized explorer entity (for index)
 */
export interface ExplorerEntity extends Omit<PublicEntity, 'title' | 'summary'> {
  title: string;
  summary?: string;
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
    default:
      return undefined;
  }
}

/**
 * Normalize entity for explorer index
 */
function normalizeEntity(entity: PublicEntity): ExplorerEntity {
  return {
    ...entity,
    title: generateEntityTitle(entity),
    summary: generateEntitySummary(entity),
  };
}

/**
 * Build explorer index from Arkiv entities
 *
 * Fetches entities from ALL known spaces to support spaceId filtering.
 * Uses spaceIds array to fetch from multiple spaces in one query.
 */
async function buildExplorerIndex(): Promise<ExplorerIndex> {
  // Known spaceIds - fetch from all spaces to support filtering
  const allSpaceIds = ['beta-launch', 'local-dev', 'local-dev-seed'];

  // Fetch all entity types in parallel from all spaces
  const [profiles, asks, offers, skills] = await Promise.all([
    listUserProfiles({ spaceIds: allSpaceIds }).catch(() => []),
    listAsks({ spaceIds: allSpaceIds, limit: 1000, includeExpired: false }).catch(() => []),
    listOffers({ spaceIds: allSpaceIds, limit: 1000, includeExpired: false }).catch(() => []),
    listSkills({ spaceIds: allSpaceIds, limit: 1000, status: 'active' }).catch(() => []),
  ]);

  // Serialize all entities using public serializers
  const serializedProfiles = profiles.map(serializePublicProfile);
  const serializedAsks = asks.map(serializePublicAsk);
  const serializedOffers = offers.map(serializePublicOffer);
  const serializedSkills = skills.map(serializePublicSkill);

  // Normalize all entities for index
  const allEntities: ExplorerEntity[] = [
    ...serializedProfiles.map(normalizeEntity),
    ...serializedAsks.map(normalizeEntity),
    ...serializedOffers.map(normalizeEntity),
    ...serializedSkills.map(normalizeEntity),
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
      profiles: serializedProfiles.length,
      asks: serializedAsks.length,
      offers: serializedOffers.length,
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
      const entitySpaceId = (entity as any).spaceId;
      return entitySpaceId === spaceId;
    });

    return {
      ...index,
      entities: filteredEntities,
      counts: {
        profiles: filteredEntities.filter((e) => e.type === 'profile').length,
        asks: filteredEntities.filter((e) => e.type === 'ask').length,
        offers: filteredEntities.filter((e) => e.type === 'offer').length,
        skills: filteredEntities.filter((e) => e.type === 'skill').length,
        total: filteredEntities.length,
      },
    };
  }

  return index;
}

