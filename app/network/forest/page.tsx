/**
 * Network Forest Page
 * 
 * Experimental forest visualization view for network graph.
 * Desktop-only, lazy-loaded, optional feature.
 */

'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
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
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!isDesktop) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <ThemeToggle />
        <main className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md w-full space-y-4 text-center">
            <h1 className="text-xl font-semibold">Skill Forest (beta)</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The forest view is experimental and currently optimized for desktop.
            </p>
            <Link 
              href="/network" 
              className="inline-block text-sm text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 underline"
            >
              Back to network list
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <ThemeToggle />
      <main className="min-h-screen flex flex-col">
        <header className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div>
            <h1 className="text-xl font-semibold">Skill Forest (experimental)</h1>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Visualizing asks, offers, and skills as a glowing forest. Desktop only. Testnet data.
            </p>
          </div>
          <Link 
            href="/network" 
            className="text-sm text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 underline"
          >
            Back to network list
          </Link>
        </header>
        <section className="flex-1 relative">
          <NetworkForestGraph />
        </section>
      </main>
    </div>
  );
}

