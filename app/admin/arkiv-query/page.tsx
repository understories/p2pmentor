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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <ArkivQueryTester />
      </div>
    </div>
  );
}
