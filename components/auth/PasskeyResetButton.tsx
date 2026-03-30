/**
 * Passkey Reset Button Component
 *
 * Allows users to clear all passkey data (for testing/reset purposes).
 * This ensures users are never locked in during beta testing.
 *
 * Reference: Arkiv Passkey Wallet Beta Implementation Plan
 */

'use client';

import { useState } from 'react';
import { resetPasskeyWallet, clearAllPasskeyWallets } from '@/lib/auth/passkey-wallet';

interface PasskeyResetButtonProps {
  userId?: string;
  onReset?: () => void;
}

export function PasskeyResetButton({ userId, onReset }: PasskeyResetButtonProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    if (
      !confirm(
        'Are you sure you want to reset your passkey wallet? This will clear all passkey data and you will need to register again.'
      )
    ) {
      return;
    }

    setIsResetting(true);
    setError(null);
    setSuccess(false);

    try {
      // Get userId from localStorage if not provided
      const userIdToUse =
        userId || (typeof window !== 'undefined' ? localStorage.getItem('passkey_user_id') : null);

      if (!userIdToUse) {
        throw new Error('No passkey wallet found to reset');
      }

      // Reset wallet (clears IndexedDB)
      await resetPasskeyWallet(userIdToUse);

      // Clear localStorage entries
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`passkey_credential_${userIdToUse}`);
        localStorage.removeItem(`passkey_wallet_${userIdToUse}`);
        localStorage.removeItem('passkey_user_id');
        // Note: We keep wallet_address in case user wants to use MetaMask/example wallet
      }

      setSuccess(true);

      if (onReset) {
        onReset();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to reset passkey wallet');
      setError(error.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleClearAll = async () => {
    if (
      !confirm(
        'Clear ALL passkey wallets on this device? This will remove both localhost and production passkeys from client storage AND server. You will need to re-register everywhere. Browser WebAuthn credentials will remain but will not work.'
      )
    ) {
      return;
    }

    setIsResetting(true);
    setError(null);
    setSuccess(false);

    try {
      await clearAllPasskeyWallets();
      setSuccess(true);
      if (onReset) {
        onReset();
      }
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to clear all passkey wallets');
      setError(error.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="w-full space-y-2">
      <button
        onClick={handleReset}
        disabled={isResetting}
        className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-all duration-200 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
      >
        {isResetting ? 'Resetting...' : 'Reset Current Passkey Wallet'}
      </button>

      <button
        onClick={handleClearAll}
        disabled={isResetting}
        className="w-full rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-medium text-orange-600 transition-all duration-200 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/30"
        title="Clear all passkey wallets (localhost + production) from this device"
      >
        {isResetting ? 'Clearing...' : 'Clear ALL Passkey Wallets (Localhost + Production)'}
      </button>

      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
          Passkey wallet reset successfully. You can register again.
        </div>
      )}
    </div>
  );
}
