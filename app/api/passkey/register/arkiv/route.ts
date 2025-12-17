/**
 * Passkey Registration Arkiv Write API
 * 
 * Creates auth_identity::passkey entity on Arkiv using the global Arkiv signing wallet.
 * This ensures Arkiv transactions are signed by the funded env wallet, not the passkey wallet.
 * 
 * POST /api/passkey/register/arkiv
 * Body: { wallet, credentialID, credentialPublicKey, counter, transports, deviceName }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPasskeyIdentity } from '@/lib/arkiv/authIdentity';
import { getPrivateKey, SPACE_ID } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      wallet, 
      credentialID, 
      credentialPublicKey, 
      counter, 
      transports, 
      deviceName 
    } = body;

    if (!wallet || !credentialID || !credentialPublicKey) {
      return NextResponse.json(
        { ok: false, error: 'wallet, credentialID, and credentialPublicKey are required' },
        { status: 400 }
      );
    }

    // Use global Arkiv signing wallet (from ARKIV_PRIVATE_KEY env var)
    // This is the funded wallet that signs all Arkiv transactions
    const privateKey = getPrivateKey();

    // Normalize credentialID (trim whitespace for consistency)
    const normalizedCredentialID = credentialID.trim();

    // Convert credentialPublicKey from array to Uint8Array if needed
    const publicKeyBytes = credentialPublicKey instanceof Array
      ? new Uint8Array(credentialPublicKey)
      : credentialPublicKey instanceof Uint8Array
      ? credentialPublicKey
      : new Uint8Array(Object.values(credentialPublicKey));

    // [PASSKEY][REGISTER][ARKIV_WRITE] - Log before Arkiv write
    console.log('[PASSKEY][REGISTER][ARKIV_WRITE]', {
      wallet: wallet.toLowerCase().trim(),
      credentialId_base64url: normalizedCredentialID,
      credentialId_length: normalizedCredentialID.length,
      spaceId: SPACE_ID,
      attempting: true,
      signingWallet: 'global_arkiv_wallet', // Using env wallet, not passkey wallet
    });

    const arkivResult = await createPasskeyIdentity({
      wallet: wallet.toLowerCase().trim(),
      credentialID: normalizedCredentialID,
      credentialPublicKey: publicKeyBytes,
      counter: counter || 0,
      transports: transports || [],
      deviceName,
      privateKey, // Global Arkiv signing wallet (funded)
      spaceId: SPACE_ID,
    });

    // [PASSKEY][REGISTER][ARKIV_WRITE] - Log success
    console.log('[PASSKEY][REGISTER][ARKIV_WRITE]', {
      success: true,
      entityId: arkivResult.key,
      txHash: arkivResult.txHash,
      spaceId: SPACE_ID,
      credentialId_stored: normalizedCredentialID,
      credentialId_length: normalizedCredentialID.length,
      signingWallet: 'global_arkiv_wallet',
    });

    return NextResponse.json({
      ok: true,
      key: arkivResult.key,
      txHash: arkivResult.txHash,
    });
  } catch (error: any) {
    // [PASSKEY][REGISTER][ARKIV_WRITE] - Log failure
    console.error('[PASSKEY][REGISTER][ARKIV_WRITE]', {
      success: false,
      error: error?.message || String(error),
      stack: error?.stack,
    });
    
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create Arkiv passkey identity' },
      { status: 500 }
    );
  }
}
