/**
 * Admin API: Metric Aggregates
 * 
 * Lists metric aggregates from Arkiv entities.
 */

import { NextResponse } from 'next/server';
import { listMetricAggregates } from '@/lib/arkiv/metricAggregates';

/**
 * GET /api/admin/metric-aggregates
 * 
 * Query params:
 * - date: string (YYYY-MM-DD)
 * - period: 'daily' | 'weekly'
 * - operation: string
 * - source: 'graphql' | 'arkiv'
 * - route: string
 * - limit: number
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || undefined;
    const period = searchParams.get('period') as 'daily' | 'weekly' | undefined;
    const operation = searchParams.get('operation') || undefined;
    const source = searchParams.get('source') as 'graphql' | 'arkiv' | undefined;
    const route = searchParams.get('route') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

    const aggregates = await listMetricAggregates({
      date,
      period,
      operation,
      source,
      route,
      limit,
    });

    return NextResponse.json({
      ok: true,
      aggregates,
      count: aggregates.length,
    });
  } catch (error: any) {
    console.error('[admin/metric-aggregates] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch metric aggregates' },
      { status: 500 }
    );
  }
}
