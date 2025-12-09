/**
 * Passkey Registration Complete API
 * 
 * Verifies WebAuthn registration response and stores credential metadata.
 * 
 * POST /api/passkey/register/complete
 * Body: { userId: string, response: PublicKeyCredential, challenge: string }
 */

import { NextResponse } from 'next/server';
import { verifyRegistration } from '@/lib/auth/passkey-webauthn-server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, response, challenge } = body;

    if (!userId || !response || !challenge) {
      return NextResponse.json(
        { ok: false, error: 'userId, response, and challenge are required' },
        { status: 400 }
      );
    }

    const verification = await verifyRegistration(userId, response, challenge);

    if (!verification.verified) {
      return NextResponse.json(
        { ok: false, error: verification.error || 'Registration verification failed' },
        { status: 400 }
      );
    }

    // Return success with credential ID
    // Client will use this to proceed with wallet creation
    return NextResponse.json({
      ok: true,
      credentialID: verification.credentialID,
      message: 'Passkey registered successfully',
    });
  } catch (error: any) {
    console.error('[api/passkey/register/complete] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to complete registration' },
      { status: 500 }
    );
  }
}

