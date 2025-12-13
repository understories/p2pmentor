/**
 * Public GraphQL Feature Flags API
 * 
 * Exposes GraphQL feature flag status for client-side pages.
 * This allows client components to check if GraphQL is enabled
 * without needing NEXT_PUBLIC_ environment variables.
 */

import { NextResponse } from 'next/server';
import {
  useGraphqlForNetwork,
  useGraphqlForMe,
  useGraphqlForProfile,
  useGraphqlForAsks,
  useGraphqlForOffers,
} from '@/lib/graph/featureFlags';

export async function GET() {
  try {
    // These functions read from process.env (server-side)
    const flags = {
      network: useGraphqlForNetwork(),
      me: useGraphqlForMe(),
      profile: useGraphqlForProfile(),
      asks: useGraphqlForAsks(),
      offers: useGraphqlForOffers(),
    };

    const enabled = Object.values(flags).filter(Boolean).length;
    const total = Object.keys(flags).length;

    return NextResponse.json({
      ok: true,
      flags,
      summary: {
        enabled,
        total,
        percentage: Math.round((enabled / total) * 100),
      },
    });
  } catch (error: any) {
    console.error('[api/graphql-flags] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch flags' },
      { status: 500 }
    );
  }
}

