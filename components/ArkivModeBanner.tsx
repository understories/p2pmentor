/**
 * Arkiv Mode Banner Component
 *
 * Shows a banner at the top of the page when Arkiv Builder Mode is enabled.
 * Displays mode status and provides quick access to toggle.
 */

'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivBuilderModeToggle } from './ArkivBuilderModeToggle';

export function ArkivModeBanner() {
  const pathname = usePathname();
  const isExplorerPage = pathname === '/explorer';
  const arkivBuilderMode = useArkivBuilderMode();
  const [queryCount, setQueryCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [arkivBuilderModeState, setArkivBuilderModeState] = useState(false);

  useEffect(() => {
    setMounted(true);
    setArkivBuilderModeState(arkivBuilderMode);
  }, [arkivBuilderMode]);

  // Listen for query events (for future Phase 3 implementation)
  useEffect(() => {
    if (!arkivBuilderMode) return;

    const handleQuery = (event: Event) => {
      const customEvent = event as CustomEvent;
      setQueryCount((prev) => prev + 1);
    };

    window.addEventListener('arkiv-query', handleQuery);
    return () => window.removeEventListener('arkiv-query', handleQuery);
  }, [arkivBuilderMode]);

  if (!mounted || !arkivBuilderMode || isExplorerPage) return null;

  const handleToggle = (enabled: boolean) => {
    setArkivBuilderModeState(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('arkiv_builder_mode', enabled ? 'true' : 'false');
      window.dispatchEvent(new CustomEvent('arkiv-builder-mode-changed', { detail: { enabled } }));
    }
  };

  return (
    <div className="relative z-40 border-b border-emerald-200 bg-emerald-50 px-4 py-2 dark:border-emerald-800 dark:bg-emerald-900/20">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-emerald-700 dark:text-emerald-300">
              Arkiv Builder Mode: Active
            </span>
            {queryCount > 0 && (
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-sm text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                {queryCount} {queryCount === 1 ? 'query' : 'queries'}
              </span>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-emerald-600 transition-colors hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200"
            aria-label={collapsed ? 'Expand banner' : 'Collapse banner'}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
        {/* Toggle removed from banner - now always in GlobalToggles for consistency */}
      </div>
      {!collapsed && (
        <div className="mx-auto mt-2 max-w-7xl text-sm text-emerald-800 dark:text-emerald-200">
          Hover over elements to see Arkiv queries and entity information. All data is stored on
          Arkiv blockchain.
        </div>
      )}
    </div>
  );
}
