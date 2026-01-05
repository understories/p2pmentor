/**
 * Explorer All Transactions Endpoint
 * 
 * Returns paginated list of all app-recorded transaction events.
 * 
 * NOTE: This shows "app-recorded transaction events" (txhash log),
 * NOT all chain transactions. See scope definition in plan.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllTransactions } from '@/lib/explorer/transactions';
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
    
    // Parse query parameters
    const spaceId = searchParams.get('spaceId') || undefined;
    const entityType = searchParams.get('type') as 'profile' | 'ask' | 'offer' | 'skill' | null;
    const status = searchParams.get('status') as 'success' | 'failed' | 'pending' | null;
    const q = searchParams.get('q') || '';
    const txHash = searchParams.get('txHash') || undefined;
    const wallet = searchParams.get('wallet') || undefined;
    const entityKey = searchParams.get('entityKey') || undefined;
    const block = searchParams.get('block') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const cursor = searchParams.get('cursor') || undefined;

    // Parse 'q' parameter (UI sugar) into specific fields
    let parsedTxHash = txHash;
    let parsedWallet = wallet;
    let parsedEntityKey = entityKey;
    let parsedBlock = block;
    
    if (q) {
      // Try to parse q into specific fields
      if (q.startsWith('0x') && q.length >= 10) {
        // Looks like a txHash
        parsedTxHash = q;
      } else if (q.startsWith('0x') && q.length === 42) {
        // Looks like a wallet address
        parsedWallet = q;
      } else if (/^\d+$/.test(q)) {
        // Numeric - treat as block number
        parsedBlock = q;
      } else {
        // Could be entity key or other - try as entityKey
        parsedEntityKey = q;
      }
    }

    // Determine final spaceId (default to SPACE_ID for data isolation, unless explicitly 'all')
    // Frontend passes spaceId only when it's not 'all', so undefined means use default
    const finalSpaceId = spaceId && spaceId !== 'all' ? spaceId : SPACE_ID;

    // Call getAllTransactions with proper spaceId filtering
    const result = await getAllTransactions({
      spaceId: finalSpaceId,
      entityType: entityType || undefined,
      status: status || undefined,
      txHash: parsedTxHash,
      wallet: parsedWallet,
      entityKey: parsedEntityKey,
      blockNumber: parsedBlock,
      limit,
      cursor,
    });

    // Determine if results were filtered (status filter may reduce results)
    const filtered = !!status;

    return NextResponse.json(
      {
        ok: true,
        transactions: result.transactions,
        nextCursor: result.nextCursor,
        total: result.total,
        filtered,
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
    console.error('[GET /api/explorer/transactions] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch transactions' },
      {
        status: 500,
        headers: {
          'X-Robots-Tag': 'noindex, nofollow',
        },
      }
    );
  }
}

