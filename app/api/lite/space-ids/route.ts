/**
 * Lite Space IDs API route
 *
 * Returns all unique space IDs discovered from lite_ask and lite_offer entities
 * on the Arkiv network. This enables the /lite page to show all space IDs
 * created by any user, not just those stored in localStorage.
 *
 * Reference: refs/lite-space-id-audit.md
 */

import { NextResponse } from 'next/server';
import { getAllLiteSpaceIds } from '@/lib/arkiv/liteSpaceIds';

export async function GET() {
  try {
    const spaceIds = await getAllLiteSpaceIds();
    return NextResponse.json({ ok: true, spaceIds });
  } catch (error: any) {
    console.error('Lite Space IDs API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error', spaceIds: [] },
      { status: 500 }
    );
  }
}
