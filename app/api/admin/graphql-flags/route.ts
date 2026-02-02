/**
 * Admin API: GraphQL Feature Flags
 *
 * Returns the current status of GraphQL feature flags for all pages.
 * This helps track migration progress empirically.
 */

import { NextResponse } from 'next/server';
import {
  useGraphqlForNetwork,
  useGraphqlForMe,
  useGraphqlForProfile,
  useGraphqlForAsks,
  useGraphqlForOffers,
} from '@/lib/graph/featureFlags';

// These are feature flag functions, not React hooks (despite the naming convention)
// eslint-disable-next-line react-hooks/rules-of-hooks
export async function GET() {
  // TODO: Add authentication/authorization check
  // For now, this is internal-only (not exposed in production without auth)

  try {
    // Note: These are feature flag getter functions, not React hooks
    const flags = {
      network: useGraphqlForNetwork(),
      me: useGraphqlForMe(),
      profile: useGraphqlForProfile(),
      asks: useGraphqlForAsks(),
      offers: useGraphqlForOffers(),
    };

    // Count how many are enabled
    const enabledCount = Object.values(flags).filter(Boolean).length;
    const totalCount = Object.keys(flags).length;

    return NextResponse.json({
      ok: true,
      flags,
      summary: {
        enabled: enabledCount,
        total: totalCount,
        percentage: Math.round((enabledCount / totalCount) * 100),
      },
    });
  } catch (error: unknown) {
    console.error('[Admin] Error fetching GraphQL flags:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch GraphQL flags';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
