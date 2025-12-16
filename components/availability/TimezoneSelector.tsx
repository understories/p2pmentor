/**
 * Timezone Selector Component
 *
 * Searchable dropdown for selecting IANA timezone with full world coverage.
 * Auto-detects user timezone on first load.
 * Uses native browser APIs (Intl) - no external dependencies.
 *
 * Arkiv-native: Stores timezone as IANA string in UTC, client-side translation.
 */

'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Get all IANA timezones supported by the browser
 * Falls back to common timezones if Intl.supportedValuesOf is not available
 */
function getAllTimezones(): string[] {
  try {
    // Modern browsers support Intl.supportedValuesOf('timeZone')
    if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch {
    // Fallback if not supported
  }

  // Fallback to common timezones if API not available
  return [
    'UTC',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid',
    'Europe/Amsterdam', 'Europe/Stockholm', 'Europe/Vienna', 'Europe/Zurich',
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Dubai',
    'Asia/Kolkata', 'Asia/Seoul', 'Asia/Bangkok', 'Asia/Jakarta',
    'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth',
    'Pacific/Auckland', 'America/Toronto', 'America/Vancouver', 'America/Mexico_City',
    'America/Sao_Paulo', 'America/Buenos_Aires', 'Africa/Cairo', 'Africa/Johannesburg',
  ];
}

/**
 * Get timezone region (America, Europe, Asia, etc.)
 */
function getTimezoneRegion(timezone: string): string {
  const parts = timezone.split('/');
  return parts[0] || 'Other';
}

/**
 * Format timezone for display
 * Shows city name and current time
 */
function formatTimezoneDisplay(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const time = formatter.format(now);

    // Extract city name from timezone (e.g., "America/New_York" -> "New York")
    const cityName = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone;

    // Get timezone abbreviation if available
    const tzFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const parts = tzFormatter.formatToParts(now);
    const tzAbbr = parts.find(p => p.type === 'timeZoneName')?.value || '';

    return `${cityName}${tzAbbr ? ` (${tzAbbr})` : ''} - ${time}`;
  } catch {
    return timezone;
  }
}

/**
 * Get user's timezone (IANA format)
 */
function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Group timezones by region
 */
function groupTimezonesByRegion(timezones: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};

  timezones.forEach(tz => {
    const region = getTimezoneRegion(tz);
    if (!grouped[region]) {
      grouped[region] = [];
    }
    grouped[region].push(tz);
  });

  // Sort regions
  const sortedRegions: Record<string, string[]> = {};
  const regionOrder = ['UTC', 'America', 'Europe', 'Asia', 'Africa', 'Australia', 'Pacific', 'Atlantic', 'Indian', 'Antarctica', 'Arctic', 'Other'];
  regionOrder.forEach(region => {
    if (grouped[region]) {
      sortedRegions[region] = grouped[region].sort();
    }
  });

  // Add any remaining regions
  Object.keys(grouped).forEach(region => {
    if (!sortedRegions[region]) {
      sortedRegions[region] = grouped[region].sort();
    }
  });

  return sortedRegions;
}

interface TimezoneSelectorProps {
  value: string;
  onChange: (timezone: string) => void;
  className?: string;
}

export function TimezoneSelector({ value, onChange, className = '' }: TimezoneSelectorProps) {
  const [allTimezones] = useState<string[]>(() => getAllTimezones());
  const [groupedTimezones] = useState<Record<string, string[]>>(() => groupTimezonesByRegion(allTimezones));
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredGroups, setFilteredGroups] = useState<Record<string, string[]>>(groupedTimezones);
  const [currentTime, setCurrentTime] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update current time display every minute
  useEffect(() => {
    const updateTime = () => {
      if (value) {
        setCurrentTime(formatTimezoneDisplay(value));
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [value]);

  // Auto-detect timezone on mount if not set
  useEffect(() => {
    if (!value) {
      const detected = getUserTimezone();
      onChange(detected);
    }
  }, []); // Only run on mount

  // Filter timezones based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredGroups(groupedTimezones);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered: Record<string, string[]> = {};

    Object.keys(groupedTimezones).forEach(region => {
      const matching = groupedTimezones[region].filter(tz => {
        const cityName = tz.split('/').pop()?.toLowerCase().replace(/_/g, ' ') || '';
        const regionName = region.toLowerCase();
        return cityName.includes(term) || regionName.includes(term) || tz.toLowerCase().includes(term);
      });

      if (matching.length > 0) {
        filtered[region] = matching;
      }
    });

    setFilteredGroups(filtered);
  }, [searchTerm, groupedTimezones]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        handleClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Update dropdown position when opening
  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      // Position will be handled by CSS, but we can add logic here if needed
    }
  };

  // Reset search term when closing dropdown without selection
  const handleClose = () => {
    setIsOpen(false);
    setSearchTerm(''); // Clear search so display value shows when closed
  };

  const handleSelect = (timezone: string) => {
    onChange(timezone);
    setSearchTerm(''); // Clear search term when selecting
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    setIsOpen(true);
    updateDropdownPosition();
  };

  const handleInputFocus = () => {
    // When focusing, if we have a value, start with empty search to show all options
    // User can then type to filter
    if (value) {
      setSearchTerm('');
    }
    setIsOpen(true);
    updateDropdownPosition();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter' && searchTerm.trim()) {
      // Select first match on Enter
      const firstMatch = Object.values(filteredGroups)[0]?.[0];
      if (firstMatch) {
        handleSelect(firstMatch);
      }
    }
  };

  const displayValue = value
    ? formatTimezoneDisplay(value)
    : '';

  return (
    <div className={className}>
      <label htmlFor="timezone" className="block text-sm font-medium mb-2">
        Timezone *
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          id="timezone"
          value={isOpen ? searchTerm : displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleInputKeyDown}
          placeholder={value ? "Type to search timezone..." : "Type to search timezone (e.g., New York, London, Tokyo)..."}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-96 overflow-y-auto"
          >
            {Object.keys(filteredGroups).length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                No timezones found matching "{searchTerm}"
              </div>
            ) : (
              Object.keys(filteredGroups).map(region => (
                <div key={region} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 text-xs font-semibold text-gray-700 dark:text-gray-300 sticky top-0">
                    {region}
                  </div>
                  {filteredGroups[region].map(timezone => {
                    const isSelected = timezone === value;
                    return (
                      <button
                        key={timezone}
                        type="button"
                        onClick={() => handleSelect(timezone)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
                          isSelected
                            ? 'bg-blue-100 dark:bg-blue-900/30 font-medium'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{formatTimezoneDisplay(timezone)}</span>
                          {isSelected && (
                            <span className="text-blue-600 dark:text-blue-400 ml-2">✓</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      {value && !isOpen && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Current time: {currentTime || formatTimezoneDisplay(value)}
        </p>
      )}
    </div>
  );
}
