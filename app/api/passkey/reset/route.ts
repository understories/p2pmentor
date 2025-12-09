/**
 * Passkey Reset API
 *
 * Clears all server-side passkey credentials (in-memory store).
 * This is useful for resetting during beta testing.
 *
 * POST /api/passkey/reset
 * Body: { userId?: string } (optional, if provided only clears that user's credentials)
 */

import { NextResponse } from 'next/server';
import { clearAllCredentials, clearUserCredentials } from '@/lib/auth/passkey-webauthn-server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userId } = body;

    if (userId) {
      // Clear credentials for a specific user
      const cleared = clearUserCredentials(userId);
      return NextResponse.json({
        ok: true,
        message: cleared ? 'User credentials cleared' : 'No credentials found for user',
      });
    } else {
      // Clear all credentials
      clearAllCredentials();
      return NextResponse.json({
        ok: true,
        message: 'All passkey credentials cleared from server',
      });
    }
  } catch (error: any) {
    console.error('[api/passkey/reset] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to reset credentials' },
      { status: 500 }
    );
  }
}

