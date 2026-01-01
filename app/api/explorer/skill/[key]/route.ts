/**
import { checkRateLimit } from '@/lib/explorer/rateLimit';
 * Explorer Skill Detail Endpoint
 *
 * Returns a single skill by key with provenance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSkillByKey, getSkillBySlug } from '@/lib/arkiv/skill';
import { serializePublicSkill } from '@/lib/explorer/serializers';
import { getTransactionMetadata, getExplorerTxUrl } from '@/lib/explorer/txMeta';
import { checkRateLimit } from '@/lib/explorer/rateLimit';
import type { Provenance } from '@/lib/explorer/types';
import { SPACE_ID } from '@/lib/config';

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
      console.warn('[explorer/skill] Failed to decode key, using as-is:', key);
    }

    console.log('[explorer/skill] Received key:', { original: key, decoded: decodedKey, length: decodedKey.length });

    // Get skill by key first
    let skill = await getSkillByKey(decodedKey);
    console.log('[explorer/skill] getSkillByKey result:', skill ? { key: skill.key, name: skill.name_canonical } : 'null');

    // Fallback: if not found by key, try by slug (in case the URL uses slug instead of key)
    if (!skill) {
      console.warn('[explorer/skill] Skill not found by key, trying slug:', { key: decodedKey, originalKey: key });
      skill = await getSkillBySlug(decodedKey, SPACE_ID);
      console.log('[explorer/skill] getSkillBySlug result:', skill ? { key: skill.key, name: skill.name_canonical } : 'null');
    }

    if (!skill) {
      console.error('[explorer/skill] Skill not found by key or slug:', { key: decodedKey, originalKey: key });
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

