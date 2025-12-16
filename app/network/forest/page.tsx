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
import { ThemeToggle } from '@/components/ThemeToggle';

const NetworkForestGraph = dynamic(
  () => import('@/components/network/NetworkForestGraph'),
  { ssr: false }
);

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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!isDesktop) {
    return (
      <main className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <ThemeToggle />
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md w-full space-y-4 text-center">
            <h1 className="text-xl font-semibold">Skill Forest (beta)</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The forest view is experimental and currently optimized for desktop.
            </p>
            <BackButton
              href="/network"
              label="Back to network list"
              className="inline-block text-sm text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 underline border-0 bg-transparent p-0"
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-gray-900 dark:text-gray-100">
      <ThemeToggle />
      <div className="min-h-screen flex flex-col">
        <header className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div>
            <h1 className="text-xl font-semibold">Skill Forest (experimental)</h1>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Visualizing asks, offers, and skills as a glowing forest. Desktop only. Testnet data.
            </p>
          </div>
          <BackButton
            href="/network"
            label="Back to network list"
            className="text-sm text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 underline border-0 bg-transparent p-0"
          />
        </header>
        <section className="flex-1 relative">
          <NetworkForestGraph />
        </section>
      </div>
    </main>
  );
}

