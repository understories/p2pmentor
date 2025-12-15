/**
 * Build static data for decentralized static client
 * 
 * Fetches all core entities from Arkiv at build time and outputs JSON files
 * for consumption by static site generator.
 * 
 * Follows Arkiv-native patterns:
 * - Wallet normalization (toLowerCase)
 * - Defensive error handling
 * - Latest version selection for immutable entities
 * - Expiration filtering for TTL entities
 */

import { getPublicClient } from '../lib/arkiv/client';
import { eq } from '@arkiv-network/sdk/query';
import { listUserProfiles, getProfileByWallet } from '../lib/arkiv/profile';
import { listSkills } from '../lib/arkiv/skill';
import { listAsks } from '../lib/arkiv/asks';
import { listOffers } from '../lib/arkiv/offers';
import * as fs from 'fs/promises';
import * as path from 'path';

interface BuildConfig {
  outputDir: string;
  spaceId?: string;
  limit?: number;
  includeExpired?: boolean;
}

/**
 * Process profiles: select latest version per wallet
 */
function processProfiles(entities: any[]): any[] {
  const byWallet = new Map<string, any>();
  
  for (const entity of entities) {
    const wallet = entity.wallet?.toLowerCase();
    if (!wallet) continue;
    
    const existing = byWallet.get(wallet);
    if (!existing || new Date(entity.createdAt || 0) > new Date(existing.createdAt || 0)) {
      byWallet.set(wallet, entity);
    }
  }
  
  return Array.from(byWallet.values());
}

/**
 * Process asks: filter expired if needed
 */
function processAsks(entities: any[], config: BuildConfig): any[] {
  const now = Date.now();
  
  return entities.filter(ask => {
    if (config.includeExpired) return true;
    
    const createdAt = new Date(ask.createdAt || 0).getTime();
    const ttlSeconds = parseInt(String(ask.ttlSeconds || '3600'), 10);
    return (createdAt + ttlSeconds * 1000) > now;
  });
}

/**
 * Process offers: filter expired if needed
 */
function processOffers(entities: any[], config: BuildConfig): any[] {
  const now = Date.now();
  
  return entities.filter(offer => {
    if (config.includeExpired) return true;
    
    const createdAt = new Date(offer.createdAt || 0).getTime();
    const ttlSeconds = parseInt(String(offer.ttlSeconds || '7200'), 10);
    return (createdAt + ttlSeconds * 1000) > now;
  });
}

/**
 * Build indexes for fast lookups
 */
function buildIndexes(data: {
  profiles: any[];
  skills: any[];
  asks: any[];
  offers: any[];
}) {
  // Profiles by wallet
  const profilesByWallet: Record<string, any> = {};
  for (const profile of data.profiles) {
    const wallet = profile.wallet?.toLowerCase();
    if (wallet) {
      profilesByWallet[wallet] = profile;
    }
  }
  
  // Asks by wallet
  const asksByWallet: Record<string, any[]> = {};
  for (const ask of data.asks) {
    const wallet = ask.wallet?.toLowerCase();
    if (wallet) {
      if (!asksByWallet[wallet]) asksByWallet[wallet] = [];
      asksByWallet[wallet].push(ask);
    }
  }
  
  // Asks by skill_id
  const asksBySkill: Record<string, any[]> = {};
  for (const ask of data.asks) {
    const skillId = ask.skill_id;
    if (skillId) {
      if (!asksBySkill[skillId]) asksBySkill[skillId] = [];
      asksBySkill[skillId].push(ask);
    }
    // Also index by legacy skill attribute
    const skill = ask.skill;
    if (skill) {
      const key = `legacy:${skill.toLowerCase()}`;
      if (!asksBySkill[key]) asksBySkill[key] = [];
      asksBySkill[key].push(ask);
    }
  }
  
  // Offers by wallet
  const offersByWallet: Record<string, any[]> = {};
  for (const offer of data.offers) {
    const wallet = offer.wallet?.toLowerCase();
    if (wallet) {
      if (!offersByWallet[wallet]) offersByWallet[wallet] = [];
      offersByWallet[wallet].push(offer);
    }
  }
  
  // Offers by skill_id
  const offersBySkill: Record<string, any[]> = {};
  for (const offer of data.offers) {
    const skillId = offer.skill_id;
    if (skillId) {
      if (!offersBySkill[skillId]) offersBySkill[skillId] = [];
      offersBySkill[skillId].push(offer);
    }
    // Also index by legacy skill attribute
    const skill = offer.skill;
    if (skill) {
      const key = `legacy:${skill.toLowerCase()}`;
      if (!offersBySkill[key]) offersBySkill[key] = [];
      offersBySkill[key].push(offer);
    }
  }
  
  // Skills by slug
  const skillsBySlug: Record<string, any> = {};
  for (const skill of data.skills) {
    const slug = skill.slug;
    if (slug) {
      skillsBySlug[slug] = skill;
    }
  }
  
  return {
    profilesByWallet,
    asksByWallet,
    asksBySkill,
    offersByWallet,
    offersBySkill,
    skillsBySlug,
  };
}

/**
 * Write JSON file
 */
async function writeJsonFile(filePath: string, data: any): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Main build function
 */
async function buildStaticData(config: BuildConfig): Promise<void> {
  const outputDir = path.join(process.cwd(), config.outputDir);
  const entitiesDir = path.join(outputDir, 'entities');
  const indexesDir = path.join(outputDir, 'indexes');
  const metadataDir = path.join(outputDir, 'metadata');
  
  // Ensure directories exist
  await fs.mkdir(entitiesDir, { recursive: true });
  await fs.mkdir(indexesDir, { recursive: true });
  await fs.mkdir(metadataDir, { recursive: true });
  
  console.log('🔍 Fetching entities from Arkiv...');
  
  try {
    // Fetch all entity types in parallel
    const [profiles, skills, asks, offers] = await Promise.all([
      listUserProfiles({ spaceId: config.spaceId }).catch((err) => {
        console.error('[build-static-data] Error fetching profiles:', err);
        return [];
      }),
      listSkills({ status: 'active', limit: config.limit || 1000 }).catch((err) => {
        console.error('[build-static-data] Error fetching skills:', err);
        return [];
      }),
      listAsks({ spaceId: config.spaceId, limit: config.limit || 1000, includeExpired: config.includeExpired }).catch((err) => {
        console.error('[build-static-data] Error fetching asks:', err);
        return [];
      }),
      listOffers({ spaceId: config.spaceId, limit: config.limit || 1000, includeExpired: config.includeExpired }).catch((err) => {
        console.error('[build-static-data] Error fetching offers:', err);
        return [];
      }),
    ]);
    
    console.log(`✅ Fetched ${profiles.length} profiles, ${skills.length} skills, ${asks.length} asks, ${offers.length} offers`);
    
    // Process data
    console.log('🔄 Processing data...');
    const processedData = {
      profiles: processProfiles(profiles),
      skills: skills,
      asks: processAsks(asks, config),
      offers: processOffers(offers, config),
    };
    
    console.log(`✅ Processed: ${processedData.profiles.length} profiles, ${processedData.skills.length} skills, ${processedData.asks.length} active asks, ${processedData.offers.length} active offers`);
    
    // Build indexes
    console.log('📇 Building indexes...');
    const indexes = buildIndexes(processedData);
    
    // Write JSON files
    console.log('💾 Writing JSON files...');
    await Promise.all([
      writeJsonFile(path.join(entitiesDir, 'profiles.json'), processedData.profiles),
      writeJsonFile(path.join(entitiesDir, 'skills.json'), processedData.skills),
      writeJsonFile(path.join(entitiesDir, 'asks.json'), processedData.asks),
      writeJsonFile(path.join(entitiesDir, 'offers.json'), processedData.offers),
      writeJsonFile(path.join(indexesDir, 'profiles-by-wallet.json'), indexes.profilesByWallet),
      writeJsonFile(path.join(indexesDir, 'asks-by-wallet.json'), indexes.asksByWallet),
      writeJsonFile(path.join(indexesDir, 'asks-by-skill.json'), indexes.asksBySkill),
      writeJsonFile(path.join(indexesDir, 'offers-by-wallet.json'), indexes.offersByWallet),
      writeJsonFile(path.join(indexesDir, 'offers-by-skill.json'), indexes.offersBySkill),
      writeJsonFile(path.join(indexesDir, 'skills-by-slug.json'), indexes.skillsBySlug),
      writeJsonFile(path.join(metadataDir, 'build-timestamp.json'), {
        timestamp: new Date().toISOString(),
        entityCounts: {
          profiles: processedData.profiles.length,
          skills: processedData.skills.length,
          asks: processedData.asks.length,
          offers: processedData.offers.length,
        },
        config: {
          spaceId: config.spaceId || 'local-dev',
          limit: config.limit || 1000,
          includeExpired: config.includeExpired || false,
        },
      }),
    ]);
    
    console.log('✅ Static data build complete!');
    console.log(`📁 Output directory: ${outputDir}`);
  } catch (error: any) {
    console.error('[build-static-data] Fatal error:', error);
    process.exit(1);
  }
}

// Main execution
const config: BuildConfig = {
  outputDir: process.env.STATIC_DATA_DIR || 'static-data',
  spaceId: process.env.ARKIV_SPACE_ID || 'local-dev',
  limit: process.env.ENTITY_LIMIT ? parseInt(process.env.ENTITY_LIMIT, 10) : 1000,
  includeExpired: process.env.INCLUDE_EXPIRED === 'true',
};

buildStaticData(config).catch((error) => {
  console.error('[build-static-data] Unhandled error:', error);
  process.exit(1);
});

