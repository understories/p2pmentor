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
import { listPasskeyIdentities } from '@/lib/arkiv/authIdentity';
import { getWalletClientFromPasskey } from '@/lib/wallet/getWalletClientFromPasskey';
import { hasLocalPasskeyWallet, hasArkivPasskeyIdentity, hasBackupWallet, recoverPasskeyWallet } from '@/lib/auth/passkey-recovery';
import { connectWallet, createArkivClients } from '@/lib/auth/metamask';
import { SPACE_ID } from '@/lib/config';

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

  // Shared authentication handler - supports both platform-only and cross-device flows
  const handlePasskeyAuth = async (platformOnly: boolean = false) => {
    setIsLoading(true);
    setError(null);

    try {
      let address: `0x${string}` | undefined = undefined;
      let credentialID: string | undefined = undefined;

      // CREDENTIAL-FIRST FLOW: No wallet pre-checks
      // localStorage is only a cache, never a prerequisite
      // Server will query Arkiv by credentialID from WebAuthn response
      
      const storedUserId = typeof window !== 'undefined' ? localStorage.getItem('passkey_user_id') : null;
      const storedWallet = typeof window !== 'undefined' ? localStorage.getItem('wallet_address') : null;
      
      // [PASSKEY][LOGIN][START] - Log start (no wallet pre-check)
      console.log('[PASSKEY][LOGIN][START]', {
        env: typeof window !== 'undefined' ? window.location.hostname : 'server',
        rpId: typeof window !== 'undefined' ? window.location.hostname.replace(/^www\./, '') : 'unknown',
        origin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
        userId: storedUserId || 'none',
        walletAddress: storedWallet || 'none',
        note: 'Credential-first flow - no wallet pre-check',
      });
      
      // STEP 1: CREDENTIAL-FIRST LOGIN
      // Always attempt login first - server queries Arkiv by credentialID from WebAuthn response
      // This works even if localStorage is empty or wallet address is wrong
      // localStorage is only a cache, never a prerequisite
      
      console.log('[PasskeyLoginButton] Attempting credential-first login (server queries Arkiv by credentialID)');
      
      try {
        // Pass userId/walletAddress as hints only (optional) - server will query by credentialID
        const userIdHint = storedUserId || userId || undefined;
        const walletHint = storedWallet || undefined;
        
        // Attempt authentication - server queries Arkiv by credentialID first (from WebAuthn response)
        const loginResult = await loginWithPasskey(userIdHint, walletHint);
        credentialID = loginResult.credentialID;
        
        // CRITICAL: Server returns walletAddress from Arkiv entity (source of truth)
        const serverWalletAddress = loginResult.walletAddress;
        
        if (!credentialID) {
          throw new Error('Credential ID not found in login response');
        }
        
        if (!serverWalletAddress) {
          throw new Error('Wallet address not found in login response - credential may not be registered on Arkiv');
        }
        
        // Use wallet address from server (Arkiv entity) - this is the source of truth
        const correctWalletAddress = serverWalletAddress;
        const correctUserId = `wallet_${correctWalletAddress.toLowerCase().slice(2, 10)}`;
        
        // Create/recover local wallet using correct userId
        const hasLocal = await hasLocalPasskeyWallet(correctUserId);
        if (!hasLocal) {
          const walletResult = await createPasskeyWallet(correctUserId, credentialID);
          address = walletResult.address;
          
          // Verify wallet address matches server (should match, but log if not)
          if (address.toLowerCase() !== correctWalletAddress.toLowerCase()) {
            console.warn('[PasskeyLoginButton] Wallet address mismatch:', {
              server: correctWalletAddress,
              local: address,
              note: 'Using server address as source of truth',
            });
            address = correctWalletAddress as `0x${string}`;
          }
        } else {
          const unlockResult = await unlockPasskeyWallet(correctUserId, credentialID);
          address = unlockResult.address;
          
          // Verify wallet address matches server
          if (address.toLowerCase() !== correctWalletAddress.toLowerCase()) {
            console.warn('[PasskeyLoginButton] Wallet address mismatch on unlock:', {
              server: correctWalletAddress,
              local: address,
              note: 'Using server address as source of truth',
            });
            address = correctWalletAddress as `0x${string}`;
          }
        }
        
        // Update localStorage with CORRECT wallet address from Arkiv (cache only)
        if (typeof window !== 'undefined') {
          localStorage.setItem(`passkey_credential_${correctUserId}`, credentialID);
          localStorage.setItem(`passkey_wallet_${correctUserId}`, address);
          localStorage.setItem('wallet_address', address);
          localStorage.setItem('passkey_user_id', correctUserId);
          setWalletType(address, 'passkey');
        }
        
        console.log('[PasskeyLoginButton] ✅ Successfully logged in - wallet from Arkiv:', address);
      } catch (error: any) {
        console.error('[PasskeyLoginButton] Login failed:', error);
        
        // Check if error is "not registered" - if so, try registration
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('not registered') || errorMessage.includes('not found') || errorMessage.includes('Credential not found')) {
          console.log('[PasskeyLoginButton] Credential not found on Arkiv, will try registration');
          // Fall through to registration flow below
          address = undefined; // Ensure we go to registration
        } else {
          // Other error (counter mismatch, verification failed, etc.) - don't auto-register
          throw error;
        }
      }
      
      // STEP 2: Registration flow - ONLY if login failed with "not registered"
      // This is truly a new user/device registration
      if (address === undefined) {
        console.log('[PasskeyLoginButton] Starting registration flow (credential not found on Arkiv)');
        
        // Generate stable userId from wallet address (if we have one) or use provided userId
        // NEVER use user_${Date.now()} - always use wallet-based stable ID for production
        let userIdToUse: string;
        let userNameToUse: string | undefined;
        
        if (storedWallet) {
          // Use wallet address to generate stable user ID
          userIdToUse = `wallet_${storedWallet.toLowerCase().slice(2, 10)}`;
          // Use shortened wallet address as display name (e.g., "0x1234...5678")
          userNameToUse = `${storedWallet.slice(0, 6)}...${storedWallet.slice(-4)}`;
        } else if (userId) {
          // Use provided userId (should be wallet-based)
          userIdToUse = userId;
          userNameToUse = userId.startsWith('wallet_') ? userId.replace('wallet_', '0x') : userId;
        } else {
          // Last resort: this should rarely happen in production
          // Only for truly new users with no wallet yet (first-time passkey registration)
          // In this case, we'll create the wallet first, then use it for stable ID
          console.warn('[PasskeyLoginButton] No wallet address available for stable userId generation');
          // We'll generate a temporary ID, but this should be replaced with wallet-based ID after wallet creation
          userIdToUse = `new_user_${Date.now()}`;
          userNameToUse = 'New User';
        }
        
        console.log('[PasskeyLoginButton] Registering new passkey with stable userId:', userIdToUse, 'userName:', userNameToUse);
        
        // Step 1: Register passkey
        // Server will query Arkiv and populate excludeCredentials to prevent duplicates
        // platformOnly: use strict platform-only constraints to prevent QR dialog
        const registerResult = await registerPasskey(userIdToUse, userNameToUse, storedWallet || undefined, platformOnly);
        credentialID = registerResult.credentialID;
        
        // Type guard for credential metadata
        const hasCredentialMetadata = registerResult.credentialPublicKey !== undefined;

        // Step 2: Create wallet
        const walletResult = await createPasskeyWallet(userIdToUse, credentialID);
        address = walletResult.address;
        
        // Step 2.5: If we used a temporary userId, update to wallet-based stable ID
        // This ensures future sessions use the stable ID
        if (userIdToUse.startsWith('new_user_')) {
          const stableUserId = `wallet_${address.toLowerCase().slice(2, 10)}`;
          console.log('[PasskeyLoginButton] Updating temporary userId to stable wallet-based ID:', stableUserId);
          userIdToUse = stableUserId;
        }

        // Step 3: Create Arkiv entity for passkey credential (MANDATORY)
        // CRITICAL: Use API route with global Arkiv signing wallet (not passkey wallet)
        // The passkey wallet has no funds - all Arkiv transactions must be signed by the env wallet
        if (hasCredentialMetadata && registerResult.credentialPublicKey) {
          try {
            // [PASSKEY][REGISTER][ARKIV_WRITE] - Log before Arkiv write
            console.log('[PASSKEY][REGISTER][ARKIV_WRITE]', {
              wallet: address,
              credentialId_base64url: credentialID,
              spaceId: SPACE_ID,
              attempting: true,
              method: 'api_route_with_global_signing_wallet',
            });
            
            // Use API route that signs with global Arkiv wallet (from ARKIV_PRIVATE_KEY)
            // This matches the pattern used for profile creation and all other Arkiv entities
            const arkivRes = await fetch('/api/passkey/register/arkiv', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                wallet: address,
                credentialID,
                credentialPublicKey: Array.from(registerResult.credentialPublicKey), // Convert Uint8Array to array for JSON
                counter: registerResult.counter || 0,
                transports: registerResult.transports || [],
                deviceName: undefined, // Optional
              }),
            });

            const arkivData = await arkivRes.json();
            
            if (!arkivRes.ok || !arkivData.ok) {
              // CRITICAL: Registration without Arkiv write is a hard error
              // User must retry - we cannot proceed without Arkiv identity
              throw new Error(arkivData.error || 'Failed to create Arkiv passkey identity. Registration cannot complete without Arkiv storage.');
            }
            
            // [PASSKEY][REGISTER][ARKIV_WRITE] - Log success
            console.log('[PASSKEY][REGISTER][ARKIV_WRITE]', {
              success: true,
              entityId: arkivData.key,
              txHash: arkivData.txHash,
              spaceId: SPACE_ID,
              credentialId_stored: credentialID,
              method: 'api_route_with_global_signing_wallet',
            });
            
            console.log('[PasskeyLoginButton] ✅ Created Arkiv auth_identity entity');
          } catch (error: any) {
            // [PASSKEY][REGISTER][ARKIV_WRITE] - Log failure
            console.error('[PASSKEY][REGISTER][ARKIV_WRITE]', {
              success: false,
              error: error?.message || String(error),
              stack: error?.stack,
              wallet: address,
              credentialId_base64url: credentialID,
              method: 'api_route_with_global_signing_wallet',
            });
            // HARD ERROR: Registration cannot complete without Arkiv write
            throw new Error(`Registration failed: ${error?.message || 'Failed to create Arkiv passkey identity'}. Please try again.`);
          }
        } else {
          throw new Error('Registration failed: missing credential metadata');
        }

        // Store credentialID and userId for future logins (cache only)
        // Use stable wallet-based userId for consistency
        if (typeof window !== 'undefined') {
          localStorage.setItem(`passkey_credential_${userIdToUse}`, credentialID);
          localStorage.setItem(`passkey_wallet_${userIdToUse}`, address);
          localStorage.setItem('wallet_address', address);
          localStorage.setItem('passkey_user_id', userIdToUse);
          // Store wallet type for unified wallet client getter
          setWalletType(address, 'passkey');
        }
      }

      // Ensure address is set (should always be set by this point)
      if (!address) {
        throw new Error('Failed to obtain wallet address');
      }

      // Store profile wallet address for session persistence
      // This is the wallet address used as the 'wallet' attribute on entities (profiles, asks, offers)
      // The global Arkiv signing wallet (from ARKIV_PRIVATE_KEY) signs transactions, but entities are tied to this profile wallet
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet_address', address);
      }

      // Call success callback or redirect
      if (onSuccess) {
        onSuccess(address);
      } else {
        // Check if user has profile for this profile wallet - redirect to onboarding if not
        import('@/lib/onboarding/state').then(({ calculateOnboardingLevel }) => {
          calculateOnboardingLevel(address).then(level => {
            if (level === 0) {
              // No profile for this profile wallet - redirect to onboarding
              router.push('/onboarding');
            } else {
              // Has profile - go to dashboard
              router.push('/me');
            }
          }).catch(() => {
            // On error, default to /me (don't block on calculation failure)
            router.push('/me');
          });
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Passkey authentication failed');
      const errorName = (error as any).name || (err as any)?.name;
      const errorMessage = error.message || String(err);

      // Better error messages for platform-only failures
      // Check for constraint errors that indicate platform authenticator unavailable
      if (platformOnly && (
        errorName === 'ConstraintError' ||
        errorName === 'NotSupportedError' ||
        errorMessage.toLowerCase().includes('constraint') ||
        errorMessage.toLowerCase().includes('not supported') ||
        errorMessage.toLowerCase().includes('platform authenticator')
      )) {
        const friendlyError = new Error('This device doesn\'t have Touch ID / Windows Hello enabled. Try "Use a phone or security key" instead.');
        setError(friendlyError.message);
        if (onError) {
          onError(friendlyError);
        }
      } else {
        setError(errorMessage);
        if (onError) {
          onError(error);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Platform-only handler (strict constraints, no QR dialog)
  const handlePlatformOnly = async () => {
    // CRITICAL: Pure user gesture - call WebAuthn immediately
    // No async delays, no modals, no analytics before the call
    await handlePasskeyAuth(true);
  };

  // Cross-device handler (allows QR dialog)
  const handleCrossDevice = async () => {
    // CRITICAL: Pure user gesture - call WebAuthn immediately
    await handlePasskeyAuth(false);
  };

  return (
    <div className="w-full space-y-3">
      {/* Platform-only button - strict constraints to prevent QR dialog */}
      <button
        onClick={handlePlatformOnly}
        disabled={isLoading}
        className="w-full px-6 py-3 text-base font-medium text-white bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-blue-500 dark:disabled:hover:bg-blue-600 relative group"
        title="Use Touch ID, Face ID, or Windows Hello on this device"
      >
        {isLoading ? 'Authenticating...' : 'Use this device (Touch ID / Windows Hello)'}
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 p-3 rounded-lg shadow-lg bg-white/95 dark:bg-gray-800 text-gray-900 dark:text-white text-xs text-center border border-gray-200 dark:border-gray-700 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
          Uses strict platform-only constraints to prevent QR dialog. Future-compatible with{' '}
          <a
            href="https://eips.ethereum.org/EIPS/eip-7951"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-600 dark:hover:text-blue-400"
          >
            EIP-7951
          </a>
          {' '}(Fusaka upgrade) for native secp256r1 signature verification on-chain
        </div>
      </button>

      {/* Cross-device button - allows QR dialog */}
      <button
        onClick={handleCrossDevice}
        disabled={isLoading}
        className="w-full px-6 py-3 text-base font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
        title="Use a phone or security key (may show QR code)"
      >
        Use a phone or security key
      </button>
      
      {!isPlatformAvailable && isSupported && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
          Platform authenticator (Touch ID, Face ID, Windows Hello) not available on this device
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

