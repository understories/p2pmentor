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
import { listUserProfiles, checkProfileExistence } from '@/lib/arkiv/profile';
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
    const allProfiles = await listUserProfiles({
      skill,
      seniority,
      spaceId,
      spaceIds,
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

    // Check which profiles are loadable (empirical query method)
    // Only check if not including archived (to save API calls)
    let activeProfiles: typeof uniqueProfiles = [];
    let archivedProfiles: typeof uniqueProfiles = [];

    if (!includeArchived) {
      // Check loadability for each profile (in parallel, but with reasonable concurrency)
      // Use Promise.allSettled to handle individual failures gracefully
      const existenceChecks = await Promise.allSettled(
        uniqueProfiles.map(async (profile) => {
          try {
            const check = await checkProfileExistence(profile.wallet);
            return { profile, check, success: true };
          } catch (error) {
            // If check fails, assume profile is loadable (fail open)
            return { profile, check: { exists: true, loadable: true, profile: null }, success: false };
          }
        })
      );

      // Process results
      existenceChecks.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.success) {
          const { profile, check } = result.value;
          if (check.loadable) {
            activeProfiles.push(profile);
          } else if (check.exists) {
            archivedProfiles.push(profile);
          }
        } else if (result.status === 'fulfilled' && !result.value.success) {
          // Fail open: if check fails, include in active
          activeProfiles.push(result.value.profile);
        }
      });
    } else {
      // Include all profiles when archived is requested
      activeProfiles = uniqueProfiles;
    }

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


