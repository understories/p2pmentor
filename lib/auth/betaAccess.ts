/**
 * Beta Access Verification Utility
 * 
 * Server-side utility to verify beta access from requests.
 * Used by API routes and middleware to check beta code access.
 * 
 * Reference: refs/docs/beta_code_gating_plan.md Phase 3
 */

import { NextRequest } from 'next/server';
import { getBetaAccessByWallet } from '@/lib/arkiv/betaAccess';
import { getBetaCodeUsage } from '@/lib/arkiv/betaCode';
import { SPACE_ID } from '@/lib/config';

export type BetaAccessCheck = {
  hasAccess: boolean;
  code?: string;
  accessKey?: string;
  error?: string;
};

/**
 * Verify beta access from request
 * 
 * Checks cookies for beta access and optionally validates on Arkiv.
 * 
 * @param request - Next.js request object
 * @param options - Verification options
 * @returns Beta access check result
 */
export async function verifyBetaAccess(
  request: NextRequest,
  options?: {
    requireArkivValidation?: boolean; // Default: false (performance)
    walletAddress?: string; // If provided, verify wallet binding
  }
): Promise<BetaAccessCheck> {
  const betaCode = request.cookies.get('beta_access_code')?.value;
  const betaAccessKey = request.cookies.get('beta_access_key')?.value;

  // Basic check: cookies present
  if (!betaCode && !betaAccessKey) {
    return { hasAccess: false, error: 'No beta access found in cookies' };
  }

  // Optional: Verify on Arkiv (adds latency, use sparingly)
  if (options?.requireArkivValidation) {
    // Verify code hasn't exceeded limit
    if (betaCode) {
      try {
        const usage = await getBetaCodeUsage(betaCode, SPACE_ID);
        if (usage && usage.usageCount >= usage.limit) {
          return { hasAccess: false, error: 'Beta code limit exceeded' };
        }
      } catch (error) {
        console.warn('[verifyBetaAccess] Failed to check code usage:', error);
        // Don't fail on Arkiv query errors - allow access if cookies are present
      }
    }

    // Verify wallet has beta access (if wallet provided)
    if (options.walletAddress) {
      try {
        const access = await getBetaAccessByWallet(options.walletAddress, SPACE_ID);
        if (!access) {
          // Wallet doesn't have access record yet (may be pre-auth)
          // This is okay - access will be created post-auth
          // For now, allow if cookies are present
        } else if (betaCode && access.code !== betaCode) {
          return { hasAccess: false, error: 'Beta access not found for wallet' };
        }
      } catch (error) {
        console.warn('[verifyBetaAccess] Failed to check wallet access:', error);
        // Don't fail on Arkiv query errors
      }
    }
  }

  return { 
    hasAccess: true, 
    code: betaCode, 
    accessKey: betaAccessKey 
  };
}

/**
 * Check beta access from cookie string (client-side helper)
 *
 * Centralized cookie parsing for beta access detection.
 * Used by client components to check beta access without duplicating logic.
 *
 * @param cookieString - document.cookie string
 * @returns True if beta access cookies are present
 */
export function hasBetaAccessFromCookieString(cookieString: string): boolean {
  if (!cookieString) return false;

  // Parse cookies - handle values containing '='
  const cookies = cookieString.split(';').reduce((acc, cookie) => {
    const trimmed = cookie.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return acc;
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    acc[key] = value; // Values are already decoded by browser
    return acc;
  }, {} as Record<string, string>);

  // Check for either beta access cookie type
  return !!(cookies['beta_access_code'] || cookies['beta_access_key']);
}
