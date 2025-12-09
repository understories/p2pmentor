/**
 * Passkey Login Button Component
 * 
 * Handles passkey registration (first time) and login (subsequent).
 * Shows passkey option only if feature flag is enabled and WebAuthn is supported.
 * 
 * Reference: Arkiv Passkey Wallet Beta Implementation Plan
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { registerPasskey, loginWithPasskey, isWebAuthnSupported, isPlatformAuthenticatorAvailable } from '@/lib/auth/passkey-webauthn-client';
import { createPasskeyWallet, unlockPasskeyWallet } from '@/lib/auth/passkey-wallet';
import { usePasskeyLogin } from '@/lib/auth/passkeyFeatureFlags';
import { setWalletType } from '@/lib/wallet/getWalletClient';

interface PasskeyLoginButtonProps {
  userId?: string; // Optional: if provided, will check for existing wallet
  onSuccess?: (address: `0x${string}`) => void;
  onError?: (error: Error) => void;
}

export function PasskeyLoginButton({ userId, onSuccess, onError }: PasskeyLoginButtonProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isPlatformAvailable, setIsPlatformAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Check feature flag and WebAuthn support
  useEffect(() => {
    const checkSupport = async () => {
      const enabled = await usePasskeyLogin();
      const supported = isWebAuthnSupported();
      const platformAvailable = supported ? await isPlatformAuthenticatorAvailable() : false;

      setIsEnabled(enabled);
      setIsSupported(supported);
      setIsPlatformAvailable(platformAvailable);
    };

    checkSupport();
  }, []);

  // Don't render if not enabled or not supported
  if (!isEnabled || !isSupported) {
    return null;
  }

  const handlePasskeyAuth = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let address: `0x${string}`;
      let credentialID: string;

      // Check if wallet already exists (by checking localStorage)
      // Note: We check localStorage for userId, but actual wallet is in IndexedDB
      const storedUserId = typeof window !== 'undefined' ? localStorage.getItem('passkey_user_id') : null;
      const hasExistingWallet = storedUserId !== null;

      if (hasExistingWallet && storedUserId) {
        // Login flow: authenticate and unlock existing wallet
        const loginResult = await loginWithPasskey(storedUserId);
        
        // Get credentialID from storage (stored during registration)
        const storedCredentialID = localStorage.getItem(`passkey_credential_${storedUserId}`);
        if (!storedCredentialID) {
          throw new Error('Passkey credential not found. Please register again.');
        }
        credentialID = storedCredentialID;

        const unlockResult = await unlockPasskeyWallet(storedUserId, credentialID);
        address = unlockResult.address;
      } else {
        // Registration flow: create new passkey and wallet
        const userIdToUse = userId || `user_${Date.now()}`; // Generate userId if not provided
        
        // Step 1: Register passkey
        const registerResult = await registerPasskey(userIdToUse);
        credentialID = registerResult.credentialID;

        // Step 2: Create wallet
        const walletResult = await createPasskeyWallet(userIdToUse, credentialID);
        address = walletResult.address;

        // Store credentialID and userId for future logins
        if (typeof window !== 'undefined') {
          localStorage.setItem(`passkey_credential_${userIdToUse}`, credentialID);
          localStorage.setItem(`passkey_wallet_${userIdToUse}`, address);
          localStorage.setItem('wallet_address', address);
          localStorage.setItem('passkey_user_id', userIdToUse);
          // Store wallet type for unified wallet client getter
          setWalletType(address, 'passkey');
        }
      }

      // Store wallet address for session persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet_address', address);
      }

      // Call success callback or redirect
      if (onSuccess) {
        onSuccess(address);
      } else {
        router.push('/me');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Passkey authentication failed');
      setError(error.message);
      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <button
        onClick={handlePasskeyAuth}
        disabled={isLoading || !isPlatformAvailable}
        className="w-full px-6 py-3 text-base font-medium text-white bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-blue-500 dark:disabled:hover:bg-blue-600"
      >
        {isLoading ? 'Authenticating...' : 'Continue with Passkey (Beta)'}
      </button>
      
      {!isPlatformAvailable && isSupported && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
          Platform authenticator (Touch ID, Face ID, Windows Hello) not available
        </p>
      )}

      {error && (
        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

