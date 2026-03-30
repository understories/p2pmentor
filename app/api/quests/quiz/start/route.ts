/**
 * Quiz Start API
 *
 * Records the server-side timestamp when a user begins a quiz.
 * Used by the submission endpoint to enforce minimum time gates.
 *
 * POST /api/quests/quiz/start
 * Body: { wallet, questId, stepId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { recordQuizStart } from '@/lib/quests/quizTimegate';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, questId, stepId } = body;

    if (!wallet || !questId || !stepId) {
      return NextResponse.json(
        { ok: false, error: 'wallet, questId, and stepId are required' },
        { status: 400 }
      );
    }

    const { startedAt } = recordQuizStart(wallet, questId, stepId);

    return NextResponse.json({ ok: true, startedAt });
  } catch (error: any) {
    console.error('[/api/quests/quiz/start] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to record quiz start' },
      { status: 500 }
    );
  }
}
