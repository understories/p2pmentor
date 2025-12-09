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
import { askColors, askEmojis, offerColors, offerEmojis } from '@/lib/colors';
import { getProfileByWallet, type UserProfile } from '@/lib/arkiv/profile';
import { calculateProfileCompleteness } from '@/lib/profile/completeness';

export default function MePage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
      
      // Load notification count and profile status
      loadNotificationCount(address);
      loadProfileStatus(address);
      
      // Poll for notifications and profile status every 30 seconds
      const interval = setInterval(() => {
        loadNotificationCount(address);
        loadProfileStatus(address);
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

  const loadProfileStatus = async (wallet: string) => {
    try {
      const profileData = await getProfileByWallet(wallet).catch(() => null);
      setHasProfile(profileData !== null);
      setProfile(profileData);
    } catch (err) {
      console.error('Error loading profile status:', err);
      setHasProfile(null);
      setProfile(null);
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

        {/* Profile Completeness Indicator */}
        {hasProfile && profile && (() => {
          const completeness = calculateProfileCompleteness(profile);
          if (completeness.percentage < 100) {
            return (
              <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-yellow-900 dark:text-yellow-200">
                    Profile {completeness.percentage}% Complete
                  </span>
                  <Link
                    href="/me/profile"
                    className="text-sm text-yellow-800 dark:text-yellow-300 hover:underline"
                  >
                    Complete →
                  </Link>
                </div>
                <div className="w-full bg-yellow-200 dark:bg-yellow-800 rounded-full h-2 mb-2">
                  <div
                    className="bg-yellow-600 dark:bg-yellow-400 h-2 rounded-full transition-all"
                    style={{ width: `${completeness.percentage}%` }}
                  />
                </div>
                {completeness.missing.length > 0 && (
                  <p className="text-xs text-yellow-800 dark:text-yellow-300">
                    Missing: {completeness.missing.join(', ')}
                  </p>
                )}
              </div>
            );
          }
          return null;
        })()}

        <div className="space-y-3 mb-6">
          <Link
            href="/me/profile"
            className="relative block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            Profile
            {hasProfile === false && (
              <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium bg-yellow-500 text-white rounded-full animate-pulse" title="Create your profile">
                ⭐
              </span>
            )}
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
            href="/asks"
            className={`block p-3 rounded-lg border ${askColors.border} ${askColors.card} ${askColors.cardHover} transition-colors text-center`}
          >
            {askEmojis.default} Asks (I am learning)
          </Link>
          <Link
            href="/offers"
            className={`block p-3 rounded-lg border ${offerColors.border} ${offerColors.card} ${offerColors.cardHover} transition-colors text-center`}
          >
            {offerEmojis.default} Offers (I am teaching)
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

        <div className="space-y-3 mb-6">
          <Link
            href="/asks"
            className={`block p-3 rounded-lg border ${askColors.border} ${askColors.card} ${askColors.cardHover} transition-colors text-center font-medium`}
          >
            {askEmojis.default} Create Ask
          </Link>
          <Link
            href="/offers"
            className={`block p-3 rounded-lg border ${offerColors.border} ${offerColors.card} ${offerColors.cardHover} transition-colors text-center font-medium`}
          >
            {offerEmojis.default} Create Offer
          </Link>
        </div>

        <div className="space-y-3">
          <Link
            href="/network"
            className="block p-3 rounded-lg border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-center font-medium"
          >
            🌐 Browse Network
          </Link>
        </div>
      </div>
    </div>
  );
}

