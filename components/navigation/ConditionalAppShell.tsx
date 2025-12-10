'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from './AppShell';

/**
 * Conditionally renders AppShell - skips it for docs pages
 */
export function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDocsPage = pathname?.startsWith('/docs');

  if (isDocsPage) {
    // Docs pages don't use AppShell
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
