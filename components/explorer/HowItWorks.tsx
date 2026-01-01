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
    <div className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">How This Works</h2>
      <div className="space-y-3">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <button
            onClick={() => toggleSection('data')}
            className="w-full px-5 py-4 text-left flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <span className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="text-lg">📊</span>
              What data is shown?
            </span>
            <span className="text-gray-500 dark:text-gray-400 text-xl font-light">
              {openSection === 'data' ? '−' : '+'}
            </span>
          </button>
          {openSection === 'data' && (
            <div className="px-5 pb-4 text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
              <p>
                The explorer shows public p2pmentor records stored on Arkiv. This includes
                profiles (display name, bio, skills), asks, offers, and skills. Private
                information like email addresses and contact links are not included.
              </p>
            </div>
          )}
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <button
            onClick={() => toggleSection('source')}
            className="w-full px-5 py-4 text-left flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <span className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="text-lg">🔗</span>
              Where does the data come from?
            </span>
            <span className="text-gray-500 dark:text-gray-400 text-xl font-light">
              {openSection === 'source' ? '−' : '+'}
            </span>
          </button>
          {openSection === 'source' && (
            <div className="px-5 pb-4 text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
              <p>
                All data comes from Arkiv, a blockchain-native storage system. Each entity
                has a transaction hash that can be verified on the Mendoza blockchain
                explorer. The data doesn't depend on a private p2pmentor database as the
                source of truth.
              </p>
            </div>
          )}
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <button
            onClick={() => toggleSection('verification')}
            className="w-full px-5 py-4 text-left flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <span className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="text-lg">✓</span>
              How can I verify the data?
            </span>
            <span className="text-gray-500 dark:text-gray-400 text-xl font-light">
              {openSection === 'verification' ? '−' : '+'}
            </span>
          </button>
          {openSection === 'verification' && (
            <div className="px-5 pb-4 text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
              <p>
                Each entity includes a transaction hash and block number. Click the
                "Verified on-chain" link to view the transaction on the Mendoza blockchain
                explorer. You can verify that the data matches what's stored on-chain.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

