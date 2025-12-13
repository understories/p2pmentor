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

    // Extract walletAddress from request body if provided (for recovery scenarios)
    const { walletAddress: requestWalletAddress } = body;
    
    const verification = await verifyAuthentication(
      userId, 
      response, 
      challenge, 
      origin,
      requestWalletAddress // Pass walletAddress to help with credential lookup
    );

    if (!verification.verified) {
      // CRITICAL: If verification fails, try to find the credential on Arkiv by credentialID
      // This enables recovery when localStorage is out of sync
      const credentialID = response.id; // base64url-encoded credentialID from WebAuthn response
      
      try {
        const { findPasskeyIdentityByCredentialID } = await import('@/lib/arkiv/authIdentity');
        const arkivIdentity = await findPasskeyIdentityByCredentialID(credentialID);
        
        if (arkivIdentity) {
          // Found the credential on Arkiv! Return it so client can recover
          return NextResponse.json({
            ok: false,
            error: 'Credential found on Arkiv but verification failed. This may be a counter mismatch or local state issue.',
            credentialID,
            walletAddress: arkivIdentity.wallet,
            foundOnArkiv: true,
            recoveryPossible: true,
          }, { status: 401 });
        }
      } catch (error) {
        console.warn('[api/passkey/login/complete] Failed to query Arkiv for recovery:', error);
      }
      
      return NextResponse.json(
        { ok: false, error: verification.error || 'Authentication verification failed', credentialID: response.id },
        { status: 401 }
      );
    }

    // Return success with userId and counter update
    // Client will use this to proceed with wallet unlock and counter update
    return NextResponse.json({
      ok: true,
      userId: verification.userId,
      walletAddress: verification.walletAddress,
      newCounter: verification.newCounter,
      credentialID: response.id, // Return credentialID for client-side recovery
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

