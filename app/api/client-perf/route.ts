/**
 * Client Performance Metrics API route
 * 
 * Handles client-side performance metrics collection.
 * Privacy-preserving: no PII, only performance data.
 * 
 * Reference: refs/doc/beta_metrics_QUESTIONS.md Question 5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientPerfMetric, listClientPerfMetrics } from '@/lib/arkiv/clientPerfMetric';
import { getPrivateKey, SPACE_ID } from '@/lib/config';
import type { ClientPerfMetric } from '@/lib/metrics/clientPerf';

/**
 * POST /api/client-perf
 * 
 * Submit client-side performance metrics
 * Body: ClientPerfMetric
 */
export async function POST(request: NextRequest) {
  try {
    const metric: ClientPerfMetric = await request.json();

    if (!metric.page || !metric.createdAt) {
      return NextResponse.json(
        { ok: false, error: 'page and createdAt are required' },
        { status: 400 }
      );
    }

    const { key, txHash } = await createClientPerfMetric({
      metric,
      privateKey: getPrivateKey(),
      spaceId: SPACE_ID,
    });

    return NextResponse.json({ ok: true, key, txHash });
  } catch (error: any) {
    console.error('[api/client-perf] Error creating metric:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create metric' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/client-perf
 * 
 * List client performance metrics
 * Query params: page, limit, since
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100;
    const since = searchParams.get('since') || undefined;

    const metrics = await listClientPerfMetrics({
      page,
      limit,
      since,
    });

    return NextResponse.json({ ok: true, metrics });
  } catch (error: any) {
    console.error('[api/client-perf] Error listing metrics:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to list metrics' },
      { status: 500 }
    );
  }
}
