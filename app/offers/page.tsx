/**
 * Offers page
 * 
 * Browse and create "I am teaching" offers.
 */

'use client';

import { BackButton } from '@/components/BackButton';

export default function OffersPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton href="/network" />
        </div>
        <h1 className="text-3xl font-semibold mb-6">Offers</h1>
        <p>Browse and create offers coming soon...</p>
        <p>This will allow you to browse and create "I am teaching" offers.</p>
      </div>
    </div>
  );
}

