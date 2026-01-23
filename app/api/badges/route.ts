/**
 * Badges API
 *
 * Handles badge operations: checking eligibility, issuing badges, and querying user badges.
 *
 * GET /api/badges?wallet=0x... - Get all badges for a user
 * GET /api/badges?wallet=0x...&badgeType=arkiv_builder - Get specific badge
 * POST /api/badges/check-eligibility - Check if user is eligible for a badge
 * POST /api/badges/issue - Issue a badge (server-side signing)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrivateKey } from '@/lib/config';
import {
  getUserBadges,
  getUserBadge,
  checkBadgeEligibility,
  issueBadge,
  type BadgeType,
} from '@/lib/arkiv/badge';

/**
 * GET - Retrieve badges for a user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet');
    const badgeType = searchParams.get('badgeType') as BadgeType | null;

    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: 'wallet is required' },
        { status: 400 }
      );
    }

    if (badgeType) {
      // Get specific badge
      const badge = await getUserBadge({ wallet, badgeType });
      return NextResponse.json({
        ok: true,
        badge: badge || null,
      });
    }

    // Get all badges
    const badges = await getUserBadges({ wallet });
    return NextResponse.json({
      ok: true,
      badges,
    });
  } catch (error: any) {
    console.error('[/api/badges GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to load badges' },
      { status: 500 }
    );
  }
}

/**
 * POST - Check eligibility or issue badge
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, wallet, questId, trackId, badgeType } = body;

    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: 'wallet is required' },
        { status: 400 }
      );
    }

    if (action === 'check-eligibility') {
      if (!questId || !trackId) {
        return NextResponse.json(
          { ok: false, error: 'questId and trackId are required' },
          { status: 400 }
        );
      }

      const eligibility = await checkBadgeEligibility({
        wallet,
        questId,
        trackId,
      });

      return NextResponse.json({
        ok: true,
        eligibility,
      });
    }

    if (action === 'issue') {
      if (!badgeType || !questId || !body.evidenceRefs) {
        return NextResponse.json(
          { ok: false, error: 'badgeType, questId, and evidenceRefs are required' },
          { status: 400 }
        );
      }

      // Get private key for server-side signing
      const privateKey = getPrivateKey();

      // questVersion from request body, or default to '1' for backward compatibility
      const questVersion = body.questVersion || '1';

      const result = await issueBadge({
        wallet,
        badgeType: badgeType as BadgeType,
        questId,
        questVersion,
        evidenceRefs: body.evidenceRefs,
        privateKey,
      });

      return NextResponse.json({
        ok: true,
        key: result.key,
        txHash: result.txHash,
      });
    }

    return NextResponse.json(
      { ok: false, error: 'Invalid action. Use "check-eligibility" or "issue"' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[/api/badges POST] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to process badge request' },
      { status: 500 }
    );
  }
}
