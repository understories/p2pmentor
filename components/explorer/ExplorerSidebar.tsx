/**
 * Explorer Adaptive Sidebar
 *
 * Adapts based on user authentication state:
 * - Logged in: Shows full SidebarNav
 * - Not logged in: Shows login prompt
 * - Theme toggle always visible
 *
 * Reference: refs/docs/explorer-adaptive-sidebar-plan.md
 */

'use client';

import { useExplorerAuthState } from '@/lib/hooks/useExplorerAuthState';
import { useTheme } from '@/lib/theme';
import { SidebarNav } from '@/components/navigation/SidebarNav';
import Link from 'next/link';

export function ExplorerSidebar() {
  const { hasBetaAccess, isLoggedIn, wallet, loading } = useExplorerAuthState();
  const { theme, toggleTheme } = useTheme();

  // Render neutral placeholder during loading (prevents hydration flash)
  if (loading) {
    return (
      <aside className="hidden md:block w-64 h-screen fixed left-0 top-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="text-xl">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
        </div>
        <div className="flex-1" />
      </aside>
    );
  }

  return (
    <aside className="hidden md:block w-64 h-screen fixed left-0 top-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Theme Toggle - Always Visible */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="text-xl">{theme === 'dark' ? '☀️' : '🌙'}</span>
        </button>
      </div>

      {/* Conditional Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoggedIn ? (
          // Logged in: Show full sidebar navigation
          // Pass allowOnExplorer and nested props
          // nested=true disables fixed positioning (ExplorerSidebar handles container)
          <SidebarNav allowOnExplorer nested />
        ) : (
          // Not logged in: Show login prompt
          <div className="p-4 flex flex-col items-center justify-center h-full space-y-4">
            <div className="text-center">
              <div className="text-4xl mb-2">🔐</div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {hasBetaAccess
                  ? 'Log in to access your dashboard and network'
                  : 'Log in to explore p2pmentor'}
              </p>
            </div>
            <Link
              href="/auth"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Log In
            </Link>
          </div>
        )}
      </div>

      {/* Footer (optional) */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/docs" className="hover:text-gray-700 dark:hover:text-gray-300">
          Documentation
        </Link>
      </div>
    </aside>
  );
}

