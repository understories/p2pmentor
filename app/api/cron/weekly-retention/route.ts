/**
 * Weekly Retention Cohort Cron Job
 * 
 * Vercel Cron job that runs weekly to compute retention cohorts.
 * Privacy-preserving: uses hashed wallets, stores only aggregates.
 * 
 * Schedule: Runs weekly on Monday at 00:00 UTC
 * 
 * Reference: refs/doc/beta_metrics_QUESTIONS.md Question 6
 */

import { NextRequest, NextResponse } from 'next/server';
import { computeRetentionCohort, createRetentionCohort } from '@/lib/arkiv/retentionMetrics';
import { getPrivateKey } from '@/lib/config';

/**
 * GET /api/cron/weekly-retention
 * 
 * Vercel Cron endpoint for weekly retention cohort computation.
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

    // Get cohort date (last week by default, or from query param)
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const cohortDate = dateParam || (() => {
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return lastWeek.toISOString().split('T')[0];
    })();

    console.log(`[cron/weekly-retention] Computing retention cohort for ${cohortDate}...`);

    // Compute retention cohort
    const cohort = await computeRetentionCohort(cohortDate, 'weekly');

    // Store as Arkiv entity
    const privateKey = getPrivateKey();
    const { key, txHash } = await createRetentionCohort({
      cohort,
      privateKey,
      spaceId: 'local-dev',
    });

    return NextResponse.json({
      ok: true,
      cohortDate,
      cohort: {
        ...cohort,
        key,
        txHash,
      },
    });
  } catch (error: any) {
    console.error('[cron/weekly-retention] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
