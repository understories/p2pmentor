/**
 * Explorer Entities List Endpoint
 * 
 * Returns paginated list of public entities with optional search and filtering.
 * Uses cached explorer index for server-side pagination.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExplorerIndex } from '@/lib/explorer/index';
import { getTransactionMetadata, getExplorerTxUrl } from '@/lib/explorer/txMeta';
import type { Provenance } from '@/lib/explorer/types';

/**
 * Opaque cursor: { i: number, v: string } where i is index, v is version
 */
type Cursor = { i: number; v: string };

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const q = searchParams.get('q') || '';
    const cursorParam = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 50);
    const includeProvenance = searchParams.get('includeProvenance') !== 'false';

    // Get cached explorer index
    const index = await getExplorerIndex();

    // Parse cursor (if provided)
    let startIndex = 0;
    if (cursorParam) {
      try {
        const cursor: Cursor = JSON.parse(
          Buffer.from(cursorParam, 'base64').toString()
        );
        // Validate cursor version matches current index
        if (cursor.v === index.version) {
          startIndex = cursor.i;
        }
      } catch {
        // Invalid cursor, start from beginning
      }
    }

    // Filter by type and search
    let filtered = index.entities;
    if (type !== 'all') {
      filtered = filtered.filter((e) => e.type === type);
    }
    if (q) {
      const queryLower = q.toLowerCase();
      filtered = filtered.filter((e) => {
        if (e.title?.toLowerCase().includes(queryLower)) return true;
        if (e.wallet?.toLowerCase().includes(queryLower)) return true;
        if (e.key?.toLowerCase().includes(queryLower)) return true;
        if (e.txHash?.toLowerCase().includes(queryLower)) return true;
        if (e.summary?.toLowerCase().includes(queryLower)) return true;
        return false;
      });
    }

    // Slice for pagination
    const pageEntities = filtered.slice(startIndex, startIndex + limit);

    // Enrich with provenance (only for returned page)
    const entitiesWithProvenance = includeProvenance
      ? await Promise.all(
          pageEntities.map(async (entity) => {
            if (!entity.txHash) {
              return { ...entity, provenance: null };
            }

            const metadata = await getTransactionMetadata(entity.txHash);
            if (!metadata) {
              return { ...entity, provenance: null };
            }

            const provenance: Provenance = {
              txHash: metadata.txHash,
              explorerTxUrl: getExplorerTxUrl(metadata.txHash),
              blockNumber: metadata.blockNumber?.toString() || null,
              blockTimestamp: metadata.blockTimestamp,
              status: metadata.status,
            };

            return {
              ...entity,
              provenance,
            };
          })
        )
      : pageEntities;

    // Generate next cursor
    const nextIndex = startIndex + pageEntities.length;
    const nextCursor =
      nextIndex < filtered.length
        ? Buffer.from(
            JSON.stringify({ i: nextIndex, v: index.version })
          ).toString('base64')
        : null;

    return NextResponse.json({
      ok: true,
      entities: entitiesWithProvenance,
      nextCursor,
      generatedAt: index.generatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('[explorer/entities] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch entities' },
      { status: 500 }
    );
  }
}

