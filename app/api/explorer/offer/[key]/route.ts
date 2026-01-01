/**
 * Explorer Offer Detail Endpoint
 * 
 * Returns a single offer by key with provenance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOfferByKey } from '@/lib/arkiv/offers';
import { serializePublicOffer } from '@/lib/explorer/serializers';
import { getTransactionMetadata, getExplorerTxUrl } from '@/lib/explorer/txMeta';
import type { Provenance } from '@/lib/explorer/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;

    // Get offer
    const offer = await getOfferByKey(key);
    if (!offer) {
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

    return NextResponse.json({
      ok: true,
      entity: {
        ...serialized,
        provenance,
      },
    });
  } catch (error: any) {
    console.error('[explorer/offer] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch offer' },
      { status: 500 }
    );
  }
}

