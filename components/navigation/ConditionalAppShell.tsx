'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from './AppShell';

/**
 * Conditionally renders AppShell - skips it for landing, auth, beta, admin, and docs pages
 */
export function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Pages that should NOT use AppShell (no navigation, no wrapper)
  const skipAppShellPaths = ['/', '/auth', '/beta', '/admin'];
  const isDocsPage = pathname?.startsWith('/docs');
  const shouldSkip = skipAppShellPaths.some(path => pathname === path || pathname?.startsWith('/admin')) || isDocsPage;

  if (shouldSkip) {
    // Landing, auth, beta, admin, and docs pages don't use AppShell
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
