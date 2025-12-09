/**
 * Notifications API route
 * 
 * Fetches data needed for notification detection.
 * Client-side will poll this endpoint and detect new items.
 */

import { NextResponse } from 'next/server';
import { listSessionsForWallet } from '@/lib/arkiv/sessions';
import { listAsks, listAsksForWallet } from '@/lib/arkiv/asks';
import { listOffers } from '@/lib/arkiv/offers';
import { listUserProfiles } from '@/lib/arkiv/profile';
import { listAdminResponses } from '@/lib/arkiv/adminResponse';
import { listAppFeedback } from '@/lib/arkiv/appFeedback';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    
    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: 'Wallet parameter is required' },
        { status: 400 }
      );
    }

    // Fetch all data needed for notification detection
    const [sessions, userAsks, allAsks, allOffers, allProfiles, adminResponses, userFeedback] = await Promise.all([
      listSessionsForWallet(wallet),
      listAsksForWallet(wallet),
      listAsks(),
      listOffers(),
      listUserProfiles(),
      listAdminResponses({ wallet }), // Admin responses for this user
      listAppFeedback({ wallet }), // User's feedback/issues
    ]);

    // Filter for resolved issues only
    const resolvedIssues = userFeedback.filter(f => f.feedbackType === 'issue' && f.resolved);

    return NextResponse.json({
      ok: true,
      data: {
        sessions,
        userAsks,
        allAsks,
        allOffers,
        allProfiles,
        adminResponses,
        resolvedIssues, // Resolved issues for notification detection
      },
    });
  } catch (error: any) {
    console.error('Notifications API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

