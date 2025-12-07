/**
 * Availability management page
 * 
 * Calendar availability editor and calendar connection.
 */

'use client';

import { BackButton } from '@/components/BackButton';

export default function AvailabilityPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>
        <h1 className="text-3xl font-semibold mb-6">Availability</h1>
        <p>Availability management coming soon...</p>
        <p>This will allow you to set your availability and connect your calendar.</p>
      </div>
    </div>
  );
}

