/**
 * Learner Quest Progress API route
 *
 * Handles user progress fetching for quests.
 *
 * Reference: refs/learner-quests-implementation-plan.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLearnerQuestProgress } from '@/lib/arkiv/learnerQuest';
import { verifyBetaAccess } from '@/lib/auth/betaAccess';

/**
 * GET /api/learner-quests/progress
 *
 * Fetch user progress for a quest
 * Query params: questId (default: 'web3privacy_foundations'), wallet (required)
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
    const questId = searchParams.get('questId') || 'web3privacy_foundations';
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: 'Wallet required' },
        { status: 400 }
      );
    }

    const progress = await getLearnerQuestProgress({
      wallet: wallet.toLowerCase(),
      questId,
    });

    return NextResponse.json({ ok: true, progress });
  } catch (error: any) {
    console.error('[learner-quests/progress] GET error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}

