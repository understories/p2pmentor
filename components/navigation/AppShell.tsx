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

      {/* Main Content Area */}
      <main className="md:ml-20 pb-20 md:pb-4">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav />

      {/* Floating Action Button */}
      <FloatingActionButton />
    </>
  );
}

