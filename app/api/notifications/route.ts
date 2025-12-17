/**
 * Notifications API route
 * 
 * Fetches notifications from Arkiv entities (Arkiv-native approach).
 * Notifications are created server-side when events occur.
 */

import { NextResponse } from 'next/server';
import { listNotifications } from '@/lib/arkiv/notifications';
import { SPACE_ID } from '@/lib/config';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const notificationType = searchParams.get('notificationType') || undefined;
    const status = searchParams.get('status') as 'active' | 'archived' | undefined;
    
    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: 'Wallet parameter is required' },
        { status: 400 }
      );
    }

    // Normalize wallet address to lowercase for consistent querying
    const normalizedWallet = wallet.toLowerCase();

    // Check if builder mode is enabled (from query param)
    const builderMode = searchParams.get('builderMode') === 'true';

    // Get spaceId(s) from query params or use default
    const spaceIdParam = searchParams.get('spaceId');
    const spaceIdsParam = searchParams.get('spaceIds');

    let spaceId: string | undefined;
    let spaceIds: string[] | undefined;

    if (builderMode && spaceIdsParam) {
      // Builder mode: query multiple spaceIds
      spaceIds = spaceIdsParam.split(',').map(s => s.trim());
    } else if (spaceIdParam) {
      // Override default spaceId
      spaceId = spaceIdParam;
    } else {
      // Use default from config
      spaceId = SPACE_ID;
    }
    
    // Query notifications directly from Arkiv entities
    const notifications = await listNotifications({
      wallet: normalizedWallet,
      notificationType: notificationType as any,
      status: status || 'active',
      spaceId,
      spaceIds,
      limit: 100,
    });

    return NextResponse.json({
      ok: true,
      notifications,
    });
  } catch (error: any) {
    console.error('Notifications API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

