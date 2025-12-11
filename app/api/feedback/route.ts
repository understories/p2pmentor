/**
 * Feedback API route
 * 
 * Handles feedback creation and retrieval.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createFeedback, listFeedbackForSession, listFeedbackForWallet } from '@/lib/arkiv/feedback';
import { getPrivateKey } from '@/lib/config';
import { verifyBetaAccess } from '@/lib/auth/betaAccess';

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
    const {
      sessionKey,
      mentorWallet,
      learnerWallet,
      feedbackFrom,
      feedbackTo,
      rating,
      notes,
      technicalDxFeedback,
      spaceId,
      sessionStatus,
      mentorConfirmed,
      learnerConfirmed,
    } = body;

    if (!sessionKey || !mentorWallet || !learnerWallet || !feedbackFrom || !feedbackTo) {
      return NextResponse.json(
        { ok: false, error: 'sessionKey, mentorWallet, learnerWallet, feedbackFrom, and feedbackTo are required' },
        { status: 400 }
      );
    }

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json(
        { ok: false, error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    const { key, txHash } = await createFeedback({
      sessionKey,
      mentorWallet,
      learnerWallet,
      feedbackFrom,
      feedbackTo,
      rating,
      notes,
      technicalDxFeedback,
      privateKey: getPrivateKey(),
      spaceId: spaceId || 'local-dev',
      sessionStatus,
      mentorConfirmed,
      learnerConfirmed,
    });

    return NextResponse.json({ ok: true, key, txHash });
  } catch (error: any) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionKey = searchParams.get('sessionKey');
    const wallet = searchParams.get('wallet');

    if (sessionKey) {
      const feedbacks = await listFeedbackForSession(sessionKey);
      return NextResponse.json({ ok: true, feedbacks });
    } else if (wallet) {
      const feedbacks = await listFeedbackForWallet(wallet);
      return NextResponse.json({ ok: true, feedbacks });
    } else {
      return NextResponse.json(
        { ok: false, error: 'sessionKey or wallet parameter is required' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Feedback API GET error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

