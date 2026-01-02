/**
 * Data Explorer Page
 * 
 * Public explorer for viewing p2pmentor entities on Arkiv.
 * Shows profiles, asks, offers, and skills with provenance.
 */

'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EntityList } from '@/components/explorer/EntityList';
import { HowItWorks } from '@/components/explorer/HowItWorks';
import { ExplorerSidebar } from '@/components/explorer/ExplorerSidebar';

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
  const [spaceId, setSpaceId] = useState<string>('all');

  useEffect(() => {
    // Add noindex meta tag
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nofollow';
    document.head.appendChild(meta);

    return () => {
      // Cleanup meta tag on unmount
      const existing = document.querySelector('meta[name="robots"][content="noindex,nofollow"]');
      if (existing) {
        existing.remove();
      }
    };
  }, []);

  useEffect(() => {
    // Fetch summary (with spaceId filter if not 'all')
    const params = new URLSearchParams();
    if (spaceId && spaceId !== 'all') {
      params.set('spaceId', spaceId);
    }
    const url = `/api/explorer/summary${params.toString() ? `?${params}` : ''}`;

    fetch(url)
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
  }, [spaceId]);

  return (
    <div className="min-h-screen flex">
      {/* New Adaptive Sidebar - Hidden on mobile, visible on desktop */}
      <div className="hidden md:block">
        <ExplorerSidebar />
      </div>

      {/* Main Content - No margin on mobile (sidebar hidden), margin on desktop */}
      <div className="flex-1 ml-0 md:ml-64 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <PageHeader
          title="p2pmentor Data Explorer"
          description="Browse p2pmentor records stored on Arkiv. All data is verifiable on-chain and doesn't depend on a private database as the source of truth."
        />

        {/* Stats Section */}
        {loading ? (
          <div className="mb-8">
            <LoadingSpinner text="Loading stats..." />
          </div>
        ) : summary ? (
          <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-3xl font-bold text-blue-700 dark:text-blue-300 mb-1">{summary.profiles}</div>
              <div className="text-sm font-medium text-blue-600 dark:text-blue-400">Profiles</div>
            </div>
            <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg border border-purple-200 dark:border-purple-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-3xl font-bold text-purple-700 dark:text-purple-300 mb-1">{summary.asks}</div>
              <div className="text-sm font-medium text-purple-600 dark:text-purple-400">Asks</div>
            </div>
            <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg border border-green-200 dark:border-green-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-3xl font-bold text-green-700 dark:text-green-300 mb-1">{summary.offers}</div>
              <div className="text-sm font-medium text-green-600 dark:text-green-400">Offers</div>
            </div>
            <div className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg border border-orange-200 dark:border-orange-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-3xl font-bold text-orange-700 dark:text-orange-300 mb-1">{summary.skills}</div>
              <div className="text-sm font-medium text-orange-600 dark:text-orange-400">Skills</div>
            </div>
          </div>
        ) : null}

        {/* Entity List */}
        <EntityList spaceId={spaceId} onSpaceIdChange={setSpaceId} />

        {/* How It Works */}
        <HowItWorks />
        </div>
      </div>
    </div>
  );
}

