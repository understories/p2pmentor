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
      <aside className="fixed left-0 top-0 flex hidden h-screen w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 md:block">
        <div className="border-b border-gray-200 p-4 dark:border-gray-800">
          <button
            onClick={toggleTheme}
            className="rounded-lg border border-gray-200 p-2 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
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

  // When logged in, let SidebarNav work normally (with its hover expansion)
  // SidebarNav handles its own positioning and styling
  if (isLoggedIn) {
    return <SidebarNav allowOnExplorer />;
  }

  // When not logged in, show custom sidebar with login prompt
  return (
    <aside className="fixed left-0 top-0 flex hidden h-screen w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 md:block">
      {/* Theme Toggle - Always Visible */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-800">
        <button
          onClick={toggleTheme}
          className="rounded-lg border border-gray-200 p-2 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="text-xl">{theme === 'dark' ? '☀️' : '🌙'}</span>
        </button>
      </div>

      {/* Login Prompt */}
      <div className="flex flex-1 flex-col items-center justify-center space-y-4 overflow-y-auto p-4">
        <div className="text-center">
          <div className="mb-2 text-4xl">🔐</div>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            {hasBetaAccess
              ? 'Log in to access your dashboard and network'
              : 'Log in to explore p2pmentor'}
          </p>
        </div>
        <Link
          href="/auth"
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
        >
          Log In
        </Link>
      </div>

      {/* Footer (optional) */}
      <div className="border-t border-gray-200 p-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <Link href="/docs" className="hover:text-gray-700 dark:hover:text-gray-300">
          Documentation
        </Link>
      </div>
    </aside>
  );
}
