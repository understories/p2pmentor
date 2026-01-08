/**
 * Lite Space IDs API route
 *
 * Returns all unique space IDs with metadata discovered from lite_ask and lite_offer entities
 * on the Arkiv network. This enables the /lite page to show all space IDs
 * created by any user, not just those stored in localStorage.
 *
 * Query parameters:
 * - filter: 'p2pmentor' | 'network' | 'all' (default: 'all')
 * - minEntities: minimum number of entities (default: 0)
 * - recentDays: only include spaces with activity in last N days
 *
 * Reference: refs/lite-space-id-audit.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllLiteSpaceIds, getAllLiteSpaceIdsSimple } from '@/lib/arkiv/liteSpaceIds';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') as 'p2pmentor' | 'network' | 'all' | null;
    const minEntities = searchParams.get('minEntities')
      ? parseInt(searchParams.get('minEntities')!, 10)
      : undefined;
    const recentDays = searchParams.get('recentDays')
      ? parseInt(searchParams.get('recentDays')!, 10)
      : undefined;
    const simple = searchParams.get('simple') === 'true'; // Return simple array for backward compatibility

    const options = {
      filter: filter || 'all',
      minEntities,
      recentDays,
    };

    if (simple) {
      // Backward compatibility: return simple array
      const spaceIds = await getAllLiteSpaceIdsSimple(options);
      return NextResponse.json({ ok: true, spaceIds });
    } else {
      // Return full metadata
      const spaceIds = await getAllLiteSpaceIds(options);
      return NextResponse.json({ ok: true, spaceIds });
    }
  } catch (error: any) {
    console.error('Lite Space IDs API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error', spaceIds: [] },
      { status: 500 }
    );
  }
}
