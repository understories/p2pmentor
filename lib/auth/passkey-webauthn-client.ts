/**
 * WebAuthn client-side helpers for passkey authentication
 * 
 * Wraps native WebAuthn API (navigator.credentials.*) and calls server API routes.
 * This layer is purely WebAuthn ceremony - does NOT manage EVM keys.
 * 
 * Reference: Arkiv Passkey Wallet Beta Implementation Plan
 */

/**
 * Register a new passkey for a user
 * 
 * Flow:
 * 1. Fetch registration options from server (server queries Arkiv for existing credentials)
 * 2. Call navigator.credentials.create() with options (excludeCredentials prevents duplicates)
 * 3. Send response to server for verification
 * 4. Return credential ID on success
 * 
 * CRITICAL: Pass walletAddress to enable Arkiv-native duplicate prevention.
 * The server will query Arkiv and populate excludeCredentials, preventing
 * the WebAuthn API from creating duplicate passkeys even if client-side checks miss something.
 * 
 * @param userId - User identifier (wallet address or profile ID)
 * @param userName - Human-readable username (optional, defaults to userId)
 * @param walletAddress - Wallet address (optional, for Arkiv query to prevent duplicates)
 * @returns Credential ID and metadata on success
 * @throws Error if WebAuthn is not supported or registration fails
 */
export async function registerPasskey(
  userId: string,
  userName?: string,
  walletAddress?: string
): Promise<{ 
  credentialID: string; 
  challenge: string;
  credentialPublicKey?: Uint8Array;
  counter?: number;
  transports?: string[];
}> {
  // Check WebAuthn support
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  // [PASSKEY][REGISTER][START] - Log registration start
  const env = typeof window !== 'undefined' ? window.location.hostname : 'server';
  const rpId = typeof window !== 'undefined' ? window.location.hostname.replace(/^www\./, '') : 'unknown';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
  console.log('[PASSKEY][REGISTER][START]', {
    env,
    rpId,
    origin,
    walletAddress: walletAddress || 'none',
    userId,
    userName: userName || 'none',
  });

  try {
    // Step 1: Fetch registration options from server
    // Server will query Arkiv for existing credentials and populate excludeCredentials
    const optionsResponse = await fetch('/api/passkey/register/options', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, userName, walletAddress }),
    });

    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      throw new Error(error.error || 'Failed to get registration options');
    }

    const { options } = await optionsResponse.json();
    const challenge = options.challenge;

    // Step 2: Transform options for WebAuthn API
    // The server returns base64url strings, but WebAuthn requires ArrayBuffers
    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      ...options,
      challenge: base64URLToArrayBuffer(options.challenge),
      user: {
        ...options.user,
        id: base64URLToArrayBuffer(options.user.id),
      },
      // Transform allowCredentials if present (for login, not registration)
      excludeCredentials: options.excludeCredentials?.map((cred: any) => ({
        ...cred,
        id: base64URLToArrayBuffer(cred.id),
      })) || [],
    };

    console.log('[passkey-webauthn-client] Registering passkey with options:', {
      challengeLength: publicKeyOptions.challenge.byteLength,
      userIdLength: publicKeyOptions.user.id.byteLength,
      rpId: publicKeyOptions.rp.id,
      userName: publicKeyOptions.user.name,
    });

    // Step 3: Call WebAuthn API to create credential
    const credential = await navigator.credentials.create({
      publicKey: publicKeyOptions,
    }) as PublicKeyCredential;

    if (!credential) {
      throw new Error('Failed to create passkey credential');
    }

    // [PASSKEY][REGISTER][CREATED] - Log credential creation
    const credentialID_raw = credential.rawId;
    const credentialID_base64 = Buffer.from(credentialID_raw).toString('base64');
    const credentialID_base64url = Buffer.from(credentialID_raw).toString('base64url');
    const credentialID_hex = Buffer.from(credentialID_raw).toString('hex');
    console.log('[PASSKEY][REGISTER][CREATED]', {
      credentialID_raw_len: credentialID_raw.byteLength,
      credentialID_base64,
      credentialID_base64url,
      credentialID_hex: credentialID_hex.substring(0, 32) + '...', // First 32 chars for readability
      publicKeyAlgo: 'P-256', // Expected for ES256
    });

    // Step 3: Send response to server for verification
    const response = credential.response as AuthenticatorAttestationResponse;
    const attestationResponse = {
      id: credential.id,
      rawId: arrayBufferToBase64URL(credential.rawId),
      response: {
        clientDataJSON: arrayBufferToBase64URL(response.clientDataJSON),
        attestationObject: arrayBufferToBase64URL(response.attestationObject),
      },
      type: credential.type,
    };

    const completeResponse = await fetch('/api/passkey/register/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        response: attestationResponse,
        challenge,
      }),
    });

    if (!completeResponse.ok) {
      const error = await completeResponse.json();
      throw new Error(error.error || 'Registration verification failed');
    }

    const result = await completeResponse.json();
    return {
      credentialID: result.credentialID,
      challenge,
      credentialPublicKey: result.credentialPublicKey ? new Uint8Array(result.credentialPublicKey) : undefined,
      counter: result.counter,
      transports: result.transports,
    };
  } catch (error: any) {
    // Re-throw with context
    if (error.name === 'NotAllowedError') {
      throw new Error('Passkey registration was cancelled or timed out');
    } else if (error.name === 'InvalidStateError') {
      throw new Error('A passkey already exists for this device');
    } else if (error.name === 'NotSupportedError') {
      throw new Error('Passkeys are not supported on this device');
    }
    throw error;
  }
}

/**
 * Authenticate using a passkey
 * 
 * Flow:
 * 1. Fetch authentication options from server
 * 2. Call navigator.credentials.get() with options
 * 3. Send response to server for verification
 * 4. Return userId on success
 * 
 * @param userId - User identifier (optional, for allowCredentials filtering)
 * @returns User ID on success
 * @throws Error if WebAuthn is not supported or authentication fails
 */
export async function loginWithPasskey(
  userId?: string,
  walletAddress?: string
): Promise<{ userId: string; challenge: string; credentialID?: string; walletAddress?: string }> {
  // Check WebAuthn support
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  // [PASSKEY][LOGIN][START] - Log login start
  const env = typeof window !== 'undefined' ? window.location.hostname : 'server';
  const rpId = typeof window !== 'undefined' ? window.location.hostname.replace(/^www\./, '') : 'unknown';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
  console.log('[PASSKEY][LOGIN][START]', {
    env,
    rpId,
    origin,
    userId: userId || 'none',
    walletAddress: walletAddress || 'none',
  });

  try {
    // Step 1: Fetch authentication options from server
    // Pass walletAddress to enable Arkiv-native credential lookup
    const optionsResponse = await fetch('/api/passkey/login/options', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, walletAddress }),
    });

    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      throw new Error(error.error || 'Failed to get authentication options');
    }

    const { options } = await optionsResponse.json();
    const challenge = options.challenge;

    // Step 2: Transform options for WebAuthn API
    // The server returns base64url strings, but WebAuthn requires ArrayBuffers
    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      ...options,
      challenge: base64URLToArrayBuffer(options.challenge),
      // Transform allowCredentials if present
      allowCredentials: options.allowCredentials?.map((cred: any) => ({
        ...cred,
        id: base64URLToArrayBuffer(cred.id),
      })) || undefined,
    };

    console.log('[passkey-webauthn-client] Authenticating with passkey:', {
      challengeLength: publicKeyOptions.challenge.byteLength,
      allowCredentialsCount: publicKeyOptions.allowCredentials?.length || 0,
      rpId: publicKeyOptions.rpId,
    });

    // Step 3: Call WebAuthn API to get credential
    const credential = await navigator.credentials.get({
      publicKey: publicKeyOptions,
    }) as PublicKeyCredential;

    if (!credential) {
      throw new Error('Failed to authenticate with passkey');
    }

    // [PASSKEY][LOGIN][ASSERTION] - Log assertion received
    const credentialID_raw = credential.rawId;
    const credentialID_base64 = Buffer.from(credentialID_raw).toString('base64');
    const credentialID_base64url = Buffer.from(credentialID_raw).toString('base64url');
    const credentialID_hex = Buffer.from(credentialID_raw).toString('hex');
    console.log('[PASSKEY][LOGIN][ASSERTION]', {
      credentialID_base64,
      credentialID_base64url,
      credentialID_hex: credentialID_hex.substring(0, 32) + '...', // First 32 chars for readability
    });

    // Step 3: Send response to server for verification
    const response = credential.response as AuthenticatorAssertionResponse;
    const assertionResponse = {
      id: credential.id,
      rawId: arrayBufferToBase64URL(credential.rawId),
      response: {
        clientDataJSON: arrayBufferToBase64URL(response.clientDataJSON),
        authenticatorData: arrayBufferToBase64URL(response.authenticatorData),
        signature: arrayBufferToBase64URL(response.signature),
        userHandle: response.userHandle
          ? arrayBufferToBase64URL(response.userHandle)
          : null,
      },
      type: credential.type,
    };

    // Extract walletAddress from localStorage if available (for recovery scenarios)
    const storedWallet = typeof window !== 'undefined' ? localStorage.getItem('wallet_address') : null;
    
    const completeResponse = await fetch('/api/passkey/login/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        response: assertionResponse,
        challenge,
        walletAddress: storedWallet || walletAddress, // Pass walletAddress for Arkiv lookup
      }),
    });

    if (!completeResponse.ok) {
      const errorData = await completeResponse.json();
      
      // If credential was found on Arkiv but verification failed, include recovery info
      if (errorData.foundOnArkiv && errorData.credentialID && errorData.walletAddress) {
        const recoveryError: any = new Error(errorData.error || 'Authentication verification failed');
        recoveryError.credentialID = errorData.credentialID;
        recoveryError.walletAddress = errorData.walletAddress;
        recoveryError.foundOnArkiv = true;
        recoveryError.recoveryPossible = errorData.recoveryPossible;
        throw recoveryError;
      }
      
      // Include credentialID in error for recovery scenarios
      const error: any = new Error(errorData.error || 'Authentication verification failed');
      error.credentialID = credential.id; // Include credentialID from WebAuthn response
      throw error;
    }

    const result = await completeResponse.json();
    return {
      userId: result.userId,
      challenge,
      credentialID: credential.id, // Return credentialID for recovery scenarios
      walletAddress: result.walletAddress, // Return walletAddress if found on Arkiv
    };
  } catch (error: any) {
    // Re-throw with context
    if (error.name === 'NotAllowedError') {
      throw new Error('Passkey authentication was cancelled or timed out');
    } else if (error.name === 'InvalidStateError') {
      throw new Error('No passkey found for this device');
    } else if (error.name === 'NotSupportedError') {
      throw new Error('Passkeys are not supported on this device');
    }
    throw error;
  }
}

/**
 * Check if WebAuthn is supported in the current browser
 * 
 * @returns true if WebAuthn is supported, false otherwise
 */
export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

/**
 * Check if platform authenticators (Touch ID, Face ID, Windows Hello) are available
 * 
 * @returns Promise that resolves to true if platform authenticators are available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) {
    return false;
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Convert ArrayBuffer to base64url string
 * 
 * @param buffer - ArrayBuffer to convert
 * @returns Base64url-encoded string
 */
function arrayBufferToBase64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // Convert to base64, then replace URL-unsafe characters
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Convert base64url string to ArrayBuffer
 * 
 * @param base64url - Base64url-encoded string
 * @returns ArrayBuffer
 */
function base64URLToArrayBuffer(base64url: string): ArrayBuffer {
  // Convert base64url to base64
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }
  // Decode base64 to binary string
  const binary = atob(base64);
  // Convert binary string to ArrayBuffer
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

