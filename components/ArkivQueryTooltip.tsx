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

export function ArkivQueryTooltip({
  query,
  label = 'Arkiv Query',
  children,
}: ArkivQueryTooltipProps) {
  const arkivBuilderMode = useArkivBuilderMode();

  // If builder mode is disabled, just render children without tooltip wrapper
  if (!arkivBuilderMode) {
    return <>{children}</>;
  }

  return (
    <div className="group/query relative inline-block overflow-visible">
      {children}
      {/* Tooltip - positioned directly above the element */}
      <div
        className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-[9999] -translate-x-1/2 whitespace-normal break-words rounded-lg bg-gray-900 px-3 py-2 text-left font-mono text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover/query:opacity-100 dark:bg-gray-800 dark:text-white"
        style={{ minWidth: '200px', maxWidth: '400px' }}
      >
        <div className="mb-1 font-semibold text-white dark:text-white">{label}:</div>
        {query.map((line, i) => (
          <div key={i} className="whitespace-normal break-words text-white dark:text-white">
            {line}
          </div>
        ))}
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
      </div>
    </div>
  );
}
