/**
 * Explorer Ask Detail Endpoint
 * 
 * Returns a single ask by key with provenance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAskByKey } from '@/lib/arkiv/asks';
import { serializePublicAsk } from '@/lib/explorer/serializers';
import { getTransactionMetadata, getExplorerTxUrl } from '@/lib/explorer/txMeta';
import { checkRateLimit } from '@/lib/explorer/rateLimit';
import type { Provenance } from '@/lib/explorer/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
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
    const { key } = await params;

    // Get ask
    const ask = await getAskByKey(key);
    if (!ask) {
      return NextResponse.json(
        { ok: false, error: 'Ask not found' },
        { status: 404 }
      );
    }

    // Serialize to public format
    const serialized = serializePublicAsk(ask);

    // Get provenance if txHash exists
    let provenance: Provenance | null = null;
    if (ask.txHash) {
      const metadata = await getTransactionMetadata(ask.txHash);
      if (metadata) {
        provenance = {
          txHash: metadata.txHash,
          explorerTxUrl: getExplorerTxUrl(metadata.txHash),
          blockNumber: metadata.blockNumber?.toString() || null,
          blockTimestamp: metadata.blockTimestamp,
          status: metadata.status,
        };
      }
    }

    return NextResponse.json(
      {
        ok: true,
        entity: {
          ...serialized,
          provenance,
        },
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
    console.error('[explorer/ask] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch ask' },
      {
        status: 500,
        headers: {
          'X-Robots-Tag': 'noindex, nofollow',
        },
      }
    );
  }
}

