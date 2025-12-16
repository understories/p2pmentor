/**
 * Admin API: Navigation Metrics
 *
 * Lists navigation metrics from Arkiv entities.
 * Privacy-preserving: aggregated data only, no PII.
 */

import { NextResponse } from 'next/server';
import { listNavigationMetrics } from '@/lib/arkiv/navigationMetric';

/**
 * GET /api/admin/navigation-metrics
 *
 * Query params:
 * - page: string (filter by page)
 * - limit: number
 * - since: string (ISO timestamp)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100;
    const since = searchParams.get('since') || undefined;

    const metrics = await listNavigationMetrics({
      page,
      limit,
      since,
    });

    return NextResponse.json({
      ok: true,
      metrics,
      count: metrics.length,
    });
  } catch (error: any) {
    console.error('[admin/navigation-metrics] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch navigation metrics' },
      { status: 500 }
    );
  }
}

