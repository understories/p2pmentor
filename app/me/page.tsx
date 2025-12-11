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
import { LearningCommunitiesCard } from '@/components/LearningCommunitiesCard';
import { GardenLayer } from '@/components/garden/GardenLayer';
import { profileToGardenSkills, type GardenSkill } from '@/lib/garden/types';
import { BackgroundImage } from '@/components/BackgroundImage';
import type { Skill } from '@/lib/arkiv/skill';

export default function MePage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [gardenSkills, setGardenSkills] = useState<GardenSkill[]>([]);
  const [allSystemSkills, setAllSystemSkills] = useState<GardenSkill[]>([]);
  const [onboardingChecked, setOnboardingChecked] = useState(false); // Track if onboarding check completed
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
      
      // Check if user has profile for this profile wallet - if not, redirect to onboarding
      // address is the profile wallet (from localStorage 'wallet_address')
      // This is the wallet address used as the 'wallet' attribute on entities (profiles, asks, offers)
      // The global Arkiv signing wallet (from ARKIV_PRIVATE_KEY) signs transactions, but entities are tied to this profile wallet
      import('@/lib/onboarding/state').then(({ calculateOnboardingLevel }) => {
        calculateOnboardingLevel(address).then(level => {
          setOnboardingChecked(true); // Mark check as complete
          if (level === 0) {
            // No profile for this profile wallet - redirect to onboarding
            router.push('/onboarding');
            return;
          }
          // Has profile - continue loading
          loadNotificationCount(address);
          loadProfileStatus(address);
        }).catch(() => {
          // On error, allow access (don't block on calculation failure)
          setOnboardingChecked(true);
          loadNotificationCount(address);
          loadProfileStatus(address);
        });
      });
      
      // Load all system skills for background garden
      loadAllSystemSkills();
      
      // Poll for notifications and profile status every 30 seconds (only if profile exists)
      const interval = setInterval(() => {
        if (hasProfile !== false) { // Only poll if we know profile exists or haven't checked yet
          loadNotificationCount(address);
          loadProfileStatus(address);
        }
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [router, hasProfile]);
  
  const loadAllSystemSkills = async () => {
    try {
      const { listSkills } = await import('@/lib/arkiv/skill');
      const skills: Skill[] = await listSkills({ status: 'active', limit: 100 });
      
      // Convert to GardenSkill format (all as sprout emojis, level 0)
      const gardenSkills: GardenSkill[] = skills.map((skill) => ({
        id: skill.slug || skill.key,
        name: skill.name_canonical,
        level: 0, // All as sprout emojis for now
      }));
      
      setAllSystemSkills(gardenSkills);
    } catch (error) {
      console.error('Error loading all system skills:', error);
    }
  };

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
      
      // Load garden skills from profile
      if (profileData) {
        const skills = profileToGardenSkills(profileData.skillsArray, profileData.skillExpertise);
        setGardenSkills(skills);
      }
    } catch (err) {
      console.error('Error loading profile status:', err);
      setHasProfile(null);
      setProfile(null);
    }
  };

  // Show loading state until wallet is loaded AND onboarding check is complete
  if (!walletAddress || !onboardingChecked) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-4">🌱</div>
          <p className="text-gray-600 dark:text-gray-400">Loading your garden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative text-gray-900 dark:text-gray-100">
      {/* Forest Background */}
      <BackgroundImage />
      
      {/* Garden Layer - persistent garden showing all system skills, with user's skills glowing */}
      <GardenLayer skills={gardenSkills} allSkills={allSystemSkills} />
      
      <div className="relative z-10 p-4">
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

        {/* Your Profile Section */}
        <div className="mb-8 relative">
          {/* Subtle radial gradient hint */}
          <div 
            className="absolute inset-0 rounded-2xl opacity-30 pointer-events-none -z-10"
            style={{
              background: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
            }}
          />
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4 mt-2">
            Your Profile
          </h2>
          <div className="space-y-3">
            <Link
              href="/me/profile"
              className="relative block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center"
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
              className="block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center"
            >
              Skills
            </Link>
            <Link
              href="/me/availability"
              className="block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center"
            >
              Availability
            </Link>
          </div>
        </div>

        {/* Your Activity Section */}
        <div className="mb-8 relative">
          {/* Subtle radial gradient hint */}
          <div 
            className="absolute inset-0 rounded-2xl opacity-30 pointer-events-none -z-10"
            style={{
              background: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.08) 0%, transparent 70%)',
            }}
          />
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4 mt-2">
            Your Activity
          </h2>
          <div className="space-y-3">
            <Link
              href="/asks"
              className={`block p-3 rounded-lg border ${askColors.border} ${askColors.card} ${askColors.cardHover} hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center font-medium`}
            >
              {askEmojis.default} Asks (I am learning)
            </Link>
            <Link
              href="/offers"
              className={`block p-3 rounded-lg border ${offerColors.border} ${offerColors.card} ${offerColors.cardHover} hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center font-medium`}
            >
              {offerEmojis.default} Offers (I am teaching)
            </Link>
            <Link
              href="/me/sessions"
              className="block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center"
            >
              Sessions
            </Link>
            <Link
              href="/notifications"
              className="relative block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center"
            >
              Notifications
              {notificationCount > 0 && (
                <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium bg-emerald-600 dark:bg-emerald-500 text-white rounded-full">
                  {notificationCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Community Section */}
        <div className="relative">
          {/* Subtle radial gradient hint */}
          <div 
            className="absolute inset-0 rounded-2xl opacity-30 pointer-events-none -z-10"
            style={{
              background: 'radial-gradient(circle at center, rgba(168, 85, 247, 0.08) 0%, transparent 70%)',
            }}
          />
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4 mt-2">
            Community
          </h2>
          <div className="space-y-3">
            <Link
              href="/profiles"
              className="block p-3 rounded-lg border border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center font-medium"
            >
              👥 Browse Profiles
            </Link>
            <Link
              href="/network"
              className="block p-3 rounded-lg border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center font-medium"
            >
              🌐 Browse Network
            </Link>
            <Link
              href="/garden/public-board"
              className="block p-3 rounded-lg border border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center font-medium"
            >
              🌱 Public Garden Board
            </Link>
          </div>
          
          {/* Learning Communities Card */}
          {walletAddress && (
            <div className="mt-4">
              <LearningCommunitiesCard wallet={walletAddress} />
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

