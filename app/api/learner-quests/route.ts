/**
 * Learner Quests API route
 *
 * Handles quest definition fetching and progress tracking.
 *
 * Reference: refs/learner-quests-implementation-plan.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLearnerQuest, markMaterialAsRead } from '@/lib/arkiv/learnerQuest';
import { getPrivateKey } from '@/lib/config';
import { verifyBetaAccess } from '@/lib/auth/betaAccess';

/**
 * GET /api/learner-quests
 *
 * Fetch quest definition
 * Query params: questId (default: 'web3privacy_foundations')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const questId = searchParams.get('questId') || 'web3privacy_foundations';

    const quest = await getLearnerQuest(questId);

    if (!quest) {
      return NextResponse.json({ ok: false, error: 'Quest not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, quest });
  } catch (error: any) {
    console.error('[learner-quests] GET error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch quest' }, { status: 500 });
  }
}

/**
 * POST /api/learner-quests
 *
 * Mark material as read (creates progress entity)
 * Body: { action: 'markRead', questId, materialId, sourceUrl, wallet }
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
    const { action, questId, materialId, sourceUrl, wallet } = body;

    if (action === 'markRead') {
      if (!questId || !materialId || !sourceUrl || !wallet) {
        return NextResponse.json(
          { ok: false, error: 'Missing required fields: questId, materialId, sourceUrl, wallet' },
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

      const result = await markMaterialAsRead({
        wallet: wallet.toLowerCase(),
        questId,
        materialId,
        sourceUrl,
        privateKey,
      });

      if (!result) {
        return NextResponse.json(
          { ok: false, error: 'Failed to mark material as read' },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, progress: result });
    }

    return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[learner-quests] POST error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}

