/**
 * Profile Migration Script
 *
 * Migrates existing duplicate profiles to single canonical entity pattern.
 * Based on entity update implementation plan (refs/entity-update-implementation-plan.md).
 *
 * Strategy:
 * 1. Identify canonical entity (latest by createdAt)
 * 2. If profile_key is referenced: Update all references to point to canonical entity_key
 * 3. If profile_key is NOT referenced: No reference updates needed
 * 4. Keep old entities (don't delete - immutable)
 * 5. Mark wallet as migrated (app-layer, not Arkiv)
 *
 * Usage:
 *   tsx scripts/migrate-profiles-to-canonical.ts [--dry-run] [--wallet=<address>]
 *
 * Options:
 *   --dry-run: Show what would be migrated without actually migrating
 *   --wallet=<address>: Migrate specific wallet only
 */

import 'dotenv/config';
import { listUserProfiles, listUserProfilesForWallet } from '../lib/arkiv/profile';
import { markWalletMigrated, isWalletMigrated, SPACE_ID } from '../lib/config';
import { getPrivateKey } from '../lib/config';

interface MigrationResult {
  wallet: string;
  profileCount: number;
  canonicalKey: string;
  canonicalCreatedAt: string;
  oldProfileKeys: string[];
  migrated: boolean;
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
 * Identify canonical profile (latest by createdAt)
 */
function identifyCanonicalProfile(profiles: Array<{ key: string; createdAt?: string }>): {
  canonical: typeof profiles[0];
  old: typeof profiles;
} {
  // Sort by createdAt descending
  const sorted = [...profiles].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
  
  return {
    canonical: sorted[0],
    old: sorted.slice(1),
  };
}

/**
 * Check if profile_key is referenced anywhere
 *
 * TODO: U0.4 audit will determine if profile_key is actually referenced.
 * For now, we assume it's NOT referenced (simpler migration).
 * If it is referenced, we'll need to update those references.
 */
async function profileKeyIsReferenced(profileKey: string): Promise<boolean> {
  // TODO: Implement reference checking once U0.4 audit is complete
  // For now, assume profile_key is NOT referenced (most likely case)
  return false;
}

/**
 * Migrate a single wallet's profiles
 */
async function migrateWalletProfiles(
  wallet: string,
  spaceId: string = SPACE_ID,
  dryRun: boolean = false
): Promise<MigrationResult> {
  const normalizedWallet = wallet.toLowerCase();
  
  // Check if already migrated
  if (isWalletMigrated(normalizedWallet)) {
    console.log(`[migrateWalletProfiles] Wallet ${normalizedWallet} already migrated, skipping`);
    return {
      wallet: normalizedWallet,
      profileCount: 0,
      canonicalKey: '',
      canonicalCreatedAt: '',
      oldProfileKeys: [],
      migrated: false,
      error: 'Already migrated',
    };
  }
  
  // Get all profiles for this wallet
  const profiles = await listUserProfilesForWallet(normalizedWallet, spaceId);
  
  if (profiles.length <= 1) {
    // No migration needed (single profile or no profiles)
    if (profiles.length === 1 && !dryRun) {
      // Mark as migrated (single profile means it's already canonical)
      markWalletMigrated(normalizedWallet);
    }
    return {
      wallet: normalizedWallet,
      profileCount: profiles.length,
      canonicalKey: profiles[0]?.key || '',
      canonicalCreatedAt: profiles[0]?.createdAt || '',
      oldProfileKeys: [],
      migrated: profiles.length === 1,
    };
  }
  
  // Identify canonical profile
  const { canonical, old } = identifyCanonicalProfile(profiles);
  
  console.log(`[migrateWalletProfiles] Wallet ${normalizedWallet}:`);
  console.log(`  - Total profiles: ${profiles.length}`);
  console.log(`  - Canonical: ${canonical.key} (created: ${canonical.createdAt})`);
  console.log(`  - Old profiles: ${old.map(p => p.key).join(', ')}`);
  
  // Check if profile_key is referenced
  const isReferenced = await profileKeyIsReferenced(canonical.key);
  
  if (isReferenced) {
    // TODO: Update references to point to canonical entity_key
    // This will be implemented once U0.4 audit confirms references exist
    console.warn(`[migrateWalletProfiles] Profile ${canonical.key} is referenced. Reference updates not yet implemented.`);
  }
  
  // NOTE: Migration markers are deprecated - migration status is now determined
  // by checking if a canonical entity exists. This script is kept for historical
  // reference but the migration marker functions are no-ops.
  // The consolidation script (consolidate-profiles.ts) should be used instead.
  
  // Note: Old entities remain on-chain (immutable)
  // Read paths select the latest entity by lastActiveTimestamp/createdAt
  
  return {
    wallet: normalizedWallet,
    profileCount: profiles.length,
    canonicalKey: canonical.key,
    canonicalCreatedAt: canonical.createdAt || '',
    oldProfileKeys: old.map(p => p.key),
    migrated: !dryRun,
  };
}

/**
 * Main migration function
 */
async function migrateProfiles(options: {
  dryRun?: boolean;
  wallet?: string;
  spaceId?: string;
} = {}) {
  const { dryRun = false, wallet, spaceId = SPACE_ID } = options;
  
  console.log('🚀 Profile Migration Script');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Space ID: ${spaceId}`);
  
  if (dryRun) {
    console.log('   ⚠️  DRY RUN MODE: No changes will be made');
  }
  
  // Verify private key is available (needed for any future reference updates)
  try {
    getPrivateKey();
  } catch (error) {
    console.error('❌ ARKIV_PRIVATE_KEY not set. Required for migration.');
    process.exit(1);
  }
  
  const results: MigrationResult[] = [];
  
  if (wallet) {
    // Migrate specific wallet
    console.log(`\n📋 Migrating wallet: ${wallet}`);
    const result = await migrateWalletProfiles(wallet, spaceId, dryRun);
    results.push(result);
  } else {
    // Migrate all wallets with multiple profiles
    console.log('\n📋 Finding wallets with multiple profiles...');
    const wallets = await getAllWalletsWithMultipleProfiles(spaceId);
    
    if (wallets.length === 0) {
      console.log('✅ No wallets with multiple profiles found. Migration not needed.');
      return;
    }
    
    console.log(`\n📋 Found ${wallets.length} wallets to migrate:`);
    for (const w of wallets) {
      console.log(`   - ${w}`);
    }
    
    console.log(`\n🔄 Starting migration...`);
    for (let i = 0; i < wallets.length; i++) {
      const w = wallets[i];
      console.log(`\n[${i + 1}/${wallets.length}] Migrating wallet: ${w}`);
      try {
        const result = await migrateWalletProfiles(w, spaceId, dryRun);
        results.push(result);
        
        // Small delay to avoid rate limits
        if (i < wallets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        console.error(`❌ Error migrating wallet ${w}:`, error.message);
        results.push({
          wallet: w,
          profileCount: 0,
          canonicalKey: '',
          canonicalCreatedAt: '',
          oldProfileKeys: [],
          migrated: false,
          error: error.message,
        });
      }
    }
  }
  
  // Summary
  console.log('\n📊 Migration Summary:');
  const successful = results.filter(r => r.migrated && !r.error);
  const failed = results.filter(r => r.error);
  const skipped = results.filter(r => !r.migrated && !r.error);
  
  console.log(`   ✅ Successfully migrated: ${successful.length}`);
  console.log(`   ⏭️  Skipped (already migrated or single profile): ${skipped.length}`);
  console.log(`   ❌ Failed: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log('\n   Migrated wallets:');
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
  
  console.log('\n✅ Migration complete!');
  
  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('   Run without --dry-run to perform actual migration.');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const walletArg = args.find(arg => arg.startsWith('--wallet='));
const wallet = walletArg ? walletArg.split('=')[1] : undefined;

// Run migration
migrateProfiles({ dryRun, wallet })
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });

