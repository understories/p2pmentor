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
        className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
          enabled
            ? 'bg-emerald-600 dark:bg-emerald-500 text-white border-emerald-600 dark:border-emerald-500'
            : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 border-emerald-300/50 dark:border-emerald-600/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20'
        }`}
        title="Arkiv Builder Mode"
      >
        [A]
      </button>
      {/* Tooltip - positioned underneath for better readability */}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap">
        Arkiv Builder Mode
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900 dark:border-b-gray-800"></div>
      </div>
    </div>
  );
}

