/**
 * Network Graph API Route
 * 
 * Returns graph data (nodes and links) for the forest visualization.
 */

import { NextResponse } from 'next/server';
import { buildNetworkGraphData } from '@/lib/arkiv/networkGraph';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skillFilter = searchParams.get('skill') || undefined;
    const limitAsks = searchParams.get('limitAsks') 
      ? parseInt(searchParams.get('limitAsks')!, 10) 
      : undefined;
    const limitOffers = searchParams.get('limitOffers')
      ? parseInt(searchParams.get('limitOffers')!, 10)
      : undefined;
    const includeExpired = searchParams.get('includeExpired') === 'true';

    const graphData = await buildNetworkGraphData({
      skillFilter,
      limitAsks,
      limitOffers,
      includeExpired,
    });

    return NextResponse.json({
      ok: true,
      ...graphData,
    });
  } catch (error: any) {
    console.error('Error building network graph:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Failed to build network graph',
      },
      { status: 500 }
    );
  }
}


