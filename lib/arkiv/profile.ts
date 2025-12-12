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
import { CURRENT_WALLET } from "../config"
import { handleTransactionWithTimeout } from "./transaction-utils"
import { selectRandomEmoji } from "@/lib/profile/identitySeed"

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
  account: `0x${string}`;
}): Promise<{ key: string; txHash: string }> {
  // Use unified wallet client getter (supports both MetaMask and Passkey)
  const walletClient = await getWalletClient(account);
  const enc = new TextEncoder();
  const spaceId = 'local-dev';
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

  // Auto-assign emoji identity seed (EIS) for new profiles only
  // Preserve existing identity_seed for profile updates
  const identity_seed = existingProfile?.identity_seed || selectRandomEmoji();

  const payload = {
    displayName,
    username,
    profileImage,
    identity_seed,
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
    createdAt,
    lastActiveTimestamp,
    sessionsCompleted: 0,
    sessionsGiven: 0,
    sessionsReceived: 0,
    avgRating: Math.round(avgRating * 10) / 10, // Round to 1 decimal place
    npsScore: 0,
    topSkillsUsage: [],
    peerTestimonials: [],
    trustEdges: [],
    communityAffiliations: [],
    reputationScore: 0,
  };

  const attributes: Array<{ key: string; value: string }> = [
    { key: 'type', value: 'user_profile' },
    { key: 'wallet', value: wallet.toLowerCase() },
    { key: 'displayName', value: displayName },
    { key: 'timezone', value: timezone },
    { key: 'spaceId', value: spaceId },
    { key: 'createdAt', value: createdAt },
  ];

  if (username) attributes.push({ key: 'username', value: username });
  if (identity_seed) attributes.push({ key: 'identity_seed', value: identity_seed });
  if (bio) attributes.push({ key: 'bio', value: bio });
  if (skills) attributes.push({ key: 'skills', value: skills });
  if (seniority) attributes.push({ key: 'seniority', value: seniority });
  if (finalSkillsArray.length > 0) {
    finalSkillsArray.forEach((skill, idx) => {
      attributes.push({ key: `skill_${idx}`, value: skill });
    });
  }

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
  privateKey: `0x${string}`;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const spaceId = 'local-dev';
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

  // Auto-assign emoji identity seed (EIS) for new profiles only
  // Preserve existing identity_seed for profile updates
  const identity_seed = existingProfile?.identity_seed || selectRandomEmoji();

  const payload = {
    displayName,
    username,
    profileImage,
    identity_seed,
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
    createdAt,
    lastActiveTimestamp,
    sessionsCompleted: 0,
    sessionsGiven: 0,
    sessionsReceived: 0,
    avgRating: Math.round(avgRating * 10) / 10, // Round to 1 decimal place
    npsScore: 0,
    topSkillsUsage: [],
    peerTestimonials: [],
    trustEdges: [],
    communityAffiliations: [],
    reputationScore: 0,
  };

  const attributes: Array<{ key: string; value: string }> = [
    { key: 'type', value: 'user_profile' },
    { key: 'wallet', value: wallet.toLowerCase() },
    { key: 'displayName', value: displayName },
    { key: 'timezone', value: timezone },
    { key: 'spaceId', value: spaceId },
    { key: 'createdAt', value: createdAt },
  ];

  if (username) attributes.push({ key: 'username', value: username });
  if (identity_seed) attributes.push({ key: 'identity_seed', value: identity_seed });
  if (bio) attributes.push({ key: 'bio', value: bio });
  if (skills) attributes.push({ key: 'skills', value: skills });
  if (seniority) attributes.push({ key: 'seniority', value: seniority });
  if (finalSkillsArray.length > 0) {
    finalSkillsArray.forEach((skill, idx) => {
      attributes.push({ key: `skill_${idx}`, value: skill });
    });
  }

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
 * List all user profiles (with optional filters)
 * 
 * Based on mentor-graph implementation.
 * 
 * Reference: refs/mentor-graph/src/arkiv/profiles.ts (listUserProfiles)
 * 
 * @param params - Optional filters (skill, seniority, spaceId)
 * @returns Array of user profiles
 */
export async function listUserProfiles(params?: { 
  skill?: string; 
  seniority?: string;
  spaceId?: string;
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
  
  if (params?.spaceId) {
    queryBuilder = queryBuilder.where(eq('spaceId', params.spaceId));
  }
  
  const result = await queryBuilder
    .withAttributes(true)
    .withPayload(true)
    .limit(100)
    .fetch();

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
      spaceId: getAttr('spaceId') || payload.spaceId || 'local-dev',
      createdAt: getAttr('createdAt') || payload.createdAt,
      txHash: payload.txHash,
      skill_ids: payload.skill_ids || [], // Include skill_ids for client-side filtering
    };
  });
  
  // Client-side skill filtering (Arkiv-native: skills stored in payload, not queryable via attributes)
  if (params?.skill) {
    const skillFilter = params.skill.toLowerCase().trim();
    profiles = profiles.filter(profile => {
      // Check skillsArray (legacy) - match by name
      if (profile.skillsArray && Array.isArray(profile.skillsArray)) {
        return profile.skillsArray.some(skill => skill.toLowerCase().includes(skillFilter));
      }
      // Check skills string (legacy)
      if (profile.skills) {
        const skillsList = profile.skills.toLowerCase().split(',').map(s => s.trim());
        return skillsList.some(skill => skill.includes(skillFilter));
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
 * @param wallet - Wallet address
 * @returns User profile or null if not found
 */
export async function getProfileByWallet(wallet: string): Promise<UserProfile | null> {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const profiles = await listUserProfilesForWallet(wallet);
  if (profiles.length === 0) return null;
  
  // Return the most recent profile (sorted by createdAt descending)
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

/**
 * List user profiles for a specific wallet
 * 
 * @param wallet - Wallet address
 * @returns Array of user profiles
 */
export async function listUserProfilesForWallet(wallet: string): Promise<UserProfile[]> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  const result = await query
    .where(eq('type', 'user_profile'))
    .where(eq('wallet', wallet.toLowerCase()))
    .withAttributes(true)
    .withPayload(true)
    .limit(100)
    .fetch();

  return result.entities.map((entity: any) => {
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
      spaceId: getAttr('spaceId') || payload.spaceId || 'local-dev',
      createdAt: getAttr('createdAt') || payload.createdAt,
      txHash: payload.txHash,
    };
  });
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
          spaceId: getAttr('spaceId') || payload.spaceId || 'local-dev',
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
