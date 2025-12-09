/**
 * Timezone Selector Component
 * 
 * Dropdown for selecting IANA timezone.
 * Auto-detects user timezone on first load.
 * 
 * Reference: Availability UX Upgrade Plan
 */

'use client';

import { useState, useEffect } from 'react';

/**
 * Common IANA timezones (subset for beta)
 * Full list can be expanded later
 */
const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'America/Phoenix', label: 'Arizona' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Europe/Rome', label: 'Rome' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Australia/Sydney', label: 'Sydney' },
  { value: 'UTC', label: 'UTC' },
];

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
 * Format timezone for display with current time
 */
function formatTimezoneWithTime(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const time = formatter.format(now);
    const tzName = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone;
    return `${tzName} (${time})`;
  } catch {
    return timezone;
  }
}

interface TimezoneSelectorProps {
  value: string;
  onChange: (timezone: string) => void;
  className?: string;
}

export function TimezoneSelector({ value, onChange, className = '' }: TimezoneSelectorProps) {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    // Update current time display every minute
    const updateTime = () => {
      if (value) {
        setCurrentTime(formatTimezoneWithTime(value));
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

  const selectedTimezone = COMMON_TIMEZONES.find(tz => tz.value === value);
  const displayValue = selectedTimezone 
    ? `${selectedTimezone.label} (${currentTime || formatTimezoneWithTime(value)})`
    : value || 'Select timezone...';

  return (
    <div className={className}>
      <label htmlFor="timezone" className="block text-sm font-medium mb-2">
        Timezone *
      </label>
      <select
        id="timezone"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {!value && <option value="">Select timezone...</option>}
        {COMMON_TIMEZONES.map((tz) => (
          <option key={tz.value} value={tz.value}>
            {tz.label}
          </option>
        ))}
      </select>
      {value && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Current time: {currentTime || formatTimezoneWithTime(value)}
        </p>
      )}
    </div>
  );
}

