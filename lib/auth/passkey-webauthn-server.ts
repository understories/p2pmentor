/**
 * WebAuthn server-side helpers for passkey authentication
 * 
 * Wraps @simplewebauthn/server for registration and authentication flows.
 * Server only stores WebAuthn credential metadata, NOT wallet keys.
 * 
 * Reference: Arkiv Passkey Wallet Beta Implementation Plan
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

// Relying Party configuration from environment
const rpID = process.env.PASSKEY_RP_ID || (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
const rpName = process.env.PASSKEY_RP_NAME || 'p2pmentor';
const origin = process.env.PASSKEY_ORIGIN || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

/**
 * In-memory storage for WebAuthn credentials (beta)
 * 
 * TODO: Migrate to persistent storage (database, KV store, etc.) for production
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
 * @param userId - User identifier (wallet address or profile ID)
 * @param userName - Human-readable username (for display in browser)
 * @returns WebAuthn registration options
 */
export async function getRegistrationOptions(
  userId: string,
  userName?: string
): Promise<any> {
  const opts = {
    rpName,
    rpID,
    userID: userId, // SimpleWebAuthn v9 expects string
    userName: userName || userId,
    timeout: 60000, // 60 seconds
    attestationType: 'none' as const, // We don't need attestation for beta
    excludeCredentials: [], // Allow multiple credentials per user (future)
    authenticatorSelection: {
      authenticatorAttachment: 'platform' as const, // Prefer platform authenticators (Touch ID, Face ID, etc.)
      userVerification: 'preferred' as const, // Prefer user verification but don't require
      requireResidentKey: false, // Don't require resident keys for beta
    },
    supportedAlgorithmIDs: [-7, -257], // ES256 (P-256) and RS256
  };

  return generateRegistrationOptions(opts as any);
}

/**
 * Verify registration response and store credential
 * 
 * @param userId - User identifier
 * @param response - WebAuthn registration response from client
 * @param expectedChallenge - Challenge that was sent in registration options
 * @returns Verification result with credential ID
 */
export async function verifyRegistration(
  userId: string,
  response: any,
  expectedChallenge: string
): Promise<{ verified: boolean; credentialID?: string; error?: string }> {
  try {
    // Get stored registration options (in production, store in session/DB)
    // For beta, we'll reconstruct from the response
    const opts = {
      response,
      expectedChallenge,
      expectedOrigin: origin,
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
 * @param userId - User identifier (optional, for allowCredentials filtering)
 * @returns WebAuthn authentication options
 */
export async function getAuthenticationOptions(
  userId?: string
): Promise<any> {
    const opts = {
      rpID,
      timeout: 60000, // 60 seconds
      userVerification: 'preferred' as const,
      allowCredentials: userId
        ? (credentialStore.get(userId) || []).map((cred) => ({
            id: Buffer.from(cred.credentialID).toString('base64url'),
            type: 'public-key' as const,
            transports: cred.transports || [],
          }))
        : undefined, // If no userId, allow any credential (discoverable credentials)
    };

  return generateAuthenticationOptions(opts as any);
}

/**
 * Verify authentication response
 * 
 * @param userId - User identifier (optional, for credential lookup)
 * @param response - WebAuthn authentication response from client
 * @param expectedChallenge - Challenge that was sent in authentication options
 * @returns Verification result
 */
export async function verifyAuthentication(
  userId: string | undefined,
  response: any,
  expectedChallenge: string
): Promise<{ verified: boolean; userId?: string; error?: string }> {
  try {
    // Find credential by ID (from response)
    let storedCredential: StoredCredential | undefined;
    let foundUserId: string | undefined;

    if (userId) {
      // Look in specific user's credentials
      const userCredentials = credentialStore.get(userId) || [];
      const credentialID = Buffer.from(response.id, 'base64url');
      storedCredential = userCredentials.find(
        (cred) => Buffer.from(cred.credentialID).equals(credentialID)
      );
      foundUserId = userId;
    } else {
      // Search all users (for discoverable credentials)
      const entries = Array.from(credentialStore.entries());
      for (const entry of entries) {
        const [uid, credentials] = entry;
        const credentialID = Buffer.from(response.id, 'base64url');
        const cred = credentials.find((c) => Buffer.from(c.credentialID).equals(credentialID));
        if (cred) {
          storedCredential = cred;
          foundUserId = uid;
          break;
        }
      }
    }

    if (!storedCredential || !foundUserId) {
      return { verified: false, error: 'Credential not found' };
    }

    const opts = {
      response,
      expectedChallenge,
      expectedOrigin: origin,
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
      // Update counter (replay attack protection)
      const userCredentials = credentialStore.get(foundUserId) || [];
      const credIndex = userCredentials.findIndex(
        (c) => Buffer.from(c.credentialID).equals(storedCredential!.credentialID)
      );
      if (credIndex >= 0) {
        userCredentials[credIndex].counter = verification.authenticationInfo.newCounter;
        credentialStore.set(foundUserId, userCredentials);
      }

      return { verified: true, userId: foundUserId };
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
  const credentialIDBuffer = Buffer.from(credentialID, 'base64url');
  
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
  return credentials.map((cred) => Buffer.from(cred.credentialID).toString('base64url'));
}

