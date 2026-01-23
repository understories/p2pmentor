/**
 * Spaced Repetition Scheduler Component
 *
 * Interactive component for creating spaced repetition schedules.
 * Used in meta-learning quest steps to demonstrate spaced repetition planning.
 */

'use client';

import { useState } from 'react';

interface SpacedRepetitionSchedulerProps {
  onScheduleCreated?: (schedule: { concept: string; reviews: Array<{ review: number; date: string }> }) => void;
  requireSchedule?: boolean;
}

export function SpacedRepetitionScheduler({ onScheduleCreated, requireSchedule = true }: SpacedRepetitionSchedulerProps) {
  const [concept, setConcept] = useState('');
  const [learningDate, setLearningDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedule, setSchedule] = useState<Array<{ review: number; date: string; label: string }>>([]);
  const [created, setCreated] = useState(false);

  const calculateSchedule = () => {
    if (!concept.trim() || !learningDate) return;

    const startDate = new Date(learningDate);
    const reviews = [
      { review: 1, days: 1, label: 'First review' },
      { review: 2, days: 3, label: 'Second review' },
      { review: 3, days: 7, label: 'Third review' },
      { review: 4, days: 14, label: 'Fourth review' },
      { review: 5, days: 30, label: 'Fifth review' },
    ];

    const calculatedSchedule = reviews.map((r) => {
      const reviewDate = new Date(startDate);
      reviewDate.setDate(reviewDate.getDate() + r.days);
      return {
        review: r.review,
        date: reviewDate.toISOString().split('T')[0],
        label: r.label,
      };
    });

    setSchedule(calculatedSchedule);
    setCreated(true);

    if (onScheduleCreated) {
      onScheduleCreated({
        concept: concept.trim(),
        reviews: calculatedSchedule.map(r => ({ review: r.review, date: r.date })),
      });
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Spaced Repetition Scheduler
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Concept to learn:
          </label>
          <input
            type="text"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="e.g., 'How blockchain works', 'Spanish vocabulary', 'React hooks'"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Learning date:
          </label>
          <input
            type="date"
            value={learningDate}
            onChange={(e) => setLearningDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <button
          onClick={calculateSchedule}
          disabled={!concept.trim() || !learningDate || created}
          className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {created ? 'Schedule Created' : 'Create Schedule'}
        </button>

        {schedule.length > 0 && (
          <div className="mt-6 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
            <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-3">
              Your Review Schedule for "{concept}":
            </div>
            <div className="space-y-2">
              {schedule.map((item) => (
                <div
                  key={item.review}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(item.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                  <div className="text-sm font-mono text-gray-600 dark:text-gray-400">
                    Review {item.review}
                  </div>
                </div>
              ))}
            </div>
            {created && (
              <div className="mt-4 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ Schedule created! Add these dates to your calendar.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
