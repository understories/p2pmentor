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
  allProfiles: UserProfile[]; // Day 2: All historical profiles for browsing
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
    // Note: This should find all profiles regardless of when they were created
    let profiles = await listUserProfilesForWallet(normalizedIdentity);
    
    // Fallback: If no profiles found via wallet attribute query, try fetching all profiles
    // and filtering by wallet (in case older profiles have wallet only in payload, not in attributes)
    // This ensures we can regrow from all historical profiles regardless of how they were stored
    if (!profiles || profiles.length === 0) {
      const { listUserProfiles } = await import('./profile');
      const allProfiles = await listUserProfiles();
      profiles = allProfiles.filter(p => 
        p.wallet?.toLowerCase() === normalizedIdentity
      );
    }
    
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
      allProfiles: sortedProfiles, // Day 2: Return all profiles for browsing
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
 * Build candidate profile from a specific historical profile
 * 
 * Day 2: Can build from any profile, not just latest.
 * 
 * @param profile - Historical profile to build from
 * @returns Candidate profile data for creation
 */
export function buildProfileFromHistory(profile: UserProfile): Partial<{
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
  // Extract all profile fields from the provided profile
  return {
    displayName: profile.displayName,
    username: profile.username,
    profileImage: profile.profileImage,
    bio: profile.bio,
    bioShort: profile.bioShort,
    bioLong: profile.bioLong,
    skills: profile.skills,
    skillsArray: profile.skillsArray,
    timezone: profile.timezone,
    languages: profile.languages,
    contactLinks: profile.contactLinks,
    seniority: profile.seniority,
    domainsOfInterest: profile.domainsOfInterest,
    mentorRoles: profile.mentorRoles,
    learnerRoles: profile.learnerRoles,
    availabilityWindow: profile.availabilityWindow,
  };
}

/**
 * Regrow profile from a specific historical profile ID
 * 
 * Day 2: Allows regrowing from any historical profile, not just latest.
 * 
 * @param identity - Normalized wallet address or Arkiv identity
 * @param profileId - Specific profile ID to regrow from (optional, defaults to latest)
 * @param privateKey - Private key for creating new profile entity
 * @returns Regrow result with status and new profile
 */
export async function regrowProfileFromArkiv(
  identity: string,
  privateKey: `0x${string}`,
  profileId?: string
): Promise<RegrowResult> {
  try {
    const normalizedIdentity = normalizeIdentity(identity);
    
    // Fetch historical data
    const history = await fetchHistoricalProfileData(normalizedIdentity);
    
    if (!history) {
      return { status: 'no-history' };
    }
    
    // Day 2: Select specific profile if provided, otherwise use latest
    let selectedProfile: UserProfile;
    if (profileId) {
      const foundProfile = history.allProfiles.find(p => p.key === profileId);
      if (!foundProfile) {
        return {
          status: 'error',
          error: `Profile with ID ${profileId} not found in history`,
        };
      }
      selectedProfile = foundProfile;
    } else {
      selectedProfile = history.latestProfile;
    }
    
    // Build candidate profile from selected historical profile
    const candidateData = buildProfileFromHistory(selectedProfile);
    
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
      sourceProfiles: [selectedProfile.key], // Day 2: Track which specific profile was regrown
    };
  } catch (error: any) {
    console.error('[regrowProfileFromArkiv] Error:', error);
    return {
      status: 'error',
      error: error.message || 'Unknown error during regrowth',
    };
  }
}

