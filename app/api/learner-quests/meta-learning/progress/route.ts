/**
 * Meta-Learning Quest Progress API route
 *
 * Handles progress fetching for meta-learning quest.
 *
 * Reference: refs/meta-learning-quest-implementation-plan.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetaLearningProgress } from '@/lib/arkiv/metaLearningQuest';
import { verifyBetaAccess } from '@/lib/auth/betaAccess';

/**
 * GET /api/learner-quests/meta-learning/progress
 *
 * Fetch user progress for meta-learning quest
 * Query params: wallet (required), questId (optional, defaults to meta_learning), targetKey (optional), includeExpired (optional)
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
    const includeExpired = searchParams.get('includeExpired') === 'true';

    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: 'Wallet required' },
        { status: 400 }
      );
    }

    const progress = await getMetaLearningProgress({
      wallet: wallet.toLowerCase(),
      questId,
      targetKey,
      includeExpired,
    });

    // getMetaLearningProgress returns null only on error, not when no progress exists
    // When no artifacts exist, it returns a valid progress object with status 'not_started'
    if (!progress) {
      console.error('[meta-learning/progress] getMetaLearningProgress returned null');
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch progress' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, progress });
  } catch (error: any) {
    console.error('[learner-quests/meta-learning/progress] GET error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}

