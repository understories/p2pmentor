/**
 * Passkey Registration Options API
 * 
 * Returns WebAuthn registration options for creating a new passkey.
 * 
 * POST /api/passkey/register/options
 * Body: { userId: string, userName?: string }
 */

import { NextResponse } from 'next/server';
import { getRegistrationOptions } from '@/lib/auth/passkey-webauthn-server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, userName, walletAddress } = body;

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    // CRITICAL: Pass walletAddress to query Arkiv for existing credentials
    // This populates excludeCredentials to prevent duplicate registrations
    const options = await getRegistrationOptions(userId, userName, walletAddress);

    // Store challenge in response (in production, store in session/DB)
    // For beta, client will send it back in complete step
    return NextResponse.json({
      ok: true,
      options,
    });
  } catch (error: any) {
    console.error('[api/passkey/register/options] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to generate registration options' },
      { status: 500 }
    );
  }
}

