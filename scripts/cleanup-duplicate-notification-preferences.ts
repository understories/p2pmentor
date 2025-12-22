/**
 * Cleanup Duplicate Notification Preferences
 *
 * This script verifies and reports on duplicate notification_preference entities.
 * The deduplication logic in listNotificationPreferences already handles duplicates
 * by keeping the most recent preference per (wallet, notificationId).
 *
 * This script:
 * 1. Finds all wallets with duplicate preferences (same wallet + notificationId)
 * 2. Reports on the duplicates (for verification)
 * 3. Verifies that the deduplication logic is working correctly
 *
 * Note: No cleanup needed - the deduplication in listNotificationPreferences
 * already ensures only the most recent preference is returned. Old duplicates
 * remain on-chain (immutable) but are ignored by queries.
 *
 * Usage:
 *   tsx scripts/cleanup-duplicate-notification-preferences.ts [--wallet=<address>]
 *
 * Options:
 *   --wallet=<address>: Check specific wallet only
 */

import 'dotenv/config';
import { getPublicClient } from '../lib/arkiv/client';
import { eq } from '@arkiv-network/sdk/query';
import { SPACE_ID } from '../lib/config';

interface DuplicateSet {
  wallet: string;
  notificationId: string;
  totalCount: number;
  canonical: {
    key: string;
    read: boolean;
    archived: boolean;
    updatedAt: string;
  };
  duplicates: Array<{
    key: string;
    read: boolean;
    archived: boolean;
    updatedAt: string;
  }>;
}

/**
 * Find all wallets with duplicate notification preferences
 * Queries raw entities to see duplicates before deduplication
 */
async function findDuplicatePreferences(spaceId: string = SPACE_ID): Promise<Map<string, DuplicateSet[]>> {
  console.log('[findDuplicatePreferences] Finding duplicate preferences...');
  
  // Query raw entities (bypass deduplication to see all)
  const publicClient = getPublicClient();
  const result = await publicClient.buildQuery()
    .where(eq('type', 'notification_preference'))
    .where(eq('spaceId', spaceId))
    .withAttributes(true)
    .withPayload(true)
    .limit(10000)
    .fetch();

  if (!result?.entities || !Array.isArray(result.entities)) {
    return new Map();
  }

  // Parse all preferences
  const allPreferences = result.entities.map((entity: any) => {
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

    return {
      key: entity.key,
      wallet: getAttr('wallet'),
      notificationId: getAttr('notificationId'),
      read: getAttr('read') === 'true' || payload.read === true,
      archived: getAttr('archived') === 'true' || payload.archived === true,
      updatedAt: getAttr('updatedAt') || payload.updatedAt || getAttr('createdAt') || payload.createdAt,
      createdAt: getAttr('createdAt') || payload.createdAt,
    };
  });

  // Group by (wallet, notificationId)
  const preferenceGroups = new Map<string, typeof allPreferences>();
  allPreferences.forEach(pref => {
    const key = `${pref.wallet.toLowerCase()}:${pref.notificationId}`;
    if (!preferenceGroups.has(key)) {
      preferenceGroups.set(key, []);
    }
    preferenceGroups.get(key)!.push(pref);
  });

  // Find duplicates (groups with more than 1 preference)
  const duplicates = new Map<string, DuplicateSet[]>();
  
  for (const [groupKey, prefs] of preferenceGroups.entries()) {
    if (prefs.length > 1) {
      // Sort by updatedAt descending to find canonical (most recent)
      const sorted = [...prefs].sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      
      const canonical = sorted[0];
      const duplicateKeys = sorted.slice(1).map(p => ({
        key: p.key,
        read: p.read,
        archived: p.archived,
        updatedAt: p.updatedAt,
      }));

      const wallet = canonical.wallet.toLowerCase();
      if (!duplicates.has(wallet)) {
        duplicates.set(wallet, []);
      }

      duplicates.get(wallet)!.push({
        wallet: canonical.wallet,
        notificationId: canonical.notificationId,
        totalCount: prefs.length,
        canonical: {
          key: canonical.key,
          read: canonical.read,
          archived: canonical.archived,
          updatedAt: canonical.updatedAt,
        },
        duplicates: duplicateKeys,
      });
    }
  }

  console.log(`[findDuplicatePreferences] Found ${duplicates.size} wallets with duplicate preferences`);
  return duplicates;
}

/**
 * Report on duplicates for a single wallet
 */
async function reportWalletDuplicates(
  wallet: string,
  duplicateSets: DuplicateSet[],
  spaceId: string = SPACE_ID
): Promise<{ verified: number; issues: number }> {
  const normalizedWallet = wallet.toLowerCase();
  const { listNotificationPreferences } = await import('../lib/arkiv/notificationPreferences');

  let verified = 0;
  let issues = 0;

  console.log(`\n[reportWalletDuplicates] Wallet ${normalizedWallet}: ${duplicateSets.length} duplicate sets`);

  for (const duplicateSet of duplicateSets) {
    try {
      // Verify that listNotificationPreferences returns the canonical preference
      const deduplicated = await listNotificationPreferences({
        wallet: normalizedWallet,
        notificationId: duplicateSet.notificationId,
        spaceId,
        limit: 1,
      });

      if (deduplicated.length > 0) {
        const returned = deduplicated[0];
        
        if (returned.key === duplicateSet.canonical.key) {
          // ✅ Deduplication working correctly
          console.log(`  ✅ ${duplicateSet.notificationId}: Canonical found (${duplicateSet.totalCount} total, ${duplicateSet.duplicates.length} duplicates ignored)`);
          verified++;
        } else {
          // ⚠️ Deduplication returned different preference
          console.warn(`  ⚠️ ${duplicateSet.notificationId}: Expected canonical ${duplicateSet.canonical.key}, got ${returned.key}`);
          console.warn(`     Total duplicates: ${duplicateSet.totalCount}`);
          issues++;
        }
      } else {
        // ⚠️ No preference returned (shouldn't happen if canonical exists)
        console.warn(`  ⚠️ ${duplicateSet.notificationId}: No preference returned (expected canonical ${duplicateSet.canonical.key})`);
        issues++;
      }
    } catch (err: any) {
      console.error(`  ❌ ${duplicateSet.notificationId}: Error verifying - ${err.message}`);
      issues++;
    }
  }

  return { verified, issues };
}

/**
 * Main verification function
 */
async function verifyDuplicates(options: {
  wallet?: string;
  spaceId?: string;
} = {}) {
  const { wallet, spaceId = SPACE_ID } = options;

  console.log('[verifyDuplicates] Starting verification...');
  console.log(`  SpaceId: ${spaceId}`);
  if (wallet) {
    console.log(`  Wallet: ${wallet}`);
  }

  try {
    // Find all duplicates
    const allDuplicates = await findDuplicatePreferences(spaceId);

    // Filter by wallet if specified
    const walletsToCheck = wallet 
      ? [wallet.toLowerCase()]
      : Array.from(allDuplicates.keys());

    if (walletsToCheck.length === 0) {
      console.log('\n[verifyDuplicates] No duplicates found! ✅');
      return;
    }

    let totalVerified = 0;
    let totalIssues = 0;
    let totalDuplicateSets = 0;

    for (const walletToCheck of walletsToCheck) {
      const duplicateSets = allDuplicates.get(walletToCheck) || [];
      
      if (duplicateSets.length === 0) {
        console.log(`\n[verifyDuplicates] Wallet ${walletToCheck}: No duplicates found ✅`);
        continue;
      }

      totalDuplicateSets += duplicateSets.length;
      const result = await reportWalletDuplicates(
        walletToCheck,
        duplicateSets,
        spaceId
      );

      totalVerified += result.verified;
      totalIssues += result.issues;
    }

    console.log('\n[verifyDuplicates] Summary:');
    console.log(`  Wallets checked: ${walletsToCheck.length}`);
    console.log(`  Duplicate sets found: ${totalDuplicateSets}`);
    console.log(`  ✅ Verified (deduplication working): ${totalVerified}`);
    console.log(`  ⚠️ Issues: ${totalIssues}`);

    if (totalIssues === 0) {
      console.log('\n✅ All duplicates are handled correctly by deduplication logic!');
      console.log('  Future updates will use Pattern B (updateEntity) with canonical keys');
      console.log('  Old duplicate entities remain on-chain (immutable) but are ignored by queries');
    } else {
      console.log('\n⚠️ Some issues found. Review the warnings above.');
    }
  } catch (error: any) {
    console.error('[verifyDuplicates] Error:', error);
    process.exit(1);
  }
}

// CLI
const args = process.argv.slice(2);
const walletArg = args.find(arg => arg.startsWith('--wallet='));
const wallet = walletArg ? walletArg.split('=')[1] : undefined;

verifyDuplicates({ wallet })
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

