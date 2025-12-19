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
// PRESERVED FOR FUTURE USE: Brave browser detection
// import { useBraveBrowser } from '@/lib/hooks/useBraveBrowser';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarHovered, setSidebarHovered] = useState(false);
  // PRESERVED FOR FUTURE USE: Brave browser detection (disabled due to issues)
  // const isBrave = useBraveBrowser();

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
      {/* PRESERVED FOR FUTURE USE: Brave browser zoom fix (disabled due to issues) */}
      {/* style={isBrave ? { transform: 'scale(0.93)', transformOrigin: 'top left' } : undefined} */}
      {/* Global z-index fix: ensure content is always above skill garden (z-[1]) */}
      <main 
        className={`relative z-10 md:ml-4 ${sidebarHovered ? 'md:ml-56' : ''} pt-14 md:pt-0 pb-4 min-h-screen transition-all duration-300 ease-out backdrop-blur-sm`}
      >
        {children}
      </main>

      {/* Floating Action Button */}
      <FloatingActionButton />
    </>
  );
}

