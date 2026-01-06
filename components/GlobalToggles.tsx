/**
 * Global Toggles Component
 * 
 * Combines ThemeToggle and ArkivBuilderModeToggle in a single global component.
 * Positioned in the top-right corner, available on every page.
 */

'use client';

import { useTheme } from '@/lib/theme';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArkivBuilderModeToggle } from './ArkivBuilderModeToggle';

export function GlobalToggles() {
  const [mounted, setMounted] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const isLitePage = pathname === '/lite';
  const isExplorerPage = pathname === '/explorer';
  // Show theme toggle on all pages except lite (which has it in FloatingButtonCluster) and explorer
  // Explorer page doesn't need theme toggle as it's a data viewing page
  const showThemeToggle = !isLitePage && !isExplorerPage;
  const [arkivBuilderMode, setArkivBuilderMode] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    // Load Arkiv Builder Mode from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('arkiv_builder_mode');
      setArkivBuilderMode(saved === 'true');

      // Listen for changes from other components (e.g., ArkivModeBanner)
      const handleModeChange = (e: Event) => {
        const customEvent = e as CustomEvent<{ enabled: boolean }>;
        setArkivBuilderMode(customEvent.detail.enabled);
      };

      window.addEventListener('arkiv-builder-mode-changed', handleModeChange);
      return () => window.removeEventListener('arkiv-builder-mode-changed', handleModeChange);
    }
  }, []);

  const handleThemeToggle = () => {
    toggleTheme();
    // Mark that user has manually toggled (stops auto-switching on landing page)
    if (pathname === '/') {
      // Signal to SunriseSunsetTimer that user has taken control
      window.dispatchEvent(new Event('theme-toggled'));
    }
  };

  const handleArkivBuilderModeToggle = (enabled: boolean) => {
    setArkivBuilderMode(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('arkiv_builder_mode', enabled ? 'true' : 'false');
      // Dispatch event so other components can listen for changes
      window.dispatchEvent(new CustomEvent('arkiv-builder-mode-changed', { detail: { enabled } }));
    }
  };

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return null;
  }

  // Show on all pages (including /, /auth, /beta, /docs)
  // Show on mobile for landing, beta, auth, and docs pages
  const showOnMobile = pathname === '/' || pathname === '/beta' || pathname === '/auth' || (pathname && pathname.startsWith('/docs'));
  const mobileClass = showOnMobile ? 'block' : 'hidden md:block';

  // For docs pages on mobile, position above the navbar (navbar is at top-0 with z-40)
  // Navbar has py-2 and content, so roughly 48-56px tall. Position toggle above it.
  const isDocsPage = pathname && pathname.startsWith('/docs');
  // On mobile docs: position at top with small margin, on desktop: keep top-4
  const topPosition = isDocsPage ? 'top-2 md:top-4' : 'top-4';

  return (
    <div 
      className={`${mobileClass} fixed ${topPosition} right-4 z-50 flex flex-row items-center justify-end gap-2`}
    >
      {/* Theme Toggle - show on all pages except lite (has it in FloatingButtonCluster) and explorer */}
      {showThemeToggle && (
      <button
        onClick={handleThemeToggle}
        className="flex items-center justify-center p-3 rounded-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 flex-shrink-0"
        style={{
          backgroundColor: theme === 'dark' 
            ? 'rgba(5, 20, 5, 0.3)' 
            : 'rgba(240, 240, 240, 0.9)',
          color: theme === 'dark'
            ? 'rgba(200, 255, 200, 0.9)'
            : '#495057',
          boxShadow: theme === 'dark'
            ? '0 0 20px rgba(100, 255, 100, 0.1), inset 0 0 20px rgba(100, 255, 100, 0.05)'
            : '0 1px 3px rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(10px)',
        }}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <span className="text-xl" style={{ 
          textShadow: theme === 'dark' 
            ? '0 0 8px rgba(150, 255, 150, 0.4), 0 0 15px rgba(100, 255, 100, 0.2)'
            : 'none'
        }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </span>
      </button>
      )}

      {/* Arkiv Builder Mode Toggle - hidden on lite and explorer pages */}
      {!isLitePage && !isExplorerPage && (
        <ArkivBuilderModeToggle
          enabled={arkivBuilderMode}
          onToggle={handleArkivBuilderModeToggle}
        />
      )}
    </div>
  );
}

