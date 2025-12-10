/**
 * Admin API: Retention Cohorts
 * 
 * Lists retention cohorts from Arkiv entities.
 */

import { NextResponse } from 'next/server';
import { listRetentionCohorts } from '@/lib/arkiv/retentionMetrics';

/**
 * GET /api/admin/retention-cohorts
 * 
 * Query params:
 * - cohortDate: string (YYYY-MM-DD)
 * - period: 'daily' | 'weekly' | 'monthly'
 * - limit: number
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cohortDate = searchParams.get('cohortDate') || undefined;
    const period = searchParams.get('period') as 'daily' | 'weekly' | 'monthly' | undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

    const cohorts = await listRetentionCohorts({
      cohortDate,
      period,
      limit,
    });

    return NextResponse.json({
      ok: true,
      cohorts,
      count: cohorts.length,
    });
  } catch (error: any) {
    console.error('[admin/retention-cohorts] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch retention cohorts' },
      { status: 500 }
    );
  }
}
