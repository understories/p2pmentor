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
import { ThemeToggle } from '@/components/ThemeToggle';

export default function MePage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
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
      
      // Load notification count
      loadNotificationCount(address);
      
      // Poll for notifications every 30 seconds
      const interval = setInterval(() => {
        loadNotificationCount(address);
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [router]);

  const loadNotificationCount = async (wallet: string) => {
    try {
      const res = await fetch(`/api/notifications?wallet=${wallet}`);
      const data = await res.json();
      if (!data.ok) return;
      
      // Simple count: pending sessions where user hasn't confirmed
      const { sessions } = data.data;
      const pendingCount = sessions.filter((s: any) => {
        if (s.status !== 'pending') return false;
        const isMentor = s.mentorWallet.toLowerCase() === wallet.toLowerCase();
        const isLearner = s.learnerWallet.toLowerCase() === wallet.toLowerCase();
        if (!isMentor && !isLearner) return false;
        const hasConfirmed = isMentor ? s.mentorConfirmed : s.learnerConfirmed;
        return !hasConfirmed;
      }).length;
      
      setNotificationCount(pendingCount);
    } catch (err) {
      console.error('Error loading notification count:', err);
    }
  };

  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <ThemeToggle />
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
          <Link
            href="/notifications"
            className="relative block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            Notifications
            {notificationCount > 0 && (
              <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded-full">
                {notificationCount}
              </span>
            )}
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

