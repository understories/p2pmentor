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
import { getPrivateKey, CURRENT_WALLET } from '@/lib/config';

/**
 * GET /api/notifications/preferences
 * 
 * Query params:
 * - wallet: User wallet address
 * - notificationId: Specific notification ID (optional)
 * - notificationType: Filter by type (optional)
 * - read: Filter by read status (optional, true/false)
 * - archived: Filter by archived status (optional, true/false)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const notificationId = searchParams.get('notificationId') || undefined;
    const notificationType = searchParams.get('notificationType') as any || undefined;
    const read = searchParams.get('read') === 'true' ? true : searchParams.get('read') === 'false' ? false : undefined;
    const archived = searchParams.get('archived') === 'true' ? true : searchParams.get('archived') === 'false' ? false : undefined;

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
    const { wallet, notificationId, notificationType, read, archived } = body;

    if (!wallet || !notificationId || !notificationType || read === undefined) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: wallet, notificationId, notificationType, read' },
        { status: 400 }
      );
    }

    // Get private key for the wallet (use default wallet if available)
    const privateKey = getPrivateKey();
    if (!privateKey) {
      return NextResponse.json(
        { ok: false, error: 'Private key not configured' },
        { status: 500 }
      );
    }

    const { key, txHash } = await upsertNotificationPreference({
      wallet,
      notificationId,
      notificationType,
      read,
      archived: archived || false,
      privateKey,
    });

    return NextResponse.json({
      ok: true,
      preference: { key, txHash },
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

    // Update all preferences in parallel
    const results = await Promise.all(
      preferences.map((pref: any) =>
        upsertNotificationPreference({
          wallet,
          notificationId: pref.notificationId,
          notificationType: pref.notificationType,
          read: pref.read,
          archived: pref.archived || false,
          privateKey,
        }).catch(err => {
          console.error(`Failed to update preference ${pref.notificationId}:`, err);
          return null;
        })
      )
    );

    const successful = results.filter(r => r !== null);
    
    return NextResponse.json({
      ok: true,
      updated: successful.length,
      total: preferences.length,
      results: successful,
    });
  } catch (error: any) {
    console.error('Bulk notification preferences API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

