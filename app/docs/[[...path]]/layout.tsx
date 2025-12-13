import { ReactNode } from 'react';

export default function DocsLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Docs pages should not use AppShell - they're standalone
  // Root layout handles ThemeProvider, BackgroundImage, and FloatingButtonCluster
  return <>{children}</>;
}
