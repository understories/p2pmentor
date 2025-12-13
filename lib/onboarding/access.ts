/**
 * Onboarding Access Verification Utility
 * 
 * Client-side utility to verify onboarding access with bypass mechanism.
 * Similar to beta gate pattern - provides consistent onboarding checks app-wide.
 * 
 * Reference: lib/auth/betaAccess.ts (beta gate pattern)
 */

export type OnboardingAccessCheck = {
  hasAccess: boolean;
  level?: number;
  requiredLevel?: number;
  error?: string;
  bypassed?: boolean;
};

/**
 * Check if onboarding bypass is active
 * Uses sessionStorage to persist bypass flag for the session
 */
export function hasOnboardingBypass(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check sessionStorage for bypass flag
  const bypass = sessionStorage.getItem('onboarding_bypass');
  return bypass === 'true';
}

/**
 * Set onboarding bypass flag
 * Call this when user explicitly wants to bypass onboarding (e.g., from onboarding flow)
 */
export function setOnboardingBypass(value: boolean = true): void {
  if (typeof window === 'undefined') return;
  
  if (value) {
    sessionStorage.setItem('onboarding_bypass', 'true');
  } else {
    sessionStorage.removeItem('onboarding_bypass');
  }
}

/**
 * Verify onboarding access
 * 
 * @param wallet - User wallet address
 * @param requiredLevel - Minimum onboarding level required (default: 0)
 * @param options - Verification options
 * @returns Onboarding access check result
 */
export async function verifyOnboardingAccess(
  wallet: string | null | undefined,
  requiredLevel: number = 0,
  options?: {
    allowBypass?: boolean; // Default: true (allow bypass mechanism)
  }
): Promise<OnboardingAccessCheck> {
  // No wallet = no access
  if (!wallet) {
    return { 
      hasAccess: false, 
      requiredLevel,
      error: 'No wallet address provided' 
    };
  }

  // Check bypass flag (if allowed)
  const allowBypass = options?.allowBypass !== false;
  if (allowBypass && hasOnboardingBypass()) {
    return { 
      hasAccess: true, 
      requiredLevel,
      level: requiredLevel, // Assume they have the required level if bypassed
      bypassed: true 
    };
  }

  // Calculate actual onboarding level
  try {
    const { calculateOnboardingLevel } = await import('./state');
    const level = await calculateOnboardingLevel(wallet);
    
    return {
      hasAccess: level >= requiredLevel,
      level,
      requiredLevel,
      bypassed: false,
    };
  } catch (error) {
    console.error('[verifyOnboardingAccess] Error calculating level:', error);
    // On error, be permissive (don't block access)
    return {
      hasAccess: true,
      requiredLevel,
      level: requiredLevel,
      error: error instanceof Error ? error.message : 'Failed to calculate onboarding level',
      bypassed: false,
    };
  }
}

/**
 * Route-level onboarding check
 * Use this in page components to check access
 * 
 * @param wallet - User wallet address
 * @param requiredLevel - Minimum onboarding level required
 * @param redirectTo - Where to redirect if access denied (default: '/onboarding')
 * @returns True if access granted, false if redirecting
 */
export async function checkOnboardingRoute(
  wallet: string | null | undefined,
  requiredLevel: number = 0,
  redirectTo: string = '/onboarding'
): Promise<boolean> {
  const check = await verifyOnboardingAccess(wallet, requiredLevel);
  
  if (!check.hasAccess && typeof window !== 'undefined') {
    // Redirect to onboarding, but set bypass flag so they can navigate back
    // This allows onboarding flow to link back to the page
    const currentUrl = window.location.pathname + window.location.search;
    window.location.href = `${redirectTo}?returnTo=${encodeURIComponent(currentUrl)}`;
    return false;
  }
  
  return true;
}

