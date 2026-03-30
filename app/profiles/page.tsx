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
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { formatAvailabilityForDisplay } from '@/lib/arkiv/availability';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import type { UserProfile } from '@/lib/arkiv/profile';

export default function ProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<(UserProfile & { profileCount?: number })[]>([]);
  const [archivedProfiles, setArchivedProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillFilter, setSkillFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [stats, setStats] = useState<{ total: number; active: number; archived: number } | null>(
    null
  );
  const [migrationMetrics, setMigrationMetrics] = useState<{
    totalWallets: number;
    walletsWithSingleProfile: number;
    walletsWithMultipleProfiles: number;
    percentCanonical: number;
  } | null>(null);
  const arkivBuilderMode = useArkivBuilderMode();

  useEffect(() => {
    fetchProfiles(skillFilter || undefined);
  }, [skillFilter]);

  const fetchProfiles = async (skill?: string, includeArchived = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (skill) params.set('skill', skill);
      if (includeArchived) params.set('includeArchived', 'true');
      if (arkivBuilderMode) {
        params.set('builderMode', 'true');
        params.set('spaceIds', 'beta-launch,local-dev,local-dev-seed');
      }
      const url = `/api/profiles${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) {
        setProfiles(data.profiles || []);
        if (data.archived) {
          setArchivedProfiles(data.archived || []);
        }
        if (data.stats) {
          setStats(data.stats);
        }
        if (data.migrationMetrics) {
          setMigrationMetrics(data.migrationMetrics);
        }
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
    <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <BackButton href="/network" />
        </div>

        <PageHeader
          title="Browse Profiles"
          description="Discover mentors and learners in the network."
        />

        {/* Filter */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <label htmlFor="skillFilter" className="mb-2 block text-sm font-medium">
            Filter by Skill
          </label>
          <input
            id="skillFilter"
            type="text"
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            placeholder="e.g., React, Solidity, Rust"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
          />
        </div>

        {/* Stats */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing <strong>{profiles.length}</strong> active profile
              {profiles.length !== 1 ? 's' : ''}
              {skillFilter && ` matching "${skillFilter}"`}
              {stats && stats.archived > 0 && (
                <span className="ml-2 text-gray-500 dark:text-gray-500">
                  ({stats.archived} archived)
                </span>
              )}
            </p>
            {stats && stats.archived > 0 && (
              <button
                onClick={() => {
                  setShowArchived(!showArchived);
                  fetchProfiles(skillFilter || undefined, !showArchived);
                }}
                className="rounded-lg bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                {showArchived ? 'Hide' : 'Show'} Archived ({stats.archived})
              </button>
            )}
          </div>

          {/* Migration Metrics - Only show in Builder Mode */}
          {arkivBuilderMode && migrationMetrics && migrationMetrics.totalWallets > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="mb-1 text-xs font-medium text-blue-900 dark:text-blue-200">
                📊 Entity Update Migration Progress
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>{migrationMetrics.percentCanonical}%</strong> of wallets have a single
                canonical profile ({migrationMetrics.walletsWithSingleProfile}/
                {migrationMetrics.totalWallets} wallets).
                {migrationMetrics.walletsWithMultipleProfiles > 0 && (
                  <span className="ml-1">
                    {migrationMetrics.walletsWithMultipleProfiles} wallet
                    {migrationMetrics.walletsWithMultipleProfiles !== 1 ? 's' : ''} still have
                    multiple profile versions.
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs italic text-blue-600 dark:text-blue-400">
                This shows how Arkiv is immutable (all versions exist) but state is mutable
                (canonical entity).
              </p>
            </div>
          )}
        </div>

        {/* Profiles List */}
        {loading ? (
          arkivBuilderMode ? (
            <ArkivQueryTooltip
              query={[
                `fetchProfiles(${skillFilter ? `skill='${skillFilter}'` : 'all'})`,
                `Queries:`,
                skillFilter
                  ? `GET /api/profiles?skill=${encodeURIComponent(skillFilter)}`
                  : `GET /api/profiles`,
                `   → type='user_profile'${skillFilter ? `, skills contains '${skillFilter}'` : ''}`,
                `Returns: UserProfile[] (all profiles, deduplicated by wallet)`,
              ]}
              label="Loading Profiles"
            >
              <LoadingSpinner text="Loading profiles..." className="py-12" />
            </ArkivQueryTooltip>
          ) : (
            <LoadingSpinner text="Loading profiles..." className="py-12" />
          )
        ) : profiles.length === 0 ? (
          <EmptyState
            title={skillFilter ? `No profiles found` : 'No profiles yet'}
            description={
              skillFilter
                ? `No profiles match "${skillFilter}". Try a different skill or clear the filter.`
                : 'Be the first to create a profile and join the network!'
            }
            icon={
              <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <div
                key={profile.key}
                className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 p-6 transition-colors hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600"
                onClick={() => router.push(`/profiles/${profile.wallet}`)}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="mb-1 text-lg font-semibold text-blue-600 dark:text-blue-400">
                      {profile.displayName || 'Anonymous'}
                    </h3>
                    {profile.username && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        @{profile.username}
                      </p>
                    )}
                  </div>
                  {profile.profileImage && (
                    <img
                      src={profile.profileImage}
                      alt={profile.displayName}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  )}
                </div>

                {profile.bioShort && (
                  <p className="mb-3 line-clamp-2 text-sm text-gray-700 dark:text-gray-300">
                    {profile.bioShort}
                  </p>
                )}

                {profile.skillsArray && profile.skillsArray.length > 0 && (
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-1">
                      {profile.skillsArray.slice(0, 3).map((skill, idx) => {
                        const skillIds = (profile as any).skill_ids || [];
                        const skillId = skillIds[idx];
                        const level =
                          skillId && profile.skillExpertise?.[skillId] !== undefined
                            ? profile.skillExpertise[skillId]
                            : undefined;
                        return (
                          <span
                            key={idx}
                            className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                          >
                            {skill}
                            {level !== undefined && ` (${level}/5)`}
                          </span>
                        );
                      })}
                      {profile.skillsArray.length > 3 && (
                        <span className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                          +{profile.skillsArray.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
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
                      <strong>Available:</strong>{' '}
                      {formatAvailabilityForDisplay(profile.availabilityWindow)}
                    </div>
                  )}
                  <div>
                    <strong>Wallet:</strong> {shortenWallet(profile.wallet)}
                  </div>
                  {profile.profileCount !== undefined && profile.profileCount > 1 && (
                    <div className="mt-2 border-t border-gray-300 pt-2 dark:border-gray-600">
                      <Link
                        href={`/profiles/${profile.wallet}/versions`}
                        className="group relative inline-flex items-center gap-1.5 text-blue-600 transition-colors hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                        title="View version history"
                      >
                        {/* DNA/Helix Icon - Double helix representation */}
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            d="M10 2a1 1 0 011 1v.5a1 1 0 001 1h.5a1 1 0 011 1v.5a1 1 0 001 1h.5a1 1 0 011 1v.5a1 1 0 001 1h.5a1 1 0 011 1v1a1 1 0 01-1 1h-.5a1 1 0 00-1 1v.5a1 1 0 01-1 1h-.5a1 1 0 00-1 1v.5a1 1 0 01-1 1h-.5a1 1 0 00-1 1v.5a1 1 0 01-1 1H9a1 1 0 01-1-1v-.5a1 1 0 00-1-1h-.5a1 1 0 01-1-1v-.5a1 1 0 00-1-1h-.5a1 1 0 01-1-1v-.5a1 1 0 00-1-1h-.5a1 1 0 01-1-1v-1a1 1 0 011-1h.5a1 1 0 001-1v-.5a1 1 0 011-1h.5a1 1 0 001-1v-.5a1 1 0 011-1h.5a1 1 0 001-1V3a1 1 0 011-1h0z"
                            opacity="0.3"
                          />
                          <path d="M10 2a1 1 0 00-1 1v.5a1 1 0 01-1 1h-.5a1 1 0 00-1 1v.5a1 1 0 01-1 1h-.5a1 1 0 00-1 1v.5a1 1 0 01-1 1h-.5a1 1 0 00-1 1v1a1 1 0 001 1h.5a1 1 0 011 1v.5a1 1 0 001 1h.5a1 1 0 011 1v.5a1 1 0 001 1h.5a1 1 0 011 1v.5a1 1 0 001 1H11a1 1 0 001-1v-.5a1 1 0 011-1h.5a1 1 0 001-1v-.5a1 1 0 011-1h.5a1 1 0 001-1v-.5a1 1 0 011-1h.5a1 1 0 001-1v-1a1 1 0 00-1-1h-.5a1 1 0 01-1-1v-.5a1 1 0 00-1-1h-.5a1 1 0 01-1-1v-.5a1 1 0 00-1-1h-.5a1 1 0 01-1-1V3a1 1 0 00-1-1h0z" />
                        </svg>
                        <span className="font-medium">Version history</span>
                        {/* Educational Tooltip */}
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-96 max-w-2xl -translate-x-1/2 whitespace-normal rounded-lg bg-gray-900 px-4 py-3 text-sm text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 dark:bg-gray-800">
                          <div className="mb-2 font-semibold">Profile version history</div>
                          <p className="leading-relaxed text-gray-300 dark:text-gray-400">
                            Blockchains are immutable at the transaction level, but application data
                            is mutable at the state level. We can update profiles while preserving
                            all historical versions on-chain. The app displays the latest canonical
                            state.
                          </p>
                          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                        </div>
                      </Link>
                    </div>
                  )}
                  {profile.profileCount === 1 && (
                    <div className="mt-2 border-t border-gray-300 pt-2 dark:border-gray-600">
                      {arkivBuilderMode ? (
                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>Canonical profile (single version)</span>
                        </div>
                      ) : (
                        <div className="group relative inline-block">
                          <div className="flex cursor-help items-center gap-1 text-green-600 dark:text-green-400">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span>Canonical profile (single version)</span>
                          </div>
                          {/* Educational Tooltip - only show when builder mode is OFF */}
                          <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-96 max-w-2xl -translate-x-1/2 whitespace-normal rounded-lg bg-gray-900 px-4 py-3 text-sm text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 dark:bg-gray-800">
                            <div className="mb-2 font-semibold">Canonical profile</div>
                            <p className="leading-relaxed text-gray-300 dark:text-gray-400">
                              Blockchains are immutable at the transaction level, but application
                              data is mutable at the state level. This profile uses a stable entity
                              key, so edits update the same entity rather than creating new
                              versions. All transaction history is preserved on-chain, ensuring a
                              complete audit trail while maintaining consistent identity.
                            </p>
                            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-700">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/profiles/${profile.wallet}`);
                    }}
                    className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                  >
                    View Profile →
                  </button>
                  {arkivBuilderMode && profile.key && (
                    <div className="flex items-center gap-2">
                      <ViewOnArkivLink
                        entityKey={profile.key}
                        txHash={profile.txHash}
                        label="View Profile on Arkiv"
                        className="text-xs"
                      />
                      <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                        {profile.key.slice(0, 12)}...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Archived Profiles Section */}
        {showArchived && archivedProfiles.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-semibold text-gray-600 dark:text-gray-400">
              📦 Archived Profiles ({archivedProfiles.length})
            </h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-500">
              These profiles exist in Arkiv but cannot be fully loaded. They may be historical
              profiles from earlier builds.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {archivedProfiles.map((profile) => (
                <div
                  key={profile.key}
                  className="rounded-lg border border-gray-300 bg-gray-100 p-6 opacity-75 dark:border-gray-600 dark:bg-gray-900"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="mb-1 text-lg font-semibold text-gray-500 dark:text-gray-400">
                        {profile.displayName || 'Anonymous'}
                      </h3>
                      {profile.username && (
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                          @{profile.username}
                        </p>
                      )}
                    </div>
                    {arkivBuilderMode && profile.key && (
                      <ViewOnArkivLink
                        entityKey={profile.key}
                        txHash={profile.txHash}
                        label="View on Arkiv"
                        className="text-xs"
                      />
                    )}
                  </div>
                  <div className="space-y-1 text-xs text-gray-400 dark:text-gray-500">
                    <div>
                      <strong>Wallet:</strong> {shortenWallet(profile.wallet)}
                    </div>
                    {profile.createdAt && (
                      <div>
                        <strong>Created:</strong> {formatDate(profile.createdAt)}
                      </div>
                    )}
                    <div className="mt-2 text-yellow-600 dark:text-yellow-400">
                      ⚠️ Cannot load full profile
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
