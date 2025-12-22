/**
 * API Route: Get profile version history
 * 
 * Fetches all versions/transactions for a profile entity.
 * Since profiles use Pattern B (update in place), we need to:
 * 1. Get the current profile to get its entity_key
 * 2. Query all profile entities for that wallet (includes old Pattern A entities)
 * 3. Also try to get transaction history from Arkiv Explorer if available
 * 
 * Returns all profile versions sorted by creation time.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProfileByWallet, listUserProfilesForWallet } from '@/lib/arkiv/profile';
import { SPACE_ID } from '@/lib/config';
import { ARKIV_EXPLORER_BASE_URL } from '@/lib/arkiv/explorer';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ wallet: string }> }
) {
  try {
    const params = await context.params;
    const wallet = params.wallet?.toLowerCase().trim();
    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Get current profile to get entity_key
    const currentProfile = await getProfileByWallet(wallet);
    if (!currentProfile) {
      return NextResponse.json(
        { ok: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Query all profile entities for this wallet
    // This will include:
    // - Current canonical entity (Pattern B)
    // - Old entities from before migration (Pattern A)
    const allProfiles = await listUserProfilesForWallet(wallet, SPACE_ID);

    // Sort by createdAt descending (most recent first)
    const sortedProfiles = allProfiles.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    // Build version history with entity data
    const versions = sortedProfiles.map((profile, index) => {
      // Determine if this is the current version
      const isCurrent = profile.key === currentProfile.key;

      return {
        version: sortedProfiles.length - index, // Version number (1 = oldest, N = newest)
        isCurrent,
        entityKey: profile.key,
        txHash: profile.txHash,
        createdAt: profile.createdAt,
        updatedAt: profile.createdAt, // For Pattern A, createdAt is the update time
        displayName: profile.displayName,
        username: profile.username,
        bioShort: profile.bioShort,
        skills: profile.skillsArray || [],
        languages: profile.languages || [],
        explorerUrl: `${ARKIV_EXPLORER_BASE_URL}/entity/${profile.key}`,
        txExplorerUrl: profile.txHash ? `${ARKIV_EXPLORER_BASE_URL}/tx/${profile.txHash}` : null,
      };
    });

    return NextResponse.json({
      ok: true,
      wallet,
      currentEntityKey: currentProfile.key,
      versions,
      totalVersions: versions.length,
    });
  } catch (error: any) {
    console.error('[GET /api/profiles/[wallet]/versions] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch version history' },
      { status: 500 }
    );
  }
}

