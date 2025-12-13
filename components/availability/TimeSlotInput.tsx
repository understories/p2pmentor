/**
 * Time Slot Input Component
 * 
 * Input for time slot (start/end times in HH:mm format).
 * 
 * Reference: Availability UX Upgrade Plan
 */

'use client';

import { useState, useEffect } from 'react';
import type { TimeSlot } from '@/lib/arkiv/availability';

interface TimeSlotInputProps {
  slot: TimeSlot;
  onChange: (slot: TimeSlot) => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
  index: number;
  className?: string;
}

/**
 * Validate and format time input (HH:mm)
 */
function formatTimeInput(value: string): string {
  // Remove non-digits
  const digits = value.replace(/\D/g, '');
  
  // Format as HH:mm
  if (digits.length <= 2) {
    return digits;
  } else if (digits.length <= 4) {
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  } else {
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  }
}

/**
 * Validate time format (HH:mm, 24-hour)
 */
function isValidTime(time: string): boolean {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

export function TimeSlotInput({ 
  slot, 
  onChange, 
  onRemove, 
  onDuplicate,
  index,
  className = '' 
}: TimeSlotInputProps) {
  const [startTime, setStartTime] = useState(slot.start);
  const [endTime, setEndTime] = useState(slot.end);
  const [startError, setStartError] = useState<string | null>(null);
  const [endError, setEndError] = useState<string | null>(null);

  useEffect(() => {
    setStartTime(slot.start);
    setEndTime(slot.end);
  }, [slot]);

  const handleStartChange = (value: string) => {
    const formatted = formatTimeInput(value);
    setStartTime(formatted);
    
    if (formatted.length === 5) {
      if (!isValidTime(formatted)) {
        setStartError('Invalid time format (use HH:mm)');
      } else if (formatted >= endTime) {
        setEndError('Start time must be before end time');
      } else {
        setStartError(null);
        setEndError(null);
        onChange({ start: formatted, end: endTime });
      }
    } else {
      setStartError(null);
    }
  };

  const handleEndChange = (value: string) => {
    const formatted = formatTimeInput(value);
    setEndTime(formatted);
    
    if (formatted.length === 5) {
      if (!isValidTime(formatted)) {
        setEndError('Invalid time format (use HH:mm)');
      } else if (formatted <= startTime) {
        setEndError('End time must be after start time');
      } else {
        setStartError(null);
        setEndError(null);
        onChange({ start: startTime, end: formatted });
      }
    } else {
      setEndError(null);
    }
  };

  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={startTime}
            onChange={(e) => handleStartChange(e.target.value)}
            placeholder="09:00"
            maxLength={5}
            className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-sm ${
              startError
                ? 'border-red-300 dark:border-red-700'
                : 'border-gray-300 dark:border-gray-600'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
          {startError && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{startError}</p>
          )}
        </div>
        <span className="text-gray-500 dark:text-gray-400">-</span>
        <div className="flex-1">
          <input
            type="text"
            value={endTime}
            onChange={(e) => handleEndChange(e.target.value)}
            placeholder="17:00"
            maxLength={5}
            className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-sm ${
              endError
                ? 'border-red-300 dark:border-red-700'
                : 'border-gray-300 dark:border-gray-600'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
          {endError && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{endError}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {onDuplicate && (
          <button
            type="button"
            onClick={onDuplicate}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Duplicate time slot"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Remove time slot"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

