/**
 * Virtual Gatherings Page
 *
 * Public view of community virtual gatherings.
 * Anyone can suggest a meeting, anyone can RSVP.
 * Jitsi is generated immediately (no confirmation needed).
 *
 * Reference: Learner community feature
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { BackgroundImage } from '@/components/BackgroundImage';
import { EmptyState } from '@/components/EmptyState';
import { EmojiIdentitySeed } from '@/components/profile/EmojiIdentitySeed';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { appendBuilderModeParams } from '@/lib/utils/builderMode';
import type { UserProfile } from '@/lib/arkiv/profile';

type VirtualGathering = {
  key: string;
  organizerWallet: string;
  community: string;
  title: string;
  description?: string;
  sessionDate: string;
  duration: number;
  videoJoinUrl?: string;
  videoRoomName?: string;
  rsvpCount?: number;
  txHash?: string;
  createdAt: string;
};

function VirtualGatheringsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [gatherings, setGatherings] = useState<VirtualGathering[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState<Record<string, boolean>>({});
  const [rsvping, setRsvping] = useState<string | null>(null);
  const [community, setCommunity] = useState(searchParams.get('community') || 'beta_users');
  const arkivBuilderMode = useArkivBuilderMode();

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formDuration, setFormDuration] = useState('60');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Get current user's wallet
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (address) {
        setUserWallet(address);
        getProfileByWallet(address)
          .then(setUserProfile)
          .catch(() => null);
      }
    }
  }, []);

  useEffect(() => {
    loadGatherings();
  }, [community]);

  // Open modal if create=true in URL
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowCreateModal(true);
      router.replace('/communities/gatherings');
    }
  }, [searchParams, router]);

  const loadGatherings = async () => {
    try {
      setLoading(true);
      setError('');

      const wallet = userWallet || '';
      const gatheringsParams = `?community=${encodeURIComponent(community)}${wallet ? `&wallet=${encodeURIComponent(wallet)}` : ''}`;
      const res = await fetch(
        `/api/virtual-gatherings${appendBuilderModeParams(arkivBuilderMode, gatheringsParams)}`
      );
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to load gatherings');
      }

      setGatherings(data.gatherings || []);
      setRsvpStatus(data.rsvpStatus || {});

      // Load profiles for organizers
      const uniqueWallets = new Set<string>();
      data.gatherings?.forEach((gathering: VirtualGathering) => {
        uniqueWallets.add(gathering.organizerWallet);
      });

      const profilePromises = Array.from(uniqueWallets).map(async (wallet) => {
        try {
          const profile = await getProfileByWallet(wallet);
          return { wallet, profile };
        } catch {
          return { wallet, profile: null };
        }
      });

      const profileResults = await Promise.all(profilePromises);
      const profileMap: Record<string, UserProfile> = {};
      profileResults.forEach(({ wallet, profile }) => {
        if (profile) {
          profileMap[wallet.toLowerCase()] = profile;
        }
      });
      setProfiles(profileMap);
    } catch (err: any) {
      console.error('Error loading gatherings:', err);
      setError(err.message || 'Failed to load gatherings');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGathering = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userWallet) {
      alert('Please connect your wallet first');
      return;
    }

    if (!formTitle || !formDate || !formTime) {
      alert('Please fill in all required fields');
      return;
    }

    // Combine date and time into ISO timestamp
    const sessionDate = new Date(`${formDate}T${formTime}:00`).toISOString();

    setSubmitting(true);
    try {
      const res = await fetch('/api/virtual-gatherings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          organizerWallet: userWallet,
          community,
          title: formTitle,
          description: formDescription,
          sessionDate,
          duration: parseInt(formDuration, 10),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create gathering');
      }

      alert('Gathering created! Jitsi room is ready.');
      setShowCreateModal(false);
      setFormTitle('');
      setFormDescription('');
      setFormDate('');
      setFormTime('');
      setFormDuration('60');
      loadGatherings();
    } catch (err: any) {
      console.error('Error creating gathering:', err);
      alert(err.message || 'Failed to create gathering');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRSVP = async (gatheringKey: string) => {
    if (!userWallet) {
      alert('Please connect your wallet first');
      return;
    }

    if (rsvpStatus[gatheringKey]) {
      alert("You have already RSVP'd to this gathering");
      return;
    }

    setRsvping(gatheringKey);
    try {
      const res = await fetch('/api/virtual-gatherings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rsvp',
          gatheringKey,
          wallet: userWallet,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to RSVP');
      }

      // Optimistically update RSVP status immediately
      setRsvpStatus((prev) => ({ ...prev, [gatheringKey]: true }));

      // Wait for Arkiv to index the new RSVP entity before reloading
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Reload gatherings to get updated RSVP count and ensure consistency
      loadGatherings();
    } catch (err: any) {
      console.error('Error RSVPing:', err);
      alert(err.message || 'Failed to RSVP');
    } finally {
      setRsvping(null);
    }
  };

  const getOrganizerProfile = (wallet: string) => {
    return profiles[wallet.toLowerCase()] || null;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  return (
    <div className="relative min-h-screen">
      <BackgroundImage />
      <div className="container relative z-10 mx-auto max-w-4xl px-4 py-8">
        <BackButton />
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
              Virtual Gatherings
            </h1>
            <div className="group relative">
              <span className="cursor-help text-sm text-gray-500 dark:text-gray-400">🔗</span>
              <div className="absolute bottom-full left-0 z-50 mb-2 hidden w-48 rounded-lg bg-gray-900 p-2 text-xs text-white shadow-lg group-hover:block dark:bg-gray-800">
                On-chain feature · stored as Arkiv entities
                <div className="absolute left-4 top-full h-0 w-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
              </div>
            </div>
          </div>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Community virtual meetings. Anyone can suggest, anyone can RSVP. Jitsi room ready
            immediately.
          </p>

          {/* Community Filter */}
          <div className="mb-4 flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Community:
            </label>
            <select
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="beta_users">Beta Users</option>
            </select>
            {userWallet &&
              (arkivBuilderMode ? (
                <ArkivQueryTooltip
                  query={[
                    `Opens modal to create virtual gathering`,
                    `POST /api/virtual-gatherings { action: 'create', ... }`,
                    `Creates: type='virtual_gathering' entity`,
                    `Attributes: organizerWallet='${userWallet?.toLowerCase().slice(0, 8) || '...'}...', community='${community}', title, sessionDate, duration`,
                    `Payload: Full gathering data (description, videoJoinUrl, videoRoomName)`,
                    `TTL: sessionDate + duration + 1 hour buffer`,
                  ]}
                  label="Suggest Gathering"
                >
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="ml-auto rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                  >
                    + Suggest Gathering
                  </button>
                </ArkivQueryTooltip>
              ) : (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="ml-auto rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                >
                  + Suggest Gathering
                </button>
              ))}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `loadGatherings()`,
                  `Queries:`,
                  `1. GET /api/virtual-gatherings?community=${community}&wallet=${userWallet?.toLowerCase().slice(0, 8) || '...'}...`,
                  `   → type='virtual_gathering', community='${community}'`,
                  `   → type='virtual_gathering_rsvp', wallet='${userWallet?.toLowerCase().slice(0, 8) || '...'}...' (for RSVP status)`,
                  `2. getProfileByWallet(...) for each organizer wallet`,
                  `   → type='user_profile', wallet='...'`,
                  `Returns: VirtualGathering[] (all gatherings for community)`,
                ]}
                label="Loading Virtual Gatherings"
              >
                <LoadingSpinner />
              </ArkivQueryTooltip>
            ) : (
              <LoadingSpinner />
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && gatherings.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="relative mb-6">
              <div
                className="absolute inset-0 opacity-30 blur-2xl"
                style={{
                  background: 'radial-gradient(circle, rgba(34, 197, 94, 0.4) 0%, transparent 70%)',
                  transform: 'translateY(20px)',
                }}
              />
              <div className="relative animate-pulse text-6xl">🌳</div>
            </div>
            <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              No gatherings scheduled yet
            </h3>
            <p className="mb-6 max-w-md text-sm text-gray-600 dark:text-gray-400">
              Be the first to suggest a community gathering.
            </p>
            {userWallet && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="rounded-lg bg-green-600 px-6 py-3 font-medium text-white transition-colors hover:bg-green-700"
              >
                Suggest First Gathering
              </button>
            )}
          </div>
        )}

        {/* Gatherings List */}
        {!loading && gatherings.length > 0 && (
          <div className="space-y-4">
            {gatherings.map((gathering) => {
              const organizerProfile = getOrganizerProfile(gathering.organizerWallet);
              const organizerName =
                organizerProfile?.displayName ||
                organizerProfile?.username ||
                gathering.organizerWallet.slice(0, 8) + '...';
              const hasRsvpd = rsvpStatus[gathering.key] || false;
              const isPast = new Date(gathering.sessionDate).getTime() < Date.now();

              return (
                <div
                  key={gathering.key}
                  className="relative overflow-hidden rounded-xl border border-gray-200/50 p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-green-300/50 hover:shadow-xl dark:border-gray-700/50 dark:hover:border-green-500/30"
                >
                  {/* Background gradients */}
                  <div
                    className="absolute inset-0 -z-10 dark:hidden"
                    style={{
                      background:
                        'linear-gradient(to bottom, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.98))',
                    }}
                  />
                  <div
                    className="absolute inset-0 -z-10 hidden dark:block"
                    style={{
                      background:
                        'linear-gradient(to bottom, rgba(31, 41, 55, 0.95), rgba(17, 24, 39, 0.98))',
                    }}
                  />
                  <div
                    className="absolute inset-0 -z-10 opacity-30"
                    style={{
                      background:
                        'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
                    }}
                  />

                  <div className="relative z-10">
                    {/* Header */}
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                          {gathering.title}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <span>Organized by</span>
                          <Link
                            href={`/profiles/${gathering.organizerWallet}`}
                            className="flex items-center gap-1 font-medium hover:underline"
                          >
                            <EmojiIdentitySeed profile={organizerProfile} size="sm" />
                            {organizerName}
                          </Link>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatDate(gathering.sessionDate)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {gathering.duration} min
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {gathering.description && (
                      <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
                        {gathering.description}
                      </p>
                    )}

                    {/* Community Badge */}
                    <div className="mb-4">
                      <span className="inline-flex items-center rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {gathering.community.replace('_', ' ')}
                      </span>
                    </div>

                    {/* RSVP Count */}
                    <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                      {gathering.rsvpCount || 0} {gathering.rsvpCount === 1 ? 'person' : 'people'}{' '}
                      RSVP'd
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      {gathering.videoJoinUrl && !isPast && (
                        <a
                          href={gathering.videoJoinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                        >
                          Join Jitsi Room
                        </a>
                      )}
                      {userWallet &&
                        !hasRsvpd &&
                        !isPast &&
                        (arkivBuilderMode ? (
                          <ArkivQueryTooltip
                            query={[
                              `POST /api/virtual-gatherings { action: 'rsvp', ... }`,
                              `Creates: type='virtual_gathering_rsvp' entity`,
                              `Attributes: gatheringKey='${gathering.key.slice(0, 12)}...', wallet='${userWallet?.toLowerCase().slice(0, 8) || '...'}...'`,
                              `Payload: Full RSVP data`,
                              `TTL: sessionDate + duration + 1 hour buffer`,
                            ]}
                            label="RSVP"
                          >
                            <button
                              onClick={() => handleRSVP(gathering.key)}
                              disabled={rsvping === gathering.key}
                              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                            >
                              {rsvping === gathering.key ? 'RSVPing...' : 'RSVP'}
                            </button>
                          </ArkivQueryTooltip>
                        ) : (
                          <button
                            onClick={() => handleRSVP(gathering.key)}
                            disabled={rsvping === gathering.key}
                            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                          >
                            {rsvping === gathering.key ? 'RSVPing...' : 'RSVP'}
                          </button>
                        ))}
                      {hasRsvpd && (
                        <span className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                          ✓ RSVP'd
                        </span>
                      )}
                      {arkivBuilderMode && gathering.key && (
                        <div className="flex items-center gap-2">
                          <ViewOnArkivLink
                            entityKey={gathering.key}
                            txHash={gathering.txHash}
                            className="text-xs"
                          />
                          <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                            {gathering.key.slice(0, 12)}...
                          </span>
                        </div>
                      )}
                      {!arkivBuilderMode && (
                        <ViewOnArkivLink entityKey={gathering.key} className="text-xs" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 dark:bg-gray-800">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                Suggest a Gathering
              </h3>
              <form onSubmit={handleCreateGathering}>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="e.g., Beta Feedback Session"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="What's this gathering about?"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Time (UTC) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={formTime}
                        onChange={(e) => setFormTime(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={formDuration}
                      onChange={(e) => setFormDuration(e.target.value)}
                      min="15"
                      max="240"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setFormTitle('');
                      setFormDescription('');
                      setFormDate('');
                      setFormTime('');
                      setFormDuration('60');
                    }}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  {arkivBuilderMode ? (
                    <ArkivQueryTooltip
                      query={[
                        `POST /api/virtual-gatherings { action: 'create', ... }`,
                        `Creates: type='virtual_gathering' entity`,
                        `Attributes: organizerWallet='${userWallet?.toLowerCase().slice(0, 8) || '...'}...', community='${community}', title, sessionDate, duration`,
                        `Payload: Full gathering data (description, videoJoinUrl, videoRoomName)`,
                        `TTL: sessionDate + duration + 1 hour buffer`,
                      ]}
                      label="Create Gathering"
                    >
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                      >
                        {submitting ? 'Creating...' : 'Create Gathering'}
                      </button>
                    </ArkivQueryTooltip>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                    >
                      {submitting ? 'Creating...' : 'Create Gathering'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VirtualGatheringsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LoadingSpinner />
        </div>
      }
    >
      <VirtualGatheringsContent />
    </Suspense>
  );
}
