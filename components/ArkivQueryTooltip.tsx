/**
 * Arkiv Query Tooltip Component
 * 
 * Shows Arkiv query information in a tooltip, similar to profile page.
 * Used in Arkiv Builder Mode to teach builders about queries.
 */

'use client';

interface ArkivQueryTooltipProps {
  query: string[];
  label?: string;
  children: React.ReactNode;
}

export function ArkivQueryTooltip({ query, label = 'Arkiv Query', children }: ArkivQueryTooltipProps) {
  return (
    <div className="group/query relative">
      {children}
      {/* Tooltip */}
      <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/query:opacity-100 transition-opacity duration-200 pointer-events-none z-10 font-mono text-left max-w-md">
        <div className="font-semibold mb-1">{label}:</div>
        {query.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
      </div>
    </div>
  );
}

