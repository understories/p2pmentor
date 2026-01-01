/**
import { checkRateLimit } from '@/lib/explorer/rateLimit';
 * Explorer Profile Detail Endpoint
 * 
 * Returns a single profile by wallet address with provenance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { serializePublicProfile } from '@/lib/explorer/serializers';
import { getTransactionMetadata, getExplorerTxUrl } from '@/lib/explorer/txMeta';
import { checkRateLimit } from '@/lib/explorer/rateLimit';
import type { Provenance } from '@/lib/explorer/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
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
    const { wallet } = await params;

    // Get profile
    const profile = await getProfileByWallet(wallet);
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Serialize to public format
    const serialized = serializePublicProfile(profile);

    // Get provenance if txHash exists
    let provenance: Provenance | null = null;
    if (profile.txHash) {
      const metadata = await getTransactionMetadata(profile.txHash);
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
    console.error('[explorer/profile] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch profile' },
      {
        status: 500,
        headers: {
          'X-Robots-Tag': 'noindex, nofollow',
        },
      }
    );
  }
}

