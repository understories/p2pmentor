/**
 * Leaf Chip Filter Component
 * 
 * Glowing leaf chips representing active filters.
 * Replaces rectangular filter box with organic forest aesthetic.
 * Part of Network page "Canopy Map" transformation.
 */

'use client';

import { useTheme } from '@/lib/theme';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';

interface LeafChipFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  arkivBuilderMode?: boolean;
}

export function LeafChipFilter({
  value,
  onChange,
  placeholder = 'Filter by skill...',
  arkivBuilderMode = false,
}: LeafChipFilterProps) {
  const { theme } = useTheme();

  const hasFilter = value.trim().length > 0;
  const filterWords = value.trim().split(/\s+/).filter(Boolean);

  const removeFilter = (wordToRemove: string) => {
    const newWords = filterWords.filter(w => w !== wordToRemove);
    onChange(newWords.join(' '));
  };

  const clearAll = () => {
    onChange('');
  };

  return (
    <div className="mb-6">
      {/* Filter Chips */}
      {hasFilter && (
        <div className="flex flex-wrap gap-2 mb-3">
          {filterWords.map((word, index) => (
            <div
              key={index}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
              style={{
                backgroundColor: theme === 'dark'
                  ? 'rgba(34, 197, 94, 0.2)'
                  : 'rgba(34, 197, 94, 0.15)',
                borderColor: theme === 'dark'
                  ? 'rgba(34, 197, 94, 0.4)'
                  : 'rgba(34, 197, 94, 0.3)',
                borderWidth: '1px',
                boxShadow: theme === 'dark'
                  ? '0 0 8px rgba(34, 197, 94, 0.3)'
                  : '0 2px 4px rgba(34, 197, 94, 0.2)',
                color: theme === 'dark' ? 'rgba(200, 255, 200, 0.9)' : 'rgba(22, 163, 74, 0.9)',
              }}
            >
              <span>🍃</span>
              <span>{word}</span>
              <button
                onClick={() => removeFilter(word)}
                className="ml-1 hover:opacity-70 transition-opacity"
                aria-label={`Remove ${word} filter`}
              >
                ×
              </button>
            </div>
          ))}
          {filterWords.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Input */}
      {arkivBuilderMode ? (
        <ArkivQueryTooltip
          query={[
            `Filter by skill: "${value || '...'}"`,
            `Queries: GET /api/skills?slug=${encodeURIComponent(value.toLowerCase().trim())}`,
            `If skill entity found: filters by skill_id`,
            `Otherwise: filters by skill string (legacy)`,
            `Filters: asks, offers, matches by skill`
          ]}
          label="Skill Filter"
        >
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-3 rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            style={{
              backgroundColor: theme === 'dark'
                ? 'rgba(31, 41, 55, 0.6)'
                : 'rgba(255, 255, 255, 0.9)',
              borderColor: theme === 'dark'
                ? 'rgba(34, 197, 94, 0.3)'
                : 'rgba(34, 197, 94, 0.2)',
              color: theme === 'dark' ? 'rgba(229, 231, 235, 0.9)' : 'rgba(17, 24, 39, 0.9)',
            }}
          />
        </ArkivQueryTooltip>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          style={{
            backgroundColor: theme === 'dark'
              ? 'rgba(31, 41, 55, 0.6)'
              : 'rgba(255, 255, 255, 0.9)',
            borderColor: theme === 'dark'
              ? 'rgba(34, 197, 94, 0.3)'
              : 'rgba(34, 197, 94, 0.2)',
            color: theme === 'dark' ? 'rgba(229, 231, 235, 0.9)' : 'rgba(17, 24, 39, 0.9)',
          }}
        />
      )}
    </div>
  );
}
