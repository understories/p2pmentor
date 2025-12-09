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
    const [sessions, userAsks, allAsks, allOffers, allProfiles, adminResponses] = await Promise.all([
      listSessionsForWallet(wallet),
      listAsksForWallet(wallet),
      listAsks(),
      listOffers(),
      listUserProfiles(),
      listAdminResponses({ wallet }), // Admin responses for this user
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        sessions,
        userAsks,
        allAsks,
        allOffers,
        allProfiles,
        adminResponses,
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

