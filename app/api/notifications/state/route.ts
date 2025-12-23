/**
 * Notification State API route
 * 
 * Handles updating notification state (read/unread/archived).
 * Uses Pattern B (updateEntity) to update notification in place.
 * 
 * Replaces old /api/notifications/preferences route.
 */

import { NextResponse } from 'next/server';
import { updateNotificationState } from '@/lib/arkiv/notifications';
import { getPrivateKey, SPACE_ID } from '@/lib/config';

/**
 * PATCH /api/notifications/state
 * 
 * Body:
 * - wallet: User wallet address
 * - notificationId: Notification ID (derived from sourceEntityType + sourceEntityKey)
 * - read: Read status (optional, true/false)
 * - archived: Archived status (optional, true/false)
 * - spaceId: Override default spaceId (optional)
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { wallet, notificationId, read, archived, spaceId: spaceIdParam } = body;

    // Normalize wallet
    const walletLower = wallet ? wallet.toLowerCase().trim() : null;
    const finalSpaceId = spaceIdParam || SPACE_ID;

    if (!walletLower || !notificationId) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: wallet, notificationId' },
        { status: 400 }
      );
    }

    // At least one state change must be provided
    if (read === undefined && archived === undefined) {
      return NextResponse.json(
        { ok: false, error: 'At least one of read or archived must be provided' },
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

    const { key, txHash } = await updateNotificationState({
      wallet: walletLower,
      notificationId,
      read,
      archived,
      privateKey,
      spaceId: finalSpaceId,
    });

    return NextResponse.json({
      ok: true,
      key,
      txHash,
      wallet: walletLower,
      notificationId,
      spaceId: finalSpaceId,
      read,
      archived,
    });
  } catch (error: any) {
    console.error('[PATCH /api/notifications/state] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

