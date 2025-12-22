/**
 * Onboarding State Calculation
 * 
 * Derives onboarding progress from Arkiv entities (no new entity type).
 * Follows Arkiv-native patterns and immutability principles.
 */

import { OnboardingLevel, OnboardingProgress } from './types';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { listAsks } from '@/lib/arkiv/asks';
import { listOffers } from '@/lib/arkiv/offers';
import { listLearningFollows } from '@/lib/arkiv/learningFollow';
import { listOnboardingEvents } from '@/lib/arkiv/onboardingEvent';

/**
 * Calculate onboarding level from Arkiv entities
 * 
 * Levels:
 * 0: No profile created
 * 1: Profile created (with or without skills) - allows dashboard access
 * 2: ≥1 Ask OR Offer created
 * 3: Network explored once
 * 4: Joined ≥1 community
 * 
 * Note: Level 1 is granted if profile exists, regardless of skills.
 * This ensures users with profiles can access the dashboard even if
 * they haven't added skills yet. Skills are encouraged but not required
 * for basic dashboard access.
 * 
 * @param wallet - Profile wallet address (from localStorage 'wallet_address')
 *                 This is the wallet address used as the 'wallet' attribute on entities.
 *                 The global Arkiv signing wallet (from ARKIV_PRIVATE_KEY) signs transactions,
 *                 but entities are tied to this profile wallet.
 * @returns Onboarding level (0-4)
 */
export async function calculateOnboardingLevel(wallet: string): Promise<OnboardingLevel> {
  try {
    // Level 0: Check if profile exists for this profile wallet
    const profile = await getProfileByWallet(wallet);
    if (!profile) {
      return 0;
    }

    // Level 1: Profile exists (with or without skills)
    // This allows dashboard access for users with profiles, even if they haven't added skills yet
    // Skills are encouraged but not required for basic access
    const hasSkills = profile.skillsArray && profile.skillsArray.length > 0;
    if (!hasSkills) {
      return 1; // Profile exists but no skills yet - still level 1 for dashboard access
    }

    // Level 2: Check if user has created asks or offers
    const [allAsks, allOffers] = await Promise.all([
      listAsks({ limit: 100 }).catch(() => []),
      listOffers({ limit: 100 }).catch(() => []),
    ]);
    // Filter by wallet (listAsks/listOffers don't have wallet filter in params)
    const asks = allAsks.filter(a => a.wallet.toLowerCase() === wallet.toLowerCase());
    const offers = allOffers.filter(o => o.wallet.toLowerCase() === wallet.toLowerCase());
    const hasAskOrOffer = (asks && asks.length > 0) || (offers && offers.length > 0);
    if (!hasAskOrOffer) {
      return 1; // Has skills but no asks/offers - still level 1
    }

    // Level 3: Check if network was explored
    const networkEvents = await listOnboardingEvents({
      wallet,
      eventType: 'network_explored',
      limit: 1,
    }).catch(() => []);
    const hasExploredNetwork = networkEvents && networkEvents.length > 0;
    if (!hasExploredNetwork) {
      return 2; // Has asks/offers but hasn't explored network
    }

    // Level 4: Check if user has joined communities
    const follows = await listLearningFollows({
      profile_wallet: wallet,
      active: true,
      limit: 1,
    }).catch(() => []);
    const hasJoinedCommunity = follows && follows.length > 0;
    if (!hasJoinedCommunity) {
      return 3; // Has explored network but hasn't joined community
    }

    return 4; // All steps complete
  } catch (error) {
    console.error('[calculateOnboardingLevel] Error:', error);
    // On error, be permissive: if profile exists, assume at least level 1
    // This prevents locking out users with profiles due to transient errors
    try {
      const profile = await getProfileByWallet(wallet);
      if (profile) {
        return 1; // Profile exists, assume at least level 1
      }
    } catch (profileError) {
      // If we can't even check profile, default to 0
      console.error('[calculateOnboardingLevel] Error checking profile:', profileError);
    }
    return 0;
  }
}

/**
 * Check if onboarding is complete
 * 
 * @param wallet - Wallet address
 * @returns True if onboarding is complete (level 2 = ask or offer created)
 * Note: Network and community steps are optional, not required for completion
 */
export async function isOnboardingComplete(wallet: string): Promise<boolean> {
  const level = await calculateOnboardingLevel(wallet);
  // Onboarding is complete after creating an ask or offer (level 2)
  // Network and community exploration are optional, not required
  return level >= 2;
}

/**
 * Get detailed onboarding progress
 * 
 * @param wallet - Wallet address
 * @returns Onboarding progress details
 */
export async function getOnboardingProgress(wallet: string): Promise<OnboardingProgress> {
  const level = await calculateOnboardingLevel(wallet);
  // Onboarding is complete after creating an ask or offer (level 2)
  // Network and community exploration are optional, not required
  const isComplete = level >= 2;

  const completedSteps: string[] = [];
  const missingSteps: string[] = [];

  // Check each step
  const profile = await getProfileByWallet(wallet).catch(() => null);
  if (profile) {
    completedSteps.push('identity');
  } else {
    missingSteps.push('identity');
  }

  if (profile?.skillsArray && profile.skillsArray.length > 0) {
    completedSteps.push('skills');
  } else {
    missingSteps.push('skills');
  }

  const [allAsks, allOffers] = await Promise.all([
    listAsks({ limit: 100 }).catch(() => []),
    listOffers({ limit: 100 }).catch(() => []),
  ]);
  // Filter by wallet
  const asks = allAsks.filter(a => a.wallet.toLowerCase() === wallet.toLowerCase());
  const offers = allOffers.filter(o => o.wallet.toLowerCase() === wallet.toLowerCase());
  if ((asks && asks.length > 0) || (offers && offers.length > 0)) {
    completedSteps.push('ask_or_offer');
  } else {
    missingSteps.push('ask_or_offer');
  }

  const networkEvents = await listOnboardingEvents({
    wallet,
    eventType: 'network_explored',
    limit: 1,
  }).catch(() => []);
  if (networkEvents && networkEvents.length > 0) {
    completedSteps.push('network');
  } else {
    missingSteps.push('network');
  }

  const follows = await listLearningFollows({
    profile_wallet: wallet,
    active: true,
    limit: 1,
  }).catch(() => []);
  if (follows && follows.length > 0) {
    completedSteps.push('community');
  } else {
    missingSteps.push('community');
  }

  return {
    level,
    isComplete,
    completedSteps,
    missingSteps,
  };
}
