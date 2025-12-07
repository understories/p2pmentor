/**
 * User dashboard page
 * 
 * Main landing page after authentication.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';

export default function MePage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (!address) {
        router.push('/auth');
        return;
      }
      setWalletAddress(address);
    }
  }, [router]);

  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <BackButton href="/auth" label="Back to Auth" />
        </div>
        
        <h1 className="text-2xl font-semibold mb-2">Your Dashboard</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 font-mono break-all">
          {walletAddress}
        </p>

        <div className="space-y-3 mb-6">
          <Link
            href="/me/profile"
            className="block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            Profile
          </Link>
          <Link
            href="/me/skills"
            className="block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            Skills
          </Link>
          <Link
            href="/me/availability"
            className="block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            Availability
          </Link>
          <Link
            href="/me/sessions"
            className="block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            Sessions
          </Link>
        </div>

        <Link
          href="/network"
          className="block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
        >
          Browse Network
        </Link>
      </div>
    </div>
  );
}

