/**
 * Profile Garden Notes Page
 * 
 * Per-profile view of garden notes (notes to/from this profile).
 * 
 * Features:
 * - Shows notes where this profile is the target
 * - Shows notes authored by this profile
 * - Filter toggle between "to" and "from"
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { BackgroundImage } from '@/components/BackgroundImage';
import { ThemeToggle } from '@/components/ThemeToggle';
import { EmptyState } from '@/components/EmptyState';
import { GardenNoteComposeModal } from '@/components/GardenNoteComposeModal';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import type { GardenNote } from '@/lib/arkiv/gardenNote';
import type { UserProfile } from '@/lib/arkiv/profile';

export default function ProfileGardenNotesPage() {
  const params = useParams();
  const router = useRouter();
  const wallet = params.wallet as string;

  const [notes, setNotes] = useState<GardenNote[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'to' | 'from'>('all');

  useEffect(() => {
    if (wallet) {
      loadProfile();
      loadNotes();
    }

    // Get current user's wallet
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (address) {
        setUserWallet(address);
        getProfileByWallet(address).then(setUserProfile).catch(() => null);
      }
    }
  }, [wallet]);

  const loadProfile = async () => {
    try {
      const profileData = await getProfileByWallet(wallet);
      setProfile(profileData);
    } catch (err) {
      setError('Failed to load profile');
    }
  };

  const loadNotes = async () => {
    try {
      setLoading(true);
      setError('');

      // Load notes where this profile is the target
      const targetRes = await fetch(`/api/garden-notes?targetWallet=${encodeURIComponent(wallet)}`);
      const targetData = await targetRes.json();

      // Load notes authored by this profile
      const authorRes = await fetch(`/api/garden-notes?authorWallet=${encodeURIComponent(wallet)}`);
      const authorData = await authorRes.json();

      const allNotes = [
        ...(targetData.ok ? targetData.notes || [] : []),
        ...(authorData.ok ? authorData.notes || [] : []),
      ];

      // Remove duplicates (by key)
      const uniqueNotes = Array.from(
        new Map(allNotes.map((note: GardenNote) => [note.key, note])).values()
      );

      setNotes(uniqueNotes);

      // Load profiles for all note authors/targets
      const uniqueWallets = new Set<string>();
      uniqueNotes.forEach((note: GardenNote) => {
        uniqueWallets.add(note.authorWallet);
        if (note.targetWallet) {
          uniqueWallets.add(note.targetWallet);
        }
      });

      const profilePromises = Array.from(uniqueWallets).map(async (w) => {
        try {
          const p = await getProfileByWallet(w);
          return { wallet: w, profile: p };
        } catch {
          return { wallet: w, profile: null };
        }
      });

      const profileResults = await Promise.all(profilePromises);
      const profileMap: Record<string, UserProfile> = {};
      profileResults.forEach(({ wallet: w, profile: p }) => {
        if (p) {
          profileMap[w.toLowerCase()] = p;
        }
      });

      setProfiles(profileMap);
    } catch (err: any) {
      setError(err.message || 'Failed to load garden notes');
    } finally {
      setLoading(false);
    }
  };

  const filteredNotes = notes.filter((note) => {
    if (filter === 'to') {
      return note.targetWallet?.toLowerCase() === wallet.toLowerCase();
    }
    if (filter === 'from') {
      return note.authorWallet.toLowerCase() === wallet.toLowerCase();
    }
    return true;
  });

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getAuthorProfile = (wallet: string) => {
    return profiles[wallet.toLowerCase()] || null;
  };

  const getTargetProfile = (wallet?: string) => {
    if (!wallet) return null;
    return profiles[wallet.toLowerCase()] || null;
  };

  const profileName = profile?.displayName || profile?.username || wallet.slice(0, 8) + '...';

  return (
    <div className="min-h-screen relative">
      {/* Background art - no gradients, just the base background */}
      <BackgroundImage />

      {/* No BetaBanner on this page */}
      <ThemeToggle />
      <div className="container mx-auto px-4 py-8 max-w-4xl relative z-10">
        <BackButton />
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {profileName}'s Garden Notes
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Public notes in this garden
          </p>
        </div>

        {/* Lantern-style Educational Banner - Gradient only behind this object */}
        <div className="mb-6 p-5 rounded-2xl border-2 border-green-400/30 dark:border-green-500/40 backdrop-blur-sm relative overflow-hidden"
          style={{
            background: 'linear-gradient(to bottom, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.08))',
            boxShadow: '0 0 20px rgba(34, 197, 94, 0.15), inset 0 0 20px rgba(34, 197, 94, 0.05)',
          }}
        >
          <div className="flex items-start gap-3 relative z-10">
            <span className="text-2xl animate-pulse">🌱</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900 dark:text-green-200 mb-1">
                Public garden notes
              </p>
              <p className="text-xs text-green-800 dark:text-green-300 leading-relaxed">
                These are public on-chain messages. They're stored as Arkiv entities, not just in this app.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6 flex items-center justify-between">
          {/* Filter Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('to')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'to'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              To {profileName}
            </button>
            <button
              onClick={() => setFilter('from')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'from'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              From {profileName}
            </button>
          </div>

          {/* Compose Button - Always "Plant a Note" */}
          {userWallet && userWallet.toLowerCase() !== wallet.toLowerCase() && (
            <button
              onClick={() => setShowComposeModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white rounded-full font-medium transition-all duration-300 flex items-center gap-2"
              style={{
                boxShadow: '0 0 20px rgba(34, 197, 94, 0.4), 0 4px 6px rgba(0, 0, 0, 0.1)',
              }}
            >
              <span>🌿</span>
              <span>Plant a Note</span>
            </button>
          )}
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

        {/* Empty State - Sprout Scene (no button here, button is always at top) */}
        {!loading && filteredNotes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="relative mb-6">
              {/* Glow below sprout */}
              <div 
                className="absolute inset-0 blur-2xl opacity-30"
                style={{
                  background: 'radial-gradient(circle, rgba(34, 197, 94, 0.4) 0%, transparent 70%)',
                  transform: 'translateY(20px)',
                }}
              />
              {/* Sprout icon */}
              <div className="relative text-6xl animate-pulse">🌱</div>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No notes in the garden yet
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md">
              {filter === 'to'
                ? `No one has left a note in ${profileName}'s garden yet.`
                : filter === 'from'
                ? `${profileName} hasn't posted any notes yet.`
                : `No notes in ${profileName}'s garden yet.`}
            </p>
          </div>
        )}

        {/* Notes List */}
        {!loading && filteredNotes.length > 0 && (
          <div className="space-y-4">
            {filteredNotes.map((note) => {
              const authorProfile = getAuthorProfile(note.authorWallet);
              const targetProfile = getTargetProfile(note.targetWallet);
              const authorName = authorProfile?.displayName || authorProfile?.username || note.authorWallet.slice(0, 8) + '...';
              const authorWalletShort = note.authorWallet.slice(0, 6) + '...' + note.authorWallet.slice(-4);
              const isToThisProfile = note.targetWallet?.toLowerCase() === wallet.toLowerCase();
              const isFromThisProfile = note.authorWallet.toLowerCase() === wallet.toLowerCase();

              return (
                <div
                  key={note.key}
                  className="backdrop-blur-sm rounded-xl shadow-lg p-6 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl hover:border-green-300/50 dark:hover:border-green-500/30 transition-all duration-300 relative overflow-hidden"
                >
                  {/* Light mode background */}
                  <div 
                    className="dark:hidden absolute inset-0 -z-10"
                    style={{
                      background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.98))',
                    }}
                  />
                  {/* Dark mode background */}
                  <div 
                    className="hidden dark:block absolute inset-0 -z-10"
                    style={{
                      background: 'linear-gradient(to bottom, rgba(31, 41, 55, 0.95), rgba(17, 24, 39, 0.98))',
                    }}
                  />
                  {/* Gradient only behind this card */}
                  <div 
                    className="absolute inset-0 -z-10 opacity-30"
                    style={{
                      background: 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
                    }}
                  />
                  <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-semibold">
                        {authorName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          {isFromThisProfile ? (
                            <span className="font-semibold">You</span>
                          ) : (
                            <Link
                              href={`/profiles/${note.authorWallet}`}
                              className="font-semibold hover:underline"
                            >
                              {authorName}
                            </Link>
                          )}
                          {isToThisProfile && (
                            <>
                              <span className="text-gray-400">→</span>
                              <span className="font-medium text-gray-600 dark:text-gray-400">
                                {profileName}
                              </span>
                            </>
                          )}
                          {targetProfile && !isToThisProfile && (
                            <>
                              <span className="text-gray-400">→</span>
                              <Link
                                href={`/profiles/${note.targetWallet}`}
                                className="font-medium text-gray-600 dark:text-gray-400 hover:underline"
                              >
                                {targetProfile.displayName || targetProfile.username || 'User'}
                              </Link>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-600 dark:text-gray-400">{formatTimeAgo(note.createdAt)}</span>
                          {note.txHash && note.txHash !== 'undefined' && (
                            <>
                              <span className="text-gray-400 dark:text-gray-500">·</span>
                              <a
                                href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${note.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline flex items-center gap-1 text-green-600 dark:text-green-400 font-medium"
                                title="View in Arkiv Explorer"
                              >
                                <span>🔗</span>
                                <span>Public Arkiv entry</span>
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message */}
                  <div className="mb-3">
                    <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap font-medium">
                      {note.message}
                    </p>
                  </div>

                  {/* Tags - Sprout Chips */}
                  {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {note.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium border border-green-200/50 dark:border-green-700/50 hover:shadow-md hover:shadow-green-200/50 dark:hover:shadow-green-900/30 transition-all duration-200"
                          style={{
                            boxShadow: '0 0 8px rgba(34, 197, 94, 0.1)',
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="pt-3 border-t border-gray-300/50 dark:border-gray-600/50 flex items-center justify-between text-xs">
                    <span className="font-mono text-gray-700 dark:text-gray-300">{authorWalletShort}</span>
                    {note.txHash && note.txHash !== 'undefined' && (
                      <a
                        href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${note.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline text-green-600 dark:text-green-400 font-medium"
                      >
                        View raw data →
                      </a>
                    )}
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Compose Modal */}
      <GardenNoteComposeModal
        isOpen={showComposeModal}
        onClose={() => setShowComposeModal(false)}
        targetProfile={profile}
        userWallet={userWallet}
        userProfile={userProfile}
        onSuccess={() => {
          // Wait for blockchain confirmation, then refresh (global pattern)
          setTimeout(() => {
            loadNotes();
          }, 3000); // Wait 3 seconds for entity to be indexed
        }}
      />
    </div>
  );
}
