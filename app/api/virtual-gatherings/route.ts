/**
 * Virtual Gatherings API route
 * 
 * Handles creation and listing of community virtual gatherings.
 * 
 * Features:
 * - Public gatherings (anyone can suggest, anyone can RSVP)
 * - Jitsi generated immediately (no confirmation needed)
 * - All data stored on Arkiv
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  createVirtualGathering, 
  listVirtualGatherings,
  rsvpToGathering,
  hasRsvpdToGathering,
} from '@/lib/arkiv/virtualGathering';
import { getPrivateKey, CURRENT_WALLET } from '@/lib/config';

/**
 * GET /api/virtual-gatherings
 * 
 * List virtual gatherings
 * Query params: community, organizerWallet
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const community = searchParams.get('community') || undefined;
    const organizerWallet = searchParams.get('organizerWallet') || undefined;
    const wallet = searchParams.get('wallet') || undefined; // For checking RSVP status

    const gatherings = await listVirtualGatherings({
      community,
      organizerWallet,
      limit: 100,
    });

    // If wallet provided, check RSVP status for each gathering
    let rsvpStatus: Record<string, boolean> = {};
    if (wallet) {
      const rsvpPromises = gatherings.map(async (gathering) => {
        const hasRsvpd = await hasRsvpdToGathering(gathering.key, wallet);
        return { key: gathering.key, hasRsvpd };
      });
      const rsvpResults = await Promise.all(rsvpPromises);
      rsvpStatus = rsvpResults.reduce((acc, { key, hasRsvpd }) => {
        acc[key] = hasRsvpd;
        return acc;
      }, {} as Record<string, boolean>);
    }

    return NextResponse.json({
      ok: true,
      gatherings,
      rsvpStatus,
      count: gatherings.length,
    });
  } catch (error: any) {
    console.error('[api/virtual-gatherings] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch virtual gatherings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/virtual-gatherings
 * 
 * Create a virtual gathering or RSVP to one
 * Body: { action: 'create' | 'rsvp', ... }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const { organizerWallet, community, title, description, sessionDate, duration } = body;

      if (!organizerWallet || !community || !title || !sessionDate) {
        return NextResponse.json(
          { ok: false, error: 'organizerWallet, community, title, and sessionDate are required' },
          { status: 400 }
        );
      }

      const privateKey = getPrivateKey();
      const { key, txHash } = await createVirtualGathering({
        organizerWallet,
        community,
        title,
        description,
        sessionDate,
        duration,
        privateKey,
      });

      return NextResponse.json({
        ok: true,
        gathering: {
          key,
          txHash,
        },
      });
    } else if (action === 'rsvp') {
      const { gatheringKey, wallet } = body;

      if (!gatheringKey || !wallet) {
        return NextResponse.json(
          { ok: false, error: 'gatheringKey and wallet are required' },
          { status: 400 }
        );
      }

      const privateKey = getPrivateKey();
      const { key, txHash } = await rsvpToGathering({
        gatheringKey,
        wallet,
        privateKey,
      });

      return NextResponse.json({
        ok: true,
        rsvp: {
          key,
          txHash,
        },
      });
    } else {
      return NextResponse.json(
        { ok: false, error: 'Invalid action. Use "create" or "rsvp"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[api/virtual-gatherings] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
