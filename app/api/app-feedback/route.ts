/**
 * App Feedback API route
 * 
 * Handles app feedback creation and retrieval (separate from session feedback).
 * 
 * Reference: refs/docs/sprint2.md Section 4.1
 */

import { NextResponse } from 'next/server';
import { createAppFeedback, listAppFeedback } from '@/lib/arkiv/appFeedback';
import { getPrivateKey } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet, page, message, rating, feedbackType } = body;

    if (!wallet || !page || !message) {
      return NextResponse.json(
        { ok: false, error: 'wallet, page, and message are required' },
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

    const { key, txHash } = await createAppFeedback({
      wallet,
      page,
      message,
      rating,
      feedbackType: feedbackType || 'feedback',
      privateKey: getPrivateKey(),
      spaceId: 'local-dev',
    });

    return NextResponse.json({ ok: true, key, txHash });
  } catch (error: any) {
    console.error('App feedback API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || undefined;
    const wallet = searchParams.get('wallet') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const since = searchParams.get('since') || undefined;
    const feedbackType = searchParams.get('feedbackType') as 'feedback' | 'issue' | undefined;

    const feedbacks = await listAppFeedback({ page, wallet, limit, since, feedbackType });
    return NextResponse.json({ ok: true, feedbacks });
  } catch (error: any) {
    console.error('App feedback API GET error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

