/**
 * Meta-Learning Quest Completion API route
 *
 * Handles completion status checking for meta-learning quest.
 *
 * Reference: refs/meta-learning-quest-implementation-plan.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkMetaLearningCompletion } from '@/lib/arkiv/metaLearningQuest';
import { verifyBetaAccess } from '@/lib/auth/betaAccess';

/**
 * GET /api/learner-quests/meta-learning/completion
 *
 * Check completion status for meta-learning quest
 * Query params: wallet (required), questId (optional, defaults to meta_learning), targetKey (optional)
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
    const wallet = searchParams.get('wallet');
    const questId = searchParams.get('questId') || 'meta_learning';
    const targetKey = searchParams.get('targetKey') || undefined;

    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: 'Wallet required' },
        { status: 400 }
      );
    }

    const completion = await checkMetaLearningCompletion({
      wallet: wallet.toLowerCase(),
      questId,
      targetKey,
    });

    if (!completion) {
      return NextResponse.json(
        { ok: false, error: 'Failed to check completion' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, completion });
  } catch (error: any) {
    console.error('[learner-quests/meta-learning/completion] GET error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to check completion' },
      { status: 500 }
    );
  }
}

