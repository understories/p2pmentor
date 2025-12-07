/**
 * Sessions history page
 * 
 * View past and upcoming mentorship sessions.
 */

'use client';

import { BackButton } from '@/components/BackButton';

export default function SessionsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>
        <h1 className="text-3xl font-semibold mb-6">Sessions</h1>
        <p>Sessions history coming soon...</p>
        <p>This will show your past and upcoming mentorship sessions.</p>
      </div>
    </div>
  );
}

