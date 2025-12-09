/**
 * Admin API: Performance Snapshots
 * 
 * Creates and retrieves performance snapshots for historical tracking.
 * 
 * Reference: Performance monitoring best practices
 */

import { NextResponse } from 'next/server';
import { createPerfSnapshot, listPerfSnapshots, getLatestSnapshot, shouldCreateSnapshot } from '@/lib/arkiv/perfSnapshots';
import { getPerfSummary } from '@/lib/metrics/perf';
import { getPrivateKey, CURRENT_WALLET } from '@/lib/config';

/**
 * POST /api/admin/perf-snapshots
 * 
 * Creates a new performance snapshot with current metrics.
 * Query params:
 * - operation: string (default: 'buildNetworkGraphData')
 * - method: 'arkiv' | 'graphql' | 'both' (default: 'both')
 * - includePageLoad: boolean (default: true)
 */
export async function POST(request: Request) {
  try {
    if (!CURRENT_WALLET) {
      return NextResponse.json(
        { ok: false, error: 'ARKIV_PRIVATE_KEY not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const operation = searchParams.get('operation') || 'buildNetworkGraphData';
    const method = (searchParams.get('method') as 'arkiv' | 'graphql' | 'both') || 'both';
    const includePageLoad = searchParams.get('includePageLoad') !== 'false';

    const privateKey = getPrivateKey();
    const timestamp = new Date().toISOString();

    // Get current performance summary
    const perfSummary = getPerfSummary(operation);

    // Get page load times if requested
    let pageLoadTimes;
    if (includePageLoad) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const pageLoadRes = await fetch(`${baseUrl}/api/admin/page-load-times?baseUrl=${encodeURIComponent(baseUrl)}`);
        if (pageLoadRes.ok) {
          const pageLoadData = await pageLoadRes.json();
          if (pageLoadData.ok && pageLoadData.summary) {
            pageLoadTimes = {
              avgDurationMs: pageLoadData.summary.avgDurationMs,
              minDurationMs: pageLoadData.summary.minDurationMs,
              maxDurationMs: pageLoadData.summary.maxDurationMs,
              total: pageLoadData.summary.total,
              successful: pageLoadData.summary.successful,
            };
          }
        }
      } catch (err) {
        console.error('[perf-snapshots] Failed to fetch page load times:', err);
        // Continue without page load times
      }
    }

    // Create snapshot entity
    const { key, txHash } = await createPerfSnapshot({
      snapshot: {
        timestamp,
        operation,
        method,
        graphql: perfSummary.graphql,
        arkiv: perfSummary.arkiv,
        pageLoadTimes,
        createdAt: timestamp,
      },
      privateKey,
    });

    return NextResponse.json({
      ok: true,
      snapshot: {
        key,
        txHash,
        timestamp,
        operation,
        method,
        explorer: `https://explorer.mendoza.hoodi.arkiv.network/tx/${txHash}`,
      },
    });
  } catch (error: any) {
    console.error('[admin/perf-snapshots] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create snapshot' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/perf-snapshots
 * 
 * Retrieves performance snapshots.
 * Query params:
 * - operation: string
 * - method: 'arkiv' | 'graphql' | 'both'
 * - limit: number
 * - since: ISO timestamp
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const operation = searchParams.get('operation') || undefined;
    const method = searchParams.get('method') as 'arkiv' | 'graphql' | 'both' | undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
    const since = searchParams.get('since') || undefined;
    const checkAuto = searchParams.get('checkAuto') === 'true';

    // If checkAuto, determine if we should create a snapshot automatically
    if (checkAuto && operation) {
      const shouldCreate = await shouldCreateSnapshot(operation);
      const latest = shouldCreate ? null : await getLatestSnapshot(operation);
      
      return NextResponse.json({
        ok: true,
        shouldCreateSnapshot: shouldCreate,
        lastSnapshot: latest ? {
          timestamp: latest.timestamp,
          hoursAgo: (Date.now() - new Date(latest.timestamp).getTime()) / (1000 * 60 * 60),
        } : null,
      });
    }

    // Otherwise, return snapshots
    const snapshots = await listPerfSnapshots({
      operation,
      method,
      limit,
      since,
    });

    return NextResponse.json({
      ok: true,
      snapshots,
      count: snapshots.length,
    });
  } catch (error: any) {
    console.error('[admin/perf-snapshots] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}

