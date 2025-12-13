/**
 * Arkiv wallet client adapter for passkey-gated wallets
 * 
 * Produces a wallet client compatible with existing Arkiv SDK patterns.
 * Uses embedded EVM keypair unlocked via passkey authentication.
 * 
 * This function is client-side only (uses WebAuthn + WebCrypto).
 * Private keys are kept in memory only for the lifetime of the wallet client.
 * 
 * Reference: Arkiv Passkey Wallet Beta Implementation Plan
 */

import { getWalletClientFromPrivateKey } from '@/lib/arkiv/client';
import { unlockPasskeyWallet } from '@/lib/auth/passkey-wallet';

/**
 * Get Arkiv wallet client from passkey
 * 
 * Flow:
 * 1. Unlock passkey wallet (WebAuthn + decrypt private key)
 * 2. Create wallet client from private key (reuse existing pattern)
 * 3. Return wallet client compatible with Arkiv SDK
 * 
 * @param userId - User identifier
 * @param credentialID - Base64url-encoded credential ID from WebAuthn
 * @returns Wallet client configured for Mendoza testnet
 * @throws Error if passkey wallet not found or unlock fails
 * 
 * @example
 * ```ts
 * // After successful WebAuthn authentication
 * const walletClient = await getWalletClientFromPasskey(userId, credentialID);
 * await walletClient.createEntity({ ... });
 * ```
 */
export async function getWalletClientFromPasskey(
  userId: string,
  credentialID: string
) {
  console.log('[getWalletClientFromPasskey] Unlocking passkey wallet...', {
    userId,
    credentialIDLength: credentialID.length,
  });
  
  // Unlock passkey wallet (decrypts private key)
  const { privateKeyHex, address } = await unlockPasskeyWallet(userId, credentialID);
  
  console.log('[getWalletClientFromPasskey] ✅ Wallet unlocked:', {
    address,
    privateKeyLength: privateKeyHex.length,
  });
  
  // Create wallet client from private key (reuse existing pattern - same as MetaMask)
  console.log('[getWalletClientFromPasskey] Creating Arkiv wallet client (same pattern as MetaMask)...');
  const walletClient = getWalletClientFromPrivateKey(privateKeyHex);
  
  console.log('[getWalletClientFromPasskey] ✅ Arkiv wallet client created:', {
    address,
    chain: walletClient.chain?.name || 'mendoza',
  });
  
  // Note: privateKeyHex is kept in memory only for the lifetime of this function call
  // The wallet client holds a reference, but we don't persist it elsewhere
  // TODO: Consider nulling the reference after wallet client creation if possible
  
  return walletClient;
}

