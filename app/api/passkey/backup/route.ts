/**
 * Passkey Backup Signer API
 * 
 * Lists backup wallets for passkey recovery.
 * Registration is done client-side (requires MetaMask wallet client).
 * 
 * GET /api/passkey/backup?wallet=0x...
 */

/**
 * GET /api/passkey/backup?wallet=0x...
 * 
 * List backup wallets for a passkey wallet.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: 'wallet parameter is required' },
        { status: 400 }
      );
    }

    const backupWallets = await listBackupWalletIdentities(wallet);

    return NextResponse.json({
      ok: true,
      backupWallets,
    });
  } catch (error: any) {
    console.error('[api/passkey/backup] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to list backup wallets' },
      { status: 500 }
    );
  }
}
