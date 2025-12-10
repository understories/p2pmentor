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

    // Return preview data (without creating new profile)
    return NextResponse.json({
      ok: true,
      hasHistory: true,
      history: {
        latestProfile: {
          displayName: history.latestProfile.displayName,
          username: history.latestProfile.username,
          bio: history.latestProfile.bio,
          bioShort: history.latestProfile.bioShort,
          skills: history.latestProfile.skills,
          skillsArray: history.latestProfile.skillsArray,
          timezone: history.latestProfile.timezone,
        },
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
 * NOTE: For beta, regrowth happens client-side.
 * This endpoint returns the candidate profile data for client-side creation.
 * 
 * Body: { wallet: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet } = body;

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

    // Return candidate profile data for client-side creation
    // Client will use createUserProfileClient() to create the new profile
    const candidate = {
      displayName: history.latestProfile.displayName,
      username: history.latestProfile.username,
      profileImage: history.latestProfile.profileImage,
      bio: history.latestProfile.bio,
      bioShort: history.latestProfile.bioShort,
      bioLong: history.latestProfile.bioLong,
      skills: history.latestProfile.skills,
      skillsArray: history.latestProfile.skillsArray,
      timezone: history.latestProfile.timezone || 'UTC',
      languages: history.latestProfile.languages,
      contactLinks: history.latestProfile.contactLinks,
      seniority: history.latestProfile.seniority,
      domainsOfInterest: history.latestProfile.domainsOfInterest,
      mentorRoles: history.latestProfile.mentorRoles,
      learnerRoles: history.latestProfile.learnerRoles,
      availabilityWindow: history.latestProfile.availabilityWindow,
    };

    return NextResponse.json({
      ok: true,
      status: 'candidate-ready',
      candidateProfile: candidate,
      sourceProfiles: history.profileIds,
      lastSeenAt: history.lastSeenAt,
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

