/**
 * Profile Consolidation Script
 *
 * Consolidates multiple profile entities into a single canonical profile.
 * This script:
 * 1. Finds wallets with multiple profiles
 * 2. Identifies the canonical profile (most recent by lastActiveTimestamp)
 * 3. Merges the latest data from all profiles into the canonical one
 * 4. Updates the canonical profile with merged data (Pattern B)
 *
 * This ensures all future updates use the canonical entity key (Pattern B),
 * eliminating warnings and ensuring consistency.
 *
 * Usage:
 *   tsx scripts/consolidate-profiles.ts [--dry-run] [--wallet=<address>]
 *
 * Options:
 *   --dry-run: Show what would be consolidated without actually updating
 *   --wallet=<address>: Consolidate specific wallet only
 */

import 'dotenv/config';
import { listUserProfiles, listUserProfilesForWallet, createUserProfile, UserProfile } from '../lib/arkiv/profile';
import { SPACE_ID, getPrivateKey } from '../lib/config';

interface ConsolidationResult {
  wallet: string;
  profileCount: number;
  canonicalKey: string;
  consolidated: boolean;
  error?: string;
}

/**
 * Get all wallets that have multiple profiles
 */
async function getAllWalletsWithMultipleProfiles(spaceId: string = SPACE_ID): Promise<string[]> {
  console.log(`[getAllWalletsWithMultipleProfiles] Querying all profiles in spaceId: ${spaceId}...`);
  
  const allProfiles = await listUserProfiles({ spaceId });
  
  // Group by wallet
  const profilesByWallet = new Map<string, typeof allProfiles>();
  for (const profile of allProfiles) {
    const wallet = profile.wallet.toLowerCase();
    if (!profilesByWallet.has(wallet)) {
      profilesByWallet.set(wallet, []);
    }
    profilesByWallet.get(wallet)!.push(profile);
  }
  
  // Find wallets with multiple profiles
  const walletsWithMultiple: string[] = [];
  for (const [wallet, profiles] of profilesByWallet.entries()) {
    if (profiles.length > 1) {
      walletsWithMultiple.push(wallet);
    }
  }
  
  console.log(`[getAllWalletsWithMultipleProfiles] Found ${walletsWithMultiple.length} wallets with multiple profiles`);
  return walletsWithMultiple;
}

/**
 * Identify canonical profile (most recent by lastActiveTimestamp, fallback to createdAt)
 */
function identifyCanonicalProfile(profiles: UserProfile[]): {
  canonical: UserProfile;
  others: UserProfile[];
} {
  // Sort by lastActiveTimestamp descending, fallback to createdAt
  const sorted = [...profiles].sort((a, b) => {
    const aTime = a.lastActiveTimestamp 
      ? new Date(a.lastActiveTimestamp).getTime() 
      : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const bTime = b.lastActiveTimestamp 
      ? new Date(b.lastActiveTimestamp).getTime() 
      : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return bTime - aTime;
  });
  
  return {
    canonical: sorted[0],
    others: sorted.slice(1),
  };
}

/**
 * Merge profile data, taking the latest value for each field
 */
function mergeProfileData(profiles: UserProfile[]): Partial<UserProfile> {
  const merged: any = {};
  
  // Sort by lastActiveTimestamp to process most recent first
  const sorted = [...profiles].sort((a, b) => {
    const aTime = a.lastActiveTimestamp ? new Date(a.lastActiveTimestamp).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const bTime = b.lastActiveTimestamp ? new Date(b.lastActiveTimestamp).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return bTime - aTime;
  });
  
  // Fields to merge (take latest non-empty value)
  const fieldsToMerge = [
    'displayName', 'username', 'profileImage', 'bio', 'bioShort', 'bioLong',
    'skills', 'skillsArray', 'skill_ids', 'skillExpertise',
    'timezone', 'languages', 'contactLinks', 'seniority',
    'domainsOfInterest', 'mentorRoles', 'learnerRoles', 'availabilityWindow',
    'sessionsCompleted', 'sessionsGiven', 'sessionsReceived',
    'avgRating', 'npsScore', 'topSkillsUsage', 'peerTestimonials',
    'trustEdges', 'communityAffiliations', 'reputationScore',
    'identity_seed', 'exploringStatement',
  ];
  
  // Process profiles from most recent to oldest
  for (const profile of sorted) {
    for (const field of fieldsToMerge) {
      const profileValue = (profile as any)[field];
      if (profileValue !== undefined && profileValue !== null && profileValue !== '') {
        // Take first non-empty value (most recent profile first)
        const mergedValue = (merged as any)[field];
        if (mergedValue === undefined || mergedValue === null || mergedValue === '') {
          (merged as any)[field] = profileValue;
        }
      }
    }
  }
  
  // Use canonical profile's wallet and spaceId
  merged.wallet = sorted[0].wallet;
  merged.spaceId = sorted[0].spaceId;
  
  // Use latest lastActiveTimestamp
  merged.lastActiveTimestamp = sorted[0].lastActiveTimestamp || sorted[0].createdAt || new Date().toISOString();
  
  return merged;
}

/**
 * Consolidate a single wallet's profiles
 */
async function consolidateWalletProfiles(
  wallet: string,
  spaceId: string = SPACE_ID,
  dryRun: boolean = false
): Promise<ConsolidationResult> {
  const normalizedWallet = wallet.toLowerCase();
  
  // Get all profiles for this wallet
  const profiles = await listUserProfilesForWallet(normalizedWallet, spaceId);
  
  if (profiles.length <= 1) {
    // No consolidation needed
    return {
      wallet: normalizedWallet,
      profileCount: profiles.length,
      canonicalKey: profiles[0]?.key || '',
      consolidated: false,
    };
  }
  
  // Identify canonical profile
  const { canonical, others } = identifyCanonicalProfile(profiles);
  
  console.log(`[consolidateWalletProfiles] Wallet ${normalizedWallet}:`);
  console.log(`  - Total profiles: ${profiles.length}`);
  console.log(`  - Canonical: ${canonical.key} (lastActive: ${canonical.lastActiveTimestamp || canonical.createdAt})`);
  console.log(`  - Other profiles: ${others.map(p => p.key).join(', ')}`);
  
  // Merge data from all profiles
  const mergedData = mergeProfileData(profiles);
  
  if (!dryRun) {
    try {
      // Update canonical profile with merged data using Pattern B (updateEntity)
      // We use createUserProfile which will detect existing profile and use updateEntity
      const privateKey = getPrivateKey();
      const { key, txHash } = await createUserProfile({
        wallet: normalizedWallet,
        displayName: mergedData.displayName || canonical.displayName || 'User',
        username: mergedData.username || canonical.username,
        profileImage: mergedData.profileImage || canonical.profileImage,
        bio: mergedData.bio || canonical.bio,
        bioShort: mergedData.bioShort || canonical.bioShort,
        bioLong: mergedData.bioLong || canonical.bioLong,
        skills: mergedData.skills || canonical.skills || '',
        skillsArray: mergedData.skillsArray || canonical.skillsArray,
        skill_ids: (mergedData as any).skill_ids || (canonical as any).skill_ids,
        skillExpertise: mergedData.skillExpertise || canonical.skillExpertise,
        timezone: mergedData.timezone || canonical.timezone || '',
        languages: mergedData.languages || canonical.languages,
        contactLinks: mergedData.contactLinks || canonical.contactLinks,
        seniority: mergedData.seniority || canonical.seniority,
        domainsOfInterest: mergedData.domainsOfInterest || canonical.domainsOfInterest,
        mentorRoles: mergedData.mentorRoles || canonical.mentorRoles,
        learnerRoles: mergedData.learnerRoles || canonical.learnerRoles,
        availabilityWindow: mergedData.availabilityWindow || canonical.availabilityWindow,
        identity_seed: mergedData.identity_seed || canonical.identity_seed,
        privateKey,
      });
      
      console.log(`[consolidateWalletProfiles] ✅ Consolidated profile ${key} (tx: ${txHash})`);
      
      return {
        wallet: normalizedWallet,
        profileCount: profiles.length,
        canonicalKey: key,
        consolidated: true,
      };
    } catch (error: any) {
      console.error(`[consolidateWalletProfiles] ❌ Error consolidating:`, error);
      return {
        wallet: normalizedWallet,
        profileCount: profiles.length,
        canonicalKey: canonical.key,
        consolidated: false,
        error: error.message,
      };
    }
  } else {
    console.log(`[consolidateWalletProfiles] DRY RUN: Would consolidate to ${canonical.key}`);
    return {
      wallet: normalizedWallet,
      profileCount: profiles.length,
      canonicalKey: canonical.key,
      consolidated: false,
    };
  }
}

/**
 * Main consolidation function
 */
async function consolidateProfiles(options: {
  dryRun?: boolean;
  wallet?: string;
  spaceId?: string;
} = {}) {
  const { dryRun = false, wallet, spaceId = SPACE_ID } = options;
  
  console.log('🚀 Profile Consolidation Script');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Space ID: ${spaceId}`);
  
  if (dryRun) {
    console.log('   ⚠️  DRY RUN MODE: No changes will be made');
  }
  
  // Verify private key is available
  try {
    getPrivateKey();
  } catch (error) {
    console.error('❌ ARKIV_PRIVATE_KEY not set. Required for consolidation.');
    process.exit(1);
  }
  
  const results: ConsolidationResult[] = [];
  
  if (wallet) {
    // Consolidate specific wallet
    console.log(`\n📋 Consolidating wallet: ${wallet}`);
    const result = await consolidateWalletProfiles(wallet, spaceId, dryRun);
    results.push(result);
  } else {
    // Consolidate all wallets with multiple profiles
    console.log('\n📋 Finding wallets with multiple profiles...');
    const wallets = await getAllWalletsWithMultipleProfiles(spaceId);
    
    if (wallets.length === 0) {
      console.log('✅ No wallets with multiple profiles found. Consolidation not needed.');
      return;
    }
    
    console.log(`\n📋 Found ${wallets.length} wallets to consolidate:`);
    for (const w of wallets) {
      console.log(`   - ${w}`);
    }
    
    console.log(`\n🔄 Starting consolidation...`);
    for (let i = 0; i < wallets.length; i++) {
      const w = wallets[i];
      console.log(`\n[${i + 1}/${wallets.length}] Consolidating wallet: ${w}`);
      try {
        const result = await consolidateWalletProfiles(w, spaceId, dryRun);
        results.push(result);
        
        // Small delay to avoid rate limits
        if (i < wallets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error(`❌ Error consolidating wallet ${w}:`, error.message);
        results.push({
          wallet: w,
          profileCount: 0,
          canonicalKey: '',
          consolidated: false,
          error: error.message,
        });
      }
    }
  }
  
  // Summary
  console.log('\n📊 Consolidation Summary:');
  const successful = results.filter(r => r.consolidated && !r.error);
  const failed = results.filter(r => r.error);
  const skipped = results.filter(r => !r.consolidated && !r.error);
  
  console.log(`   ✅ Successfully consolidated: ${successful.length}`);
  console.log(`   ⏭️  Skipped (single profile or no profiles): ${skipped.length}`);
  console.log(`   ❌ Failed: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log('\n   Consolidated wallets:');
    for (const r of successful) {
      console.log(`     - ${r.wallet}: ${r.profileCount} profiles → 1 canonical (${r.canonicalKey})`);
    }
  }
  
  if (failed.length > 0) {
    console.log('\n   Failed wallets:');
    for (const r of failed) {
      console.log(`     - ${r.wallet}: ${r.error}`);
    }
  }
  
  console.log('\n✅ Consolidation complete!');
  
  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('   Run without --dry-run to perform actual consolidation.');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const walletArg = args.find(arg => arg.startsWith('--wallet='));
const wallet = walletArg ? walletArg.split('=')[1] : undefined;

// Run consolidation
consolidateProfiles({ dryRun, wallet })
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Consolidation failed:', error);
    process.exit(1);
  });

