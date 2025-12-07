/**
 * Profiles browse page
 * 
 * Browse all user profiles with filtering.
 * 
 * Based on mentor-graph implementation, adapted with modern UI.
 * 
 * Reference: refs/mentor-graph/pages/profiles.tsx
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { BetaBanner } from '@/components/BetaBanner';
import type { UserProfile } from '@/lib/arkiv/profile';

export default function ProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillFilter, setSkillFilter] = useState('');

  useEffect(() => {
    fetchProfiles(skillFilter || undefined);
  }, [skillFilter]);

  const fetchProfiles = async (skill?: string) => {
    try {
      setLoading(true);
      const url = skill ? `/api/profiles?skill=${encodeURIComponent(skill)}` : '/api/profiles';
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) {
        // Get unique profiles by wallet (most recent for each wallet)
        const profilesMap = new Map<string, UserProfile>();
        (data.profiles || []).forEach((profile: UserProfile) => {
          const existing = profilesMap.get(profile.wallet);
          if (!existing || (profile.createdAt && existing.createdAt && new Date(profile.createdAt) > new Date(existing.createdAt))) {
            profilesMap.set(profile.wallet, profile);
          }
        });
        setProfiles(Array.from(profilesMap.values()));
      }
    } catch (err) {
      console.error('Error fetching profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const shortenWallet = (wallet: string) => {
    if (!wallet || wallet.length < 10) return wallet;
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <ThemeToggle />
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <BackButton href="/network" />
        </div>

        <PageHeader
          title="Browse Profiles"
          description="Discover mentors and learners in the network."
        />
        
        <BetaBanner />

        {/* Beta Warning */}
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ <strong>Beta Environment:</strong> This is a test environment. All data is on the Mendoza testnet and may be reset.
          </p>
        </div>

        {/* Filter */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <label htmlFor="skillFilter" className="block text-sm font-medium mb-2">
            Filter by Skill
          </label>
          <input
            id="skillFilter"
            type="text"
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            placeholder="e.g., React, Solidity, Rust"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Stats */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing <strong>{profiles.length}</strong> profile{profiles.length !== 1 ? 's' : ''}
            {skillFilter && ` matching "${skillFilter}"`}
          </p>
        </div>

        {/* Profiles List */}
        {loading ? (
          <LoadingSpinner text="Loading profiles..." className="py-12" />
        ) : profiles.length === 0 ? (
          <EmptyState
            title={skillFilter ? `No profiles found` : 'No profiles yet'}
            description={skillFilter ? `No profiles match "${skillFilter}". Try a different skill or clear the filter.` : 'Be the first to create a profile and join the network!'}
            icon={
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((profile) => (
              <div
                key={profile.key}
                className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
                onClick={() => router.push(`/profiles/${profile.wallet}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-1">
                      {profile.displayName || 'Anonymous'}
                    </h3>
                    {profile.username && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">@{profile.username}</p>
                    )}
                  </div>
                  {profile.profileImage && (
                    <img
                      src={profile.profileImage}
                      alt={profile.displayName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  )}
                </div>

                {profile.bioShort && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-2">
                    {profile.bioShort}
                  </p>
                )}

                {profile.skillsArray && profile.skillsArray.length > 0 && (
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-1">
                      {profile.skillsArray.slice(0, 3).map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded"
                        >
                          {skill}
                        </span>
                      ))}
                      {profile.skillsArray.length > 3 && (
                        <span className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                          +{profile.skillsArray.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  {profile.seniority && (
                    <div>
                      <strong>Level:</strong> {profile.seniority}
                    </div>
                  )}
                  {profile.timezone && (
                    <div>
                      <strong>Timezone:</strong> {profile.timezone}
                    </div>
                  )}
                  {profile.availabilityWindow && (
                    <div>
                      <strong>Available:</strong> {profile.availabilityWindow}
                    </div>
                  )}
                  <div>
                    <strong>Wallet:</strong> {shortenWallet(profile.wallet)}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/profiles/${profile.wallet}`);
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    View Profile →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

