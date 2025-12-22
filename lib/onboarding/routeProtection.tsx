/**
 * Route Protection Component
 * 
 * Redirects to onboarding if user hasn't completed it.
 * Use this as a wrapper for protected routes.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingLevel } from './useOnboardingLevel';
import { hasOnboardingBypass } from './access';

interface RouteProtectionProps {
  children: React.ReactNode;
  requiredLevel?: number;
  redirectTo?: string;
}

export function RouteProtection({ 
  children, 
  requiredLevel = 0,
  redirectTo = '/onboarding'
}: RouteProtectionProps) {
  const router = useRouter();
  const [wallet, setWallet] = useState<string | null>(null);
  const { level, loading, error } = useOnboardingLevel(wallet);
  const [hasBypass, setHasBypass] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedWallet = localStorage.getItem('wallet_address');
      setWallet(storedWallet);
      setHasBypass(hasOnboardingBypass());
    }
  }, []);

  useEffect(() => {
    // Don't redirect if:
    // - Still loading
    // - No wallet
    // - Bypass is active
    // - There's an error (be permissive on errors to avoid locking out users)
    // - Level meets requirement
    if (!loading && wallet && !hasBypass && !error && level !== null && level < requiredLevel) {
      router.push(redirectTo);
    }
  }, [loading, wallet, level, requiredLevel, redirectTo, router, hasBypass, error]);

  if (loading || !wallet) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-4">🌱</div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Allow access if bypass is active, error occurred (be permissive), or level meets requirement
  if (!hasBypass && !error && level !== null && level < requiredLevel) {
    return null; // Will redirect
  }

  return <>{children}</>;
}
