/**
 * Weekly Availability Editor Component
 * 
 * Main component for editing weekly availability (Calendly-style).
 * Allows day-by-day configuration with multiple time slots per day.
 * 
 * Reference: Availability UX Upgrade Plan
 */

'use client';

import { useState, useEffect } from 'react';
import type { WeeklyAvailability, DayOfWeek } from '@/lib/arkiv/availability';
import { 
  createDefaultWeeklyAvailability, 
  validateWeeklyAvailability
} from '@/lib/arkiv/availability';
import { DayAvailabilityRow } from './DayAvailabilityRow';
import { TimezoneSelector } from './TimezoneSelector';

interface WeeklyAvailabilityEditorProps {
  value?: WeeklyAvailability | null;
  onChange: (availability: WeeklyAvailability | null) => void;
  timezone?: string;
  onTimezoneChange?: (timezone: string) => void;
  className?: string;
  showBulkActions?: boolean;
}

const DAYS: Array<{ day: DayOfWeek; label: string; abbr: string }> = [
  { day: 'sunday', label: 'Sunday', abbr: 'S' },
  { day: 'monday', label: 'Monday', abbr: 'M' },
  { day: 'tuesday', label: 'Tuesday', abbr: 'T' },
  { day: 'wednesday', label: 'Wednesday', abbr: 'W' },
  { day: 'thursday', label: 'Thursday', abbr: 'T' },
  { day: 'friday', label: 'Friday', abbr: 'F' },
  { day: 'saturday', label: 'Saturday', abbr: 'S' },
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

export function WeeklyAvailabilityEditor({
  value,
  onChange,
  timezone: externalTimezone,
  onTimezoneChange,
  className = '',
  showBulkActions = true,
}: WeeklyAvailabilityEditorProps) {
  const [availability, setAvailability] = useState<WeeklyAvailability | null>(value || null);
  const [timezone, setTimezone] = useState<string>(externalTimezone || getUserTimezone());
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize with default if no value provided
  useEffect(() => {
    if (!availability) {
      const defaultAvail = createDefaultWeeklyAvailability(timezone);
      setAvailability(defaultAvail);
      onChange(defaultAvail);
    }
  }, []);

  // Sync external timezone changes
  useEffect(() => {
    if (externalTimezone && externalTimezone !== timezone) {
      setTimezone(externalTimezone);
      if (availability) {
        const updated = { ...availability, timezone: externalTimezone };
        setAvailability(updated);
        onChange(updated);
      }
    }
  }, [externalTimezone]);

  const handleDayChange = (day: DayOfWeek, dayAvailability: any) => {
    if (!availability) return;
    
    const updated: WeeklyAvailability = {
      ...availability,
      days: {
        ...availability.days,
        [day]: dayAvailability,
      },
    };
    
    setAvailability(updated);
    
    // Validate
    const validation = validateWeeklyAvailability(updated);
    if (validation.valid) {
      setValidationError(null);
      onChange(updated);
    } else {
      setValidationError(validation.error || 'Invalid availability');
      // Still call onChange to allow partial saves
      onChange(updated);
    }
  };

  const handleTimezoneChange = (newTimezone: string) => {
    setTimezone(newTimezone);
    if (availability) {
      const updated = { ...availability, timezone: newTimezone };
      setAvailability(updated);
      onChange(updated);
    }
    if (onTimezoneChange) {
      onTimezoneChange(newTimezone);
    }
  };

  const handleCopyToWeekdays = () => {
    if (!availability) return;
    
    const mondaySlots = availability.days.monday.timeSlots;
    const updated: WeeklyAvailability = {
      ...availability,
      days: {
        ...availability.days,
        tuesday: { available: availability.days.monday.available, timeSlots: [...mondaySlots] },
        wednesday: { available: availability.days.monday.available, timeSlots: [...mondaySlots] },
        thursday: { available: availability.days.monday.available, timeSlots: [...mondaySlots] },
        friday: { available: availability.days.monday.available, timeSlots: [...mondaySlots] },
      },
    };
    
    setAvailability(updated);
    onChange(updated);
  };

  const handleClearAll = () => {
    if (!availability) return;
    
    const cleared = createDefaultWeeklyAvailability(timezone);
    setAvailability(cleared);
    onChange(cleared);
  };

  const handleSetStandardHours = () => {
    if (!availability) return;
    
    const standardSlot = { start: '09:00', end: '17:00' };
    const updated: WeeklyAvailability = {
      ...availability,
      days: {
        sunday: { available: false, timeSlots: [] },
        monday: { available: true, timeSlots: [standardSlot] },
        tuesday: { available: true, timeSlots: [standardSlot] },
        wednesday: { available: true, timeSlots: [standardSlot] },
        thursday: { available: true, timeSlots: [standardSlot] },
        friday: { available: true, timeSlots: [standardSlot] },
        saturday: { available: false, timeSlots: [] },
      },
    };
    
    setAvailability(updated);
    onChange(updated);
  };

  if (!availability) {
    return <div className="text-gray-500 dark:text-gray-400">Loading...</div>;
  }

  return (
    <div className={className}>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Weekly hours
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Set when you are typically available for meetings
            </p>
          </div>
        </div>
      </div>

      {/* Timezone Selector */}
      <div className="mb-6">
        <TimezoneSelector
          value={timezone}
          onChange={handleTimezoneChange}
        />
      </div>

      {/* Bulk Actions */}
      {showBulkActions && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyToWeekdays}
            className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Copy Monday to all weekdays
          </button>
          <button
            type="button"
            onClick={handleSetStandardHours}
            className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Set standard hours (Mon-Fri 9am-5pm)
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Validation Error */}
      {validationError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {validationError}
        </div>
      )}

      {/* Days List */}
      <div className="space-y-3">
        {DAYS.map(({ day, label, abbr }) => (
          <DayAvailabilityRow
            key={day}
            day={day}
            dayLabel={label}
            dayAbbr={abbr}
            availability={availability.days[day]}
            onChange={(dayAvail) => handleDayChange(day, dayAvail)}
          />
        ))}
      </div>
    </div>
  );
}

