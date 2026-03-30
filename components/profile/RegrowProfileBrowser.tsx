/**
 * Regrow Profile Browser Component
 *
 * Day 2: Allows users to browse all historical profiles and select one to regrow.
 * Based on profile_stability.md - Day 2 requirements.
 */

'use client';

import { useState, useEffect } from 'react';

interface HistoricalProfile {
  key: string;
  displayName: string;
  username?: string;
  bio?: string;
  bioShort?: string;
  bioLong?: string;
  skills?: string;
  skillsArray?: string[];
  timezone?: string;
  createdAt?: string;
  profileImage?: string;
  wallet?: string; // Original wallet address (for display)
  languages?: string[];
  contactLinks?: {
    twitter?: string;
    github?: string;
    telegram?: string;
    discord?: string;
  };
  seniority?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  domainsOfInterest?: string[];
  mentorRoles?: string[];
  learnerRoles?: string[];
  availabilityWindow?: string;
}

interface RegrowProfileBrowserProps {
  wallet: string; // Current wallet - will be used when creating new profile
  onSelectProfile: (profile: HistoricalProfile) => void;
  onCancel: () => void;
}

export function RegrowProfileBrowser({
  wallet,
  onSelectProfile,
  onCancel,
}: RegrowProfileBrowserProps) {
  const [loading, setLoading] = useState(true);
  const [regrowing, setRegrowing] = useState(false);
  const [error, setError] = useState('');
  const [allProfiles, setAllProfiles] = useState<HistoricalProfile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<HistoricalProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('');

  useEffect(() => {
    loadHistoricalProfiles();
  }, [wallet]);

  useEffect(() => {
    filterProfiles();
  }, [nameFilter, dateFilter, allProfiles]);

  const filterProfiles = () => {
    let filtered = [...allProfiles];

    // Filter by name
    if (nameFilter.trim()) {
      const searchTerm = nameFilter.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.displayName?.toLowerCase().includes(searchTerm) ||
          p.username?.toLowerCase().includes(searchTerm) ||
          p.bioShort?.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by date
    if (dateFilter) {
      const now = new Date();
      let filterDate = new Date();

      switch (dateFilter) {
        case 'this-week':
          filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
          break;
        case 'this-month':
          filterDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
          break;
        case 'last-week':
          // Last week = 7-14 days ago
          const weekEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const weekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter((p) => {
            if (!p.createdAt) return false;
            const profileDate = new Date(p.createdAt);
            return profileDate >= weekStart && profileDate < weekEnd;
          });
          setFilteredProfiles(filtered);
          return;
        case 'last-month':
          // Last month = 30-60 days ago
          const monthEnd = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          const monthStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter((p) => {
            if (!p.createdAt) return false;
            const profileDate = new Date(p.createdAt);
            return profileDate >= monthStart && profileDate < monthEnd;
          });
          setFilteredProfiles(filtered);
          return;
        case 'last-3-months':
          filterDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // Last 90 days
          break;
        default:
          break;
      }

      if (
        dateFilter === 'this-week' ||
        dateFilter === 'this-month' ||
        dateFilter === 'last-3-months'
      ) {
        filtered = filtered.filter((p) => {
          if (!p.createdAt) return false;
          const profileDate = new Date(p.createdAt);
          return profileDate >= filterDate;
        });
      }
    }

    setFilteredProfiles(filtered);
  };

  const loadHistoricalProfiles = async () => {
    try {
      setLoading(true);
      setError('');

      // Beta: Load ALL historical profiles from all wallets
      // Users can clone any historical profile into a new profile for their wallet
      const res = await fetch(`/api/profiles`);
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to load historical profiles');
      }

      // Get all profiles and convert to HistoricalProfile format
      const allProfiles = (data.profiles || []).map((p: any) => ({
        key: p.key,
        displayName: p.displayName,
        username: p.username,
        bio: p.bio,
        bioShort: p.bioShort,
        bioLong: p.bioLong,
        skills: p.skills,
        skillsArray: p.skillsArray,
        timezone: p.timezone,
        createdAt: p.createdAt,
        profileImage: p.profileImage,
        wallet: p.wallet, // Keep original wallet for display
        languages: p.languages,
        contactLinks: p.contactLinks,
        seniority: p.seniority,
        domainsOfInterest: p.domainsOfInterest,
        mentorRoles: p.mentorRoles,
        learnerRoles: p.learnerRoles,
        availabilityWindow: p.availabilityWindow,
      }));

      // Sort by createdAt descending (newest first)
      allProfiles.sort((a: HistoricalProfile, b: HistoricalProfile) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

      setAllProfiles(allProfiles);
      setFilteredProfiles(allProfiles);
    } catch (err: any) {
      console.error('Error loading historical profiles:', err);
      setError(err.message || 'Failed to load historical profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleRegrow = async () => {
    if (!selectedProfileId) {
      setError('Please select a profile to regrow');
      return;
    }

    const selectedProfile = filteredProfiles.find((p) => p.key === selectedProfileId);
    if (!selectedProfile) {
      setError('Selected profile not found');
      return;
    }

    // Show loading state
    setRegrowing(true);
    setError('');

    // Longer delay to show the loading state clearly and ensure it doesn't look like a failure
    await new Promise((resolve) => setTimeout(resolve, 3500));

    // Call the parent handler which will create the profile
    onSelectProfile(selectedProfile);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown date';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading historical profiles...</p>
      </div>
    );
  }

  if (regrowing) {
    return (
      <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/20">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-green-600 dark:border-green-400"></div>
          <h3 className="mb-2 text-lg font-semibold text-green-900 dark:text-green-200">
            Regrowing Profile...
          </h3>
          <p className="text-center text-sm text-green-800 dark:text-green-300">
            Creating your new profile from historical data.
            <br />
            This may take a few moments.
          </p>
        </div>
      </div>
    );
  }

  if (error && allProfiles.length === 0) {
    return (
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20">
        <h3 className="mb-2 text-lg font-semibold text-blue-900 dark:text-blue-200">
          Regrow Profile from History
        </h3>
        <p className="mb-4 text-sm text-blue-800 dark:text-blue-300">
          No historical profiles found for this wallet.
        </p>
        <p className="mb-4 text-sm text-red-700 dark:text-red-400">{error}</p>
        <button
          onClick={onCancel}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
        >
          Create New Profile
        </button>
      </div>
    );
  }

  if (allProfiles.length === 0) {
    // No history found, but still show the option to create new
    return (
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20">
        <h3 className="mb-2 text-lg font-semibold text-blue-900 dark:text-blue-200">
          Regrow Profile from History
        </h3>
        <p className="mb-4 text-sm text-blue-800 dark:text-blue-300">
          No historical profiles found. You can create a new profile below.
        </p>
        <button
          onClick={onCancel}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
        >
          Create New Profile
        </button>
      </div>
    );
  }

  return (
    <div
      className="mb-6 w-full rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20"
      style={{
        padding: 'clamp(1rem, 3vw, 2rem)',
        maxWidth: '75%',
        width: '75%',
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <h3 className="mb-2 text-lg font-semibold text-blue-900 dark:text-blue-200">
        Regrow Profile from History
      </h3>
      <p className="mb-4 text-sm text-blue-800 dark:text-blue-300">
        Browse all historical profiles. Select any profile to clone its data into a new profile for
        your wallet.
        {allProfiles.length > 0 && (
          <>
            {' '}
            Found {allProfiles.length} historical profile{allProfiles.length !== 1 ? 's' : ''}.
          </>
        )}
      </p>

      {/* Regrow button at top when profile is selected */}
      {selectedProfileId && (
        <div className="mb-6 flex gap-3">
          <button
            onClick={handleRegrow}
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white shadow-md transition-colors hover:bg-blue-700"
          >
            Regrow Selected Profile
          </button>
          <button
            onClick={() => setSelectedProfileId(null)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <label
            htmlFor="nameFilter"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Filter by Name
          </label>
          <input
            id="nameFilter"
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Search by name, username, or bio..."
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="sm:w-48">
          <label
            htmlFor="dateFilter"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Filter by Date
          </label>
          <select
            id="dateFilter"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All time</option>
            <option value="this-week">This week</option>
            <option value="this-month">This month</option>
            <option value="last-week">Last week</option>
            <option value="last-month">Last month</option>
            <option value="last-3-months">Last 3 months</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-100 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {filteredProfiles.length === 0 && (nameFilter || dateFilter) && (
        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            No profiles match your filters. Try adjusting your search criteria.
          </p>
        </div>
      )}

      {/* Organic grid layout with dynamic spacing - garden-like, cards size to content */}
      <div
        className="mb-4 w-full"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 'clamp(0.75rem, 2vw, 1.5rem)',
          maxWidth: '100%',
          width: '100%',
          gridAutoRows: 'min-content',
          alignItems: 'start',
        }}
      >
        {filteredProfiles.map((profile) => (
          <div
            key={profile.key}
            className={`cursor-pointer rounded-xl border-2 p-3 shadow-sm transition-all hover:shadow-md ${
              selectedProfileId === profile.key
                ? 'scale-[1.02] border-green-500 bg-green-50 shadow-md dark:border-green-400 dark:bg-green-900/20'
                : 'border-gray-200 bg-white/90 backdrop-blur-sm hover:border-green-300 hover:bg-green-50/50 dark:border-gray-700 dark:bg-gray-800/90 dark:hover:border-green-600 dark:hover:bg-green-900/10'
            }`}
            onClick={() => setSelectedProfileId(profile.key)}
          >
            <div className="flex w-full flex-col">
              <div className="mb-2 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h4 className="truncate font-medium text-gray-900 dark:text-gray-100">
                      {profile.displayName}
                    </h4>
                    {profile.username && (
                      <span className="truncate text-sm text-gray-500 dark:text-gray-400">
                        @{profile.username}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-2 flex-shrink-0">
                  <input
                    type="radio"
                    name="selectedProfile"
                    checked={selectedProfileId === profile.key}
                    onChange={() => setSelectedProfileId(profile.key)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                </div>
              </div>

              {profile.bioShort && (
                <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">{profile.bioShort}</p>
              )}

              {profile.skillsArray && profile.skillsArray.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {profile.skillsArray.map((skill, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Created: {formatDate(profile.createdAt)}
                </p>
                <div className="space-y-0.5 text-xs text-gray-400 dark:text-gray-500">
                  <p className="truncate font-mono" title={profile.key}>
                    ID: {profile.key.substring(0, 12)}...
                  </p>
                  {profile.wallet && (
                    <p className="truncate font-mono" title={profile.wallet}>
                      Wallet: {profile.wallet.substring(0, 10)}...
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Create New Profile
        </button>
      </div>

      {filteredProfiles.length > 0 && (
        <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
          Showing {filteredProfiles.length} of {allProfiles.length} profiles
        </p>
      )}
    </div>
  );
}
