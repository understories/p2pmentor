/**
 * Day Availability Row Component
 *
 * Single day row in weekly availability editor.
 * Shows day name, availability toggle, and time slots.
 *
 * Reference: Availability UX Upgrade Plan
 */

'use client';

import { useState } from 'react';
import type { DayOfWeek, DayAvailability, TimeSlot } from '@/lib/arkiv/availability';
import { TimeSlotInput } from './TimeSlotInput';

interface DayAvailabilityRowProps {
  day: DayOfWeek;
  dayLabel: string;
  dayAbbr: string;
  availability: DayAvailability;
  onChange: (availability: DayAvailability) => void;
  className?: string;
}

export function DayAvailabilityRow({
  day,
  dayLabel,
  dayAbbr,
  availability,
  onChange,
  className = '',
}: DayAvailabilityRowProps) {
  const [isExpanded, setIsExpanded] = useState(availability.available);

  const handleToggleAvailable = () => {
    const newAvailable = !availability.available;
    onChange({
      available: newAvailable,
      timeSlots: newAvailable
        ? availability.timeSlots.length > 0
          ? availability.timeSlots
          : [{ start: '09:00', end: '17:00' }]
        : [],
    });
    setIsExpanded(newAvailable);
  };

  const handleAddTimeSlot = () => {
    const newSlot: TimeSlot = { start: '09:00', end: '17:00' };
    onChange({
      ...availability,
      timeSlots: [...availability.timeSlots, newSlot],
    });
  };

  const handleTimeSlotChange = (index: number, slot: TimeSlot) => {
    const newSlots = [...availability.timeSlots];
    newSlots[index] = slot;
    onChange({
      ...availability,
      timeSlots: newSlots,
    });
  };

  const handleRemoveTimeSlot = (index: number) => {
    const newSlots = availability.timeSlots.filter((_, i) => i !== index);
    onChange({
      ...availability,
      timeSlots: newSlots,
    });
  };

  const handleDuplicateTimeSlot = (index: number) => {
    const slotToDuplicate = availability.timeSlots[index];
    const newSlots = [...availability.timeSlots];
    newSlots.splice(index + 1, 0, { ...slotToDuplicate });
    onChange({
      ...availability,
      timeSlots: newSlots,
    });
  };

  return (
    <div className={`rounded-lg border border-gray-200 p-4 dark:border-gray-700 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-sm font-medium text-white dark:bg-blue-600">
            {dayAbbr}
          </div>
          <span className="font-medium text-gray-900 dark:text-gray-100">{dayLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {!availability.available && (
            <button
              type="button"
              onClick={handleToggleAvailable}
              className="flex items-center gap-1 rounded px-3 py-1 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-blue-400"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add
            </button>
          )}
          {availability.available && (
            <button
              type="button"
              onClick={handleToggleAvailable}
              className="rounded px-3 py-1 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Unavailable
            </button>
          )}
        </div>
      </div>

      {availability.available && (
        <div className="space-y-3">
          {availability.timeSlots.length === 0 ? (
            <div className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">
              No time slots. Click "Add time slot" to set availability.
            </div>
          ) : (
            availability.timeSlots.map((slot, index) => (
              <TimeSlotInput
                key={index}
                slot={slot}
                index={index}
                onChange={(updatedSlot) => handleTimeSlotChange(index, updatedSlot)}
                onRemove={() => handleRemoveTimeSlot(index)}
                onDuplicate={() => handleDuplicateTimeSlot(index)}
              />
            ))
          )}

          <button
            type="button"
            onClick={handleAddTimeSlot}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm text-blue-600 transition-colors hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add time slot
          </button>
        </div>
      )}

      {!availability.available && (
        <div className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">Unavailable</div>
      )}
    </div>
  );
}
