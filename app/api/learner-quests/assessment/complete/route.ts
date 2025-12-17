/**
 * Assessment Complete API route
 *
 * Handles completion of language assessments and creates result entities.
 *
 * Reference: docs/betadocs/arkiv/learner-quests.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { completeAssessment } from '@/lib/arkiv/assessmentResult';
import { getPrivateKey, SPACE_ID } from '@/lib/config';
import { verifyBetaAccess } from '@/lib/auth/betaAccess';

/**
 * POST /api/learner-quests/assessment/complete
 *
 * Complete assessment and create result entity
 * Body: { wallet, questId, startedAt }
 */
export async function POST(request: NextRequest) {
  // Verify beta access
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
    const { wallet, questId, startedAt } = body;

    if (!wallet || !questId || !startedAt) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: wallet, questId, startedAt' },
        { status: 400 }
      );
    }

    // Use server-side private key for entity creation
    const privateKey = getPrivateKey();
    if (!privateKey) {
      return NextResponse.json(
        { ok: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const result = await completeAssessment({
      wallet: wallet.toLowerCase(),
      questId,
      startedAt,
      privateKey,
      spaceId: SPACE_ID,
    });

    if (!result) {
      return NextResponse.json(
        { ok: false, error: 'Failed to complete assessment' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      result: {
        key: result.key,
        txHash: result.txHash,
        result: result.result,
      },
    });
  } catch (error: any) {
    console.error('[learner-quests/assessment/complete] POST error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to complete assessment' },
      { status: 500 }
    );
  }
}

