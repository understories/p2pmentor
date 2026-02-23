/**
 * Quest Leaderboard API
 *
 * GET: Get proof-first quest completion leaderboard
 *
 * Shows completion counts backed by verifiable badge entities,
 * not arbitrary points. Every entry is proof-verifiable on Arkiv.
 *
 * Week 4 (Feb 22-29) - Partner-ready weekly quests
 */

import { NextResponse } from 'next/server';
import { getQuestLeaderboard } from '@/lib/arkiv/questLeaderboard';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const questId = searchParams.get('questId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const leaderboard = await getQuestLeaderboard({
      questId,
      limit: Math.min(limit, 50),
    });

    return NextResponse.json({
      ok: true,
      leaderboard,
      total: leaderboard.length,
    });
  } catch (error: any) {
    console.error('[GET /api/quests/leaderboard] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to get leaderboard' },
      { status: 500 }
    );
  }
}
