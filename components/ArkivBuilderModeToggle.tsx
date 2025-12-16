/**
 * Arkiv Builder Mode Toggle Component
 * 
 * Reusable toggle for enabling Arkiv Builder Mode across all pages.
 * Shows Arkiv entity information, queries, and links for builders.
 */

'use client';

interface ArkivBuilderModeToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function ArkivBuilderModeToggle({ enabled, onToggle }: ArkivBuilderModeToggleProps) {
  return (
    <div className="relative group">
      <button
        onClick={() => onToggle(!enabled)}
        className={`
          px-4 py-2 rounded-lg transition-all duration-200 font-semibold
          ${enabled
            ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-lg ring-2 ring-emerald-400 ring-offset-2 dark:ring-offset-gray-900'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }
        `}
        title="Arkiv Builder Mode - Toggle to see Arkiv queries and entity information"
        aria-label={enabled ? 'Disable Arkiv Builder Mode' : 'Enable Arkiv Builder Mode'}
      >
        <span className="font-mono">[A]</span>
        {enabled && <span className="ml-2 text-sm">Active</span>}
      </button>
      {/* Tooltip - positioned underneath for better readability */}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap">
        {enabled ? 'Arkiv Builder Mode: Active' : 'Enable Arkiv Builder Mode'}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900 dark:border-b-gray-800"></div>
      </div>
    </div>
  );
}

