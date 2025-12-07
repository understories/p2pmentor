/**
 * Skills management page
 * 
 * Add, view, and edit skills using Arkiv entities.
 */

'use client';

import { BackButton } from '@/components/BackButton';

export default function SkillsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>
        <h1 className="text-3xl font-semibold mb-6">Skills</h1>
        <p>Skills management coming soon...</p>
        <p>This will allow you to add, view, and edit your skills using Arkiv entities.</p>
      </div>
    </div>
  );
}

