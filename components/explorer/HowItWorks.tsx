/**
 * How It Works Component
 *
 * Accordion FAQ explaining how the explorer works.
 */

'use client';

import { useState } from 'react';

export function HowItWorks() {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <div className="mt-12 border-t border-gray-200 pt-8 dark:border-gray-700">
      <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">How This Works</h2>
      <div className="space-y-3">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
          <button
            onClick={() => toggleSection('data')}
            className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:hover:bg-gray-700/50"
          >
            <span className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
              <span className="text-lg">📊</span>
              What data is shown?
            </span>
            <span
              className={`text-xl font-light text-gray-500 transition-transform dark:text-gray-400 ${openSection === 'data' ? 'rotate-180' : ''}`}
            >
              {openSection === 'data' ? '−' : '+'}
            </span>
          </button>
          {openSection === 'data' && (
            <div className="border-t border-gray-200 px-5 pb-4 pt-4 text-gray-600 dark:border-gray-700 dark:text-gray-400">
              <p>
                The explorer shows all p2pmentor records stored on Arkiv. This includes profiles
                (display name, bio, skills, contact links), asks, offers, and skills. All data
                stored on Arkiv is visible here and verifiable via transaction hashes. Email
                addresses are not stored on Arkiv, so they are not shown.
              </p>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
          <button
            onClick={() => toggleSection('source')}
            className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:hover:bg-gray-700/50"
          >
            <span className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
              <span className="text-lg">🔗</span>
              Where does the data come from?
            </span>
            <span
              className={`text-xl font-light text-gray-500 transition-transform dark:text-gray-400 ${openSection === 'source' ? 'rotate-180' : ''}`}
            >
              {openSection === 'source' ? '−' : '+'}
            </span>
          </button>
          {openSection === 'source' && (
            <div className="border-t border-gray-200 px-5 pb-4 pt-4 text-gray-600 dark:border-gray-700 dark:text-gray-400">
              <p>
                All data comes from Arkiv, a blockchain-native storage system. Each entity has a
                transaction hash that can be verified on the Kaolin blockchain explorer. The data
                doesn't depend on a private p2pmentor database as the source of truth.
              </p>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
          <button
            onClick={() => toggleSection('verification')}
            className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:hover:bg-gray-700/50"
          >
            <span className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
              <span className="text-lg">✓</span>
              How can I verify the data?
            </span>
            <span
              className={`text-xl font-light text-gray-500 transition-transform dark:text-gray-400 ${openSection === 'verification' ? 'rotate-180' : ''}`}
            >
              {openSection === 'verification' ? '−' : '+'}
            </span>
          </button>
          {openSection === 'verification' && (
            <div className="border-t border-gray-200 px-5 pb-4 pt-4 text-gray-600 dark:border-gray-700 dark:text-gray-400">
              <p>
                Each entity includes a transaction hash and block number. Click the "View on Arkiv"
                link to view the transaction on the Kaolin blockchain explorer. You can verify that
                the data matches what's stored on-chain.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
