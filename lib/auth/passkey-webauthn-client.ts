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
 * 1. Fetch registration options from server
 * 2. Call navigator.credentials.create() with options
 * 3. Send response to server for verification
 * 4. Return credential ID on success
 * 
 * @param userId - User identifier (wallet address or profile ID)
 * @param userName - Human-readable username (optional, defaults to userId)
 * @returns Credential ID and metadata on success
 * @throws Error if WebAuthn is not supported or registration fails
 */
export async function registerPasskey(
  userId: string,
  userName?: string
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

  try {
    // Step 1: Fetch registration options from server
    const optionsResponse = await fetch('/api/passkey/register/options', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, userName }),
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
  userId?: string
): Promise<{ userId: string; challenge: string }> {
  // Check WebAuthn support
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  try {
    // Step 1: Fetch authentication options from server
    const optionsResponse = await fetch('/api/passkey/login/options', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
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

    const completeResponse = await fetch('/api/passkey/login/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        response: assertionResponse,
        challenge,
      }),
    });

    if (!completeResponse.ok) {
      const error = await completeResponse.json();
      throw new Error(error.error || 'Authentication verification failed');
    }

    const result = await completeResponse.json();
    return {
      userId: result.userId,
      challenge,
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

