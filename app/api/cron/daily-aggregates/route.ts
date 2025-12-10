/**
 * Daily Metric Aggregation Cron Job
 * 
 * Vercel Cron job that runs daily to compute and store metric aggregates.
 * Computes percentiles (p50/p90/p95/p99) and error/fallback rates.
 * 
 * Schedule: Runs daily at 00:00 UTC
 * 
 * Reference: refs/doc/beta_metrics_QUESTIONS.md Questions 2, 4
 */

import { NextRequest, NextResponse } from 'next/server';
import { computeDailyAggregates, createMetricAggregate } from '@/lib/arkiv/metricAggregates';
import { getPrivateKey } from '@/lib/config';

/**
 * GET /api/cron/daily-aggregates
 * 
 * Vercel Cron endpoint for daily metric aggregation.
 * Can also be called manually for testing.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a Vercel Cron request (or allow manual trigger)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get date (yesterday by default, or from query param)
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const date = dateParam || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Yesterday

    console.log(`[cron/daily-aggregates] Computing aggregates for ${date}...`);

    // Compute aggregates
    const aggregates = await computeDailyAggregates(date);

    // Store each aggregate as Arkiv entity
    const privateKey = getPrivateKey();
    const results = [];

    for (const aggregate of aggregates) {
      try {
        const { key, txHash } = await createMetricAggregate({
          aggregate,
          privateKey,
          spaceId: 'local-dev',
        });
        results.push({ aggregate, key, txHash, status: 'created' });
      } catch (error: any) {
        console.error(`[cron/daily-aggregates] Failed to create aggregate:`, error);
        results.push({ aggregate, status: 'error', error: error.message });
      }
    }

    return NextResponse.json({
      ok: true,
      date,
      aggregatesCreated: results.filter(r => r.status === 'created').length,
      errors: results.filter(r => r.status === 'error').length,
      results,
    });
  } catch (error: any) {
    console.error('[cron/daily-aggregates] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
