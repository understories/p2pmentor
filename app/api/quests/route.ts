/**
 * Quests API
 *
 * Serves quest definitions from content/quests/ directory.
 * Supports listing all quests and fetching individual quest details.
 *
 * GET /api/quests - List all available quests
 * GET /api/quests?trackId=arkiv - Get specific quest by track ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { listQuests, loadQuest } from '@/lib/quests';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const trackId = searchParams.get('trackId');

    if (trackId) {
      // Get specific quest
      const quest = await loadQuest(trackId);
      if (!quest) {
        return NextResponse.json(
          { ok: false, error: `Quest not found: ${trackId}` },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true, quest });
    }

    // List all quests
    const quests = await listQuests();
    return NextResponse.json({ ok: true, quests });
  } catch (error: any) {
    console.error('[/api/quests] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to load quests' },
      { status: 500 }
    );
  }
}
