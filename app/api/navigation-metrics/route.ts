/**
 * Navigation Metrics API route
 *
 * Handles aggregated navigation metrics collection.
 * Privacy-preserving: no PII, only aggregated counts.
 *
 * Reference: refs/click-navigation-tracking-plan.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { createNavigationMetric } from '@/lib/arkiv/navigationMetric';
import { getPrivateKey, SPACE_ID } from '@/lib/config';
import type { NavigationMetric } from '@/lib/metrics/navigation';

/**
 * POST /api/navigation-metrics
 *
 * Submit aggregated navigation metrics
 * Body: { aggregates: NavigationAggregate[], page: string, createdAt: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { aggregates, page, createdAt, actionType, clicksToComplete } = body;

    // Handle action completion metrics (Phase 2)
    if (actionType && typeof clicksToComplete === 'number') {
      // Store as navigation metric with action completion pattern
      const metric: NavigationMetric = {
        aggregates: [{
          pattern: `action:${actionType}:clicks:${clicksToComplete}`,
          count: 1,
        }],
        page: page || 'unknown',
        createdAt: createdAt || new Date().toISOString(),
      };

      const { key, txHash } = await createNavigationMetric({
        metric,
        privateKey: getPrivateKey(),
        spaceId: SPACE_ID,
      });

      return NextResponse.json({ ok: true, key, txHash });
    }

    // Handle navigation aggregates (Phase 1)
    if (!Array.isArray(aggregates) || !page || !createdAt) {
      return NextResponse.json(
        { ok: false, error: 'aggregates (array), page, and createdAt are required' },
        { status: 400 }
      );
    }

    // Validate aggregates structure
    if (aggregates.length === 0) {
      return NextResponse.json({ ok: true, message: 'No aggregates to store' });
    }

    for (const aggregate of aggregates) {
      if (!aggregate.pattern || typeof aggregate.count !== 'number') {
        return NextResponse.json(
          { ok: false, error: 'Invalid aggregate structure: pattern and count required' },
          { status: 400 }
        );
      }
    }

    const metric: NavigationMetric = {
      aggregates,
      page,
      createdAt,
    };

    const { key, txHash } = await createNavigationMetric({
      metric,
      privateKey: getPrivateKey(),
      spaceId: SPACE_ID,
    });

    return NextResponse.json({ ok: true, key, txHash });
  } catch (error: any) {
    console.error('[api/navigation-metrics] Error creating metric:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create metric' },
      { status: 500 }
    );
  }
}

