/**
 * Notifications API route
 * 
 * Fetches notifications from Arkiv entities (Arkiv-native approach).
 * Notifications are created server-side when events occur.
 */

import { NextResponse } from 'next/server';
import { listNotifications } from '@/lib/arkiv/notifications';

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

    // Query notifications directly from Arkiv entities
    const notifications = await listNotifications({
      wallet,
      notificationType: notificationType as any,
      status: status || 'active',
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

