/**
 * Network Forest Page
 *
 * Experimental forest visualization view for network graph.
 * Desktop-only, lazy-loaded, optional feature.
 */

'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { BackButton } from '@/components/BackButton';

const NetworkForestGraph = dynamic(() => import('@/components/network/NetworkForestGraph'), {
  ssr: false,
});

export default function NetworkForestPage() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkDesktop = () => {
        setIsDesktop(window.innerWidth >= 768);
      };
      checkDesktop();
      window.addEventListener('resize', checkDesktop);
      return () => window.removeEventListener('resize', checkDesktop);
    }
  }, []);

  if (isDesktop === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!isDesktop) {
    return (
      <main className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-md space-y-4 text-center">
            <h1 className="text-xl font-semibold">Skill Forest (beta)</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The forest view is experimental and currently optimized for desktop.
            </p>
            <BackButton
              href="/network"
              label="Back to network list"
              className="inline-block border-0 bg-transparent p-0 text-sm text-emerald-500 underline hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-gray-900 dark:text-gray-100">
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div>
            <h1 className="text-xl font-semibold">Skill Forest (experimental)</h1>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Visualizing asks, offers, and skills as a glowing forest. Desktop only. Testnet data.
            </p>
          </div>
          <BackButton
            href="/network"
            label="Back to network list"
            className="border-0 bg-transparent p-0 text-sm text-emerald-500 underline hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
          />
        </header>
        <section className="relative flex-1">
          <NetworkForestGraph />
        </section>
      </div>
    </main>
  );
}
