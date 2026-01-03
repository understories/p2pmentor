/**
 * Investigation Script: Profile Duplicates Analysis
 * 
 * Analyzes duplicate profile entities to determine:
 * 1. If consolidation script ran
 * 2. Whether duplicates are Pattern A (different entity_key) or Pattern B (same entity_key)
 * 3. Migration mode status
 * 4. Statistics on duplicates
 */

import 'dotenv/config';
import { listUserProfiles } from '../lib/arkiv/profile';
import { SPACE_ID, ENTITY_UPDATE_MODE } from '../lib/config';

interface DuplicateAnalysis {
  wallet: string;
  profileCount: number;
  entityKeys: string[];
  uniqueEntityKeys: number;
  createdAtRange: { earliest: string; latest: string };
  lastActiveTimestampRange: { earliest: string | null; latest: string | null };
  isPatternA: boolean; // Different entity_keys (old versioning)
  isPatternB: boolean; // Same entity_key (updates)
  profiles: Array<{
    key: string;
    createdAt: string;
    lastActiveTimestamp?: string;
    displayName: string;
  }>;
}

interface SummaryStats {
  totalProfiles: number;
  totalWallets: number;
  walletsWithSingleProfile: number;
  walletsWithMultipleProfiles: number;
  walletsWithPatternA: number; // Multiple different entity_keys
  walletsWithPatternB: number; // Same entity_key (shouldn't happen, but check)
  percentCanonical: number;
  migrationMode: string;
}

async function investigateDuplicates() {
  console.log('🔍 Investigating profile duplicates...\n');
  
  // Check migration mode
  console.log(`📊 Migration Mode: ${ENTITY_UPDATE_MODE}`);
  console.log(`📊 Space ID: ${SPACE_ID}\n`);
  
  // Fetch all profiles from all spaces
  const allSpaceIds = ['beta-launch', 'local-dev', 'local-dev-seed'];
  console.log(`📥 Fetching profiles from spaces: ${allSpaceIds.join(', ')}...`);
  
  const allProfiles = await listUserProfiles({ spaceIds: allSpaceIds });
  console.log(`✅ Found ${allProfiles.length} total profiles\n`);
  
  // Group by wallet
  const profilesByWallet = new Map<string, typeof allProfiles>();
  allProfiles.forEach(profile => {
    const wallet = profile.wallet.toLowerCase();
    const existing = profilesByWallet.get(wallet) || [];
    existing.push(profile);
    profilesByWallet.set(wallet, existing);
  });
  
  console.log(`📊 Total unique wallets: ${profilesByWallet.size}`);
  
  // Analyze duplicates
  const walletsWithDuplicates: DuplicateAnalysis[] = [];
  const walletsWithSingleProfile: string[] = [];
  
  for (const [wallet, profiles] of profilesByWallet.entries()) {
    if (profiles.length === 1) {
      walletsWithSingleProfile.push(wallet);
      continue;
    }
    
    // Multiple profiles - analyze
    const entityKeys = profiles.map(p => p.key);
    const uniqueEntityKeys = new Set(entityKeys).size;
    
    const createdAtTimes = profiles.map(p => new Date(p.createdAt || 0).getTime());
    const lastActiveTimes = profiles.map(p => 
      p.lastActiveTimestamp 
        ? new Date(p.lastActiveTimestamp).getTime() 
        : (p.createdAt ? new Date(p.createdAt).getTime() : 0)
    );
    
    const analysis: DuplicateAnalysis = {
      wallet,
      profileCount: profiles.length,
      entityKeys,
      uniqueEntityKeys,
      createdAtRange: {
        earliest: profiles.reduce((earliest, p) => 
          (!earliest || new Date(p.createdAt || 0) < new Date(earliest)) ? p.createdAt || '' : earliest
        , ''),
        latest: profiles.reduce((latest, p) => 
          (!latest || new Date(p.createdAt || 0) > new Date(latest)) ? p.createdAt || '' : latest
        , ''),
      },
      lastActiveTimestampRange: {
        earliest: profiles.reduce((earliest, p) => {
          const time = p.lastActiveTimestamp || p.createdAt || '';
          return (!earliest || (time && new Date(time) < new Date(earliest))) ? time : earliest;
        }, null as string | null),
        latest: profiles.reduce((latest, p) => {
          const time = p.lastActiveTimestamp || p.createdAt || '';
          return (!latest || (time && new Date(time) > new Date(latest))) ? time : latest;
        }, null as string | null),
      },
      isPatternA: uniqueEntityKeys === profiles.length, // All different keys = Pattern A
      isPatternB: uniqueEntityKeys === 1, // All same key = Pattern B (shouldn't happen, but check)
      profiles: profiles.map(p => ({
        key: p.key,
        createdAt: p.createdAt || '',
        lastActiveTimestamp: p.lastActiveTimestamp,
        displayName: p.displayName,
      })),
    };
    
    walletsWithDuplicates.push(analysis);
  }
  
  // Calculate summary stats
  const totalWallets = profilesByWallet.size;
  const walletsWithSingle = walletsWithSingleProfile.length;
  const walletsWithMultiple = walletsWithDuplicates.length;
  const walletsWithPatternA = walletsWithDuplicates.filter(w => w.isPatternA).length;
  const walletsWithPatternB = walletsWithDuplicates.filter(w => w.isPatternB).length;
  const percentCanonical = totalWallets > 0 ? (walletsWithSingle / totalWallets) * 100 : 0;
  
  const summary: SummaryStats = {
    totalProfiles: allProfiles.length,
    totalWallets,
    walletsWithSingleProfile: walletsWithSingle,
    walletsWithMultipleProfiles: walletsWithMultiple,
    walletsWithPatternA,
    walletsWithPatternB,
    percentCanonical,
    migrationMode: ENTITY_UPDATE_MODE,
  };
  
  // Print summary
  console.log('\n📊 Summary Statistics:');
  console.log('─'.repeat(60));
  console.log(`Total Profiles: ${summary.totalProfiles}`);
  console.log(`Total Wallets: ${summary.totalWallets}`);
  console.log(`Wallets with Single Profile: ${summary.walletsWithSingleProfile} (${summary.percentCanonical.toFixed(1)}%)`);
  console.log(`Wallets with Multiple Profiles: ${summary.walletsWithMultipleProfiles}`);
  console.log(`  - Pattern A (different entity_keys): ${summary.walletsWithPatternA}`);
  console.log(`  - Pattern B (same entity_key - unexpected): ${summary.walletsWithPatternB}`);
  console.log(`Migration Mode: ${summary.migrationMode}`);
  console.log('─'.repeat(60));
  
  // Print detailed analysis for duplicates
  if (walletsWithDuplicates.length > 0) {
    console.log('\n🔍 Detailed Analysis of Duplicates:');
    console.log('─'.repeat(60));
    
    // Sort by profile count (most duplicates first)
    walletsWithDuplicates.sort((a, b) => b.profileCount - a.profileCount);
    
    // Show top 10 wallets with most duplicates
    const topDuplicates = walletsWithDuplicates.slice(0, 10);
    for (const analysis of topDuplicates) {
      console.log(`\nWallet: ${analysis.wallet.slice(0, 10)}...${analysis.wallet.slice(-8)}`);
      console.log(`  Profile Count: ${analysis.profileCount}`);
      console.log(`  Unique Entity Keys: ${analysis.uniqueEntityKeys}`);
      console.log(`  Pattern: ${analysis.isPatternA ? 'Pattern A (different keys)' : analysis.isPatternB ? 'Pattern B (same key)' : 'Mixed'}`);
      console.log(`  Created At Range: ${analysis.createdAtRange.earliest} to ${analysis.createdAtRange.latest}`);
      if (analysis.lastActiveTimestampRange.latest) {
        console.log(`  Last Active Range: ${analysis.lastActiveTimestampRange.earliest || 'N/A'} to ${analysis.lastActiveTimestampRange.latest}`);
      }
      console.log(`  Entity Keys:`);
      analysis.profiles.forEach((p, idx) => {
        console.log(`    ${idx + 1}. ${p.key.slice(0, 12)}... (created: ${p.createdAt}, displayName: ${p.displayName})`);
      });
    }
    
    if (walletsWithDuplicates.length > 10) {
      console.log(`\n... and ${walletsWithDuplicates.length - 10} more wallets with duplicates`);
    }
  } else {
    console.log('\n✅ No duplicates found! All wallets have single canonical profiles.');
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  console.log('─'.repeat(60));
  
  if (walletsWithDuplicates.length > 0) {
    if (summary.migrationMode === 'off') {
      console.log('⚠️  Migration mode is OFF - new profiles still use Pattern A (create new entity on edit)');
      console.log('   → Consider enabling migration mode to use Pattern B (update existing entity)');
    } else if (summary.migrationMode === 'shadow') {
      console.log('⚠️  Migration mode is SHADOW - some wallets may not be migrated yet');
      console.log('   → Run consolidation script to merge duplicate profiles');
    } else if (summary.migrationMode === 'on') {
      console.log('✅ Migration mode is ON - new profiles use Pattern B');
      if (walletsWithDuplicates.length > 0) {
        console.log('   → Duplicates are likely from before migration (Pattern A entities)');
        console.log('   → Run consolidation script to merge them into canonical profiles');
      }
    }
    
    if (summary.walletsWithPatternA > 0) {
      console.log(`\n📋 ${summary.walletsWithPatternA} wallets have Pattern A duplicates (different entity_keys)`);
      console.log('   → These are from before Pattern B migration');
      console.log('   → Run: tsx scripts/consolidate-profiles.ts [--dry-run]');
    }
    
    if (summary.walletsWithPatternB > 0) {
      console.log(`\n⚠️  ${summary.walletsWithPatternB} wallets have Pattern B duplicates (same entity_key)`);
      console.log('   → This is unexpected - same entity_key should only have one profile');
      console.log('   → This might indicate an indexing issue or query bug');
    }
  } else {
    console.log('✅ All wallets have single canonical profiles - no action needed!');
  }
  
  return { summary, duplicates: walletsWithDuplicates };
}

// Run investigation
investigateDuplicates()
  .then(() => {
    console.log('\n✅ Investigation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Investigation failed:', error);
    process.exit(1);
  });

