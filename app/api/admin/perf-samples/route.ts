/**
 * Admin API: Performance Samples
 * 
 * Exposes performance metrics for admin panel.
 * 
 * Reference: refs/docs/sprint2.md Section 2.3
 */

import { NextResponse } from 'next/server';
import { getPerfSamples, getPerfSamplesFiltered, getPerfSummary, clearPerfSamples } from '@/lib/metrics/perf';

/**
 * GET /api/admin/perf-samples
 * 
 * Query params:
 * - source: 'graphql' | 'arkiv'
 * - operation: string
 * - route: string
 * - since: ISO timestamp
 * 
 * Returns: Array of performance samples
 */
export async function GET(request: Request) {
  // TODO: Add authentication/authorization check
  // For now, this is internal-only (not exposed in production without auth)
  
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source') as 'graphql' | 'arkiv' | null;
  const operation = searchParams.get('operation') || undefined;
  const route = searchParams.get('route') || undefined;
  const since = searchParams.get('since') || undefined;
  const summary = searchParams.get('summary') === 'true';
  const summaryOperation = searchParams.get('summaryOperation') || undefined;

  try {
    if (summary && summaryOperation) {
      // Return performance summary
      const perfSummary = getPerfSummary(summaryOperation, route);
      return NextResponse.json(perfSummary);
    }

    // Return filtered samples
    const samples = getPerfSamplesFiltered({
      source: source || undefined,
      operation,
      route,
      since,
    });

    return NextResponse.json({
      samples,
      count: samples.length,
    });
  } catch (error) {
    console.error('[admin/perf-samples] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance samples' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/perf-samples
 * 
 * Clears all performance samples
 */
export async function DELETE(request: Request) {
  // TODO: Add authentication/authorization check
  
  try {
    clearPerfSamples();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/perf-samples] Error clearing samples:', error);
    return NextResponse.json(
      { error: 'Failed to clear performance samples' },
      { status: 500 }
    );
  }
}

