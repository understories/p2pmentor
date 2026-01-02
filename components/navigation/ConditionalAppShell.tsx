'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from './AppShell';

/**
 * Conditionally renders AppShell - skips it for landing, auth, beta, admin, docs, and explorer pages
 * These pages should have NO wrapper, NO navigation, just pure content
 * Explorer has its own adaptive sidebar (ExplorerSidebar)
 */
export function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Pages that should NOT use AppShell at all (no wrapper, no nav, nothing)
  const skipAppShellPaths = ['/', '/auth', '/beta', '/explorer'];
  const isAdminPage = pathname?.startsWith('/admin');
  const isDocsPage = pathname?.startsWith('/docs');
  
  if (skipAppShellPaths.includes(pathname || '') || isAdminPage || isDocsPage) {
    // Landing, auth, beta, admin, docs, and explorer pages - NO AppShell wrapper at all
    // Explorer has its own adaptive sidebar
    return <>{children}</>;
  }

  // All other pages get AppShell with navigation
  return <AppShell>{children}</AppShell>;
}
