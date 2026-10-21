/**
 * Explorer Transaction Count Endpoint
 *
 * Returns total count of transactions (entities) written by the server wallet.
 * Queries Arkiv network directly (entities created by the server signer, p2pmentor project).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPublicClient } from '@/lib/arkiv/client';
import { PROJECT, eqAttr } from '@/lib/arkiv/schema';
import { fetchAll } from '@/lib/arkiv/read';
import { CURRENT_WALLET, SERVER_SIGNER_ADDRESS } from '@/lib/config';
import { checkRateLimit } from '@/lib/explorer/rateLimit';
import { SPACE_ID } from '@/lib/config';

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

    if (!CURRENT_WALLET || !SERVER_SIGNER_ADDRESS) {
      return NextResponse.json(
        { ok: false, error: 'Server wallet not configured' },
        { status: 500 }
      );
    }

    const publicClient = getPublicClient();
    const finalSpaceId = spaceId && spaceId !== 'all' ? spaceId : SPACE_ID;

    // Query Arkiv directly for all p2pmentor entities created by the server wallet
    // (Arkiv 0.8 has no count query: select keys only and count them)
    // Note: capped at MAX_COUNT entities; above that we report a partial count
    // This is acceptable for the explorer stats - it shows "at least X" transactions
    const MAX_COUNT = 1000;

    let query = publicClient
      .select({ key: true }) // We don't need attributes or payload, just count
      .where(eqAttr('project', PROJECT))
      .createdBy(SERVER_SIGNER_ADDRESS);

    // Add spaceId filter if provided
    if (finalSpaceId) {
      query = query.where(eqAttr('space_id', finalSpaceId));
    }

    const result = await fetchAll(query, MAX_COUNT, publicClient);

    if (!result?.entities || !Array.isArray(result.entities)) {
      return NextResponse.json(
        { ok: true, count: 0 },
        {
          headers: {
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
            'X-Robots-Tag': 'noindex, nofollow',
          },
        }
      );
    }

    const totalCount = result.entities.length;

    return NextResponse.json(
      { ok: true, count: totalCount },
      {
        headers: {
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          'X-Robots-Tag': 'noindex, nofollow',
        },
      }
    );
  } catch (error: any) {
    console.error('[GET /api/explorer/transaction-count] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch transaction count' },
      {
        status: 500,
        headers: {
          'X-Robots-Tag': 'noindex, nofollow',
        },
      }
    );
  }
}
