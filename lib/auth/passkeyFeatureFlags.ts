/**
 * Feature flags for passkey login
 * 
 * Reuses existing feature flag pattern from lib/graph/featureFlags.ts
 * 
 * Reference: Arkiv Passkey Wallet Beta Implementation Plan
 */

/**
 * Check if passkey login is enabled (server-side)
 * 
 * @returns true if ENABLE_PASSKEY_LOGIN is set to 'true'
 */
export function isPasskeyLoginEnabled(): boolean {
  return process.env.ENABLE_PASSKEY_LOGIN === 'true';
}

/**
 * Check if passkey login is enabled (client-side)
 * 
 * On client, fetches from API endpoint to get server-side flag status.
 * Falls back to NEXT_PUBLIC_ENABLE_PASSKEY_LOGIN if API unavailable.
 * 
 * @returns Promise that resolves to true if passkey login is enabled
 */
export async function usePasskeyLogin(): Promise<boolean> {
  if (typeof window === 'undefined') {
    // Server-side: use direct env access
    return isPasskeyLoginEnabled();
  }

  try {
    // Client-side: fetch from API (more reliable than process.env)
    const response = await fetch('/api/passkey/feature-flag');
    if (response.ok) {
      const data = await response.json();
      return data.enabled === true;
    }
  } catch (error) {
    // Fallback to NEXT_PUBLIC_ env var if API fails
    console.warn('[passkeyFeatureFlags] Failed to fetch feature flag, using env var fallback');
  }

  // Fallback to NEXT_PUBLIC_ env var
  return process.env.NEXT_PUBLIC_ENABLE_PASSKEY_LOGIN === 'true';
}

