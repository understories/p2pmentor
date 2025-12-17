/**
 * Assessment Answer API route
 *
 * Handles submission of answers to language assessment questions.
 *
 * Reference: docs/betadocs/arkiv/learner-quests.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { submitAssessmentAnswer } from '@/lib/arkiv/languageQuest';
import { getPrivateKey, SPACE_ID } from '@/lib/config';
import { verifyBetaAccess } from '@/lib/auth/betaAccess';

/**
 * POST /api/learner-quests/assessment/answer
 *
 * Submit answer to assessment question
 * Body: { wallet, questId, sectionId, questionId, answer, timeSpent }
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
    const { wallet, questId, sectionId, questionId, answer, timeSpent } = body;

    if (!wallet || !questId || !sectionId || !questionId || answer === undefined || timeSpent === undefined) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: wallet, questId, sectionId, questionId, answer, timeSpent' },
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

    const result = await submitAssessmentAnswer({
      wallet: wallet.toLowerCase(),
      questId,
      sectionId,
      questionId,
      answer,
      timeSpent,
      privateKey,
      spaceId: SPACE_ID,
    });

    if (!result) {
      return NextResponse.json(
        { ok: false, error: 'Failed to submit answer' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      progress: {
        key: result.key,
        txHash: result.txHash,
        correct: result.correct,
        score: result.score,
      },
    });
  } catch (error: any) {
    console.error('[learner-quests/assessment/answer] POST error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to submit answer' },
      { status: 500 }
    );
  }
}

