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
    <div className="group relative">
      <button
        onClick={() => onToggle(!enabled)}
        className={`flex min-w-fit flex-row items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 font-semibold transition-all duration-200 ${
          enabled
            ? 'bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-400 ring-offset-2 dark:bg-emerald-500 dark:ring-offset-gray-900'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
        } `}
        title="Arkiv Builder Mode - Toggle to see Arkiv queries and entity information"
        aria-label={enabled ? 'Disable Arkiv Builder Mode' : 'Enable Arkiv Builder Mode'}
      >
        <span className="flex-shrink-0 font-mono">[A]</span>
        {enabled && <span className="flex-shrink-0 text-sm">Active</span>}
      </button>
      {/* Tooltip - positioned underneath for better readability */}
      <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 transform whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 dark:bg-gray-800">
        {enabled ? 'Arkiv Builder Mode: Active' : 'Enable Arkiv Builder Mode'}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 transform border-4 border-transparent border-b-gray-900 dark:border-b-gray-800"></div>
      </div>
    </div>
  );
}
