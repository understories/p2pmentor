/**
 * Profile CRUD helpers
 * 
 * Based on mentor-graph implementation.
 * 
 * Reference: refs/mentor-graph/src/arkiv/profiles.ts
 */

import { eq } from "@arkiv-network/sdk/query"
import { getPublicClient, getWalletClientFromPrivateKey, getWalletClientFromMetaMask } from "./client"
import { CURRENT_WALLET } from "../config"

export type UserProfile = {
  key: string;
  wallet: string;
  // Core Identity
  displayName: string;
  username?: string;
  profileImage?: string;
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
 * Create user profile (client-side with MetaMask)
 * 
 * @param data - Profile data
 * @param account - Wallet address from MetaMask
 * @returns Entity key and transaction hash
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
  const walletClient = getWalletClientFromMetaMask(account);
  const enc = new TextEncoder();
  const spaceId = 'local-dev';
  const createdAt = new Date().toISOString();
  const lastActiveTimestamp = new Date().toISOString();

  // Use skillsArray if provided, otherwise parse skills string
  const finalSkillsArray = skillsArray || (skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : []);

  const payload = {
    displayName,
    username,
    profileImage,
    bio,
    bioShort: bioShort || bio,
    bioLong,
    skills: finalSkillsArray.join(', '),
    skillsArray: finalSkillsArray,
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
    avgRating: 0,
    npsScore: 0,
    topSkillsUsage: [],
    peerTestimonials: [],
    trustEdges: [],
    communityAffiliations: [],
    reputationScore: 0,
  };

  const attributes: Array<{ key: string; value: string }> = [
    { key: 'type', value: 'user_profile' },
    { key: 'wallet', value: wallet },
    { key: 'displayName', value: displayName },
    { key: 'timezone', value: timezone },
    { key: 'spaceId', value: spaceId },
    { key: 'createdAt', value: createdAt },
  ];

  if (username) attributes.push({ key: 'username', value: username });
  if (bio) attributes.push({ key: 'bio', value: bio });
  if (skills) attributes.push({ key: 'skills', value: skills });
  if (seniority) attributes.push({ key: 'seniority', value: seniority });
  if (finalSkillsArray.length > 0) {
    finalSkillsArray.forEach((skill, idx) => {
      attributes.push({ key: `skill_${idx}`, value: skill });
    });
  }

  const { entityKey, txHash } = await walletClient.createEntity({
    payload: enc.encode(JSON.stringify(payload)),
    contentType: 'application/json',
    attributes,
    expiresIn: 31536000, // 1 year
  });

  return { key: entityKey, txHash };
}

/**
 * Create user profile (server-side with private key)
 * 
 * @param data - Profile data
 * @param privateKey - Private key for signing
 * @returns Entity key and transaction hash
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

  const payload = {
    displayName,
    username,
    profileImage,
    bio,
    bioShort: bioShort || bio,
    bioLong,
    skills: finalSkillsArray.join(', '),
    skillsArray: finalSkillsArray,
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
    avgRating: 0,
    npsScore: 0,
    topSkillsUsage: [],
    peerTestimonials: [],
    trustEdges: [],
    communityAffiliations: [],
    reputationScore: 0,
  };

  const attributes: Array<{ key: string; value: string }> = [
    { key: 'type', value: 'user_profile' },
    { key: 'wallet', value: wallet },
    { key: 'displayName', value: displayName },
    { key: 'timezone', value: timezone },
    { key: 'spaceId', value: spaceId },
    { key: 'createdAt', value: createdAt },
  ];

  if (username) attributes.push({ key: 'username', value: username });
  if (bio) attributes.push({ key: 'bio', value: bio });
  if (skills) attributes.push({ key: 'skills', value: skills });
  if (seniority) attributes.push({ key: 'seniority', value: seniority });
  if (finalSkillsArray.length > 0) {
    finalSkillsArray.forEach((skill, idx) => {
      attributes.push({ key: `skill_${idx}`, value: skill });
    });
  }

  const { entityKey, txHash } = await walletClient.createEntity({
    payload: enc.encode(JSON.stringify(payload)),
    contentType: 'application/json',
    attributes,
    expiresIn: 31536000, // 1 year
  });

  return { key: entityKey, txHash };
}

/**
 * Get profile by wallet address
 * 
 * @param wallet - Wallet address
 * @returns User profile or null if not found
 */
export async function getProfileByWallet(wallet: string): Promise<UserProfile | null> {
  const profiles = await listUserProfilesForWallet(wallet);
  if (profiles.length === 0) return null;
  
  // Return the most recent profile (sorted by createdAt descending)
  profiles.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
  
  return profiles[0];
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
    .where(eq('wallet', wallet))
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

