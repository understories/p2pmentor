/**
 * Arkiv Query Tester Admin Page
 *
 * Interactive tool for testing Arkiv queries with all entity types.
 * Allows inputting parameters and viewing results with explorer links.
 */

'use client';

import { ArkivQueryTester } from '@/components/arkiv/ArkivQueryTester';

export default function ArkivQueryPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-900 md:p-8">
      <div className="mx-auto max-w-7xl">
        <ArkivQueryTester />
      </div>
    </div>
  );
}
