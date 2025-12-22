/**
 * Notification Preferences API route
 * 
 * Handles CRUD operations for notification preferences (read/unread state).
 * Stores preferences as Arkiv entities for persistence.
 */

import { NextResponse } from 'next/server';
import { 
  upsertNotificationPreference, 
  listNotificationPreferences,
  getNotificationPreference,
} from '@/lib/arkiv/notificationPreferences';
import { getPrivateKey, CURRENT_WALLET, SPACE_ID } from '@/lib/config';

/**
 * GET /api/notifications/preferences
 * 
 * Query params:
 * - wallet: User wallet address
 * - notificationId: Specific notification ID (optional)
 * - notificationType: Filter by type (optional)
 * - read: Filter by read status (optional, true/false)
 * - archived: Filter by archived status (optional, true/false)
 * - spaceId: Override default spaceId (optional, uses SPACE_ID from config by default)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const notificationId = searchParams.get('notificationId') || undefined;
    const notificationType = searchParams.get('notificationType') as any || undefined;
    const read = searchParams.get('read') === 'true' ? true : searchParams.get('read') === 'false' ? false : undefined;
    const archived = searchParams.get('archived') === 'true' ? true : searchParams.get('archived') === 'false' ? false : undefined;
    const spaceIdParam = searchParams.get('spaceId');
    
    // Use provided spaceId or default to SPACE_ID from config
    const spaceId = spaceIdParam || SPACE_ID;

    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: 'Wallet parameter is required' },
        { status: 400 }
      );
    }

    const preferences = await listNotificationPreferences({
      wallet,
      notificationId,
      notificationType,
      read,
      archived,
      spaceId,
    });

    return NextResponse.json({
      ok: true,
      preferences,
    });
  } catch (error: any) {
    console.error('Notification preferences API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/preferences
 * 
 * Body:
 * - wallet: User wallet address
 * - notificationId: Notification ID
 * - notificationType: Type of notification
 * - read: Read status (true/false)
 * - archived: Archived status (optional, default false)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet, notificationId, notificationType, read, archived, preferenceKey, spaceId: spaceIdParam } = body;

    // Normalize wallet once at API boundary
    const walletLower = wallet ? wallet.toLowerCase().trim() : null;
    // Use provided spaceId or default to SPACE_ID from config
    const finalSpaceId = spaceIdParam || SPACE_ID;

    console.log('[POST /api/notifications/preferences] Received request:', {
      wallet: walletLower,
      notificationId,
      notificationType,
      read,
      archived,
      preferenceKey, // NEW
      spaceId: finalSpaceId,
    });

    if (!walletLower || !notificationId || !notificationType || read === undefined) {
      console.error('[POST /api/notifications/preferences] Missing required fields');
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: wallet, notificationId, notificationType, read' },
        { status: 400 }
      );
    }

    // Get private key for the wallet (use default wallet if available)
    const privateKey = getPrivateKey();
    if (!privateKey) {
      console.error('[POST /api/notifications/preferences] Private key not configured');
      return NextResponse.json(
        { ok: false, error: 'Private key not configured' },
        { status: 500 }
      );
    }
    
    console.log('[POST /api/notifications/preferences] Calling upsertNotificationPreference:', {
      wallet: walletLower,
      notificationId,
      preferenceKey, // NEW
      spaceId: finalSpaceId,
    });

    const { key, txHash } = await upsertNotificationPreference({
      wallet: walletLower, // Use normalized wallet
      notificationId,
      notificationType,
      read,
      archived: archived || false,
      preferenceKey, // NEW: Pass through preferenceKey for direct updates
      privateKey,
      spaceId: finalSpaceId,
    });

    const now = new Date().toISOString();

    console.log('[POST /api/notifications/preferences] Successfully upserted preference:', {
      key,
      txHash,
      wallet: walletLower,
      spaceId: finalSpaceId,
    });

    // Return full response with normalized values for debugging and client storage
    return NextResponse.json({
      ok: true,
      key, // preference entity key (for client storage)
      txHash,
      wallet: walletLower, // normalized
      notificationId,
      spaceId: finalSpaceId, // echo back for debugging
      read,
      archived: archived || false,
      updatedAt: now,
    });
  } catch (error: any) {
    console.error('[POST /api/notifications/preferences] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/preferences/bulk
 * 
 * Body:
 * - wallet: User wallet address
 * - preferences: Array of { notificationId, notificationType, read, archived? }
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { wallet, preferences } = body;

    if (!wallet || !Array.isArray(preferences)) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: wallet, preferences array' },
        { status: 400 }
      );
    }

    const privateKey = getPrivateKey();
    if (!privateKey) {
      return NextResponse.json(
        { ok: false, error: 'Private key not configured' },
        { status: 500 }
      );
    }

    // Use SPACE_ID from config (beta-launch in production, local-dev in development)
    const spaceId = SPACE_ID;
    
    // Update preferences sequentially with delays to allow Arkiv indexing
    // CRITICAL: Each entity needs time to be indexed before the next one
    // Using 200ms delay to ensure proper indexing (Arkiv-native pattern)
    // This prevents rate limits and ensures all entities are indexed before querying
    const results: Array<{ key: string; txHash: string } | null> = [];
    for (let i = 0; i < preferences.length; i++) {
      const pref = preferences[i];
      try {
        const result = await upsertNotificationPreference({
          wallet,
          notificationId: pref.notificationId,
          notificationType: pref.notificationType,
          read: pref.read,
          archived: pref.archived || false,
          privateKey,
          spaceId,
        });
        results.push(result);
        
        // Delay between updates to allow Arkiv indexing (200ms per entity)
        // This ensures each entity is indexed before the next update
        // Longer delay helps prevent rate limits and ensures reliable indexing
        if (i < preferences.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (err: any) {
        console.error(`[bulk preferences] Failed to update preference ${pref.notificationId}:`, err);
        results.push(null);
        // Continue processing other preferences even if one fails
        // Add delay even on error to avoid rate limits
        if (i < preferences.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }

    const successful = results.filter(r => r !== null);
    
    // Log if some updates failed
    if (successful.length < preferences.length) {
      console.warn(`[bulk preferences] Only ${successful.length}/${preferences.length} preferences updated successfully`);
    }
    
    return NextResponse.json({
      ok: true,
      updated: successful.length,
      total: preferences.length,
      results: successful,
      // Include failure info for debugging
      ...(successful.length < preferences.length ? {
        warning: `${preferences.length - successful.length} preferences failed to update`,
      } : {}),
    });
  } catch (error: any) {
    console.error('Bulk notification preferences API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

