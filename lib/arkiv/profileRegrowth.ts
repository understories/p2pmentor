/**
 * Profile Regrowth from Arkiv History
 * 
 * Beta: Regrow profiles from historical Arkiv data.
 * Pure Arkiv queries - no central database.
 * 
 * Based on profile_stability.md - Beta Launch Plan
 */

import { listUserProfilesForWallet, type UserProfile, createUserProfile } from './profile';
import { normalizeIdentity } from '../identity/rootIdentity';

/**
 * Historical profile data for a given identity
 */
export interface HistoricalProfileData {
  latestProfile: UserProfile;
  profileIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  profileCount: number;
}

/**
 * Result of regrowth attempt
 */
export interface RegrowResult {
  status: 'regrown' | 'no-history' | 'error';
  newProfile?: UserProfile;
  sourceProfiles?: string[];
  error?: string;
}

/**
 * Fetch all historical profile data for an identity
 * 
 * Queries Arkiv for all Profile entities tied to this wallet/identity.
 * Sorts by createdAt descending to get latest first.
 * 
 * @param identity - Normalized wallet address or Arkiv identity
 * @returns Historical profile data, or null if no history found
 */
export async function fetchHistoricalProfileData(
  identity: string
): Promise<HistoricalProfileData | null> {
  try {
    const normalizedIdentity = normalizeIdentity(identity);
    
    // Query all profiles for this wallet
    const profiles = await listUserProfilesForWallet(normalizedIdentity);
    
    if (!profiles || profiles.length === 0) {
      return null;
    }
    
    // Sort by createdAt descending (newest first)
    // createdAt is in attributes or payload
    const sortedProfiles = profiles.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime; // Descending
    });
    
    const latestProfile = sortedProfiles[0];
    const profileIds = sortedProfiles.map(p => p.key);
    
    // Find first and last seen timestamps
    const timestamps = sortedProfiles
      .map(p => p.createdAt ? new Date(p.createdAt).getTime() : 0)
      .filter(t => t > 0)
      .sort((a, b) => a - b);
    
    const firstSeenAt = timestamps.length > 0 
      ? new Date(timestamps[0]).toISOString()
      : latestProfile.createdAt || new Date().toISOString();
    
    const lastSeenAt = latestProfile.createdAt || new Date().toISOString();
    
    return {
      latestProfile,
      profileIds,
      firstSeenAt,
      lastSeenAt,
      profileCount: profiles.length,
    };
  } catch (error: any) {
    console.error('[fetchHistoricalProfileData] Error:', error);
    return null;
  }
}

/**
 * Build candidate profile from historical data
 * 
 * For v1, simply use latestProfile data as-is.
 * Later we can do merging, heuristics, or combine across multiple partial profiles.
 * 
 * @param history - Historical profile data
 * @returns Candidate profile data for creation
 */
function buildProfileFromHistory(history: HistoricalProfileData): Partial<{
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
}> {
  const latest = history.latestProfile;
  
  // Extract all profile fields from latest profile
  return {
    displayName: latest.displayName,
    username: latest.username,
    profileImage: latest.profileImage,
    bio: latest.bio,
    bioShort: latest.bioShort,
    bioLong: latest.bioLong,
    skills: latest.skills,
    skillsArray: latest.skillsArray,
    timezone: latest.timezone,
    languages: latest.languages,
    contactLinks: latest.contactLinks,
    seniority: latest.seniority,
    domainsOfInterest: latest.domainsOfInterest,
    mentorRoles: latest.mentorRoles,
    learnerRoles: latest.learnerRoles,
    availabilityWindow: latest.availabilityWindow,
  };
}

/**
 * Regrow profile from Arkiv history
 * 
 * Queries historical profile data and creates a new Profile entity
 * with that data. Stores metadata about the regrowth source.
 * 
 * @param identity - Normalized wallet address or Arkiv identity
 * @param privateKey - Private key for creating new profile entity
 * @returns Regrow result with status and new profile
 */
export async function regrowProfileFromArkiv(
  identity: string,
  privateKey: `0x${string}`
): Promise<RegrowResult> {
  try {
    const normalizedIdentity = normalizeIdentity(identity);
    
    // Fetch historical data
    const history = await fetchHistoricalProfileData(normalizedIdentity);
    
    if (!history) {
      return { status: 'no-history' };
    }
    
    // Build candidate profile from latest historical data
    const candidateData = buildProfileFromHistory(history);
    
    // Ensure required fields are present
    if (!candidateData.displayName) {
      return {
        status: 'error',
        error: 'Historical profile missing required displayName',
      };
    }
    
    // Create new profile with historical data
    // Store metadata about regrowth source in a comment or optional field
    const { key, txHash } = await createUserProfile({
      wallet: normalizedIdentity,
      displayName: candidateData.displayName,
      username: candidateData.username,
      profileImage: candidateData.profileImage,
      bio: candidateData.bio,
      bioShort: candidateData.bioShort,
      bioLong: candidateData.bioLong,
      skills: candidateData.skills || '',
      skillsArray: candidateData.skillsArray,
      timezone: candidateData.timezone || 'UTC',
      languages: candidateData.languages,
      contactLinks: candidateData.contactLinks,
      seniority: candidateData.seniority,
      domainsOfInterest: candidateData.domainsOfInterest,
      mentorRoles: candidateData.mentorRoles,
      learnerRoles: candidateData.learnerRoles,
      availabilityWindow: candidateData.availabilityWindow,
      privateKey,
    });
    
    // Fetch the newly created profile to return
    const newProfile = await listUserProfilesForWallet(normalizedIdentity).then(profiles => {
      return profiles.find(p => p.key === key) || null;
    });
    
    if (!newProfile) {
      return {
        status: 'error',
        error: 'Failed to fetch newly created profile',
      };
    }
    
    return {
      status: 'regrown',
      newProfile,
      sourceProfiles: history.profileIds,
    };
  } catch (error: any) {
    console.error('[regrowProfileFromArkiv] Error:', error);
    return {
      status: 'error',
      error: error.message || 'Unknown error during regrowth',
    };
  }
}

