/**
 * App Shell Component
 * 
 * Phase 0: Wraps app content with navigation (bottom nav on mobile, sidebar on desktop).
 * Provides consistent layout without breaking existing flows.
 */

'use client';

import { useState } from 'react';
import { BottomNav } from './BottomNav';
import { SidebarNav } from './SidebarNav';
import { FloatingActionButton } from './FloatingActionButton';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarHovered, setSidebarHovered] = useState(false);

  return (
    <>
      {/* Desktop Sidebar - hover detection */}
      <div
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className="hidden md:block"
      >
        <SidebarNav />
      </div>

      {/* Mobile Top Nav */}
      <BottomNav />

      {/* Main Content Area - adjusts margin when sidebar is hovered */}
      <main className={`md:ml-4 ${sidebarHovered ? 'md:ml-56' : ''} pt-14 md:pt-0 pb-4 min-h-screen transition-all duration-300 ease-out backdrop-blur-sm`}>
        {children}
      </main>

      {/* Floating Action Button */}
      <FloatingActionButton />
    </>
  );
}

