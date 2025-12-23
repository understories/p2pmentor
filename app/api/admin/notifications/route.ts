/**
 * Admin Notifications API route
 * 
 * Handles fetching and updating admin notifications.
 * 
 * Notifications are tied to ADMIN_WALLET (defaults to signing wallet address).
 * All admins see the same notifications regardless of who is logged in.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listAdminNotifications, updateAdminNotificationState } from '@/lib/arkiv/adminNotification';
import { ADMIN_WALLET, getPrivateKey } from '@/lib/config';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const notificationType = searchParams.get('notificationType') || undefined;
    const read = searchParams.get('read') === 'true' ? true : searchParams.get('read') === 'false' ? false : undefined;
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (!ADMIN_WALLET) {
      return NextResponse.json(
        { ok: false, error: 'Admin wallet not configured' },
        { status: 500 }
      );
    }

    const notifications = await listAdminNotifications({
      wallet: ADMIN_WALLET,
      notificationType: notificationType as any,
      read,
      archived: includeArchived ? undefined : false,
      limit,
    });

    const unreadCount = notifications.filter(n => !n.read && !n.archived).length;

    return NextResponse.json({
      ok: true,
      notifications,
      unreadCount,
      totalCount: notifications.length,
    });
  } catch (error: any) {
    console.error('[GET /api/admin/notifications] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationId, read, archived } = body;

    if (!notificationId) {
      return NextResponse.json(
        { ok: false, error: 'notificationId is required' },
        { status: 400 }
      );
    }

    if (!ADMIN_WALLET) {
      return NextResponse.json(
        { ok: false, error: 'Admin wallet not configured' },
        { status: 500 }
      );
    }

    const { key, txHash } = await updateAdminNotificationState({
      wallet: ADMIN_WALLET,
      notificationId,
      read,
      archived,
      privateKey: getPrivateKey(),
    });

    return NextResponse.json({
      ok: true,
      key,
      txHash,
    });
  } catch (error: any) {
    console.error('[PATCH /api/admin/notifications] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to update notification' },
      { status: 500 }
    );
  }
}

