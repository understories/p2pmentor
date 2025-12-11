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
import { ThemeToggle } from '@/components/ThemeToggle';
import { EmptyState } from '@/components/EmptyState';
import { EmojiIdentitySeed } from '@/components/profile/EmojiIdentitySeed';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { getProfileByWallet } from '@/lib/arkiv/profile';
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
        getProfileByWallet(address).then(setUserProfile).catch(() => null);
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
      const res = await fetch(`/api/virtual-gatherings?community=${encodeURIComponent(community)}${wallet ? `&wallet=${encodeURIComponent(wallet)}` : ''}`);
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
      alert('You have already RSVP\'d to this gathering');
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

      alert('RSVP confirmed! This gathering is now linked to your profile.');
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
    <div className="min-h-screen relative">
      <BackgroundImage />
      <ThemeToggle />
      <div className="container mx-auto px-4 py-8 max-w-4xl relative z-10">
        <BackButton />
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
              Virtual Gatherings
            </h1>
            <div className="relative group">
              <span className="text-sm text-gray-500 dark:text-gray-400 cursor-help">🔗</span>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg z-50">
                On-chain feature · stored as Arkiv entities
                <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
              </div>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            Community virtual meetings. Anyone can suggest, anyone can RSVP. Jitsi room ready immediately.
          </p>
          
          {/* Community Filter */}
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Community:</label>
            <select
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="beta_users">Beta Users</option>
            </select>
            {userWallet && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="ml-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                + Suggest Gathering
              </button>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        )}

        {/* Empty State */}
        {!loading && gatherings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="relative mb-6">
              <div 
                className="absolute inset-0 blur-2xl opacity-30"
                style={{
                  background: 'radial-gradient(circle, rgba(34, 197, 94, 0.4) 0%, transparent 70%)',
                  transform: 'translateY(20px)',
                }}
              />
              <div className="relative text-6xl animate-pulse">🌳</div>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No gatherings scheduled yet
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md">
              Be the first to suggest a community gathering.
            </p>
            {userWallet && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
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
              const organizerName = organizerProfile?.displayName || organizerProfile?.username || gathering.organizerWallet.slice(0, 8) + '...';
              const hasRsvpd = rsvpStatus[gathering.key] || false;
              const isPast = new Date(gathering.sessionDate).getTime() < Date.now();

              return (
                <div
                  key={gathering.key}
                  className="backdrop-blur-sm rounded-xl shadow-lg p-6 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl hover:border-green-300/50 dark:hover:border-green-500/30 transition-all duration-300 relative overflow-hidden"
                >
                  {/* Background gradients */}
                  <div 
                    className="dark:hidden absolute inset-0 -z-10"
                    style={{
                      background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.98))',
                    }}
                  />
                  <div 
                    className="hidden dark:block absolute inset-0 -z-10"
                    style={{
                      background: 'linear-gradient(to bottom, rgba(31, 41, 55, 0.95), rgba(17, 24, 39, 0.98))',
                    }}
                  />
                  <div 
                    className="absolute inset-0 -z-10 opacity-30"
                    style={{
                      background: 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
                    }}
                  />
                  
                  <div className="relative z-10">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                          {gathering.title}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <span>Organized by</span>
                          <Link
                            href={`/profiles/${gathering.organizerWallet}`}
                            className="font-medium hover:underline flex items-center gap-1"
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
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                        {gathering.description}
                      </p>
                    )}

                    {/* Community Badge */}
                    <div className="mb-4">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {gathering.community.replace('_', ' ')}
                      </span>
                    </div>

                    {/* RSVP Count */}
                    <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                      {gathering.rsvpCount || 0} {gathering.rsvpCount === 1 ? 'person' : 'people'} RSVP'd
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      {gathering.videoJoinUrl && !isPast && (
                        <a
                          href={gathering.videoJoinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Join Jitsi Room
                        </a>
                      )}
                      {userWallet && !hasRsvpd && !isPast && (
                        <button
                          onClick={() => handleRSVP(gathering.key)}
                          disabled={rsvping === gathering.key}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {rsvping === gathering.key ? 'RSVPing...' : 'RSVP'}
                        </button>
                      )}
                      {hasRsvpd && (
                        <span className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium">
                          ✓ RSVP'd
                        </span>
                      )}
                      <ViewOnArkivLink txHash={gathering.txHash} entityKey={gathering.key} className="text-xs" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                Suggest a Gathering
              </h3>
              <form onSubmit={handleCreateGathering}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="e.g., Beta Feedback Session"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="What's this gathering about?"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Time (UTC) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={formTime}
                        onChange={(e) => setFormTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={formDuration}
                      onChange={(e) => setFormDuration(e.target.value)}
                      min="15"
                      max="240"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end mt-6">
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
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create Gathering'}
                  </button>
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    }>
      <VirtualGatheringsContent />
    </Suspense>
  );
}
