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
import { createPasskeyIdentity, listPasskeyIdentities } from '@/lib/arkiv/authIdentity';
import { getWalletClientFromPasskey } from '@/lib/wallet/getWalletClientFromPasskey';
import { hasLocalPasskeyWallet, hasArkivPasskeyIdentity, hasBackupWallet, recoverPasskeyWallet } from '@/lib/auth/passkey-recovery';
import { connectWallet, createArkivClients } from '@/lib/auth/metamask';

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
      let address: `0x${string}` | undefined = undefined;
      let credentialID: string | undefined = undefined;

      // Check if wallet already exists (by checking localStorage and Arkiv)
      // Note: We check localStorage for userId, but actual wallet is in IndexedDB
      // CRITICAL: Also check Arkiv for existing passkey identities to prevent duplicate registrations
      const storedUserId = typeof window !== 'undefined' ? localStorage.getItem('passkey_user_id') : null;
      const storedWallet = typeof window !== 'undefined' ? localStorage.getItem('wallet_address') : null;
      const hasExistingWallet = storedUserId !== null;
      
      // Arkiv-native check: Query Arkiv for existing passkey identities before registration
      // This prevents creating duplicate passkeys when localStorage is cleared but Arkiv has the identity
      let hasArkivIdentity = false;
      if (storedWallet) {
        try {
          hasArkivIdentity = await hasArkivPasskeyIdentity(storedWallet);
          if (hasArkivIdentity) {
            console.log('[PasskeyLoginButton] Found existing Arkiv passkey identity for wallet:', storedWallet);
          }
        } catch (error) {
          console.warn('[PasskeyLoginButton] Failed to check Arkiv for existing identity:', error);
        }
      }

      if (hasExistingWallet && storedUserId) {
        // Check if local wallet exists in IndexedDB
        const hasLocal = await hasLocalPasskeyWallet(storedUserId);
        const hasArkiv = storedWallet ? await hasArkivPasskeyIdentity(storedWallet) : false;
        
        if (!hasLocal && hasArkiv) {
          // Recovery scenario: Arkiv has identity but local wallet is missing
          const hasBackup = storedWallet ? await hasBackupWallet(storedWallet) : false;
          
          if (hasBackup) {
            // Recovery flow: use backup wallet to recreate passkey wallet
            const backupWalletAddress = await connectWallet();
            const { walletClient } = createArkivClients(backupWalletAddress);
            
            // Register new passkey (user will authenticate with device)
            // Pass walletAddress to enable Arkiv-native duplicate prevention
            const registerResult = await registerPasskey(storedUserId, undefined, storedWallet || undefined);
            credentialID = registerResult.credentialID;
            
            // Recover wallet using backup signer
            const recoveryResult = await recoverPasskeyWallet({
              wallet: storedWallet!,
              backupWalletAddress,
              backupWalletClient: walletClient,
              userId: storedUserId,
              credentialID,
            });
            
            address = recoveryResult.address;
            
            // Create new Arkiv entity for the recovered credential
            if (registerResult.credentialPublicKey) {
              try {
                const { privateKeyHex } = await unlockPasskeyWallet(storedUserId, credentialID);
                await createPasskeyIdentity({
                  wallet: address,
                  credentialID,
                  credentialPublicKey: registerResult.credentialPublicKey,
                  counter: registerResult.counter || 0,
                  transports: registerResult.transports,
                  privateKey: privateKeyHex,
                });
              } catch (error) {
                console.warn('[PasskeyLoginButton] Failed to create Arkiv entity after recovery:', error);
              }
            }
          } else {
            // No backup wallet - user needs to register one or re-register
            throw new Error('Local wallet not found and no backup wallet registered. Please register a backup wallet or contact support.');
          }
        } else if (hasLocal) {
          // Normal login flow: authenticate and unlock existing wallet
          try {
            const loginResult = await loginWithPasskey(storedUserId, storedWallet || undefined);
            
            // Use credentialID from login result (from WebAuthn response) or fallback to localStorage
            credentialID = loginResult.credentialID || localStorage.getItem(`passkey_credential_${storedUserId}`) || undefined;
            
            if (!credentialID) {
              throw new Error('Passkey credential not found. Please register again.');
            }

            const unlockResult = await unlockPasskeyWallet(storedUserId, credentialID);
            address = unlockResult.address;
            
            // Update localStorage with credentialID from WebAuthn response (in case it changed)
            if (loginResult.credentialID && loginResult.credentialID !== localStorage.getItem(`passkey_credential_${storedUserId}`)) {
              console.log('[PasskeyLoginButton] Updating localStorage credentialID to match WebAuthn response');
              localStorage.setItem(`passkey_credential_${storedUserId}`, loginResult.credentialID);
            }
            
            // Update wallet address if found on Arkiv (recovery scenario)
            if (loginResult.walletAddress && loginResult.walletAddress !== storedWallet) {
              console.log('[PasskeyLoginButton] Updating wallet address from Arkiv:', loginResult.walletAddress);
              if (typeof window !== 'undefined') {
                localStorage.setItem('wallet_address', loginResult.walletAddress);
              }
            }
          } catch (error: any) {
            // RECOVERY: If authentication fails, try to recover using credentialID from WebAuthn response
            const errorMessage = error.message || '';
            const credentialIDFromError = error.credentialID; // credentialID from WebAuthn response
            
            if (credentialIDFromError) {
              console.log('[PasskeyLoginButton] Authentication failed with credentialID, attempting Arkiv recovery...', credentialIDFromError);
              
              try {
                // Query Arkiv to find which wallet this credentialID belongs to
                const { findPasskeyIdentityByCredentialID } = await import('@/lib/arkiv/authIdentity');
                const arkivIdentity = await findPasskeyIdentityByCredentialID(credentialIDFromError);
                
                if (arkivIdentity) {
                  console.log('[PasskeyLoginButton] ✅ Found credential on Arkiv! Recovering wallet...', arkivIdentity.wallet);
                  
                  // Found the credential on Arkiv! Recover the wallet
                  const recoveredWallet = arkivIdentity.wallet;
                  const recoveredCredentialID = arkivIdentity.credentialID;
                  
                  if (!recoveredCredentialID) {
                    throw new Error('Credential ID not found in Arkiv identity');
                  }
                  
                  // Generate userId from wallet address
                  const recoveredUserId = `wallet_${recoveredWallet.toLowerCase().slice(2, 10)}`;
                  
                  // Check if local wallet exists, create if not
                  const hasLocal = await hasLocalPasskeyWallet(recoveredUserId);
                  if (!hasLocal) {
                    // Create new local wallet with recovered credentialID
                    const walletResult = await createPasskeyWallet(recoveredUserId, recoveredCredentialID);
                    address = walletResult.address;
                  } else {
                    // Unlock existing wallet
                    const unlockResult = await unlockPasskeyWallet(recoveredUserId, recoveredCredentialID);
                    address = unlockResult.address;
                  }
                  
                  // Update localStorage to match Arkiv identity
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(`passkey_credential_${recoveredUserId}`, recoveredCredentialID);
                    localStorage.setItem(`passkey_wallet_${recoveredUserId}`, address);
                    localStorage.setItem('wallet_address', address);
                    localStorage.setItem('passkey_user_id', recoveredUserId);
                    setWalletType(address, 'passkey');
                  }
                  
                  credentialID = recoveredCredentialID;
                  console.log('[PasskeyLoginButton] ✅ Successfully recovered wallet from Arkiv!');
                  
                  // Successfully recovered - exit the error handler
                  return;
                } else {
                  // Credential not found on Arkiv - this is a real issue
                  console.warn('[PasskeyLoginButton] Credential not found on Arkiv:', credentialIDFromError);
                  throw new Error('The selected passkey is not registered on Arkiv. This may be a local-only credential. Please use "Reset passkeys" to clear local credentials and register a new passkey.');
                }
              } catch (recoveryError: any) {
                console.error('[PasskeyLoginButton] Recovery attempt failed:', recoveryError);
                // If recovery fails, provide helpful error message
                if (recoveryError.message) {
                  throw recoveryError;
                }
              }
            } else if (errorMessage.includes('Credential not found') || errorMessage.includes('verification failed')) {
              // No credentialID in error - try querying Arkiv by wallet
              if (storedWallet) {
                try {
                  const identities = await listPasskeyIdentities(storedWallet);
                  if (identities.length > 0) {
                    console.log('[PasskeyLoginButton] Found', identities.length, 'identities on Arkiv for wallet:', storedWallet);
                    throw new Error(`Found ${identities.length} passkey(s) on Arkiv but authentication failed. The selected passkey may not match. Please try selecting a different passkey from the list, or use "Reset passkeys" to clear local credentials.`);
                  }
                } catch (recoveryError) {
                  console.error('[PasskeyLoginButton] Recovery attempt failed:', recoveryError);
                }
              }
            }
            
            // If we get here, recovery failed - throw original error
            throw error;
          }
          
          // Counter update: API route handles counter updates during verification
          // For Arkiv entities, we use the immutable pattern - new entity with updated counter
          // This happens automatically on next authentication when API route detects counter change
          // No action needed here - counter is tracked in API route and will be persisted to Arkiv
        } else {
          // No local wallet and no Arkiv identity - fresh registration
          throw new Error('No passkey wallet found. Please register a new passkey.');
        }
      } else if (hasArkivIdentity && storedWallet) {
        // CRITICAL: Arkiv has identity but localStorage doesn't - try to authenticate with existing credential
        // This happens when localStorage is cleared but Arkiv still has the passkey identity
        // This prevents creating duplicate passkeys when the user already has one registered
        console.log('[PasskeyLoginButton] Arkiv has passkey identity but localStorage missing - attempting authentication with existing credential');
        
        try {
          // Query Arkiv for all passkey identities for this wallet
          const identities = await listPasskeyIdentities(storedWallet);
          if (identities.length === 0) {
            throw new Error('No passkey identities found on Arkiv');
          }
          
          // Generate a stable userId from the wallet address
          // This ensures we can recover the same wallet across sessions
          const userIdToUse = `wallet_${storedWallet.toLowerCase().slice(2, 10)}`;
          
          // Attempt authentication with existing credential
          // Pass walletAddress so the API can query Arkiv for existing credentials
          // This prevents creating duplicate passkeys
          const loginResult = await loginWithPasskey(userIdToUse, storedWallet);
          
          // Use credentialID from login result (from WebAuthn response) or fallback to first identity
          let credentialID = loginResult.credentialID;
          
          if (!credentialID) {
            // Fallback: use the first identity's credentialID
            const firstIdentity = identities[0];
            credentialID = firstIdentity.credentialID;
          }
          
          if (!credentialID) {
            throw new Error('Credential ID not found in Arkiv identity');
          }
          
          // Create/recover local wallet linked to existing Arkiv identity
          // Check if wallet already exists in IndexedDB first
          const hasLocal = await hasLocalPasskeyWallet(userIdToUse);
          let recoveredAddress: `0x${string}`;
          if (!hasLocal) {
            // Create new local wallet with same credentialID
            const walletResult = await createPasskeyWallet(userIdToUse, credentialID);
            recoveredAddress = walletResult.address;
          } else {
            // Unlock existing wallet
            const unlockResult = await unlockPasskeyWallet(userIdToUse, credentialID);
            recoveredAddress = unlockResult.address;
          }
          
          address = recoveredAddress;
          
          // Update localStorage to match Arkiv identity
          if (typeof window !== 'undefined') {
            localStorage.setItem(`passkey_credential_${userIdToUse}`, credentialID);
            localStorage.setItem(`passkey_wallet_${userIdToUse}`, address);
            localStorage.setItem('wallet_address', address);
            localStorage.setItem('passkey_user_id', userIdToUse);
            setWalletType(address, 'passkey');
          }
          
          console.log('[PasskeyLoginButton] ✅ Recovered wallet from Arkiv identity');
        } catch (error) {
          console.error('[PasskeyLoginButton] Failed to authenticate with existing Arkiv identity:', error);
          // If authentication fails, we should NOT create a new passkey
          // Instead, show an error and ask user to use their existing passkey device
          const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
          throw new Error(`Found existing passkey identity on Arkiv, but authentication failed: ${errorMessage}. Please use the same passkey device you registered with, or register a backup wallet for recovery.`);
        }
      }
      
      // Registration flow: create new passkey and wallet
      // Only reached if no existing wallet AND no Arkiv identity (or Arkiv auth failed)
      if (address === undefined) {
        const userIdToUse = userId || `user_${Date.now()}`; // Generate userId if not provided
        
        // Step 1: Register passkey
        // CRITICAL: Pass storedWallet (if exists) to enable Arkiv-native duplicate prevention
        // Even if our client-side check missed something, the server will query Arkiv
        // and populate excludeCredentials, preventing duplicate registrations at the WebAuthn API level
        const registerResult = await registerPasskey(userIdToUse, undefined, storedWallet || undefined);
        credentialID = registerResult.credentialID;
        
        // Type guard for credential metadata
        const hasCredentialMetadata = registerResult.credentialPublicKey !== undefined;

        // Step 2: Create wallet
        const walletResult = await createPasskeyWallet(userIdToUse, credentialID);
        address = walletResult.address;

        // Step 3: Create Arkiv entity for passkey credential
        if (hasCredentialMetadata && registerResult.credentialPublicKey) {
          try {
            const { privateKeyHex } = await unlockPasskeyWallet(userIdToUse, credentialID);
            
            await createPasskeyIdentity({
              wallet: address,
              credentialID,
              credentialPublicKey: registerResult.credentialPublicKey,
              counter: registerResult.counter || 0,
              transports: registerResult.transports,
              privateKey: privateKeyHex,
            });
            
            console.log('[PasskeyLoginButton] ✅ Created Arkiv auth_identity entity');
          } catch (error) {
            console.warn('[PasskeyLoginButton] Failed to create Arkiv entity (non-fatal):', error);
            // Non-fatal - wallet is created, entity can be created later or on next login
          }
        }

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
        className="w-full px-6 py-3 text-base font-medium text-white bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-blue-500 dark:disabled:hover:bg-blue-600 relative group"
        title="Powered by Fusaka upgrade (EIP-7951) - native secp256r1 signature verification"
      >
        {isLoading ? 'Authenticating...' : 'Continue with Face ID or Touch ID'}
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 p-3 rounded-lg shadow-lg bg-white/95 dark:bg-gray-800 text-gray-900 dark:text-white text-xs text-center border border-gray-200 dark:border-gray-700 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
          Powered by Fusaka upgrade ({' '}
          <a
            href="https://eips.ethereum.org/EIPS/eip-7951"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-600 dark:hover:text-blue-400"
          >
            EIP-7951
          </a>
          {' '}) - enables native secp256r1 signature verification for efficient passkey authentication
        </div>
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

