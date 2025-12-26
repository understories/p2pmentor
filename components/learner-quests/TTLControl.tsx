/**
 * TTL Control Component
 *
 * Reusable component for selecting TTL (Time-to-Live) for Arkiv artifacts.
 * Used in meta-learning quest artifact submissions.
 *
 * Reference: refs/meta-learning-quest-implementation-plan.md
 */

'use client';

import { useState } from 'react';

export type TTLPreset = '1day' | '1week' | '1month' | '6months' | '1year' | '3years' | 'custom';

const TTL_PRESETS: Record<TTLPreset, number> = {
  '1day': 86400, // 1 day in seconds
  '1week': 604800, // 7 days
  '1month': 2592000, // 30 days
  '6months': 15552000, // 180 days
  '1year': 31536000, // 365 days (default)
  '3years': 94608000, // 3 years
  'custom': 0, // Will be set by user input
};

const TTL_PRESET_LABELS: Record<TTLPreset, string> = {
  '1day': '1 day',
  '1week': '1 week',
  '1month': '1 month',
  '6months': '6 months',
  '1year': '1 year',
  '3years': '3 years',
  'custom': 'Custom',
};

export interface TTLControlProps {
  value: number; // TTL in seconds
  onChange: (ttlSeconds: number) => void;
  showAdvanced?: boolean;
  onAdvancedToggle?: (show: boolean) => void;
  applyToRemaining?: boolean;
  onApplyToRemainingChange?: (apply: boolean) => void;
  className?: string;
}

export function TTLControl({
  value,
  onChange,
  showAdvanced: showAdvancedProp,
  onAdvancedToggle,
  applyToRemaining,
  onApplyToRemainingChange,
  className = '',
}: TTLControlProps) {
  const [showAdvanced, setShowAdvanced] = useState(showAdvancedProp || false);
  const [customValue, setCustomValue] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<TTLPreset>(() => {
    // Find matching preset
    for (const [preset, seconds] of Object.entries(TTL_PRESETS)) {
      if (preset !== 'custom' && seconds === value) {
        return preset as TTLPreset;
      }
    }
    return 'custom';
  });

  const handlePresetChange = (preset: TTLPreset) => {
    setSelectedPreset(preset);
    if (preset !== 'custom') {
      onChange(TTL_PRESETS[preset]);
      setCustomValue('');
    }
  };

  const handleCustomChange = (input: string) => {
    setCustomValue(input);
    const numValue = parseInt(input, 10);
    if (!isNaN(numValue) && numValue >= 3600) {
      onChange(numValue);
    }
  };

  const formatTTL = (seconds: number): string => {
    if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) !== 1 ? 's' : ''}`;
    } else if (seconds < 2592000) {
      return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) !== 1 ? 's' : ''}`;
    } else if (seconds < 31536000) {
      return `${Math.floor(seconds / 2592000)} month${Math.floor(seconds / 2592000) !== 1 ? 's' : ''}`;
    } else {
      return `${Math.floor(seconds / 31536000)} year${Math.floor(seconds / 31536000) !== 1 ? 's' : ''}`;
    }
  };

  const toggleAdvanced = () => {
    const newValue = !showAdvanced;
    setShowAdvanced(newValue);
    onAdvancedToggle?.(newValue);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Visible retention summary (collapsed by default) */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">Retention:</span>{' '}
          <span>{formatTTL(value)}</span>
        </div>
        <button
          type="button"
          onClick={toggleAdvanced}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showAdvanced ? 'Hide' : 'Advanced'} options
        </button>
      </div>

      {/* Advanced TTL controls */}
      {showAdvanced && (
        <div className="space-y-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          {/* Presets */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Retention Duration
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['1day', '1week', '1month', '6months', '1year', '3years'] as TTLPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetChange(preset)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    selectedPreset === preset
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400'
                  }`}
                >
                  {TTL_PRESET_LABELS[preset]}
                </button>
              ))}
            </div>
          </div>

          {/* Custom input */}
          <div>
            <label htmlFor="custom-ttl" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Custom (seconds)
            </label>
            <input
              id="custom-ttl"
              type="number"
              min="3600"
              step="1"
              value={selectedPreset === 'custom' ? customValue || value : ''}
              onChange={(e) => {
                setSelectedPreset('custom');
                handleCustomChange(e.target.value);
              }}
              placeholder={value.toString()}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Minimum: 3600 seconds (1 hour)
            </p>
          </div>

          {/* Apply to remaining steps checkbox */}
          {onApplyToRemainingChange && (
            <div className="flex items-center">
              <input
                id="apply-to-remaining"
                type="checkbox"
                checked={applyToRemaining || false}
                onChange={(e) => onApplyToRemainingChange(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="apply-to-remaining" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Apply this retention to remaining steps in this quest
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

