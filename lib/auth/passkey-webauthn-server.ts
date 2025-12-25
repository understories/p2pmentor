/**
 * WebAuthn API route helpers for passkey authentication
 * 
 * Wraps @simplewebauthn/server for registration and authentication flows.
 * Runs in serverless API routes (Next.js). Credentials stored on Arkiv, NOT in memory.
 * 
 * Reference: Arkiv Passkey Wallet Beta Implementation Plan
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { base64urlToBuffer, bufferToBase64url, isBase64urlSupported } from './base64url';

// Log base64url support status on module load (for debugging)
if (typeof process !== 'undefined') {
  const supported = isBase64urlSupported();
  console.log('[passkey-webauthn-server] Base64URL encoding support:', {
    supported,
    nodeVersion: process.version,
    runtime: typeof Buffer !== 'undefined' ? 'Node.js' : 'unknown',
  });
}

// Relying Party configuration from environment
// RP ID must match the current domain or be a valid parent domain
// Best practice: Use root domain (without www) to work across all subdomains
function getRPID(): string {
  if (process.env.PASSKEY_RP_ID) {
    // If explicitly set, use it (but strip www. if present for cross-subdomain compatibility)
    return process.env.PASSKEY_RP_ID.replace(/^www\./, '');
  }
  // Default: use hostname and strip www. for cross-subdomain compatibility
  if (typeof window !== 'undefined') {
    return window.location.hostname.replace(/^www\./, '');
  }
  return 'localhost';
}

const rpID = getRPID();
const rpName = process.env.PASSKEY_RP_NAME || 'p2pmentor';

/**
 * Get expected origin for WebAuthn verification
 * 
 * Priority:
 * 1. PASSKEY_ORIGIN env var (explicit override)
 * 2. Request origin (from headers, in API routes)
 * 3. window.location.origin (client-side)
 * 4. Default to localhost for development
 * 
 * @param requestOrigin - Origin from request headers (optional)
 * @returns Expected origin string
 */
function getExpectedOrigin(requestOrigin?: string): string {
  if (process.env.PASSKEY_ORIGIN) {
    return process.env.PASSKEY_ORIGIN;
  }
  if (requestOrigin) {
    return requestOrigin;
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // Default for API routes when no request origin provided
  return process.env.NODE_ENV === 'production' 
    ? 'https://p2pmentor.com' 
    : 'http://localhost:3000';
}

/**
 * In-memory storage for WebAuthn credentials (backward compatibility only)
 * 
 * NOTE: This is ephemeral and lost on serverless function restart.
 * New credentials are stored on Arkiv. This Map is only for migration/fallback.
 * Structure: Map<userId, Array<Credential>>
 */
interface StoredCredential {
  credentialID: Uint8Array;
  credentialPublicKey: Uint8Array;
  counter: number;
  transports?: string[]; // e.g., ['usb', 'nfc', 'ble', 'internal']
}

const credentialStore = new Map<string, StoredCredential[]>();

/**
 * Get registration options for a new passkey
 * 
 * CRITICAL: Queries Arkiv for existing credentials and populates excludeCredentials
 * to prevent duplicate passkey registrations. This is called BEFORE navigator.credentials.create()
 * to ensure the WebAuthn API itself prevents duplicates.
 * 
 * @param userId - User identifier (wallet address or profile ID)
 * @param userName - Human-readable username (for display in browser)
 * @param walletAddress - Wallet address (optional, for Arkiv query to find existing credentials)
 * @param platformOnly - If true, use strict platform-only constraints to prevent QR dialog
 * @returns WebAuthn registration options with excludeCredentials populated from Arkiv
 */
export async function getRegistrationOptions(
  userId: string,
  userName?: string,
  walletAddress?: string,
  platformOnly: boolean = false
): Promise<any> {
  // CRITICAL: Query Arkiv for existing passkey identities BEFORE generating options
  // This prevents duplicate registrations at the WebAuthn API level
  let excludeCredentials: any[] = [];
  
  if (walletAddress) {
    try {
      const { listPasskeyIdentities } = await import('@/lib/arkiv/authIdentity');
      const identities = await listPasskeyIdentities(walletAddress);
      
      if (identities.length > 0) {
        // Populate excludeCredentials with existing credential IDs from Arkiv
        excludeCredentials = identities
          .filter(identity => identity.credentialID)
          .map((identity) => {
            // Convert base64url credentialID to ArrayBuffer for WebAuthn
            try {
              const credentialIDBuffer = base64urlToBuffer(identity.credentialID!);
              return {
                id: credentialIDBuffer,
                type: 'public-key' as const,
                transports: identity.credential?.transports || [],
              };
            } catch (error) {
              console.warn('[getRegistrationOptions] Failed to convert credentialID to ArrayBuffer:', error);
              return null;
            }
          })
          .filter((cred): cred is NonNullable<typeof cred> => cred !== null);
        
        console.log('[getRegistrationOptions] Found', excludeCredentials.length, 'existing credentials on Arkiv to exclude');
      }
    } catch (error) {
      console.warn('[getRegistrationOptions] Failed to query Arkiv for existing credentials:', error);
      // Continue with empty excludeCredentials - better to allow registration than block it
    }
  }

  // Use meaningful userName - prefer provided userName, fallback to wallet address format
  // If userId is wallet-based (wallet_xxxx), extract wallet address for display
  let displayName = userName;
  if (!displayName && userId.startsWith('wallet_')) {
    // Extract wallet address from userId (wallet_12345678 -> 0x12345678...)
    const walletSuffix = userId.replace('wallet_', '');
    displayName = `0x${walletSuffix}...`;
  } else if (!displayName) {
    // Last resort: use userId as-is
    displayName = userId;
  }

  // Build authenticatorSelection options
  // For platform-only: use strict constraints to prevent cross-device eligibility
  // For cross-device: explicitly set cross-platform to make QR/phone flow deterministic
  const authenticatorSelection: any = platformOnly
    ? {
        authenticatorAttachment: 'platform' as const, // Force platform authenticator only
        userVerification: 'required' as const, // Required (not preferred) for strictness
        residentKey: 'required' as const, // Modern WebAuthn guidance (not requireResidentKey)
      }
    : {
        authenticatorAttachment: 'cross-platform' as const, // Explicitly allow cross-platform (QR/phone/USB key)
        userVerification: 'preferred' as const, // Prefer user verification but don't require
        residentKey: 'preferred' as const, // Prefer resident keys
      };

  const opts = {
    rpName,
    rpID,
    userID: userId, // SimpleWebAuthn v9 expects string (stable wallet-based ID)
    userName: displayName, // Human-readable name for browser display
    timeout: 60000, // 60 seconds
    attestationType: 'none' as const, // We don't need attestation for beta
    excludeCredentials, // Populated from Arkiv to prevent duplicates
    authenticatorSelection,
    supportedAlgorithmIDs: [-7, -257], // ES256 (P-256) and RS256
  };

  const generatedOptions = await generateRegistrationOptions(opts as any);

  // CRITICAL: Log what SimpleWebAuthn actually returns
  // This helps verify if it maps residentKey to requireResidentKey internally
  console.log('[PASSKEY][REGISTER][SERVER] SimpleWebAuthn generated options:', {
    platformOnly,
    authenticatorSelection: {
      authenticatorAttachment: generatedOptions.authenticatorSelection?.authenticatorAttachment || 'not_set',
      userVerification: generatedOptions.authenticatorSelection?.userVerification || 'not_set',
      residentKey: (generatedOptions.authenticatorSelection as any)?.residentKey || 'not_set',
      requireResidentKey: (generatedOptions.authenticatorSelection as any)?.requireResidentKey || 'not_set',
    },
    note: 'Verify browser receives intended constraints',
  });

  return generatedOptions;
}

/**
 * Verify registration response and store credential
 * 
 * @param userId - User identifier
 * @param response - WebAuthn registration response from client
 * @param expectedChallenge - Challenge that was sent in registration options
 * @returns Verification result with credential ID and metadata
 */
export async function verifyRegistration(
  userId: string,
  response: any,
  expectedChallenge: string,
  requestOrigin?: string
): Promise<{ 
  verified: boolean; 
  credentialID?: string; 
  credentialPublicKey?: Uint8Array;
  counter?: number;
  transports?: string[];
  error?: string;
}> {
  try {
    const expectedOrigin = getExpectedOrigin(requestOrigin);
    
    // Registration options reconstructed from response (stateless serverless function)
    const opts = {
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false, // Optional for beta
    };

    const verification = await verifyRegistrationResponse(opts);

      if (verification.verified && verification.registrationInfo) {
        // Store credential metadata
        const credential: StoredCredential = {
          credentialID: verification.registrationInfo.credentialID,
          credentialPublicKey: verification.registrationInfo.credentialPublicKey,
          counter: verification.registrationInfo.counter,
          transports: (verification.registrationInfo as any).transports,
        };

      // Add to user's credentials
      const userCredentials = credentialStore.get(userId) || [];
      userCredentials.push(credential);
      credentialStore.set(userId, userCredentials);

      return {
        verified: true,
        credentialID: Buffer.from(credential.credentialID).toString('base64url'),
        credentialPublicKey: credential.credentialPublicKey,
        counter: credential.counter,
        transports: credential.transports,
      };
    }

    return { verified: false, error: 'Verification failed' };
  } catch (error: any) {
    console.error('[passkey-webauthn-server] Registration verification error:', error);
    return { verified: false, error: error.message || 'Verification error' };
  }
}

/**
 * Get authentication options for passkey login
 * 
 * Queries Arkiv for credentials (replaces in-memory Map lookup).
 * Falls back to in-memory Map for backward compatibility during migration.
 * 
 * @param userId - User identifier (optional, for allowCredentials filtering)
 * @param walletAddress - Wallet address (optional, for Arkiv query)
 * @param requestOrigin - Origin from request headers (optional, for consistency checks)
 * @returns WebAuthn authentication options
 */
export async function getAuthenticationOptions(
  userId?: string,
  walletAddress?: string,
  requestOrigin?: string
): Promise<any> {
  // [PASSKEY][LOGIN][START] - Log server-side login options generation
  const env = process.env.NODE_ENV || 'development';
  const rpId = getRPID();
  const origin = getExpectedOrigin(requestOrigin);
  console.log('[PASSKEY][LOGIN][START]', {
    env,
    rpId,
    origin,
    requestOrigin: requestOrigin || 'none',
    userId: userId || 'none',
    walletAddress: walletAddress || 'none',
  });

  let allowCredentials: any[] | undefined = undefined;

  // CREDENTIAL-FIRST: allowCredentials is optional
  // If empty, WebAuthn will show all passkeys for this RP (discoverable credentials)
  // Server will query Arkiv by credentialID after WebAuthn response (in verifyAuthentication)
  // This enables login even when localStorage is empty
  
  // Optional: Try to populate allowCredentials if wallet address provided (optimization only)
  // This is NOT required - login will work without it
  if (walletAddress) {
    try {
      const { listPasskeyIdentities } = await import('@/lib/arkiv/authIdentity');
      const identities = await listPasskeyIdentities(walletAddress);
      
      // [PASSKEY][LOGIN][START] - Log Arkiv query results
      const arkivCredentialIds = identities
        .filter(id => id.credentialID)
        .map(id => id.credentialID!);
      
      console.log('[PASSKEY][LOGIN][START]', {
        arkivQueryResult: {
          found: identities.length,
          credentialIds: arkivCredentialIds.map(id => id.substring(0, 16) + '...'), // First 16 chars for readability
        },
        note: 'allowCredentials populated for optimization, but not required for login',
      });
      
      if (identities.length > 0) {
        allowCredentials = identities
          .filter(identity => identity.credentialID)
          .map((identity) => ({
            id: identity.credentialID!,
            type: 'public-key' as const,
            transports: identity.credential?.transports || [],
          }));
      }
    } catch (error) {
      console.warn('[PASSKEY][LOGIN][START]', {
        arkivQueryResult: {
          error: error instanceof Error ? error.message : String(error),
        },
        note: 'allowCredentials query failed (non-fatal - login will still work)',
      });
    }
  }

  // Fallback to in-memory Map (for backward compatibility only)
  if (!allowCredentials && userId) {
    const userCredentials = credentialStore.get(userId) || [];
    allowCredentials = userCredentials.map((cred) => ({
      id: bufferToBase64url(cred.credentialID),
      type: 'public-key' as const,
      transports: cred.transports || [],
    }));
  }

  // Note: authenticatorSelection is NOT valid for authentication (only for registration)
  // The key to avoiding QR/phone routing is populating allowCredentials with known credential IDs
  // When allowCredentials is empty, Safari may offer all passkeys including phone-based ones
  const opts = {
    rpID,
    timeout: 60000, // 60 seconds
    userVerification: 'preferred' as const,
    allowCredentials: allowCredentials && allowCredentials.length > 0 ? allowCredentials : undefined,
  };

  const generatedOptions = await generateAuthenticationOptions(opts as any);

  // [PASSKEY][LOGIN][OPTIONS] - Comprehensive logging of final options shape
  // This logging will help diagnose why Safari sometimes routes to phone QR vs platform authenticator
  console.log('[PASSKEY][LOGIN][OPTIONS]', {
    rpId: generatedOptions.rpId || rpId,
    allowCredentialsCount: generatedOptions.allowCredentials?.length || 0,
    userVerification: generatedOptions.userVerification || 'preferred',
    timeout: generatedOptions.timeout || 60000,
    challengeLength: generatedOptions.challenge?.length || 0,
    intendedBehavior: {
      allowCredentialsProvided: (generatedOptions.allowCredentials?.length || 0) > 0,
      note: allowCredentials && allowCredentials.length > 0
        ? 'allowCredentials populated - should narrow to known credentials (prefers platform authenticator)'
        : 'allowCredentials empty - will show all passkeys for this RP (may include phone QR)',
    },
    warning: allowCredentials && allowCredentials.length === 0
      ? 'allowCredentials is empty - Safari may route to phone QR even if platform authenticator exists'
      : undefined,
  });

  return generatedOptions;
}

/**
 * Verify authentication response
 * 
 * Queries Arkiv for credentials (replaces in-memory Map lookup).
 * Falls back to in-memory Map for backward compatibility during migration.
 * 
 * @param userId - User identifier (optional, for credential lookup)
 * @param walletAddress - Wallet address (optional, for Arkiv query)
 * @param response - WebAuthn authentication response from client
 * @param expectedChallenge - Challenge that was sent in authentication options
 * @returns Verification result
 */
export async function verifyAuthentication(
  userId: string | undefined,
  response: any,
  expectedChallenge: string,
  requestOrigin?: string,
  walletAddress?: string
): Promise<{ verified: boolean; userId?: string; walletAddress?: string; newCounter?: number; error?: string }> {
  try {
    const expectedOrigin = getExpectedOrigin(requestOrigin);
    const credentialID = response.id; // base64url-encoded from client
    
    // [PASSKEY][LOGIN][CREDENTIAL_LOOKUP] - Log lookup start
    console.log('[PASSKEY][LOGIN][CREDENTIAL_LOOKUP]', {
      credentialId_base64url: credentialID,
      userId: userId || 'none',
      walletAddress: walletAddress || 'none',
      attempting: 'arkiv_first',
    });
    
    // Try Arkiv first (by credentialID or wallet address)
    let arkivIdentity: any = null;
    let foundWallet: string | undefined = undefined;
    let arkivQueryError: any = null;
    
    try {
      const { findPasskeyIdentityByCredentialID, listPasskeyIdentities } = await import('@/lib/arkiv/authIdentity');
      
      // Try finding by credentialID first (most direct)
      arkivIdentity = await findPasskeyIdentityByCredentialID(credentialID);
      
      if (arkivIdentity) {
        foundWallet = arkivIdentity.wallet;
        console.log('[PASSKEY][LOGIN][CREDENTIAL_LOOKUP]', {
          found: true,
          source: 'findPasskeyIdentityByCredentialID',
          wallet: foundWallet,
          arkiv_credentialId: arkivIdentity.credentialID,
          match: arkivIdentity.credentialID === credentialID ? 'exact' : 'mismatch',
        });
      } else if (walletAddress) {
        // Fallback: query by wallet address
        const identities = await listPasskeyIdentities(walletAddress);
        const matchingIdentity = identities.find(id => id.credentialID === credentialID);
        
        console.log('[PASSKEY][LOGIN][CREDENTIAL_LOOKUP]', {
          found: !!matchingIdentity,
          source: 'listPasskeyIdentities',
          wallet: walletAddress,
          totalIdentities: identities.length,
          knownCredentialIds: identities
            .filter(id => id.credentialID)
            .map(id => ({
              stored: id.credentialID!.substring(0, 16) + '...',
              received: credentialID.substring(0, 16) + '...',
              match: id.credentialID === credentialID,
            })),
        });
        
        if (matchingIdentity) {
          arkivIdentity = matchingIdentity;
          foundWallet = walletAddress;
        }
      }
    } catch (error) {
      arkivQueryError = error;
      console.warn('[PASSKEY][LOGIN][CREDENTIAL_LOOKUP]', {
        arkivQueryFailed: true,
        error: error instanceof Error ? error.message : String(error),
        fallingBackTo: 'in_memory_map',
      });
    }

    // Convert Arkiv credential to StoredCredential format if found
    let storedCredential: StoredCredential | undefined;
    let foundUserId: string | undefined;

    if (arkivIdentity && arkivIdentity.credential) {
      // Use Arkiv credential
      const cred = arkivIdentity.credential;
      const credentialIDBuffer = Buffer.from(credentialID, 'base64url');
      const publicKeyBuffer = Buffer.from(cred.credentialPublicKey, 'base64');
      
      // [PASSKEY][LOGIN][CREDENTIAL_LOOKUP] - Log encoding comparison
      console.log('[PASSKEY][LOGIN][CREDENTIAL_LOOKUP]', {
        found: true,
        source: 'arkiv',
        encodingCheck: {
          received_base64url: credentialID,
          stored_base64url: cred.credentialID,
          match: cred.credentialID === credentialID,
        },
      });
      
      storedCredential = {
        credentialID: credentialIDBuffer,
        credentialPublicKey: publicKeyBuffer,
        counter: cred.counter || 0,
        transports: cred.transports,
      };
      foundUserId = foundWallet || userId || arkivIdentity.wallet;
    } else {
      // Fallback to in-memory Map (for backward compatibility)
      console.log('[PASSKEY][LOGIN][CREDENTIAL_LOOKUP]', {
        found: false,
        source: 'arkiv',
        fallingBackTo: 'in_memory_map',
        checkingUserId: userId || 'none',
      });
      
      if (userId) {
        const userCredentials = credentialStore.get(userId) || [];
        const credentialIDBuffer = base64urlToBuffer(credentialID);
        storedCredential = userCredentials.find(
          (cred) => Buffer.from(cred.credentialID).equals(credentialIDBuffer)
        );
        foundUserId = userId;
        
        console.log('[PASSKEY][LOGIN][CREDENTIAL_LOOKUP]', {
          found: !!storedCredential,
          source: 'in_memory_map',
          userId,
          credentialsInMap: userCredentials.length,
        });
      } else {
        // Search all users (for discoverable credentials)
        const entries = Array.from(credentialStore.entries());
        for (const entry of entries) {
          const [uid, credentials] = entry;
          const credentialIDBuffer = base64urlToBuffer(credentialID); // Use custom utility for compatibility
          const cred = credentials.find((c) => Buffer.from(c.credentialID).equals(credentialIDBuffer));
          if (cred) {
            storedCredential = cred;
            foundUserId = uid;
            break;
          }
        }
        
        console.log('[PASSKEY][LOGIN][CREDENTIAL_LOOKUP]', {
          found: !!storedCredential,
          source: 'in_memory_map_discoverable',
          searchedUsers: entries.length,
        });
      }
    }

    if (!storedCredential || !foundUserId) {
      // [PASSKEY][LOGIN][NOT_REGISTERED] - Log before returning error
      console.error('[PASSKEY][LOGIN][NOT_REGISTERED]', {
        reason: !arkivIdentity ? 'not_in_arkiv' : !storedCredential ? 'credential_mismatch' : 'no_user_id',
        credentialId_base64url: credentialID,
        arkivQueryAttempted: !arkivQueryError,
        arkivQueryError: arkivQueryError ? (arkivQueryError instanceof Error ? arkivQueryError.message : String(arkivQueryError)) : null,
        userId: userId || 'none',
        walletAddress: walletAddress || 'none',
      });
      
      return { verified: false, error: 'Credential not found' };
    }

    const opts = {
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: storedCredential.credentialID,
        credentialPublicKey: storedCredential.credentialPublicKey,
        counter: storedCredential.counter,
      },
      requireUserVerification: false, // Optional for beta
    };

    const verification = await verifyAuthenticationResponse(opts);

    if (verification.verified) {
      // Update counter (replay attack protection) - Pattern B: update in place
      if (arkivIdentity) {
        // Pattern B: Update counter in place using updatePasskeyCounter
        try {
          const { updatePasskeyCounter } = await import('@/lib/arkiv/authIdentity');
          const { getPrivateKey } = await import('@/lib/config');

          await updatePasskeyCounter(
            credentialID,
            verification.authenticationInfo.newCounter,
            getPrivateKey() // Use global Arkiv signing wallet
          );

          console.log('[verifyAuthentication] Counter updated (Pattern B: update in place):', {
            oldCounter: storedCredential.counter,
            newCounter: verification.authenticationInfo.newCounter,
            credentialID: credentialID,
          });
        } catch (error: any) {
          console.error('[verifyAuthentication] Failed to update counter:', error);
          // Non-fatal: authentication succeeded, counter update can retry
          // Log warning but don't fail authentication
        }
      } else {
        // Update in-memory Map (backward compatibility)
        const userCredentials = credentialStore.get(foundUserId) || [];
        const credIndex = userCredentials.findIndex(
          (c) => Buffer.from(c.credentialID).equals(storedCredential!.credentialID)
        );
        if (credIndex >= 0) {
          userCredentials[credIndex].counter = verification.authenticationInfo.newCounter;
          credentialStore.set(foundUserId, userCredentials);
        }
      }

      return { 
        verified: true, 
        userId: foundUserId,
        walletAddress: foundWallet,
        newCounter: verification.authenticationInfo.newCounter,
      };
    }

    return { verified: false, error: 'Verification failed' };
  } catch (error: any) {
    console.error('[passkey-webauthn-server] Authentication verification error:', error);
    return { verified: false, error: error.message || 'Verification error' };
  }
}

/**
 * Remove a passkey credential (for reset/revocation)
 * 
 * @param userId - User identifier
 * @param credentialID - Base64url-encoded credential ID
 * @returns Success status
 */
export function removeCredential(userId: string, credentialID: string): boolean {
  const userCredentials = credentialStore.get(userId) || [];
  const credentialIDBuffer = base64urlToBuffer(credentialID);
  
  const filtered = userCredentials.filter(
    (cred) => !Buffer.from(cred.credentialID).equals(credentialIDBuffer)
  );

  if (filtered.length < userCredentials.length) {
    credentialStore.set(userId, filtered);
    return true;
  }

  return false;
}

/**
 * Get all credentials for a user (for management UI)
 * 
 * @param userId - User identifier
 * @returns Array of credential IDs (base64url-encoded)
 */
export function getUserCredentials(userId: string): string[] {
  const credentials = credentialStore.get(userId) || [];
  return credentials.map((cred) => bufferToBase64url(cred.credentialID));
}

/**
 * Clear all credentials for a user
 * 
 * @param userId - User identifier
 * @returns True if credentials were cleared, false if none existed
 */
export function clearUserCredentials(userId: string): boolean {
  const hadCredentials = credentialStore.has(userId);
  credentialStore.delete(userId);
  return hadCredentials;
}

/**
 * Clear ALL credentials from in-memory Map (for reset/testing)
 * 
 * WARNING: This clears all passkey credentials from the ephemeral in-memory store.
 * Arkiv entities are NOT affected. Use with caution - users with only in-memory
 * credentials will need to re-register.
 */
export function clearAllCredentials(): void {
  credentialStore.clear();
}

