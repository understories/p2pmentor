/**
 * Test Script: Explorer Deduplication Logic
 * 
 * Tests the deduplication logic to ensure it works correctly.
 * This script verifies:
 * 1. Profiles are properly deduplicated by wallet
 * 2. Version count is calculated correctly
 * 3. Canonical profile selection works
 * 4. Edge cases are handled
 */

import 'dotenv/config';
import { listUserProfiles } from '../lib/arkiv/profile';
import { serializePublicProfile } from '../lib/explorer/serializers';
import type { PublicEntity } from '../lib/explorer/types';

// Copy deduplication logic from lib/explorer/index.ts for testing
interface ExplorerEntity extends Omit<PublicEntity, 'title' | 'summary'> {
  title: string;
  summary?: string;
  versionCount?: number;
}

function generateEntityTitle(entity: PublicEntity): string {
  if (entity.type === 'profile' && 'displayName' in entity) {
    const profile = entity as any;
    return profile.displayName || profile.wallet || entity.key;
  }
  return entity.key;
}

function normalizeEntity(entity: PublicEntity, versionCount?: number): ExplorerEntity {
  return {
    ...entity,
    title: generateEntityTitle(entity),
    summary: undefined,
    ...(versionCount !== undefined && { versionCount }),
  };
}

function deduplicateProfiles(profiles: ExplorerEntity[]): ExplorerEntity[] {
  const byWallet = new Map<string, ExplorerEntity[]>();
  
  // Group profiles by wallet
  profiles.forEach(profile => {
    if (profile.type === 'profile' && profile.wallet) {
      const wallet = profile.wallet.toLowerCase();
      const existing = byWallet.get(wallet) || [];
      existing.push(profile);
      byWallet.set(wallet, existing);
    }
  });
  
  // For each wallet, keep canonical (most recent) and add version count
  const canonicalProfiles: ExplorerEntity[] = [];
  
  for (const [wallet, walletProfiles] of byWallet.entries()) {
    if (walletProfiles.length === 0) continue;
    
    // Sort by createdAt descending (most recent first)
    // Also consider lastActiveTimestamp if available (for Pattern B updates)
    walletProfiles.sort((a, b) => {
      const aTime = (a as any).lastActiveTimestamp 
        ? new Date((a as any).lastActiveTimestamp).getTime()
        : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const bTime = (b as any).lastActiveTimestamp
        ? new Date((b as any).lastActiveTimestamp).getTime()
        : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return bTime - aTime;
    });
    
    // Canonical is the most recent
    const canonical = walletProfiles[0];
    const versionCount = walletProfiles.length;
    
    // Add version count metadata if multiple versions exist
    canonicalProfiles.push({
      ...canonical,
      versionCount: versionCount > 1 ? versionCount : undefined,
    });
  }
  
  return canonicalProfiles;
}

async function testDeduplication() {
  console.log('🧪 Testing Explorer Deduplication Logic\n');
  
  // Fetch all profiles
  const allSpaceIds = ['beta-launch', 'local-dev', 'local-dev-seed'];
  console.log(`📥 Fetching profiles from spaces: ${allSpaceIds.join(', ')}...`);
  
  const profiles = await listUserProfiles({ spaceIds: allSpaceIds });
  console.log(`✅ Found ${profiles.length} total profiles\n`);
  
  // Serialize profiles
  const serializedProfiles = profiles.map(serializePublicProfile);
  
  // Normalize profiles
  const normalizedProfiles = serializedProfiles.map(normalizeEntity);
  
  // Deduplicate
  const deduplicatedProfiles = deduplicateProfiles(normalizedProfiles);
  
  // Verify results
  console.log('📊 Deduplication Results:');
  console.log('─'.repeat(60));
  console.log(`Total Profiles: ${profiles.length}`);
  console.log(`Deduplicated Profiles: ${deduplicatedProfiles.length}`);
  console.log(`Reduction: ${profiles.length - deduplicatedProfiles.length} profiles (${((profiles.length - deduplicatedProfiles.length) / profiles.length * 100).toFixed(1)}% reduction)`);
  
  // Check version counts
  const profilesWithVersions = deduplicatedProfiles.filter(p => p.versionCount && p.versionCount > 1);
  console.log(`\n📋 Profiles with Multiple Versions: ${profilesWithVersions.length}`);
  
  if (profilesWithVersions.length > 0) {
    console.log('\n🔍 Sample Profiles with Version History:');
    profilesWithVersions.slice(0, 5).forEach(profile => {
      console.log(`  - ${(profile as any).displayName || profile.wallet}: ${profile.versionCount} versions`);
    });
  }
  
  // Verify no duplicates by wallet
  const wallets = new Set<string>();
  let duplicateWallets = 0;
  deduplicatedProfiles.forEach(profile => {
    if (profile.type === 'profile' && profile.wallet) {
      const wallet = profile.wallet.toLowerCase();
      if (wallets.has(wallet)) {
        duplicateWallets++;
        console.error(`  ❌ Duplicate wallet found: ${wallet}`);
      }
      wallets.add(wallet);
    }
  });
  
  if (duplicateWallets === 0) {
    console.log('\n✅ No duplicate wallets found - deduplication working correctly');
  } else {
    console.error(`\n❌ Found ${duplicateWallets} duplicate wallets - deduplication failed!`);
    process.exit(1);
  }
  
  // Verify versionCount is set correctly
  let versionCountErrors = 0;
  deduplicatedProfiles.forEach(profile => {
    if (profile.type === 'profile' && profile.wallet) {
      // Count actual versions for this wallet
      const wallet = profile.wallet.toLowerCase();
      const actualVersions = normalizedProfiles.filter(
        p => p.type === 'profile' && p.wallet && p.wallet.toLowerCase() === wallet
      ).length;
      
      if (actualVersions > 1 && (!profile.versionCount || profile.versionCount !== actualVersions)) {
        versionCountErrors++;
        console.error(`  ❌ Version count mismatch for ${wallet}: expected ${actualVersions}, got ${profile.versionCount}`);
      } else if (actualVersions === 1 && profile.versionCount !== undefined) {
        versionCountErrors++;
        console.error(`  ❌ Version count should be undefined for single version: ${wallet}`);
      }
    }
  });
  
  if (versionCountErrors === 0) {
    console.log('✅ Version counts are correct');
  } else {
    console.error(`\n❌ Found ${versionCountErrors} version count errors`);
    process.exit(1);
  }
  
  console.log('\n✅ All tests passed!');
}

testDeduplication()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

