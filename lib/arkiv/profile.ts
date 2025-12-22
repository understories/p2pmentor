/**
 * Profile CRUD helpers
 * 
 * Based on mentor-graph implementation.
 * 
 * Reference: refs/mentor-graph/src/arkiv/profiles.ts
 */

import { eq } from "@arkiv-network/sdk/query"
import { getPublicClient, getWalletClientFromPrivateKey, getWalletClientFromMetaMask } from "./client"
import { getWalletClient } from "@/lib/wallet/getWalletClient"
import { CURRENT_WALLET, SPACE_ID, ENTITY_UPDATE_MODE } from "../config"
import { handleTransactionWithTimeout } from "./transaction-utils"
import { selectRandomEmoji } from "@/lib/profile/identitySeed"
import { arkivUpsertEntity } from "./entity-utils"

export type UserProfile = {
  key: string;
  wallet: string;
  // Core Identity
  displayName: string;
  username?: string;
  profileImage?: string;
  identity_seed?: string; // Emoji Identity Seed (EIS) - plant emoji for forest aesthetic
  exploringStatement?: string; // "What are you exploring?" - optional one-liner from onboarding
  bio?: string; // Legacy: kept for backward compatibility
  bioShort?: string; // Short bio (spec requirement)
  bioLong?: string;
  timezone: string;
  languages?: string[];
  contactLinks?: {
    twitter?: string;
    github?: string;
    telegram?: string;
    discord?: string;
  };
  // Skills / Roles
  skills: string; // Keep as string for backward compatibility, but can be parsed as array
  skillsArray?: string[];
  skillExpertise?: Record<string, number>; // Map of skillId -> expertise level (0-5) from onboarding
  seniority?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  domainsOfInterest?: string[];
  mentorRoles?: string[];
  learnerRoles?: string[];
  // Availability
  availabilityWindow?: string; // Simple text-based availability (e.g., "Mon-Fri 9am-5pm EST")
  // Contribution / Reputation Metadata
  sessionsCompleted?: number;
  sessionsGiven?: number;
  sessionsReceived?: number;
  avgRating?: number;
  npsScore?: number;
  topSkillsUsage?: Array<{ skill: string; count: number }>;
  peerTestimonials?: Array<{ text: string; timestamp: string; fromWallet: string }>;
  trustEdges?: Array<{ toWallet: string; strength: number; createdAt: string }>;
  // Derived / System Fields
  lastActiveTimestamp?: string;
  communityAffiliations?: string[];
  reputationScore?: number;
  // Legacy fields
  spaceId: string;
  createdAt?: string;
  txHash?: string;
}

/**
 * Create user profile (client-side with MetaMask or Passkey)
 * 
 * @param data - Profile data
 * @param wallet - Profile wallet address (from localStorage 'wallet_address')
 *                 This is used as the 'wallet' attribute on the profile entity.
 * @param account - Wallet address for signing the transaction (MetaMask or Passkey)
 * @returns Entity key and transaction hash
 * 
 * Note: The wallet parameter is the profile wallet address (stored in localStorage 'wallet_address').
 * This is used as the 'wallet' attribute on the entity. The account parameter is used for signing
 * the transaction via the walletClient. The global Arkiv signing wallet (from ARKIV_PRIVATE_KEY)
 * is used for server-side API routes, but client-side uses the account parameter for signing.
 */
export async function createUserProfileClient({
  wallet,
  displayName,
  username,
  profileImage,
  bio,
  bioShort,
  bioLong,
  skills = '',
  skillsArray,
  skill_ids,
  skillExpertise,
  timezone = '',
  languages,
  contactLinks,
  seniority,
  domainsOfInterest,
  mentorRoles,
  learnerRoles,
  availabilityWindow,
  identity_seed,
  account,
}: {
  wallet: string;
  displayName: string;
  username?: string;
  profileImage?: string;
  bio?: string;
  bioShort?: string;
  bioLong?: string;
  skills?: string;
  skillsArray?: string[];
  skill_ids?: string[];
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
  identity_seed?: string;
  account: `0x${string}`;
}): Promise<{ key: string; txHash: string }> {
  // Use unified wallet client getter (supports both MetaMask and Passkey)
  const walletClient = await getWalletClient(account);
  const enc = new TextEncoder();
  const finalSpaceId = SPACE_ID;
  const spaceId = finalSpaceId; // Keep for backward compatibility
  const createdAt = new Date().toISOString();
  const lastActiveTimestamp = new Date().toISOString();

  // Use skillsArray if provided, otherwise parse skills string
  const finalSkillsArray = skillsArray || (skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : []);

  // Calculate avgRating if this is an update (get existing profile first)
  let avgRating = 0;
  let existingProfile: UserProfile | null = null;
  try {
      existingProfile = await getProfileByWallet(wallet);
      if (existingProfile) {
        // Recalculate from all feedback
        avgRating = await calculateAverageRating(wallet);
      }
  } catch (e) {
    // New profile or calculation failed - use 0
    avgRating = 0;
  }

  // Use provided identity_seed if explicitly set, otherwise preserve existing, or auto-assign for new profiles
  // If identity_seed is undefined, preserve existing; if explicitly provided (even empty string), use it
  const finalIdentitySeed = identity_seed !== undefined
    ? (identity_seed || undefined) // Allow empty string to clear identity_seed
    : (existingProfile?.identity_seed || selectRandomEmoji());

  // Preserve existing createdAt when updating
  const finalCreatedAt = existingProfile?.createdAt || createdAt;

  const payload = {
    displayName,
    username,
    profileImage,
    identity_seed: finalIdentitySeed,
    exploringStatement: bioShort || undefined, // Use bioShort as exploringStatement for onboarding
    bio,
    bioShort: bioShort || bio,
    bioLong,
    skills: finalSkillsArray.join(', '),
    skillsArray: finalSkillsArray,
    skill_ids: skill_ids || [],
    skillExpertise: skillExpertise || undefined,
    timezone,
    languages: languages || [],
    contactLinks: contactLinks || {},
    seniority,
    domainsOfInterest: domainsOfInterest || [],
    mentorRoles: mentorRoles || [],
    learnerRoles: learnerRoles || [],
    availabilityWindow,
    spaceId,
    createdAt: finalCreatedAt,
    lastActiveTimestamp,
    sessionsCompleted: existingProfile?.sessionsCompleted || 0,
    sessionsGiven: existingProfile?.sessionsGiven || 0,
    sessionsReceived: existingProfile?.sessionsReceived || 0,
    avgRating: Math.round(avgRating * 10) / 10, // Round to 1 decimal place
    npsScore: existingProfile?.npsScore || 0,
    topSkillsUsage: existingProfile?.topSkillsUsage || [],
    peerTestimonials: existingProfile?.peerTestimonials || [],
    trustEdges: existingProfile?.trustEdges || [],
    communityAffiliations: existingProfile?.communityAffiliations || [],
    reputationScore: existingProfile?.reputationScore || 0,
  };

  const attributes: Array<{ key: string; value: string }> = [
    { key: 'type', value: 'user_profile' },
    { key: 'wallet', value: wallet.toLowerCase() },
    { key: 'displayName', value: displayName },
    { key: 'timezone', value: timezone },
    { key: 'spaceId', value: spaceId },
    { key: 'createdAt', value: finalCreatedAt },
  ];

  if (username) attributes.push({ key: 'username', value: username });
  if (finalIdentitySeed) attributes.push({ key: 'identity_seed', value: finalIdentitySeed });
  if (bio) attributes.push({ key: 'bio', value: bio });
  if (skills) attributes.push({ key: 'skills', value: skills });
  if (seniority) attributes.push({ key: 'seniority', value: seniority });
  if (finalSkillsArray.length > 0) {
    finalSkillsArray.forEach((skill, idx) => {
      attributes.push({ key: `skill_${idx}`, value: skill });
    });
  }

  // Deterministic check: If existing profile found, use Pattern B (updateEntity)
  // Otherwise, use Pattern A (createEntity)
  // Client-side updates require walletClient directly (no private key available)
  const normalizedWallet = wallet.toLowerCase();
  const shouldUpdate = existingProfile?.key && (
    ENTITY_UPDATE_MODE === 'on' || ENTITY_UPDATE_MODE === 'shadow'
  );

  if (shouldUpdate && existingProfile?.key) {
    // Client-side update using walletClient.updateEntity
    // This uses the same pattern as server-side but with walletClient from MetaMask/Passkey
    const updateResult = await handleTransactionWithTimeout(async () => {
      const { addSignerMetadata } = await import('./signer-metadata');
      const attributesWithSigner = addSignerMetadata(attributes, account);
      
      return await walletClient.updateEntity({
        entityKey: existingProfile.key as `0x${string}`,
        payload: enc.encode(JSON.stringify(payload)),
        attributes: attributesWithSigner,
        contentType: 'application/json',
        expiresIn: 31536000, // 1 year
      });
    });

    return { key: updateResult.entityKey, txHash: updateResult.txHash };
  }

  // Create new profile (old behavior or fallback)
  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes,
      expiresIn: 31536000, // 1 year
    });
  });

  return { key: result.entityKey, txHash: result.txHash };
}

/**
 * Create user profile (server-side with private key)
 * 
 * @param data - Profile data
 * @param wallet - Profile wallet address (used as the 'wallet' attribute on the entity)
 * @param privateKey - Private key for signing (global Arkiv signing wallet from ARKIV_PRIVATE_KEY)
 * @returns Entity key and transaction hash
 * 
 * Note: The wallet parameter is the profile wallet address (used as entity attribute).
 * The privateKey is the global Arkiv signing wallet (from ARKIV_PRIVATE_KEY env var) that signs
 * all server-side transactions. Entities are tied to the profile wallet, not the signing wallet.
 */
export async function createUserProfile({
  wallet,
  displayName,
  username,
  profileImage,
  bio,
  bioShort,
  bioLong,
  skills = '',
  skillsArray,
  skill_ids,
  skillExpertise,
  timezone = '',
  languages,
  contactLinks,
  seniority,
  domainsOfInterest,
  mentorRoles,
  learnerRoles,
  availabilityWindow,
  identity_seed,
  privateKey,
}: {
  wallet: string;
  displayName: string;
  username?: string;
  profileImage?: string;
  bio?: string;
  bioShort?: string;
  bioLong?: string;
  skills?: string;
  skillsArray?: string[];
  skill_ids?: string[];
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
  identity_seed?: string;
  privateKey: `0x${string}`;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const finalSpaceId = SPACE_ID;
  const spaceId = finalSpaceId; // Keep for backward compatibility in this function
  const createdAt = new Date().toISOString();
  const lastActiveTimestamp = new Date().toISOString();

  // Use skillsArray if provided, otherwise parse skills string
  const finalSkillsArray = skillsArray || (skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : []);

  // Calculate avgRating if this is an update (get existing profile first)
  let avgRating = 0;
  let existingProfile: UserProfile | null = null;
  try {
      existingProfile = await getProfileByWallet(wallet);
      if (existingProfile) {
        // Recalculate from all feedback
        avgRating = await calculateAverageRating(wallet);
      }
  } catch (e) {
    // New profile or calculation failed - use 0
    avgRating = 0;
  }

  // Use provided identity_seed if explicitly set, otherwise preserve existing, or auto-assign for new profiles
  // If identity_seed is undefined, preserve existing; if explicitly provided (even empty string), use it
  const finalIdentitySeed = identity_seed !== undefined
    ? (identity_seed || undefined) // Allow empty string to clear identity_seed
    : (existingProfile?.identity_seed || selectRandomEmoji());

  // Preserve existing createdAt when updating
  const finalCreatedAt = existingProfile?.createdAt || createdAt;

  const payload = {
    displayName,
    username,
    profileImage,
    identity_seed: finalIdentitySeed,
    bio,
    bioShort: bioShort || bio,
    bioLong,
    skills: finalSkillsArray.join(', '),
    skillsArray: finalSkillsArray,
    skillExpertise: skillExpertise || undefined,
    timezone,
    languages: languages || [],
    contactLinks: contactLinks || {},
    seniority,
    domainsOfInterest: domainsOfInterest || [],
    mentorRoles: mentorRoles || [],
    learnerRoles: learnerRoles || [],
    availabilityWindow,
    spaceId,
    createdAt: finalCreatedAt,
    lastActiveTimestamp,
    sessionsCompleted: existingProfile?.sessionsCompleted || 0,
    sessionsGiven: existingProfile?.sessionsGiven || 0,
    sessionsReceived: existingProfile?.sessionsReceived || 0,
    avgRating: Math.round(avgRating * 10) / 10, // Round to 1 decimal place
    npsScore: existingProfile?.npsScore || 0,
    topSkillsUsage: existingProfile?.topSkillsUsage || [],
    peerTestimonials: existingProfile?.peerTestimonials || [],
    trustEdges: existingProfile?.trustEdges || [],
    communityAffiliations: existingProfile?.communityAffiliations || [],
    reputationScore: existingProfile?.reputationScore || 0,
  };

  const attributes: Array<{ key: string; value: string }> = [
    { key: 'type', value: 'user_profile' },
    { key: 'wallet', value: wallet.toLowerCase() },
    { key: 'displayName', value: displayName },
    { key: 'timezone', value: timezone },
    { key: 'spaceId', value: spaceId },
    { key: 'createdAt', value: finalCreatedAt },
  ];

  if (username) attributes.push({ key: 'username', value: username });
  if (finalIdentitySeed) attributes.push({ key: 'identity_seed', value: finalIdentitySeed });
  if (bio) attributes.push({ key: 'bio', value: bio });
  if (skills) attributes.push({ key: 'skills', value: skills });
  if (seniority) attributes.push({ key: 'seniority', value: seniority });
  if (finalSkillsArray.length > 0) {
    finalSkillsArray.forEach((skill, idx) => {
      attributes.push({ key: `skill_${idx}`, value: skill });
    });
  }

  // Deterministic check: If existing profile found, use Pattern B (updateEntity)
  // Otherwise, use Pattern A (createEntity)
  // This replaces the migration status check which was in-memory only
  const normalizedWallet = wallet.toLowerCase();
  const shouldUpdate = existingProfile?.key && (
    ENTITY_UPDATE_MODE === 'on' || ENTITY_UPDATE_MODE === 'shadow'
  );

  if (shouldUpdate && existingProfile?.key) {
    // Use canonical helper to update existing entity (Pattern B)
    const updateResult = await arkivUpsertEntity({
      type: 'user_profile',
      key: existingProfile.key, // Stable entity_key
      attributes,
      payload: enc.encode(JSON.stringify(payload)),
      expiresIn: 31536000, // 1 year
      privateKey,
    });

    // Structured logging (U1.x.1)
    const { logEntityWrite } = await import('./write-logging');
    logEntityWrite({
      entityType: 'user_profile',
      entityKey: updateResult.key,
      txHash: updateResult.txHash,
      wallet: normalizedWallet,
      timestamp: new Date().toISOString(),
      operation: 'update',
      spaceId: spaceId,
    });

    return updateResult;
  }

  // Create new profile (old behavior or fallback)
  const { addSignerMetadata } = await import('./signer-metadata');
  const attributesWithSigner = addSignerMetadata(attributes, privateKey);
  
  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: attributesWithSigner,
      expiresIn: 31536000, // 1 year
    });
  });

  // Structured logging (U1.x.1)
  const { logEntityWrite } = await import('./write-logging');
  logEntityWrite({
    entityType: 'user_profile',
    entityKey: result.entityKey,
    txHash: result.txHash,
    wallet: normalizedWallet,
    timestamp: new Date().toISOString(),
    operation: 'create',
    spaceId: spaceId,
  });

  return { key: result.entityKey, txHash: result.txHash };
}

/**
 * List all user profiles (with optional filters)
 * 
 * Based on mentor-graph implementation.
 * 
 * Reference: refs/mentor-graph/src/arkiv/profiles.ts (listUserProfiles)
 * 
 * @param params - Optional filters (skill, seniority, spaceId, spaceIds)
 * @returns Array of user profiles
 */
export async function listUserProfiles(params?: { 
  skill?: string; 
  seniority?: string;
  spaceId?: string;
  spaceIds?: string[];
}): Promise<UserProfile[]> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  let queryBuilder = query.where(eq('type', 'user_profile'));
  
  // Note: Skill filtering is done client-side after fetching
  // because skills can be stored in multiple ways:
  // - skill_ids array in payload (preferred, beta)
  // - skillsArray in payload (legacy)
  // - skills attribute (legacy comma-separated string)
  // - skill_0, skill_1, etc. attributes (for querying, but not reliable for filtering)
  // We fetch all profiles and filter client-side for accuracy
  
  if (params?.seniority) {
    queryBuilder = queryBuilder.where(eq('seniority', params.seniority));
  }
  
  // Support multiple spaceIds (builder mode) or single spaceId
  let limit = 100; // Default limit
  if (params?.spaceIds && params.spaceIds.length > 0) {
    // Query all, filter client-side (Arkiv doesn't support OR queries)
    // Use higher limit when querying multiple spaceIds to ensure we get all profiles
    limit = 500;
  } else {
    // Use provided spaceId or default to SPACE_ID from config
    const spaceId = params?.spaceId || SPACE_ID;
    queryBuilder = queryBuilder.where(eq('spaceId', spaceId));
  }
  
  let result: any = null;
  try {
    result = await queryBuilder
      .withAttributes(true)
      .withPayload(true)
      .limit(limit)
      .fetch();
  } catch (fetchError: any) {
    console.error('[listUserProfiles] Arkiv query failed:', {
      message: fetchError?.message,
      stack: fetchError?.stack,
      error: fetchError,
      spaceId: params?.spaceId,
      spaceIds: params?.spaceIds,
      limit,
    });
    return []; // Return empty array on query failure
  }

  // Defensive check: ensure result and entities exist
  if (!result || !result.entities || !Array.isArray(result.entities)) {
    console.warn('[listUserProfiles] Invalid result structure:', {
      result,
      hasEntities: !!result?.entities,
      isArray: Array.isArray(result?.entities),
      spaceId: params?.spaceId,
      spaceIds: params?.spaceIds,
    });
    return [];
  }

  console.log('[listUserProfiles] Query successful:', {
    entityCount: result.entities.length,
    spaceId: params?.spaceId,
    spaceIds: params?.spaceIds,
    limit,
  });

  let profiles = result.entities.map((entity: any) => {
    let payload: any = {};
    try {
      if (entity.payload) {
        const decoded = entity.payload instanceof Uint8Array
          ? new TextDecoder().decode(entity.payload)
          : typeof entity.payload === 'string'
          ? entity.payload
          : JSON.stringify(entity.payload);
        payload = JSON.parse(decoded);
      }
    } catch (e) {
      console.error('Error decoding payload:', e);
    }

    const attrs = entity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };

    // Parse skills array from attributes or payload
    const skillsArray: string[] = [];
    if (Array.isArray(attrs)) {
      attrs.forEach((attr: any) => {
        if (attr.key?.startsWith('skill_')) {
          skillsArray.push(attr.value);
        }
      });
    }
    const finalSkillsArray = payload.skillsArray || skillsArray.length > 0 ? skillsArray : (payload.skills ? payload.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : []);

    // Handle trustEdges: convert legacy string[] to object[] if needed
    let trustEdges = payload.trustEdges || [];
    if (Array.isArray(trustEdges) && trustEdges.length > 0 && typeof trustEdges[0] === 'string') {
      // Legacy format: convert string[] to object[]
      trustEdges = trustEdges.map((wallet: string) => ({
        toWallet: wallet,
        strength: 1,
        createdAt: new Date().toISOString(),
      }));
    }

    return {
      key: entity.key,
      wallet: getAttr('wallet') || payload.wallet || '',
      displayName: getAttr('displayName') || payload.displayName || '',
      username: payload.username || getAttr('username') || undefined,
      profileImage: payload.profileImage || undefined,
      identity_seed: payload.identity_seed || getAttr('identity_seed') || undefined,
      bio: payload.bio || getAttr('bio') || undefined,
      bioShort: payload.bioShort || payload.bio || getAttr('bio') || undefined,
      bioLong: payload.bioLong || undefined,
      skills: getAttr('skills') || payload.skills || '',
      skillsArray: finalSkillsArray,
      timezone: getAttr('timezone') || payload.timezone || '',
      languages: payload.languages || [],
      contactLinks: payload.contactLinks || {},
      seniority: payload.seniority || getAttr('seniority') || undefined,
      domainsOfInterest: payload.domainsOfInterest || [],
      mentorRoles: payload.mentorRoles || [],
      learnerRoles: payload.learnerRoles || [],
      availabilityWindow: payload.availabilityWindow || undefined,
      sessionsCompleted: payload.sessionsCompleted || 0,
      sessionsGiven: payload.sessionsGiven || 0,
      sessionsReceived: payload.sessionsReceived || 0,
      avgRating: payload.avgRating || 0,
      npsScore: payload.npsScore || 0,
      topSkillsUsage: payload.topSkillsUsage || [],
      peerTestimonials: payload.peerTestimonials || [],
      trustEdges: trustEdges as Array<{ toWallet: string; strength: number; createdAt: string }>,
      lastActiveTimestamp: payload.lastActiveTimestamp || undefined,
      communityAffiliations: payload.communityAffiliations || [],
      reputationScore: payload.reputationScore || 0,
      spaceId: getAttr('spaceId') || payload.spaceId || SPACE_ID, // Use SPACE_ID from config as fallback (entities should always have spaceId)
      createdAt: getAttr('createdAt') || payload.createdAt,
      txHash: payload.txHash,
      skill_ids: payload.skill_ids || [], // Include skill_ids for client-side filtering
    };
  });
  
  // Filter by spaceIds client-side if multiple requested
  if (params?.spaceIds && params.spaceIds.length > 0) {
    const beforeFilter = profiles.length;
    profiles = profiles.filter((profile: UserProfile) => params.spaceIds!.includes(profile.spaceId));
    console.log('[listUserProfiles] Filtered by spaceIds:', {
      beforeFilter,
      afterFilter: profiles.length,
      requestedSpaceIds: params.spaceIds,
      foundSpaceIds: [...new Set(profiles.map((p: UserProfile) => p.spaceId))],
    });
  }

  // Client-side skill filtering (Arkiv-native: skills stored in payload, not queryable via attributes)
  if (params?.skill) {
    const skillFilter = params.skill.toLowerCase().trim();
    profiles = profiles.filter((profile: UserProfile) => {
      // Check skillsArray (legacy) - match by name
      if (profile.skillsArray && Array.isArray(profile.skillsArray)) {
        return profile.skillsArray.some(skill => skill.toLowerCase().includes(skillFilter));
      }
      // Check skills string (legacy)
      if (profile.skills) {
        const skillsList = profile.skills.toLowerCase().split(',').map((s: string) => s.trim());
        return skillsList.some((skill: string) => skill.includes(skillFilter));
      }
      // Note: skill_ids array would require loading all skills to match IDs to names
      // For now, we rely on skillsArray and skills string for filtering
      return false;
    });
  }
  
  return profiles;
}

/**
 * Get profile by wallet address
 *
 * Updated for entity update pattern (U1.4):
 * - If migration mode is 'on' or wallet is migrated: Returns single canonical entity (no sorting needed)
 * - If mode is 'off': Uses old pattern (multiple entities, pick latest)
 * - If mode is 'shadow': Returns canonical first, falls back to latest if not found
 *
 * @param wallet - Wallet address
 * @param spaceId - Optional space ID filter
 * @returns User profile or null if not found
 */
export async function getProfileByWallet(wallet: string, spaceId?: string): Promise<UserProfile | null> {
  // Normalize wallet: trim and convert to lowercase for consistent querying
  const normalizedWallet = wallet.trim().toLowerCase();
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const profiles = await listUserProfilesForWallet(normalizedWallet, spaceId);
  if (profiles.length === 0) return null;

  // Determine query strategy based on update mode
  // With Pattern B (updateEntity), we expect a single canonical entity
  // With Pattern A (createEntity), we may have multiple entities and need to pick latest
  const useCanonicalPath = ENTITY_UPDATE_MODE === 'on' || ENTITY_UPDATE_MODE === 'shadow';

  if (useCanonicalPath) {
    // With updates, there should only be one canonical entity per wallet
    // However, we sort by lastActiveTimestamp to ensure we get the most recently updated version
    // This handles edge cases where indexing might be slow or multiple entities exist temporarily
    if (profiles.length > 1) {
      // Multiple profiles found - this is expected during migration transition
      // Sort by lastActiveTimestamp descending (most recent first) to get canonical profile
      profiles.sort((a, b) => {
        const aTime = a.lastActiveTimestamp ? new Date(a.lastActiveTimestamp).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const bTime = b.lastActiveTimestamp ? new Date(b.lastActiveTimestamp).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return bTime - aTime;
      });
      
      // Log at info level (not warning) since this is handled correctly
      // Only log once per wallet to avoid log spam (use a simple cache)
      const logKey = `multi-profile-${normalizedWallet}`;
      if (!(globalThis as any).__profileLogCache) {
        (globalThis as any).__profileLogCache = new Set<string>();
      }
      const logCache = (globalThis as any).__profileLogCache as Set<string>;
      
      if (!logCache.has(logKey)) {
        logCache.add(logKey);
        // Clear cache after 5 minutes to allow re-logging if needed
        setTimeout(() => logCache.delete(logKey), 5 * 60 * 1000);
        
        console.info(
          `[getProfileByWallet] Multiple profiles found for wallet ${normalizedWallet.slice(0, 10)}... ` +
          `(${profiles.length} profiles). Using most recent profile (${profiles[0].key.slice(0, 12)}...). ` +
          `Run consolidation script to clean up duplicates if needed.`
        );
      }
    } else if (profiles.length === 1) {
      // Even with single entity, ensure we have the latest version
      // (This is a no-op for single entity, but makes the logic explicit)
    }
    // Return first profile (most recently updated if sorted, or the only one)
    const profile = profiles[0];

    // Record performance metrics
    const durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
    const payloadBytes = JSON.stringify(profile).length;

    // Record performance sample (async, don't block)
    import('@/lib/metrics/perf').then(({ recordPerfSample }) => {
      recordPerfSample({
        source: 'arkiv',
        operation: 'getProfileByWallet',
        durationMs: Math.round(durationMs),
        payloadBytes,
        httpRequests: 1, // Single query
        createdAt: new Date().toISOString(),
      });
    }).catch(() => {
      // Silently fail if metrics module not available
    });

    return profile;
  } else {
    // Pattern A (createEntity) or shadow mode without existing entity: use latest pattern
    // Sort by createdAt descending (most recent first)
    profiles.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    const profile = profiles[0];

    // Record performance metrics
    const durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
    const payloadBytes = JSON.stringify(profile).length;

    // Record performance sample (async, don't block)
    import('@/lib/metrics/perf').then(({ recordPerfSample }) => {
      recordPerfSample({
        source: 'arkiv',
        operation: 'getProfileByWallet',
        durationMs: Math.round(durationMs),
        payloadBytes,
        httpRequests: 1, // Single query
        createdAt: new Date().toISOString(),
      });
    }).catch(() => {
      // Silently fail if metrics module not available
    });

    return profile;
  }
}

/**
 * List user profiles for a specific wallet
 *
 * Updated for entity update pattern (U1.4):
 * - With updates enabled, should return single canonical entity
 * - Warns if multiple profiles found (indicates incomplete migration or old entities)
 *
 * @param wallet - Wallet address
 * @param spaceId - Optional space ID filter
 * @returns Array of user profiles (should be 1 with updates, may be multiple with old pattern)
 */
export async function listUserProfilesForWallet(wallet: string, spaceId?: string): Promise<UserProfile[]> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  let queryBuilder = query
    .where(eq('type', 'user_profile'))
    .where(eq('wallet', wallet.toLowerCase()));

  // Use provided spaceId or default to SPACE_ID from config
  const finalSpaceId = spaceId || SPACE_ID;
  queryBuilder = queryBuilder.where(eq('spaceId', finalSpaceId));

  const result = await queryBuilder
    .withAttributes(true)
    .withPayload(true)
    .limit(100)
    .fetch();

  // Determine query strategy based on update mode
  // With Pattern B (updateEntity), we expect a single canonical entity
  // With Pattern A (createEntity), we may have multiple entities and need to pick latest
  const normalizedWallet = wallet.toLowerCase();
  const useCanonicalPath = ENTITY_UPDATE_MODE === 'on' || ENTITY_UPDATE_MODE === 'shadow';

  if (!result?.entities || !Array.isArray(result.entities)) {
    return [];
  }

  // If using canonical path and multiple entities found, prefer the one with the most recent lastActiveTimestamp
  // This handles the case where old entities exist alongside the canonical one
  // We use lastActiveTimestamp because it's updated on each profile update, unlike createdAt
  let entitiesToProcess = result.entities;
  if (useCanonicalPath && result.entities.length > 1) {
    console.warn(
      `[listUserProfilesForWallet] Multiple profiles found for migrated wallet ${normalizedWallet}. ` +
      `Expected single canonical entity. Found ${result.entities.length} profiles. ` +
      `This may indicate incomplete migration or old entities not yet cleaned up. ` +
      `Sorting by lastActiveTimestamp to get most recent.`
    );
    // Sort by lastActiveTimestamp descending (most recent first)
    // Fallback to createdAt if lastActiveTimestamp not available
    entitiesToProcess = result.entities.sort((a: any, b: any) => {
      // Extract lastActiveTimestamp from payload (it's in the payload, not attributes)
      const getLastActive = (entity: any): string => {
        try {
          if (entity.payload) {
            const decoded = entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
              ? entity.payload
              : JSON.stringify(entity.payload);
            const payload = JSON.parse(decoded);
            return payload.lastActiveTimestamp || payload.createdAt || '';
          }
        } catch (e) {
          // Ignore parse errors
        }
        // Fallback to createdAt from attributes
        const createdAt = entity.attributes?.createdAt || (Array.isArray(entity.attributes) ? entity.attributes.find((attr: any) => attr.key === 'createdAt')?.value : '');
        return createdAt;
      };
      const aTime = getLastActive(a);
      const bTime = getLastActive(b);
      if (!aTime || !bTime) return 0;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }

  return entitiesToProcess.map((entity: any) => {
    let payload: any = {};
    try {
      if (entity.payload) {
        const decoded = entity.payload instanceof Uint8Array
          ? new TextDecoder().decode(entity.payload)
          : typeof entity.payload === 'string'
          ? entity.payload
          : JSON.stringify(entity.payload);
        payload = JSON.parse(decoded);
      }
    } catch (e) {
      console.error('Error decoding payload:', e);
    }

    const attrs = entity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };

    // Parse skills array from attributes or payload
    const skillsArray: string[] = [];
    if (Array.isArray(attrs)) {
      attrs.forEach((attr: any) => {
        if (attr.key?.startsWith('skill_')) {
          skillsArray.push(attr.value);
        }
      });
    }
    const finalSkillsArray = payload.skillsArray || skillsArray.length > 0 ? skillsArray : (payload.skills ? payload.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : []);

    // Handle trustEdges: convert legacy string[] to object[] if needed
    let trustEdges = payload.trustEdges || [];
    if (Array.isArray(trustEdges) && trustEdges.length > 0 && typeof trustEdges[0] === 'string') {
      trustEdges = trustEdges.map((wallet: string) => ({
        toWallet: wallet,
        strength: 1,
        createdAt: new Date().toISOString(),
      }));
    }

    return {
      key: entity.key,
      wallet: getAttr('wallet') || payload.wallet || '',
      displayName: getAttr('displayName') || payload.displayName || '',
      username: payload.username || getAttr('username') || undefined,
      profileImage: payload.profileImage || undefined,
      identity_seed: payload.identity_seed || getAttr('identity_seed') || undefined,
      bio: payload.bio || getAttr('bio') || undefined,
      bioShort: payload.bioShort || payload.bio || getAttr('bio') || undefined,
      bioLong: payload.bioLong || undefined,
      skills: getAttr('skills') || payload.skills || '',
      skillsArray: finalSkillsArray,
      timezone: getAttr('timezone') || payload.timezone || '',
      languages: payload.languages || [],
      contactLinks: payload.contactLinks || {},
      seniority: payload.seniority || getAttr('seniority') || undefined,
      domainsOfInterest: payload.domainsOfInterest || [],
      mentorRoles: payload.mentorRoles || [],
      learnerRoles: payload.learnerRoles || [],
      sessionsCompleted: payload.sessionsCompleted || 0,
      sessionsGiven: payload.sessionsGiven || 0,
      sessionsReceived: payload.sessionsReceived || 0,
      avgRating: payload.avgRating || 0,
      npsScore: payload.npsScore || 0,
      topSkillsUsage: payload.topSkillsUsage || [],
      peerTestimonials: payload.peerTestimonials || [],
      trustEdges: trustEdges as Array<{ toWallet: string; strength: number; createdAt: string }>,
      lastActiveTimestamp: payload.lastActiveTimestamp || undefined,
      communityAffiliations: payload.communityAffiliations || [],
      reputationScore: payload.reputationScore || 0,
      spaceId: getAttr('spaceId') || payload.spaceId || SPACE_ID, // Use SPACE_ID from config as fallback (entities should always have spaceId)
      createdAt: getAttr('createdAt') || payload.createdAt,
      txHash: payload.txHash,
    };
  });
}

/**
 * Empirically check if a profile exists and is loadable
 * 
 * This method validates that a profile can be successfully queried and loaded,
 * which is necessary for the profile detail page to work properly.
 * 
 * @param wallet - Wallet address to check
 * @returns Object with existence and loadability status
 */
export async function checkProfileExistence(wallet: string): Promise<{
  exists: boolean;
  loadable: boolean;
  profile: UserProfile | null;
  error?: string;
}> {
  const normalizedWallet = wallet.toLowerCase().trim();
  
  try {
    // Step 1: Query profile entities (arkiv-native pattern)
    const profiles = await listUserProfilesForWallet(normalizedWallet);
    
    if (profiles.length === 0) {
      return { exists: false, loadable: false, profile: null };
    }
    
    // Step 2: Get most recent profile (same logic as getProfileByWallet)
    profiles.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
    
    const profile = profiles[0];
    
    // Step 3: Validate loadability
    // Check minimum required fields
    const hasRequiredFields = Boolean(
      profile.wallet && 
      profile.wallet.toLowerCase() === normalizedWallet &&
      profile.displayName !== undefined &&
      profile.createdAt !== undefined
    );
    
    // Try to load via getProfileByWallet (same as detail page)
    let loadable = false;
    try {
      const loadedProfile = await getProfileByWallet(normalizedWallet);
      loadable = loadedProfile !== null && hasRequiredFields;
    } catch (e) {
      loadable = false;
    }
    
    return {
      exists: true,
      loadable: loadable && hasRequiredFields,
      profile: loadable ? profile : null,
      error: loadable ? undefined : 'Profile exists but cannot be loaded',
    };
  } catch (error: any) {
    return {
      exists: false,
      loadable: false,
      profile: null,
      error: error.message || 'Query failed',
    };
  }
}

/**
 * Check if username is already taken (queries all historical profiles)
 * 
 * Uses same query pattern as regrow function to check all profiles.
 * 
 * @param username - Username to check
 * @returns Array of profiles with this username (all historical versions)
 */
export async function checkUsernameExists(username: string): Promise<UserProfile[]> {
  if (!username || username.trim() === '') {
    return [];
  }

  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  
  try {
    // Query all profiles with this username (check both attribute and payload)
    const result = await query
      .where(eq('type', 'user_profile'))
      .where(eq('username', username.trim()))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch();

    if (!result?.entities || !Array.isArray(result.entities)) {
      return [];
    }

    // Also check payload for username (in case it's only in payload, not attribute)
    const profilesWithUsername: UserProfile[] = [];
    
    result.entities.forEach((entity: any) => {
      let payload: any = {};
      try {
        if (entity.payload) {
          const decoded = entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
            ? entity.payload
            : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('[checkUsernameExists] Error decoding payload:', e);
      }

      const attrs = entity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };

      // Check if username matches (case-insensitive)
      const attrUsername = getAttr('username');
      const payloadUsername = payload.username;
      const normalizedInput = username.trim().toLowerCase();
      
      if (
        (attrUsername && attrUsername.toLowerCase() === normalizedInput) ||
        (payloadUsername && payloadUsername.toLowerCase() === normalizedInput)
      ) {
        // Parse full profile data (reuse same logic as listUserProfilesForWallet)
        const finalSkillsArray: string[] = [];
        if (Array.isArray(attrs)) {
          attrs.forEach((attr: any) => {
            if (attr.key?.startsWith('skill_')) {
              finalSkillsArray.push(attr.value);
            }
          });
        }
        const finalSkillsArrayFromPayload = payload.skillsArray || (payload.skills ? payload.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : []);

        let trustEdges = payload.trustEdges || [];
        if (Array.isArray(trustEdges) && trustEdges.length > 0 && typeof trustEdges[0] === 'string') {
          trustEdges = trustEdges.map((wallet: string) => ({
            toWallet: wallet,
            strength: 1,
            createdAt: new Date().toISOString(),
          }));
        }

        profilesWithUsername.push({
          key: entity.key,
          wallet: getAttr('wallet') || payload.wallet || '',
          displayName: getAttr('displayName') || payload.displayName || '',
          username: payloadUsername || attrUsername || undefined,
          profileImage: payload.profileImage || undefined,
          identity_seed: payload.identity_seed || getAttr('identity_seed') || undefined,
          bio: payload.bio || getAttr('bio') || undefined,
          bioShort: payload.bioShort || payload.bio || getAttr('bio') || undefined,
          bioLong: payload.bioLong || undefined,
          skills: getAttr('skills') || payload.skills || '',
          skillsArray: finalSkillsArrayFromPayload.length > 0 ? finalSkillsArrayFromPayload : finalSkillsArray,
          timezone: getAttr('timezone') || payload.timezone || '',
          languages: payload.languages || [],
          contactLinks: payload.contactLinks || {},
          seniority: payload.seniority || getAttr('seniority') || undefined,
          domainsOfInterest: payload.domainsOfInterest || [],
          mentorRoles: payload.mentorRoles || [],
          learnerRoles: payload.learnerRoles || [],
          sessionsCompleted: payload.sessionsCompleted || 0,
          sessionsGiven: payload.sessionsGiven || 0,
          sessionsReceived: payload.sessionsReceived || 0,
          avgRating: payload.avgRating || 0,
          npsScore: payload.npsScore || 0,
          topSkillsUsage: payload.topSkillsUsage || [],
          peerTestimonials: payload.peerTestimonials || [],
          trustEdges: trustEdges as Array<{ toWallet: string; strength: number; createdAt: string }>,
          lastActiveTimestamp: payload.lastActiveTimestamp || undefined,
          communityAffiliations: payload.communityAffiliations || [],
          reputationScore: payload.reputationScore || 0,
          spaceId: getAttr('spaceId') || payload.spaceId || SPACE_ID, // Use SPACE_ID from config as fallback (entities should always have spaceId)
          createdAt: getAttr('createdAt') || payload.createdAt,
          txHash: payload.txHash,
        });
      }
    });

    return profilesWithUsername;
  } catch (error: any) {
    console.error('[checkUsernameExists] Arkiv query failed:', {
      message: error?.message,
      stack: error?.stack,
      error: error
    });
    return []; // Return empty array on query failure
  }
}

/**
 * Calculate average rating from feedback entities for a wallet
 * 
 * @param wallet - Wallet address
 * @returns Average rating (0 if no feedback)
 */
export async function calculateAverageRating(wallet: string): Promise<number> {
  try {
    const { listFeedbackForWallet } = await import('./feedback');
    const feedbacks = await listFeedbackForWallet(wallet);
    
    // Filter feedback received (feedbackTo matches wallet)
    const receivedFeedback = feedbacks.filter(f => 
      f.feedbackTo.toLowerCase() === wallet.toLowerCase()
    );
    
    const ratings = receivedFeedback
      .map(f => f.rating)
      .filter((r): r is number => r !== undefined && r > 0);
    
    if (ratings.length === 0) {
      return 0;
    }
    
    return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  } catch (error: any) {
    console.error('[calculateAverageRating] Error:', error);
    return 0;
  }
}

/**
 * Update profile avgRating field
 * 
 * Creates new profile entity with updated avgRating.
 * 
 * @param wallet - Wallet address
 * @param privateKey - Private key for signing
 * @returns Entity key and transaction hash
 */
export async function updateProfileAvgRating(
  wallet: string,
  privateKey: `0x${string}`
): Promise<{ key: string; txHash: string }> {
  // Get current profile
  const currentProfile = await getProfileByWallet(wallet);
  if (!currentProfile) {
    throw new Error('Profile not found');
  }
  
  // Calculate new average rating
  const avgRating = await calculateAverageRating(wallet);
  
  // Create new profile entity with updated avgRating
  return await createUserProfile({
    wallet,
    displayName: currentProfile.displayName,
    username: currentProfile.username,
    profileImage: currentProfile.profileImage,
    bio: currentProfile.bio,
    bioShort: currentProfile.bioShort,
    bioLong: currentProfile.bioLong,
    skills: currentProfile.skills,
    skillsArray: currentProfile.skillsArray,
    skill_ids: (currentProfile as any).skill_ids,
    skillExpertise: currentProfile.skillExpertise,
    timezone: currentProfile.timezone,
    languages: currentProfile.languages,
    contactLinks: currentProfile.contactLinks,
    seniority: currentProfile.seniority,
    domainsOfInterest: currentProfile.domainsOfInterest,
    mentorRoles: currentProfile.mentorRoles,
    learnerRoles: currentProfile.learnerRoles,
    availabilityWindow: currentProfile.availabilityWindow,
    privateKey,
  });
}
