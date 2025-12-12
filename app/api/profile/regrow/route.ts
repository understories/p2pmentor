/**
 * Profile Regrowth API
 * 
 * Beta: Regrow profiles from historical Arkiv data.
 * 
 * Based on profile_stability.md - Beta Launch Plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchHistoricalProfileData } from '@/lib/arkiv/profileRegrowth';

/**
 * GET /api/profile/regrow?wallet=0x...
 * 
 * Check if historical profile data exists for a wallet.
 * Returns preview data for regrowth.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Fetch historical profile data
    const history = await fetchHistoricalProfileData(wallet);

    if (!history) {
      return NextResponse.json({
        ok: true,
        hasHistory: false,
        message: 'No historical profile data found',
      });
    }

    // Day 2: Return all historical profiles for browsing
    return NextResponse.json({
      ok: true,
      hasHistory: true,
      history: {
        latestProfile: {
          key: history.latestProfile.key,
          displayName: history.latestProfile.displayName,
          username: history.latestProfile.username,
          bio: history.latestProfile.bio,
          bioShort: history.latestProfile.bioShort,
          skills: history.latestProfile.skills,
          skillsArray: history.latestProfile.skillsArray,
          timezone: history.latestProfile.timezone,
          createdAt: history.latestProfile.createdAt,
        },
        // Day 2: Return all profiles for browsing
        allProfiles: history.allProfiles.map(p => ({
          key: p.key,
          displayName: p.displayName,
          username: p.username,
          bio: p.bio,
          bioShort: p.bioShort,
          skills: p.skills,
          skillsArray: p.skillsArray,
          timezone: p.timezone,
          createdAt: p.createdAt,
          profileImage: p.profileImage,
        })),
        profileCount: history.profileCount,
        firstSeenAt: history.firstSeenAt,
        lastSeenAt: history.lastSeenAt,
        profileIds: history.profileIds,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/profile/regrow] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch historical data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profile/regrow
 * 
 * Day 2: Returns candidate profile data for a specific historical profile.
 * 
 * NOTE: For beta, regrowth happens client-side.
 * This endpoint returns the candidate profile data for client-side creation.
 * 
 * Body: { wallet: string, profileId?: string }
 *   - profileId: Optional. If provided, regrow from that specific profile.
 *                If not provided, uses the latest profile.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, profileId } = body;

    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Fetch historical profile data
    const history = await fetchHistoricalProfileData(wallet);

    if (!history) {
      return NextResponse.json({
        ok: false,
        error: 'No historical profile data found',
        status: 'no-history',
      });
    }

    // Day 2: Select specific profile if provided, otherwise use latest
    let selectedProfile: typeof history.latestProfile;
    if (profileId) {
      const foundProfile = history.allProfiles.find(p => p.key === profileId);
      if (!foundProfile) {
        return NextResponse.json({
          ok: false,
          error: `Profile with ID ${profileId} not found in history`,
          status: 'profile-not-found',
        });
      }
      selectedProfile = foundProfile;
    } else {
      selectedProfile = history.latestProfile;
    }

    // Return candidate profile data for client-side creation
    // Client will use /api/profile API route to create the new profile (uses server-side signing wallet)
    const candidate = {
      displayName: selectedProfile.displayName,
      username: selectedProfile.username,
      profileImage: selectedProfile.profileImage,
      bio: selectedProfile.bio,
      bioShort: selectedProfile.bioShort,
      bioLong: selectedProfile.bioLong,
      skills: selectedProfile.skills,
      skillsArray: selectedProfile.skillsArray,
      timezone: selectedProfile.timezone || 'UTC',
      languages: selectedProfile.languages,
      contactLinks: selectedProfile.contactLinks,
      seniority: selectedProfile.seniority,
      domainsOfInterest: selectedProfile.domainsOfInterest,
      mentorRoles: selectedProfile.mentorRoles,
      learnerRoles: selectedProfile.learnerRoles,
      availabilityWindow: selectedProfile.availabilityWindow,
    };

    return NextResponse.json({
      ok: true,
      status: 'candidate-ready',
      candidateProfile: candidate,
      sourceProfileId: selectedProfile.key, // Day 2: Track which profile was selected
      sourceProfiles: history.profileIds,
      lastSeenAt: selectedProfile.createdAt || history.lastSeenAt,
      message: 'Candidate profile data ready for client-side creation',
    });
  } catch (error: any) {
    console.error('[POST /api/profile/regrow] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to prepare regrowth candidate' },
      { status: 500 }
    );
  }
}

