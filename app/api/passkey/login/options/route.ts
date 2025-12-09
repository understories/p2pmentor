/**
 * Passkey Login Options API
 * 
 * Returns WebAuthn authentication options for passkey login.
 * 
 * POST /api/passkey/login/options
 * Body: { userId?: string } (optional, for allowCredentials filtering)
 */

import { NextResponse } from 'next/server';
import { getAuthenticationOptions } from '@/lib/auth/passkey-webauthn-server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId } = body;

    const options = await getAuthenticationOptions(userId);

    // Store challenge in response (in production, store in session/DB)
    // For beta, client will send it back in complete step
    return NextResponse.json({
      ok: true,
      options,
    });
  } catch (error: any) {
    console.error('[api/passkey/login/options] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to generate authentication options' },
      { status: 500 }
    );
  }
}

