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
    const { userId, walletAddress } = body;

    // Capture request origin for RP ID consistency checks
    const requestOrigin = request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/') || undefined;

    console.log('[api/passkey/login/options] Request received:', {
      userId: userId || 'none',
      walletAddress: walletAddress || 'none',
      requestOrigin,
      headers: {
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
        host: request.headers.get('host'),
      },
    });

    // Pass walletAddress to query Arkiv for existing credentials
    // This enables recovery when localStorage is cleared but Arkiv has the identity
    const options = await getAuthenticationOptions(userId, walletAddress, requestOrigin);

    // Challenge returned in response (client will send it back in complete step)
    // No session storage needed - stateless serverless function
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

