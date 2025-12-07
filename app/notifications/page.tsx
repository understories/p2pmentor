/**
 * Notifications page
 * 
 * UI-only notifications for meeting requests, matches, etc.
 */

'use client';

import { BackButton } from '@/components/BackButton';

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>
        <h1 className="text-3xl font-semibold mb-6">Notifications</h1>
        <p>Notifications coming soon...</p>
        <p>This will show meeting requests, profile matches, ask & offer matches, and new offers.</p>
      </div>
    </div>
  );
}

