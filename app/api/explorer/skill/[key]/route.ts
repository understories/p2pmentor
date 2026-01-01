/**
import { checkRateLimit } from '@/lib/explorer/rateLimit';
 * Explorer Skill Detail Endpoint
 * 
 * Returns a single skill by key with provenance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSkillByKey } from '@/lib/arkiv/skill';
import { serializePublicSkill } from '@/lib/explorer/serializers';
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

    // Get skill
    const skill = await getSkillByKey(key);
    if (!skill) {
      return NextResponse.json(
        { ok: false, error: 'Skill not found' },
        { status: 404 }
      );
    }

    // Serialize to public format
    const serialized = serializePublicSkill(skill);

    // Get provenance if txHash exists
    let provenance: Provenance | null = null;
    if (skill.txHash) {
      const metadata = await getTransactionMetadata(skill.txHash);
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
    console.error('[explorer/skill] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch skill' },
      {
        status: 500,
        headers: {
          'X-Robots-Tag': 'noindex, nofollow',
        },
      }
    );
  }
}

