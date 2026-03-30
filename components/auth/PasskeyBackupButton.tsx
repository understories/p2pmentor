/**
 * Passkey Backup Wallet Component
 *
 * Allows users to register a MetaMask wallet as a backup for passkey recovery.
 *
 * Reference: refs/doc/passkey_levelup.md Phase 2
 */

'use client';

import { useState, useEffect } from 'react';
import { connectWallet, createArkivClients } from '@/lib/auth/metamask';
import { registerBackupWallet, hasBackupWallet } from '@/lib/auth/passkey-recovery';
import { listBackupWalletIdentities } from '@/lib/arkiv/authIdentity';

interface PasskeyBackupButtonProps {
  wallet: string; // Passkey wallet address
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function PasskeyBackupButton({ wallet, onSuccess, onError }: PasskeyBackupButtonProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [backupWallets, setBackupWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadBackupWallets = async () => {
    setLoading(true);
    try {
      const wallets = await listBackupWalletIdentities(wallet);
      setBackupWallets(wallets);
    } catch (err) {
      console.error('Failed to load backup wallets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterBackup = async () => {
    setIsRegistering(true);
    setError(null);
    setSuccess(null);

    try {
      // Connect MetaMask (backup wallet)
      const backupWalletAddress = await connectWallet();

      // Check if already registered
      const hasBackup = await hasBackupWallet(wallet);
      if (hasBackup) {
        const existing = await listBackupWalletIdentities(wallet);
        const isAlreadyRegistered = existing.some(
          (bw) => bw.backupWalletAddress?.toLowerCase() === backupWalletAddress.toLowerCase()
        );

        if (isAlreadyRegistered) {
          setError('This wallet is already registered as a backup');
          setIsRegistering(false);
          return;
        }
      }

      // Get wallet client from MetaMask
      const { walletClient } = createArkivClients(backupWalletAddress);

      // Register backup wallet
      const result = await registerBackupWallet({
        wallet,
        backupWalletAddress,
        backupWalletClient: walletClient,
      });

      setSuccess(`Backup wallet registered! Entity: ${result.key.substring(0, 16)}...`);

      // Reload backup wallets
      await loadBackupWallets();

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to register backup wallet');
      setError(error.message);
      if (onError) {
        onError(error);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  // Load backup wallets on mount
  useEffect(() => {
    loadBackupWallets();
  }, [wallet]);

  return (
    <div className="space-y-3">
      <button
        onClick={handleRegisterBackup}
        disabled={isRegistering || loading}
        className="w-full rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-blue-600 dark:hover:bg-blue-500"
      >
        {isRegistering ? 'Registering...' : 'Register MetaMask as Backup'}
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
          {success}
        </div>
      )}

      {backupWallets.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Registered Backup Wallets:
          </h4>
          <ul className="space-y-1">
            {backupWallets.map((bw) => (
              <li key={bw.key} className="text-sm text-gray-600 dark:text-gray-400">
                {bw.backupWalletAddress?.substring(0, 10)}...
                {bw.backupWalletAddress?.substring(bw.backupWalletAddress.length - 8)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
