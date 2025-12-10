'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from './AppShell';

/**
 * Conditionally renders AppShell - skips it for docs pages
 * Navigation components (SidebarNav/BottomNav) handle their own visibility for landing/auth/beta/admin
 */
export function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDocsPage = pathname?.startsWith('/docs');

  if (isDocsPage) {
    // Docs pages don't use AppShell
    return <>{children}</>;
  }

  // AppShell will render, but SidebarNav and BottomNav will hide themselves on landing/auth/beta/admin
  return <AppShell>{children}</AppShell>;
}
