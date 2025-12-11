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
  const { level, loading } = useOnboardingLevel(wallet);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedWallet = localStorage.getItem('wallet_address');
      setWallet(storedWallet);
    }
  }, []);

  useEffect(() => {
    if (!loading && wallet && level < requiredLevel) {
      router.push(redirectTo);
    }
  }, [loading, wallet, level, requiredLevel, redirectTo, router]);

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

  if (level < requiredLevel) {
    return null; // Will redirect
  }

  return <>{children}</>;
}
