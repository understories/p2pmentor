/**
 * App Shell Component
 * 
 * Phase 0: Wraps app content with navigation (bottom nav on mobile, sidebar on desktop).
 * Provides consistent layout without breaking existing flows.
 */

'use client';

import { BottomNav } from './BottomNav';
import { SidebarNav } from './SidebarNav';
import { FloatingActionButton } from './FloatingActionButton';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <SidebarNav />

      {/* Mobile Top Nav */}
      <BottomNav />

      {/* Main Content Area */}
      <main className="md:ml-56 pt-14 md:pt-0 pb-4 min-h-screen">
        {children}
      </main>

      {/* Floating Action Button */}
      <FloatingActionButton />
    </>
  );
}

