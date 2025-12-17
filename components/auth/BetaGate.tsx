/**
 * Beta Gate Component
 * 
 * Client-side component to protect pages with beta access check.
 * Provides fast UX feedback and redirects if no access.
 * 
 * Note: This is UX-only - server-side middleware provides actual security.
 * 
 * Reference: refs/docs/beta_code_gating_plan.md Phase 4
 */

'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useBetaAccess } from '@/lib/hooks/useBetaAccess';
import { safePathname } from '@/lib/utils/redirect';

export function BetaGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { hasAccess, loading } = useBetaAccess();

  useEffect(() => {
    if (!loading && !hasAccess) {
      // Redirect to /beta with return URL
      // Validate pathname to prevent encoding "null" (pathname can be null during hydration)
      const returnUrl = safePathname(pathname, '/auth');
      
      // Use URL APIs to avoid double-encoding (don't manually encode)
      if (typeof window !== 'undefined') {
        const url = new URL('/beta', window.location.origin);
        url.searchParams.set('redirect', returnUrl); // URLSearchParams handles encoding automatically
        router.push(url.pathname + url.search);
      } else {
        // Fallback for SSR (shouldn't happen, but safe)
        router.push(`/beta?redirect=${encodeURIComponent(returnUrl)}`);
      }
    }
  }, [hasAccess, loading, router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-4">🌱</div>
          <p className="text-gray-600 dark:text-gray-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return null; // Will redirect
  }

  return <>{children}</>;
}
