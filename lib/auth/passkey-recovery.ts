/**
 * Passkey Recovery Helpers
 * 
 * Handles recovery flows for passkey wallets using backup signers.
 * 
 * Reference: refs/doc/passkey_levelup.md Phase 2
 */

import { createBackupWalletIdentity, listBackupWalletIdentities, listPasskeyIdentities } from '@/lib/arkiv/authIdentity';
import { createPasskeyWallet } from '@/lib/auth/passkey-wallet';
import { getWalletClientFromMetaMask } from '@/lib/arkiv/client';
import { signMessage } from 'viem';

/**
 * Register a backup wallet for passkey recovery (client-side)
 * 
 * Flow:
 * 1. User connects MetaMask (backup wallet)
 * 2. Create auth_identity::backup_wallet entity on Arkiv using backup wallet
 * 
 * Note: This must be called client-side with a MetaMask wallet client.
 * The backup wallet signs the entity creation transaction.
 * 
 * @param wallet - Passkey wallet address
 * @param backupWalletAddress - Backup wallet address (from MetaMask)
 * @param backupWalletClient - Wallet client for backup wallet (from MetaMask)
 * @returns Entity key and transaction hash
 */
export async function registerBackupWallet({
  wallet,
  backupWalletAddress,
  backupWalletClient,
}: {
  wallet: string;
  backupWalletAddress: `0x${string}`;
  backupWalletClient: any; // Wallet client from MetaMask
}): Promise<{ key: string; txHash: string }> {
  // Create backup wallet identity entity using backup wallet client
  // We need to create the entity directly using the wallet client
  // since createBackupWalletIdentity expects a private key (which we don't have from MetaMask)
  
  const { handleTransactionWithTimeout } = await import('@/lib/arkiv/transaction-utils');
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();

  const payload = {
    walletAddress: backupWalletAddress,
    createdAt,
  };

  // 1 year TTL (effectively permanent for beta)
  const expiresIn = 31536000;

  const result = await handleTransactionWithTimeout(async () => {
    return await backupWalletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'auth_identity' },
        { key: 'subtype', value: 'backup_wallet' },
        { key: 'wallet', value: wallet.toLowerCase() },
        { key: 'spaceId', value: 'local-dev' },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn,
    });
  });

  return { key: result.entityKey, txHash: result.txHash };
}

/**
 * Check if local passkey wallet exists
 * 
 * @param userId - User identifier
 * @returns True if wallet exists in IndexedDB
 */
export async function hasLocalPasskeyWallet(userId: string): Promise<boolean> {
  try {
    const { loadEncryptedWallet } = await import('@/lib/auth/passkey-wallet');
    const encrypted = await loadEncryptedWallet(userId);
    return encrypted !== null;
  } catch {
    return false;
  }
}

/**
 * Check if Arkiv has passkey identity for wallet
 * 
 * @param wallet - Wallet address
 * @returns True if passkey identity exists on Arkiv
 */
export async function hasArkivPasskeyIdentity(wallet: string): Promise<boolean> {
  try {
    const identities = await listPasskeyIdentities(wallet);
    return identities.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if backup wallet is registered
 * 
 * @param wallet - Wallet address
 * @returns True if backup wallet exists on Arkiv
 */
export async function hasBackupWallet(wallet: string): Promise<boolean> {
  try {
    const backupWallets = await listBackupWalletIdentities(wallet);
    return backupWallets.length > 0;
  } catch {
    return false;
  }
}

/**
 * Recover passkey wallet using backup signer
 * 
 * Flow:
 * 1. User proves control of backup wallet (sign challenge)
 * 2. Create new local passkey wallet
 * 3. Link new wallet to same identity (or create new identity)
 * 
 * @param wallet - Original wallet address (from Arkiv profile)
 * @param backupWalletAddress - Backup wallet address
 * @param backupWalletClient - Wallet client for backup wallet
 * @param userId - New user identifier for the recovered wallet
 * @param credentialID - New passkey credential ID (from new registration)
 * @returns New wallet address
 */
export async function recoverPasskeyWallet({
  wallet,
  backupWalletAddress,
  backupWalletClient,
  userId,
  credentialID,
}: {
  wallet: string;
  backupWalletAddress: `0x${string}`;
  backupWalletClient: any;
  userId: string;
  credentialID: string;
}): Promise<{ address: `0x${string}` }> {
  // Verify backup wallet is registered
  const backupWallets = await listBackupWalletIdentities(wallet);
  const isRegistered = backupWallets.some(bw => 
    bw.backupWalletAddress?.toLowerCase() === backupWalletAddress.toLowerCase()
  );

  if (!isRegistered) {
    throw new Error('Backup wallet is not registered for this passkey wallet');
  }

  // Create challenge message
  const message = `Recover passkey wallet ${wallet}\n\nTimestamp: ${Date.now()}`;
  
  // Sign message with backup wallet
  const signature = await backupWalletClient.signMessage({
    message,
  });

  // Verify signature
  const { verifyMessage } = await import('viem');
  const isValid = await verifyMessage({
    address: backupWalletAddress,
    message,
    signature: signature as `0x${string}`,
  });

  if (!isValid) {
    throw new Error('Signature verification failed');
  }

  // Create new local passkey wallet
  const walletResult = await createPasskeyWallet(userId, credentialID);
  
  // Note: The new wallet will have a different address
  // The user's identity (profile) is linked to the original wallet address
  // We'll need to handle this in the recovery UI (prompt to regrow profile or link to new wallet)
  
  return { address: walletResult.address };
}
