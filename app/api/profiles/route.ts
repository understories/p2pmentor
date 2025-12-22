/**
 * Profiles API route
 *
 * Handles profile listing with optional filters.
 *
 * Based on mentor-graph implementation, adapted for Next.js App Router.
 *
 * Reference: refs/mentor-graph/pages/api/profiles.ts
 */

import { NextResponse } from 'next/server';
import { listUserProfiles } from '@/lib/arkiv/profile';
import { SPACE_ID } from '@/lib/config';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skill = searchParams.get('skill') || undefined;
    const seniority = searchParams.get('seniority') || undefined;
    const includeArchived = searchParams.get('includeArchived') === 'true';

    // Check if builder mode is enabled (from query param)
    const builderMode = searchParams.get('builderMode') === 'true';

    // Get spaceId(s) from query params or use default
    const spaceIdParam = searchParams.get('spaceId');
    const spaceIdsParam = searchParams.get('spaceIds');

    let spaceId: string | undefined;
    let spaceIds: string[] | undefined;

    if (builderMode && spaceIdsParam) {
      // Builder mode: query multiple spaceIds
      spaceIds = spaceIdsParam.split(',').map(s => s.trim());
    } else if (spaceIdParam) {
      // Override default spaceId
      spaceId = spaceIdParam;
    } else {
      // Use default from config
      spaceId = SPACE_ID;
    }

    // List all profiles with optional filters
    console.log('[Profiles API] Querying profiles:', {
      skill,
      seniority,
      spaceId,
      spaceIds,
      builderMode,
      SPACE_ID,
    });

    const allProfiles = await listUserProfiles({
      skill,
      seniority,
      spaceId,
      spaceIds,
    });

    console.log('[Profiles API] Profiles returned from listUserProfiles:', {
      count: allProfiles.length,
      wallets: allProfiles.slice(0, 5).map(p => p.wallet),
    });

    // Get unique profiles by wallet (most recent for each wallet)
    // CRITICAL: With Pattern B (update in place), createdAt doesn't change on updates.
    // Use lastActiveTimestamp instead, which is updated on each profile update.
    // Fallback to createdAt if lastActiveTimestamp not available (legacy profiles).
    const profilesMap = new Map<string, typeof allProfiles[0]>();
    const profileCountsByWallet = new Map<string, number>();

    allProfiles.forEach((profile) => {
      const wallet = profile.wallet.toLowerCase();
      // Count profiles per wallet (for migration metrics)
      profileCountsByWallet.set(wallet, (profileCountsByWallet.get(wallet) || 0) + 1);

      // Keep most recent profile for each wallet
      // Use lastActiveTimestamp (updated on each update) or fallback to createdAt
      const existing = profilesMap.get(wallet);
      if (!existing) {
        profilesMap.set(wallet, profile);
      } else {
        // Compare timestamps: prefer lastActiveTimestamp, fallback to createdAt
        const profileTime = profile.lastActiveTimestamp 
          ? new Date(profile.lastActiveTimestamp).getTime()
          : (profile.createdAt ? new Date(profile.createdAt).getTime() : 0);
        const existingTime = existing.lastActiveTimestamp
          ? new Date(existing.lastActiveTimestamp).getTime()
          : (existing.createdAt ? new Date(existing.createdAt).getTime() : 0);
        
        if (profileTime > existingTime) {
          profilesMap.set(wallet, profile);
        }
      }
    });

    const uniqueProfiles = Array.from(profilesMap.values());

    // Add profile count to each profile (for display on /profiles page)
    const profilesWithCounts = uniqueProfiles.map(profile => ({
      ...profile,
      profileCount: profileCountsByWallet.get(profile.wallet.toLowerCase()) || 1,
    }));

    // Skip existence checks to avoid rate limiting (429 errors)
    // Profiles returned from listUserProfiles are already valid
    // If a profile can't be loaded, the detail page will handle it gracefully
    const activeProfiles = uniqueProfiles;
    const archivedProfiles: typeof uniqueProfiles = [];

    console.log('[Profiles API] Skipping existence checks to avoid rate limiting:', {
      totalProfiles: uniqueProfiles.length,
      note: 'Existence checks were causing 429 rate limit errors. Profiles are validated when accessed.',
    });

    // Calculate migration metrics
    const walletsWithMultipleProfiles = Array.from(profileCountsByWallet.entries())
      .filter(([_, count]) => count > 1)
      .length;
    const walletsWithSingleProfile = Array.from(profileCountsByWallet.entries())
      .filter(([_, count]) => count === 1)
      .length;
    const totalWallets = profileCountsByWallet.size;
    const percentCanonical = totalWallets > 0
      ? Math.round((walletsWithSingleProfile / totalWallets) * 100)
      : 100;

    // Log migration metrics (for observability)
    console.log('[Profiles API] Migration metrics:', {
      totalWallets,
      walletsWithSingleProfile,
      walletsWithMultipleProfiles,
      percentCanonical: `${percentCanonical}%`,
    });

    return NextResponse.json({
      ok: true,
      profiles: profilesWithCounts,
      archived: includeArchived ? archivedProfiles : undefined,
      stats: {
        total: uniqueProfiles.length,
        active: activeProfiles.length,
        archived: archivedProfiles.length,
      },
      migrationMetrics: {
        totalWallets,
        walletsWithSingleProfile,
        walletsWithMultipleProfiles,
        percentCanonical,
      },
    });
  } catch (error: any) {
    console.error('Profiles API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


