/**
 * Public Garden Board Page
 *
 * Global view of all public garden notes (bulletin board).
 *
 * Features:
 * - Shows all public notes from all users
 * - Educational banner about on-chain nature
 * - Links to Arkiv explorer
 * - Filter by tags (future)
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { BackgroundImage } from '@/components/BackgroundImage';
import { EmptyState } from '@/components/EmptyState';
import { GardenNoteComposeModal } from '@/components/GardenNoteComposeModal';
import { EmojiIdentitySeed } from '@/components/profile/EmojiIdentitySeed';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { appendBuilderModeParams } from '@/lib/utils/builderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import type { GardenNote } from '@/lib/arkiv/gardenNote';
import type { UserProfile } from '@/lib/arkiv/profile';
import { GardenLayer } from '@/components/garden/GardenLayer';
import { useSkillProfileCounts } from '@/lib/hooks/useSkillProfileCounts';
import { listLearningFollows } from '@/lib/arkiv/learningFollow';
import { profileToGardenSkills } from '@/lib/garden/types';

function PublicGardenBoardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notes, setNotes] = useState<GardenNote[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [gardenSkills, setGardenSkills] = useState<any[]>([]);
  const [learningSkillIds, setLearningSkillIds] = useState<string[]>([]);
  const arkivBuilderMode = useArkivBuilderMode();
  const skillProfileCounts = useSkillProfileCounts();

  useEffect(() => {
    // Get current user's profile wallet (from localStorage 'wallet_address')
    // This is the wallet address used as the 'wallet' attribute on entities (profiles, asks, offers)
    // The global Arkiv signing wallet (from ARKIV_PRIVATE_KEY) signs transactions, but entities are tied to this profile wallet
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (address) {
        setUserWallet(address);
        getProfileByWallet(address)
          .then((profile) => {
            setUserProfile(profile);
            if (profile) {
              const skills = profileToGardenSkills(profile.skillsArray, profile.skillExpertise);
              setGardenSkills(skills);
            }
          })
          .catch(() => null);

        // Check if user has profile for this profile wallet - if not, redirect to onboarding
        import('@/lib/onboarding/state').then(({ calculateOnboardingLevel }) => {
          calculateOnboardingLevel(address)
            .then((level) => {
              if (level === 0) {
                // No profile for this profile wallet - redirect to onboarding
                router.push('/onboarding');
              }
            })
            .catch(() => {
              // On error, allow access (don't block on calculation failure)
            });
        });
      }
    }
  }, [router]);

  useEffect(() => {
    loadNotes();
  }, []);

  // Load learning follows for glow
  useEffect(() => {
    if (userWallet) {
      listLearningFollows({ profile_wallet: userWallet, active: true })
        .then((follows) => {
          setLearningSkillIds(follows.map((f) => f.skill_id));
        })
        .catch(() => {
          // Learning follows not found - that's okay
        });
    }
  }, [userWallet]);

  // Open modal if create=true in URL (from FAB)
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowComposeModal(true);
      // Remove query param from URL
      router.replace('/garden/public-board');
    }
  }, [searchParams, router]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      setError('');

      const gardenNotesParams = '?channel=public_garden_board';
      const res = await fetch(
        `/api/garden-notes${appendBuilderModeParams(arkivBuilderMode, gardenNotesParams)}`
      );
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to load garden notes');
      }

      setNotes(data.notes || []);

      // Load profiles for all note authors
      const uniqueWallets = new Set<string>();
      data.notes?.forEach((note: GardenNote) => {
        uniqueWallets.add(note.authorWallet);
        if (note.targetWallet) {
          uniqueWallets.add(note.targetWallet);
        }
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
      setError(err.message || 'Failed to load garden notes');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="relative min-h-screen">
      {/* Background art - no gradients, just the base background */}
      <BackgroundImage />

      {/* Garden Layer - persistent garden showing user's skills */}
      {gardenSkills.length > 0 && (
        <GardenLayer
          skills={gardenSkills}
          skillProfileCounts={skillProfileCounts}
          learningSkillIds={learningSkillIds}
        />
      )}

      <div className="container relative z-10 mx-auto max-w-4xl px-4 py-8">
        <BackButton />
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
              Public Garden Board
            </h1>
            <div className="group relative">
              <span className="cursor-help text-sm text-gray-500 dark:text-gray-400">🔗</span>
              <div className="absolute bottom-full left-0 z-50 mb-2 hidden w-48 rounded-lg bg-gray-900 p-2 text-xs text-white shadow-lg group-hover:block dark:bg-gray-800">
                On-chain feature · stored as Arkiv entities
                <div className="absolute left-4 top-full h-0 w-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Shared messages from this mentorship forest.
          </p>
        </div>

        {/* Lantern-style Educational Banner - Gradient only behind this object */}
        <div
          className="relative mb-6 overflow-hidden rounded-2xl border-2 border-green-400/30 p-5 backdrop-blur-sm dark:border-green-500/40"
          style={{
            background:
              'linear-gradient(to bottom, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.08))',
            boxShadow: '0 0 20px rgba(34, 197, 94, 0.15), inset 0 0 20px rgba(34, 197, 94, 0.05)',
          }}
        >
          <div className="relative z-10 flex items-start gap-3">
            <span className="animate-pulse text-2xl">🌱</span>
            <div className="flex-1">
              <p className="mb-1 text-sm font-medium text-green-900 dark:text-green-200">
                Public garden notes
              </p>
              <p className="text-xs leading-relaxed text-green-800 dark:text-green-300">
                These are public on-chain messages. They're stored as Arkiv entities, not just in
                this app. Anyone can read them, and they're hard to fully delete. Share only what
                you're happy to plant in public.
              </p>
            </div>
          </div>
        </div>

        {/* Compose Button - Always "Plant a Note", always visible when user is logged in */}
        {userWallet && (
          <div className="mb-6">
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `Opens GardenNoteComposeModal to create garden note`,
                  `POST /api/garden-notes { action: 'createNote', ... }`,
                  `Creates: type='garden_note' entity`,
                  `Attributes: authorWallet='${userWallet?.toLowerCase().slice(0, 8) || '...'}...', channel='public_garden_board', targetWallet (optional)`,
                  `Payload: Full garden note data (message, tags, etc.)`,
                  `TTL: 1 year (31536000 seconds)`,
                ]}
                label="Plant a Note"
              >
                <button
                  onClick={() => setShowComposeModal(true)}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 px-6 py-3 font-medium text-white transition-all duration-300 hover:from-green-500 hover:to-emerald-600"
                  style={{
                    boxShadow: '0 0 20px rgba(34, 197, 94, 0.4), 0 4px 6px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <span>🌿</span>
                  <span>Plant a Note</span>
                </button>
              </ArkivQueryTooltip>
            ) : (
              <button
                onClick={() => setShowComposeModal(true)}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 px-6 py-3 font-medium text-white transition-all duration-300 hover:from-green-500 hover:to-emerald-600"
                style={{
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.4), 0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
              >
                <span>🌿</span>
                <span>Plant a Note</span>
              </button>
            )}
          </div>
        )}

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
                  `loadNotes()`,
                  `Queries:`,
                  `1. GET /api/garden-notes?channel=public_garden_board`,
                  `   → type='garden_note', channel='public_garden_board'`,
                  `2. getProfileByWallet(...) for each unique wallet`,
                  `   → type='user_profile', wallet='...'`,
                  `Returns: GardenNote[] (all public garden notes)`,
                ]}
                label="Loading Garden Notes"
              >
                <LoadingSpinner />
              </ArkivQueryTooltip>
            ) : (
              <LoadingSpinner />
            )}
          </div>
        )}

        {/* Empty State - Sprout Scene (no button here, button is always at top) */}
        {!loading && notes.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="relative mb-6">
              {/* Glow below sprout */}
              <div
                className="absolute inset-0 opacity-30 blur-2xl"
                style={{
                  background: 'radial-gradient(circle, rgba(34, 197, 94, 0.4) 0%, transparent 70%)',
                  transform: 'translateY(20px)',
                }}
              />
              {/* Sprout icon */}
              <div className="relative animate-pulse text-6xl">🌱</div>
            </div>
            <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              No notes in the garden yet
            </h3>
            <p className="mb-6 max-w-md text-sm text-gray-600 dark:text-gray-400">
              Be the first to plant a public note on the garden board.
            </p>
          </div>
        )}

        {/* Notes List */}
        {!loading && notes.length > 0 && (
          <div className="space-y-4">
            {notes.map((note) => {
              const authorProfile = getAuthorProfile(note.authorWallet);
              const targetProfile = getTargetProfile(note.targetWallet);
              const authorName =
                authorProfile?.displayName ||
                authorProfile?.username ||
                note.authorWallet.slice(0, 8) + '...';
              const authorWalletShort =
                note.authorWallet.slice(0, 6) + '...' + note.authorWallet.slice(-4);

              return (
                <div
                  key={note.key}
                  className="relative overflow-hidden rounded-xl border border-gray-200/50 p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-green-300/50 hover:shadow-xl dark:border-gray-700/50 dark:hover:border-green-500/30"
                >
                  {/* Light mode background */}
                  <div
                    className="absolute inset-0 -z-10 dark:hidden"
                    style={{
                      background:
                        'linear-gradient(to bottom, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.98))',
                    }}
                  />
                  {/* Dark mode background */}
                  <div
                    className="absolute inset-0 -z-10 hidden dark:block"
                    style={{
                      background:
                        'linear-gradient(to bottom, rgba(31, 41, 55, 0.95), rgba(17, 24, 39, 0.98))',
                    }}
                  />
                  {/* Gradient only behind this card */}
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
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-green-300/30 bg-gradient-to-br from-green-400/20 to-blue-500/20 dark:border-green-500/20 dark:from-green-400/10 dark:to-blue-500/10">
                          <EmojiIdentitySeed profile={authorProfile} size="lg" showGlow={true} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/profiles/${note.authorWallet}`}
                              className="font-semibold hover:underline"
                            >
                              {authorName}
                            </Link>
                            {targetProfile && (
                              <>
                                <span className="text-gray-400">→</span>
                                <Link
                                  href={`/profiles/${note.targetWallet}`}
                                  className="font-medium text-gray-600 hover:underline dark:text-gray-400"
                                >
                                  {targetProfile.displayName || targetProfile.username || 'User'}
                                </Link>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-600 dark:text-gray-400">
                              {formatTimeAgo(note.createdAt)}
                            </span>
                            {note.key && (
                              <>
                                <span className="text-gray-400 dark:text-gray-500">·</span>
                                <ViewOnArkivLink
                                  entityKey={note.key}
                                  txHash={note.txHash}
                                  label="View on Arkiv"
                                  className="text-xs"
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Message */}
                    <div className="mb-3">
                      <p className="whitespace-pre-wrap font-medium text-gray-900 dark:text-gray-100">
                        {note.message}
                      </p>
                    </div>

                    {/* Tags - Sprout Chips */}
                    {note.tags && note.tags.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {note.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="rounded-full border border-green-200/50 bg-gradient-to-r from-green-100 to-emerald-100 px-3 py-1.5 text-xs font-medium text-green-800 transition-all duration-200 hover:shadow-md hover:shadow-green-200/50 dark:border-green-700/50 dark:from-green-900/40 dark:to-emerald-900/30 dark:text-green-300 dark:hover:shadow-green-900/30"
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
                    <div className="flex items-center justify-between border-t border-gray-300/50 pt-3 text-xs dark:border-gray-600/50">
                      <span className="font-mono text-gray-700 dark:text-gray-300">
                        {authorWalletShort}
                      </span>
                      {note.key && (
                        <ViewOnArkivLink
                          entityKey={note.key}
                          txHash={note.txHash}
                          label="View on Arkiv"
                          className="text-xs"
                        />
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

export default function PublicGardenBoardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
          <div className="mx-auto max-w-6xl">
            <LoadingSpinner text="Loading garden board..." />
          </div>
        </div>
      }
    >
      <PublicGardenBoardContent />
    </Suspense>
  );
}
