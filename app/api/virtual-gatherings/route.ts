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
  listRsvpWalletsForGathering,
} from '@/lib/arkiv/virtualGathering';
import { getPrivateKey, CURRENT_WALLET, SPACE_ID } from '@/lib/config';

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
    const gatheringKey = searchParams.get('gatheringKey') || undefined; // For getting RSVP wallets for a specific gathering

    // If gatheringKey is provided, return RSVP wallets for that gathering
    if (gatheringKey) {
      // Get the gathering to get its spaceId for accurate filtering
      const gatherings = await listVirtualGatherings({ limit: 1000 });
      const gathering = gatherings.find(g => g.key === gatheringKey);
      const spaceId = gathering?.spaceId || SPACE_ID;
      
      const rsvpWallets = await listRsvpWalletsForGathering(gatheringKey, spaceId);
      return NextResponse.json({
        ok: true,
        rsvpWallets,
        count: rsvpWallets.length,
      });
    }

    const gatherings = await listVirtualGatherings({
      community,
      organizerWallet,
      limit: 100,
    });

    // If wallet provided, check RSVP status for each gathering
    // CRITICAL: Use each gathering's spaceId for accurate filtering
    let rsvpStatus: Record<string, boolean> = {};
    if (wallet) {
      const rsvpPromises = gatherings.map(async (gathering) => {
        const hasRsvpd = await hasRsvpdToGathering(gathering.key, wallet, gathering.spaceId);
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
  // Verify beta access
  const { verifyBetaAccess } = await import('@/lib/auth/betaAccess');
  const betaCheck = await verifyBetaAccess(request, {
    requireArkivValidation: false, // Fast path - cookies are sufficient
  });

  if (!betaCheck.hasAccess) {
    return NextResponse.json(
      { ok: false, error: betaCheck.error || 'Beta access required. Please enter invite code at /beta' },
      { status: 403 }
    );
  }
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

      // Ensure duration is always an integer to prevent BigInt conversion errors
      const durationInt = duration !== undefined && duration !== null 
        ? Math.floor(typeof duration === 'number' ? duration : parseInt(String(duration), 10) || 60)
        : 60;

      const privateKey = getPrivateKey();
      const { key, txHash } = await createVirtualGathering({
        organizerWallet,
        community,
        title,
        description,
        sessionDate,
        duration: durationInt,
        privateKey,
      });

      // Create user-focused notification
      if (key) {
        try {
          const { createNotification } = await import('@/lib/arkiv/notifications');
          await createNotification({
            wallet: organizerWallet.toLowerCase(),
            notificationType: 'entity_created',
            sourceEntityType: 'virtual_gathering',
            sourceEntityKey: key,
            title: 'Community Gathering Created',
            message: `You created a community gathering: "${title}"`,
            link: `/topic/${community}`,
            metadata: {
              gatheringKey: key,
              community: community,
              title: title,
              sessionDate: sessionDate,
            },
            privateKey: getPrivateKey(),
          });
        } catch (notifError) {
          console.error('Failed to create notification for virtual gathering:', notifError);
        }
      }

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

      // Get the gathering to get its spaceId for accurate filtering
      const gatherings = await listVirtualGatherings({ limit: 1000 });
      const gathering = gatherings.find(g => g.key === gatheringKey);
      if (!gathering) {
        return NextResponse.json(
          { ok: false, error: 'Gathering not found' },
          { status: 404 }
        );
      }

      // Check if user has already RSVP'd (prevent duplicates)
      // CRITICAL: Use the gathering's spaceId to ensure we check the correct environment
      const hasRsvpd = await hasRsvpdToGathering(gatheringKey, wallet, gathering.spaceId);
      if (hasRsvpd) {
        return NextResponse.json(
          { ok: false, error: 'You have already RSVP\'d to this gathering' },
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
