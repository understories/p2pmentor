/**
 * Assessment Result API route
 *
 * Handles fetching assessment results for users.
 *
 * Reference: docs/betadocs/arkiv/learner-quests.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAssessmentResult } from '@/lib/arkiv/assessmentResult';
import { verifyBetaAccess } from '@/lib/auth/betaAccess';

/**
 * GET /api/learner-quests/assessment/result
 *
 * Fetch assessment result for a user
 * Query params: questId (required), wallet (required)
 */
export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url);
    const questId = searchParams.get('questId');
    const wallet = searchParams.get('wallet');

    if (!questId || !wallet) {
      return NextResponse.json(
        { ok: false, error: 'Missing required query parameters: questId, wallet' },
        { status: 400 }
      );
    }

    const result = await getAssessmentResult({
      wallet: wallet.toLowerCase(),
      questId,
    });

    if (!result) {
      return NextResponse.json(
        { ok: false, error: 'No assessment result found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    console.error('[learner-quests/assessment/result] GET error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch assessment result' },
      { status: 500 }
    );
  }
}

