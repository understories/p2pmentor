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

    // Determine what was actually tested (not just what was requested)
    // If method=both but only one has data, update method to reflect reality
    let actualMethod: 'arkiv' | 'graphql' | 'both' = method;
    if (method === 'both') {
      const hasArkiv = !!perfSummary.arkiv && perfSummary.arkiv.samples > 0;
      const hasGraphQL = !!perfSummary.graphql && perfSummary.graphql.samples > 0;
      if (hasArkiv && hasGraphQL) {
        actualMethod = 'both';
      } else if (hasArkiv) {
        actualMethod = 'arkiv';
      } else if (hasGraphQL) {
        actualMethod = 'graphql';
      } else {
        // No data at all - keep requested method but note it
        actualMethod = method;
      }
    }

    // Get page load times if requested
    // Note: First request may include cold start, so we measure multiple times
    let pageLoadTimes;
    if (includePageLoad) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        // Measure twice to avoid cold start skewing results
        const pageLoadRes1 = await fetch(`${baseUrl}/api/admin/page-load-times?baseUrl=${encodeURIComponent(baseUrl)}`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between measurements
        const pageLoadRes2 = await fetch(`${baseUrl}/api/admin/page-load-times?baseUrl=${encodeURIComponent(baseUrl)}`);
        
        if (pageLoadRes1.ok && pageLoadRes2.ok) {
          const pageLoadData1 = await pageLoadRes1.json();
          const pageLoadData2 = await pageLoadRes2.json();
          
          // Use the better (faster) measurement to avoid cold start
          const data1 = pageLoadData1.ok && pageLoadData1.summary ? pageLoadData1.summary : null;
          const data2 = pageLoadData2.ok && pageLoadData2.summary ? pageLoadData2.summary : null;
          
          const bestData = data1 && data2 
            ? (data1.avgDurationMs < data2.avgDurationMs ? data1 : data2)
            : (data1 || data2);
          
          if (bestData) {
            pageLoadTimes = {
              avgDurationMs: bestData.avgDurationMs,
              minDurationMs: bestData.minDurationMs,
              maxDurationMs: bestData.maxDurationMs,
              total: bestData.total,
              successful: bestData.successful,
            };
          }
        }
      } catch (err) {
        console.error('[perf-snapshots] Failed to fetch page load times:', err);
        // Continue without page load times
      }
    }

    // Create snapshot entity with actual method tested
    const { key, txHash } = await createPerfSnapshot({
      snapshot: {
        timestamp,
        operation,
        method: actualMethod, // Use actual method, not requested
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

