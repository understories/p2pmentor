/**
 * API Route: Get transaction history for an entity
 * 
 * Returns all transactions for a given entity in human-legible format.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/explorer/rateLimit';
import { getProfileTransactionHistory, getEntityTransactionHistory } from '@/lib/explorer/transactions';
import { SPACE_ID } from '@/lib/config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
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
    const { type, id } = await params;
    
    if (!type || !id) {
      return NextResponse.json(
        { ok: false, error: 'Type and ID are required' },
        { status: 400 }
      );
    }

    // Decode URL-encoded ID
    const decodedId = decodeURIComponent(id);

    let transactions;

    if (type === 'profile') {
      // For profiles, use wallet address
      transactions = await getProfileTransactionHistory(decodedId, SPACE_ID);
    } else if (type === 'ask' || type === 'offer' || type === 'skill') {
      // For other entity types, use entity key
      transactions = await getEntityTransactionHistory(decodedId, type);
    } else {
      return NextResponse.json(
        { ok: false, error: 'Invalid entity type' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        transactions,
        count: transactions.length,
      },
      {
        headers: {
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          'X-Robots-Tag': 'noindex, nofollow',
        },
      }
    );
  } catch (error: any) {
    console.error('[GET /api/explorer/[type]/[id]/transactions] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch transaction history' },
      {
        status: 500,
        headers: {
          'X-Robots-Tag': 'noindex, nofollow',
        },
      }
    );
  }
}

