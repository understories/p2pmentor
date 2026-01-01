/**
 * Explorer Summary Endpoint
 * 
 * Returns counts of all public entities by type.
 * Uses cached explorer index for performance.
 */

import { NextResponse } from 'next/server';
import { getExplorerIndex } from '@/lib/explorer/index';

export async function GET() {
  try {
    const index = await getExplorerIndex();

    const summary = {
      profiles: index.counts.profiles,
      asks: index.counts.asks,
      offers: index.counts.offers,
      skills: index.counts.skills,
      total: index.counts.total,
      generatedAt: index.generatedAt.toISOString(),
    };

    return NextResponse.json({ ok: true, summary });
  } catch (error: any) {
    console.error('[explorer/summary] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch summary' },
      { status: 500 }
    );
  }
}

