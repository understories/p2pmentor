/**
 * Passkey Login Complete API
 * 
 * Verifies WebAuthn authentication response and returns success.
 * 
 * POST /api/passkey/login/complete
 * Body: { userId?: string, response: PublicKeyCredential, challenge: string }
 */

import { NextResponse } from 'next/server';
import { verifyAuthentication } from '@/lib/auth/passkey-webauthn-server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, response, challenge } = body;

    if (!response || !challenge) {
      return NextResponse.json(
        { ok: false, error: 'response and challenge are required' },
        { status: 400 }
      );
    }

    // Extract origin from request headers for production compatibility
    const origin = request.headers.get('origin') || 
                   request.headers.get('referer')?.split('/').slice(0, 3).join('/') ||
                   undefined;

    const verification = await verifyAuthentication(userId, response, challenge, origin);

    if (!verification.verified) {
      return NextResponse.json(
        { ok: false, error: verification.error || 'Authentication verification failed' },
        { status: 401 }
      );
    }

    // Return success with userId
    // Client will use this to proceed with wallet unlock
    return NextResponse.json({
      ok: true,
      userId: verification.userId,
      message: 'Passkey authentication successful',
    });
  } catch (error: any) {
    console.error('[api/passkey/login/complete] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to complete authentication' },
      { status: 500 }
    );
  }
}

