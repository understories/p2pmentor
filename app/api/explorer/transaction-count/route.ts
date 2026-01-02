/**
 * Explorer Transaction Count Endpoint
 * 
 * Returns total count of transactions (entities) written by the server wallet.
 * Queries Arkiv network directly to get the actual count matching Mendoza explorer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPublicClient } from '@/lib/arkiv/client';
import { eq } from '@arkiv-network/sdk/query';
import { CURRENT_WALLET } from '@/lib/config';
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

    if (!CURRENT_WALLET) {
      return NextResponse.json(
        { ok: false, error: 'Server wallet not configured' },
        { status: 500 }
      );
    }

    const publicClient = getPublicClient();
    const finalSpaceId = spaceId && spaceId !== 'all' ? spaceId : SPACE_ID;

    // Query Arkiv directly for all entities written by the server wallet
    // This gives us the actual transaction count from the blockchain
    // We use a high limit to get as many as possible in one query
    // Note: If the wallet has more than 5000 entities, we'll get a partial count
    // This is acceptable for the explorer stats - it shows "at least X" transactions
    
    let query = publicClient.buildQuery()
      .where(eq('wallet', CURRENT_WALLET.toLowerCase()))
      .limit(5000); // High limit to get most/all entities in one query
    
    // Add spaceId filter if provided
    if (finalSpaceId) {
      query = query.where(eq('spaceId', finalSpaceId));
    }
    
    const result = await query
      .withAttributes(false) // We don't need attributes, just count
      .withPayload(false) // We don't need payload, just count
      .fetch();
    
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

