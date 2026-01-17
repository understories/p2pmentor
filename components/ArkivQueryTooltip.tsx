/**
 * Arkiv Query Tooltip Component
 * 
 * Shows Arkiv query information in a tooltip, similar to profile page.
 * Used in Arkiv Builder Mode to teach builders about queries.
 * Only shows tooltip when Arkiv Builder Mode is enabled.
 */

'use client';

import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';

interface ArkivQueryTooltipProps {
  query: string[];
  label?: string;
  children: React.ReactNode;
}

export function ArkivQueryTooltip({ query, label = 'Arkiv Query', children }: ArkivQueryTooltipProps) {
  const arkivBuilderMode = useArkivBuilderMode();

  // If builder mode is disabled, just render children without tooltip wrapper
  if (!arkivBuilderMode) {
    return <>{children}</>;
  }

  return (
    <div className="group/query relative inline-block overflow-visible">
      {children}
      {/* Tooltip - positioned directly above the element */}
      <div className="absolute bottom-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white dark:text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/query:opacity-100 transition-opacity duration-200 pointer-events-none z-[9999] font-mono text-left whitespace-normal break-words" style={{ minWidth: '200px', maxWidth: '400px' }}>
        <div className="font-semibold mb-1 text-white dark:text-white">{label}:</div>
        {query.map((line, i) => (
          <div key={i} className="whitespace-normal break-words text-white dark:text-white">{line}</div>
        ))}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
      </div>
    </div>
  );
}

