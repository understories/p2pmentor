/**
 * React Hook for Onboarding Access
 * 
 * Provides onboarding access check with bypass mechanism.
 * Similar to beta gate pattern - consistent app-wide onboarding checks.
 */

import { useState, useEffect } from 'react';
import { verifyOnboardingAccess, hasOnboardingBypass, setOnboardingBypass } from './access';
import type { OnboardingAccessCheck } from './access';

export function useOnboardingAccess(
  wallet: string | null | undefined,
  requiredLevel: number = 0
) {
  const [check, setCheck] = useState<OnboardingAccessCheck | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wallet) {
      setCheck({
        hasAccess: false,
        requiredLevel,
        error: 'No wallet address',
      });
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        setLoading(true);
        const result = await verifyOnboardingAccess(wallet, requiredLevel);
        if (!cancelled) {
          setCheck(result);
        }
      } catch (error) {
        if (!cancelled) {
          setCheck({
            hasAccess: true, // Be permissive on error
            requiredLevel,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [wallet, requiredLevel]);

  return {
    ...check,
    loading,
    hasBypass: hasOnboardingBypass(),
    setBypass: setOnboardingBypass,
  };
}

