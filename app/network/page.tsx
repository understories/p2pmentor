/**
 * Network graph page
 * 
 * View network, match asks ↔ offers ↔ skills, and filter.
 */

'use client';

import { BackButton } from '@/components/BackButton';

export default function NetworkPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>
        <h1 className="text-3xl font-semibold mb-6">Network</h1>
        <p>Network view coming soon...</p>
        <p>This will show the mentorship network with filtering and matching capabilities.</p>
      </div>
    </div>
  );
}

