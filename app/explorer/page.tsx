/**
 * Data Explorer Page
 * 
 * Public explorer for viewing p2pmentor entities on Arkiv.
 * Shows profiles, asks, offers, and skills with provenance.
 */

'use client';

import { useEffect, useState } from 'react';
import { EntityList } from '@/components/explorer/EntityList';
import { HowItWorks } from '@/components/explorer/HowItWorks';

interface Summary {
  profiles: number;
  asks: number;
  offers: number;
  skills: number;
  total: number;
  generatedAt: string;
}

export default function ExplorerPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Add noindex meta tag
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nofollow';
    document.head.appendChild(meta);

    // Fetch summary
    fetch('/api/explorer/summary')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setSummary(data.summary);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to fetch summary:', error);
        setLoading(false);
      });

    return () => {
      // Cleanup meta tag on unmount
      const existing = document.querySelector('meta[name="robots"][content="noindex,nofollow"]');
      if (existing) {
        existing.remove();
      }
    };
  }, []);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">p2pmentor Data Explorer</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
            Browse public p2pmentor records stored on Arkiv. All data is verifiable
            on-chain and doesn't depend on a private database as the source of truth.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            We serve this page as a viewer, but the records themselves are verifiable
            from the network and don't depend on a private p2pmentor database as the
            source of truth.
          </p>
        </div>

        {/* Stats Section */}
        {loading ? (
          <div className="mb-8 text-gray-500">Loading stats...</div>
        ) : summary ? (
          <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold">{summary.profiles}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Profiles</div>
            </div>
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold">{summary.asks}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Asks</div>
            </div>
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold">{summary.offers}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Offers</div>
            </div>
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold">{summary.skills}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Skills</div>
            </div>
          </div>
        ) : null}

        {/* Entity List */}
        <EntityList />

        {/* How It Works */}
        <HowItWorks />
      </div>
    </div>
  );
}

