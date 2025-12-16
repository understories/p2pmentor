/**
 * Arkiv Mode Banner Component
 *
 * Shows a banner at the top of the page when Arkiv Builder Mode is enabled.
 * Displays mode status and provides quick access to toggle.
 */

'use client';

import { useState, useEffect } from 'react';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivBuilderModeToggle } from './ArkivBuilderModeToggle';

export function ArkivModeBanner() {
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

  if (!mounted || !arkivBuilderMode) return null;

  const handleToggle = (enabled: boolean) => {
    setArkivBuilderModeState(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('arkiv_builder_mode', enabled ? 'true' : 'false');
      window.dispatchEvent(new CustomEvent('arkiv-builder-mode-changed', { detail: { enabled } }));
    }
  };

  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800 px-4 py-2 relative z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-emerald-700 dark:text-emerald-300 font-medium">
              Arkiv Builder Mode: Active
            </span>
            {queryCount > 0 && (
              <span className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded">
                {queryCount} {queryCount === 1 ? 'query' : 'queries'}
              </span>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors"
            aria-label={collapsed ? 'Expand banner' : 'Collapse banner'}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
        {/* Toggle removed from banner - now always in GlobalToggles for consistency */}
      </div>
      {!collapsed && (
        <div className="max-w-7xl mx-auto mt-2 text-sm text-emerald-800 dark:text-emerald-200">
          Hover over elements to see Arkiv queries and entity information. All data is stored on Arkiv blockchain.
        </div>
      )}
    </div>
  );
}

