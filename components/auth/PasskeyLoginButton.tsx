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

      // STEP 1: Arkiv-first check - ALWAYS check Arkiv before registration
      // This is the source of truth, not localStorage or IndexedDB
      // Check for ANY wallet address we might have (from localStorage or previous session)
      const storedUserId = typeof window !== 'undefined' ? localStorage.getItem('passkey_user_id') : null;
      const storedWallet = typeof window !== 'undefined' ? localStorage.getItem('wallet_address') : null;
      
      // CRITICAL: Check Arkiv FIRST for existing passkey identities
      // This prevents duplicate registrations even when localStorage is empty
      let hasArkivIdentity = false;
      let arkivWallet: string | null = null;
      let arkivIdentities: any[] = [];
      
      if (storedWallet) {
        try {
          arkivIdentities = await listPasskeyIdentities(storedWallet);
          hasArkivIdentity = arkivIdentities.length > 0;
          if (hasArkivIdentity) {
            arkivWallet = storedWallet;
            console.log('[PasskeyLoginButton] ✅ Found', arkivIdentities.length, 'existing Arkiv passkey identity(ies) for wallet:', storedWallet);
          }
        } catch (error) {
          console.warn('[PasskeyLoginButton] Failed to check Arkiv for existing identity:', error);
        }
      }
      
      // If no wallet in localStorage, try to find any passkey identity on Arkiv
      // This handles cases where user has passkeys but localStorage was cleared
      if (!hasArkivIdentity && !storedWallet) {
        // For now, we can't query "all passkeys" without a wallet
        // But we'll handle this in the login flow below
        console.log('[PasskeyLoginButton] No wallet in localStorage, will attempt login first');
      }

      // Check if we have existing local wallet state
      const hasExistingWallet = storedUserId !== null;

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
                  // [PASSKEY][LOGIN][NOT_REGISTERED] - Log before showing error
                  console.error('[PASSKEY][LOGIN][NOT_REGISTERED]', {
                    reason: 'not_in_arkiv',
                    credentialId_base64url: credentialIDFromError,
                    walletAddress: storedWallet || 'none',
                    recoveryAttempted: true,
                    recoveryResult: 'not_found',
                  });
                  
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
          // No local wallet and no Arkiv identity - will try Arkiv-first login below, then registration if needed
        }
      }
      
      // STEP 2: If Arkiv has identity, ALWAYS try login first (default to login, not registration)
      // Only register if truly no identity exists anywhere
      if (address === undefined && hasArkivIdentity && arkivWallet) {
        // Arkiv has identity - attempt login with existing credential
        console.log('[PasskeyLoginButton] Arkiv has identity, attempting login (not registration)');
        
        try {
          // Generate stable userId from wallet address
          const stableUserId = `wallet_${arkivWallet.toLowerCase().slice(2, 10)}`;
          
          // Attempt authentication with existing credential
          const loginResult = await loginWithPasskey(stableUserId, arkivWallet);
          credentialID = loginResult.credentialID;
          
          if (!credentialID) {
            // Use first identity's credentialID as fallback
            credentialID = arkivIdentities[0]?.credentialID;
          }
          
          if (!credentialID) {
            throw new Error('Credential ID not found');
          }
          
          // Create/recover local wallet
          const hasLocal = await hasLocalPasskeyWallet(stableUserId);
          if (!hasLocal) {
            const walletResult = await createPasskeyWallet(stableUserId, credentialID);
            address = walletResult.address;
          } else {
            const unlockResult = await unlockPasskeyWallet(stableUserId, credentialID);
            address = unlockResult.address;
          }
          
          // Update localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem(`passkey_credential_${stableUserId}`, credentialID);
            localStorage.setItem(`passkey_wallet_${stableUserId}`, address);
            localStorage.setItem('wallet_address', address);
            localStorage.setItem('passkey_user_id', stableUserId);
            setWalletType(address, 'passkey');
          }
          
          console.log('[PasskeyLoginButton] ✅ Successfully logged in with existing Arkiv identity');
        } catch (error) {
          console.error('[PasskeyLoginButton] Login with Arkiv identity failed:', error);
          // If login fails, don't automatically register - show error
          throw new Error(`Found existing passkey on Arkiv, but authentication failed. Please use the same device you registered with, or contact support. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // STEP 3: Registration flow - ONLY if no Arkiv identity exists
      // This is truly a new user/device registration
      if (address === undefined) {
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
        // CRITICAL: Pass storedWallet (if exists) to enable Arkiv-native duplicate prevention
        // Even if our client-side check missed something, the server will query Arkiv
        // and populate excludeCredentials, preventing duplicate registrations at the WebAuthn API level
        const registerResult = await registerPasskey(userIdToUse, userNameToUse, storedWallet || undefined);
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

        // Step 3: Create Arkiv entity for passkey credential
        // CRITICAL: Use API route with global Arkiv signing wallet (not passkey wallet)
        // The passkey wallet has no funds - all Arkiv transactions must be signed by the env wallet
        if (hasCredentialMetadata && registerResult.credentialPublicKey) {
          try {
            // [PASSKEY][REGISTER][ARKIV_WRITE] - Log before Arkiv write
            console.log('[PASSKEY][REGISTER][ARKIV_WRITE]', {
              wallet: address,
              credentialId_base64url: credentialID,
              spaceId: 'local-dev',
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
              throw new Error(arkivData.error || 'Failed to create Arkiv passkey identity');
            }
            
            // [PASSKEY][REGISTER][ARKIV_WRITE] - Log success
            console.log('[PASSKEY][REGISTER][ARKIV_WRITE]', {
              success: true,
              entityId: arkivData.key,
              txHash: arkivData.txHash,
              spaceId: 'local-dev',
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
            console.warn('[PasskeyLoginButton] Failed to create Arkiv entity (non-fatal):', error);
            // Non-fatal - wallet is created, entity can be created later or on next login
          }
        }

        // Store credentialID and userId for future logins
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

