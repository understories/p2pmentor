'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from './AppShell';

/**
 * Conditionally renders AppShell - skips it for landing, auth, beta, admin, and docs pages
 * These pages should have NO wrapper, NO navigation, just pure content
 */
export function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Pages that should NOT use AppShell at all (no wrapper, no nav, nothing)
  const skipAppShellPaths = ['/', '/auth', '/beta'];
  const isAdminPage = pathname?.startsWith('/admin');
  const isDocsPage = pathname?.startsWith('/docs');
  
  if (skipAppShellPaths.includes(pathname || '') || isAdminPage || isDocsPage) {
    // Landing, auth, beta, admin, and docs pages - NO AppShell wrapper at all
    return <>{children}</>;
  }

  // All other pages get AppShell with navigation
  return <AppShell>{children}</AppShell>;
}
