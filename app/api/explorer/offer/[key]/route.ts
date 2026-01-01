/**
import { checkRateLimit } from '@/lib/explorer/rateLimit';
 * Explorer Offer Detail Endpoint
 *
 * Returns a single offer by key with provenance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOfferByKey } from '@/lib/arkiv/offers';
import { serializePublicOffer } from '@/lib/explorer/serializers';
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

    // Decode URL parameter (Next.js should auto-decode, but be safe)
    let decodedKey = key;
    try {
      decodedKey = decodeURIComponent(key);
    } catch (e) {
      // If decoding fails, use as-is
      console.warn('[explorer/offer] Failed to decode key, using as-is:', key);
    }

    // Get offer
    const offer = await getOfferByKey(decodedKey);
    if (!offer) {
      console.error('[explorer/offer] Offer not found:', { key: decodedKey, originalKey: key });
      return NextResponse.json(
        { ok: false, error: 'Offer not found' },
        { status: 404 }
      );
    }

    // Serialize to public format
    const serialized = serializePublicOffer(offer);

    // Get provenance if txHash exists
    let provenance: Provenance | null = null;
    if (offer.txHash) {
      const metadata = await getTransactionMetadata(offer.txHash);
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
    console.error('[explorer/offer] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch offer' },
      {
        status: 500,
        headers: {
          'X-Robots-Tag': 'noindex, nofollow',
        },
      }
    );
  }
}

