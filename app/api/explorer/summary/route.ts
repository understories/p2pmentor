/**
import { checkRateLimit } from '@/lib/explorer/rateLimit';
 * Explorer Summary Endpoint
 * 
 * Returns counts of all public entities by type.
 * Uses cached explorer index for performance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExplorerIndex } from '@/lib/explorer/index';
import { checkRateLimit } from '@/lib/explorer/rateLimit';

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimit = checkRateLimit(request);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          'X-Robots-Tag': 'noindex, nofollow',
        },
      }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get('spaceId') || undefined;

    const index = await getExplorerIndex(spaceId);

    const summary = {
      profiles: index.counts.profiles,
      asks: index.counts.asks,
      offers: index.counts.offers,
      skills: index.counts.skills,
      total: index.counts.total,
      generatedAt: index.generatedAt.toISOString(),
    };

    return NextResponse.json(
      { ok: true, summary },
      {
        headers: {
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          'X-Robots-Tag': 'noindex, nofollow',
        },
      }
    );
  } catch (error: any) {
    console.error('[explorer/summary] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch summary' },
      {
        status: 500,
        headers: {
          'X-Robots-Tag': 'noindex, nofollow',
        },
      }
    );
  }
}

