/**
 * Notifications API route
 * 
 * Fetches notifications from Arkiv entities (Arkiv-native approach).
 * Notifications are created server-side when events occur.
 */

import { NextResponse } from 'next/server';
import { listNotifications, archiveAllNotifications } from '@/lib/arkiv/notifications';
import { getPrivateKey, SPACE_ID } from '@/lib/config';

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
    // Note: read/archived are now in notification payload, not separate preferences
    const notifications = await listNotifications({
      wallet: normalizedWallet,
      notificationType: notificationType as any,
      archived: status === 'archived' ? true : status === 'active' ? false : undefined,
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

/**
 * DELETE /api/notifications
 * 
 * Archives (soft deletes) all notifications for a wallet.
 * This allows users to "nuke" all their notifications.
 * 
 * Query params:
 * - wallet: User wallet address (required)
 * - spaceId: Override default spaceId (optional)
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    
    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: 'Wallet parameter is required' },
        { status: 400 }
      );
    }

    // Normalize wallet address to lowercase for consistent querying
    const normalizedWallet = wallet.toLowerCase();

    // Get spaceId from query params or use default
    const spaceIdParam = searchParams.get('spaceId');
    const finalSpaceId = spaceIdParam || SPACE_ID;

    const privateKey = getPrivateKey();
    if (!privateKey) {
      return NextResponse.json(
        { ok: false, error: 'Private key not configured' },
        { status: 500 }
      );
    }

    console.log(`[DELETE /api/notifications] Archiving all notifications for wallet ${normalizedWallet}`);

    const results = await archiveAllNotifications({
      wallet: normalizedWallet,
      privateKey,
      spaceId: finalSpaceId,
    });

    return NextResponse.json({
      ok: true,
      archived: results.length,
      results,
    });
  } catch (error: any) {
    console.error('[DELETE /api/notifications] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

