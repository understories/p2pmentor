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
    const profilesMap = new Map<string, typeof allProfiles[0]>();
    allProfiles.forEach((profile) => {
      const existing = profilesMap.get(profile.wallet);
      if (!existing || (profile.createdAt && existing.createdAt && new Date(profile.createdAt) > new Date(existing.createdAt))) {
        profilesMap.set(profile.wallet, profile);
      }
    });

    const uniqueProfiles = Array.from(profilesMap.values());

    // Skip existence checks to avoid rate limiting (429 errors)
    // Profiles returned from listUserProfiles are already valid
    // If a profile can't be loaded, the detail page will handle it gracefully
    const activeProfiles = uniqueProfiles;
    const archivedProfiles: typeof uniqueProfiles = [];

    console.log('[Profiles API] Skipping existence checks to avoid rate limiting:', {
      totalProfiles: uniqueProfiles.length,
      note: 'Existence checks were causing 429 rate limit errors. Profiles are validated when accessed.',
    });

    return NextResponse.json({
      ok: true,
      profiles: activeProfiles,
      archived: includeArchived ? archivedProfiles : undefined,
      stats: {
        total: uniqueProfiles.length,
        active: activeProfiles.length,
        archived: archivedProfiles.length,
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


