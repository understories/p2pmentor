/**
 * Individual profile view page
 *
 * Shows detailed profile information, skills, availability, and user's asks/offers.
 *
 * Based on sprint spec: Show profile, skills, offers, availability
 * Reference: docs/beta_launch_sprint.md line 331-334
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';
import { RequestMeetingModal } from '@/components/RequestMeetingModal';
import { GardenNoteComposeModal } from '@/components/GardenNoteComposeModal';
import { EmojiIdentitySeed } from '@/components/profile/EmojiIdentitySeed';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { useGraphqlForProfile } from '@/lib/graph/featureFlags';
import { fetchProfileDetail } from '@/lib/graph/profileQueries';
import { formatAvailabilityForDisplay, listAvailabilityForWallet } from '@/lib/arkiv/availability';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { listSessionsForWallet } from '@/lib/arkiv/sessions';
import { listFeedbackForWallet } from '@/lib/arkiv/feedback';
import { listAsksForWallet } from '@/lib/arkiv/asks';
import { listOffersForWallet } from '@/lib/arkiv/offers';
import { listLearningFollows } from '@/lib/arkiv/learningFollow';
import { GardenBoard } from '@/components/garden/GardenBoard';
import type { UserProfile } from '@/lib/arkiv/profile';
import type { Ask } from '@/lib/arkiv/asks';
import type { Offer } from '@/lib/arkiv/offers';
import type { Session } from '@/lib/arkiv/sessions';
import type { Feedback } from '@/lib/arkiv/feedback';
import type { Availability } from '@/lib/arkiv/availability';

export default function ProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const walletParam = params.wallet as string;

  // Normalize wallet from URL parameter
  // Decode URL parameter and normalize wallet to lowercase for Arkiv queries
  // Next.js params are already decoded, but we ensure proper normalization
  let wallet = walletParam ? walletParam.trim() : '';
  if (wallet) {
    // Remove any URL encoding artifacts
    try {
      wallet = decodeURIComponent(wallet);
    } catch (e) {
      // If decoding fails, use as-is
    }
    // Normalize to lowercase and trim whitespace
    wallet = wallet.toLowerCase().trim();
  }

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [asks, setAsks] = useState<Ask[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [skillsLearningCount, setSkillsLearningCount] = useState(0);
  const [learnerQuestCompletion, setLearnerQuestCompletion] = useState<{
    percent: number;
    readCount: number;
    totalMaterials: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingMode, setMeetingMode] = useState<'request' | 'peer'>('request');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [showGardenNoteModal, setShowGardenNoteModal] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'view'>('view'); // 'edit' = show edit controls, 'view' = view as others
  const [archivedSessionsExpanded, setArchivedSessionsExpanded] = useState(false);
  const arkivBuilderMode = useArkivBuilderMode();

  useEffect(() => {
    if (wallet) {
      loadProfileData(wallet);
    }
    // Get current user's wallet and profile
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (address) {
        setUserWallet(address);
        getProfileByWallet(address.toLowerCase().trim())
          .then(setUserProfile)
          .catch(() => null);
      }
    }
  }, [walletParam]);

  const loadProfileData = async (walletAddress: string) => {
    try {
      setLoading(true);
      setError('');

      // Normalize wallet address for consistent querying (arkiv-native pattern)
      const normalizedWallet = walletAddress.toLowerCase().trim();

      // Use arkiv-native queries directly (same pattern as dashboard)
      // This ensures we're using the same query logic and getting the same data
      const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

      const [
        profileData,
        asksData,
        offersData,
        sessionsData,
        feedbackData,
        availabilityData,
        learningFollowsData,
      ] = await Promise.all([
        getProfileByWallet(normalizedWallet).catch(() => null),
        listAsksForWallet(normalizedWallet).catch(() => []),
        listOffersForWallet(normalizedWallet).catch(() => []),
        listSessionsForWallet(normalizedWallet).catch(() => []),
        listFeedbackForWallet(normalizedWallet).catch(() => []),
        listAvailabilityForWallet(normalizedWallet).catch(() => []),
        listLearningFollows({ profile_wallet: normalizedWallet, active: true }).catch(() => []),
      ]);

      // Record performance metrics
      const durationMs =
        typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
      const payloadBytes = JSON.stringify({
        profile: profileData,
        asks: asksData,
        offers: offersData,
        sessions: sessionsData,
        feedback: feedbackData,
        availability: availabilityData,
      }).length;

      // Record performance sample (async, don't block)
      import('@/lib/metrics/perf')
        .then(({ recordPerfSample }) => {
          recordPerfSample({
            source: 'arkiv',
            operation: 'loadProfileData',
            route: '/profiles/[wallet]',
            durationMs: Math.round(durationMs),
            payloadBytes,
            httpRequests: 6, // 6 parallel arkiv queries
            createdAt: new Date().toISOString(),
          });
        })
        .catch(() => {
          // Silently fail if metrics module not available
        });

      if (!profileData) {
        setError(`Profile not found for wallet: ${normalizedWallet}`);
      } else {
        setProfile(profileData);
      }

      setAsks(asksData);
      setOffers(offersData);
      setSessions(sessionsData);
      setFeedbacks(feedbackData);
      setSkillsLearningCount(learningFollowsData.length);

      // Set availability - use the most recent one if available
      if (availabilityData.length > 0) {
        setAvailability(availabilityData);
        // Update profile availabilityWindow from availability entity if not already set
        if (!profileData?.availabilityWindow && availabilityData[0].timeBlocks) {
          // Profile will be updated above, but we can enhance it with availability data
        }
      }

      // Load learner quest completion percentage
      loadLearnerQuestCompletion(normalizedWallet);
    } catch (err: any) {
      console.error('Error loading profile data:', err);
      setError(err.message || `Failed to load profile for wallet: ${walletAddress}`);
    } finally {
      setLoading(false);
    }
  };

  const shortenWallet = (wallet: string) => {
    if (!wallet || wallet.length < 10) return wallet;
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatTimeRemaining = (createdAt: string, ttlSeconds: number) => {
    const created = new Date(createdAt).getTime();
    const expires = created + ttlSeconds * 1000;
    const now = Date.now();
    const remaining = expires - now;

    if (remaining <= 0) {
      return 'Expired';
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return '<1m';
    }
  };

  const loadLearnerQuestCompletion = async (walletAddress: string) => {
    try {
      // Fetch all active quests
      const questsRes = await fetch('/api/learner-quests');
      const questsData = await questsRes.json();

      if (!questsData.ok || !questsData.quests || questsData.quests.length === 0) {
        setLearnerQuestCompletion(null);
        return;
      }

      const quests = questsData.quests;

      // Load progress for all quests in parallel (reading_list and meta_learning)
      const progressPromises = quests.map(async (quest: any) => {
        try {
          if (quest.questType === 'meta_learning') {
            // Load meta-learning quest progress
            const res = await fetch(
              `/api/learner-quests/meta-learning/progress?questId=meta_learning&wallet=${walletAddress}`
            );
            const data = await res.json();

            if (data.ok && data.progress) {
              const progress = data.progress;
              const completedSteps = progress.completedSteps || 0;
              const totalSteps = progress.totalSteps || 6;
              // Convert to readCount/totalMaterials format for consistency
              return { readCount: completedSteps, totalMaterials: totalSteps };
            }
            return { readCount: 0, totalMaterials: 6 };
          } else {
            // Reading list quests
            const res = await fetch(
              `/api/learner-quests/progress?questId=${quest.questId}&wallet=${walletAddress}`
            );
            const data = await res.json();

            if (data.ok && data.progress) {
              const readCount = Object.values(data.progress).filter(
                (p: any) => p.status === 'read'
              ).length;
              const totalMaterials = quest.materials?.length || 0;
              return { readCount, totalMaterials };
            }
            return { readCount: 0, totalMaterials: quest.materials?.length || 0 };
          }
        } catch (err) {
          console.error(`Error loading progress for quest ${quest.questId}:`, err);
          return { readCount: 0, totalMaterials: quest.materials?.length || 6 };
        }
      });

      const results = await Promise.all(progressPromises);
      const totalRead = results.reduce((sum, r) => sum + r.readCount, 0);
      const totalMaterials = results.reduce((sum, r) => sum + r.totalMaterials, 0);
      const percent = totalMaterials > 0 ? Math.round((totalRead / totalMaterials) * 100) : 0;

      setLearnerQuestCompletion({ percent, readCount: totalRead, totalMaterials });
    } catch (err) {
      console.error('Error loading learner quest completion:', err);
      setLearnerQuestCompletion(null);
    }
  };

  const isExpired = (createdAt: string, ttlSeconds: number): boolean => {
    const created = new Date(createdAt).getTime();
    const expires = created + ttlSeconds * 1000;
    return Date.now() >= expires;
  };

  const getDisplayStatus = (status: string, createdAt: string, ttlSeconds: number): string => {
    return isExpired(createdAt, ttlSeconds) ? 'closed' : status;
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <BackButton href="/profiles" />
          </div>
          {arkivBuilderMode ? (
            <ArkivQueryTooltip
              query={[
                `loadProfileData("${wallet?.toLowerCase().slice(0, 8) || '...'}...")`,
                `Queries:`,
                `1. getProfileByWallet("${wallet?.toLowerCase().slice(0, 8) || '...'}...")`,
                `   → type='user_profile', wallet='${wallet?.toLowerCase().slice(0, 8) || '...'}...'`,
                `2. listAsksForWallet("${wallet?.toLowerCase().slice(0, 8) || '...'}...")`,
                `   → type='ask', wallet='${wallet?.toLowerCase().slice(0, 8) || '...'}...'`,
                `3. listOffersForWallet("${wallet?.toLowerCase().slice(0, 8) || '...'}...")`,
                `   → type='offer', wallet='${wallet?.toLowerCase().slice(0, 8) || '...'}...'`,
                `4. listSessionsForWallet("${wallet?.toLowerCase().slice(0, 8) || '...'}...")`,
                `   → type='session', mentorWallet OR learnerWallet='${wallet?.toLowerCase().slice(0, 8) || '...'}...'`,
                `5. listFeedbackForWallet("${wallet?.toLowerCase().slice(0, 8) || '...'}...")`,
                `   → type='feedback', wallet='${wallet?.toLowerCase().slice(0, 8) || '...'}...'`,
                `6. listAvailabilityForWallet("${wallet?.toLowerCase().slice(0, 8) || '...'}...")`,
                `   → type='availability', wallet='${wallet?.toLowerCase().slice(0, 8) || '...'}...'`,
                `7. listLearningFollows({ profile_wallet: "${wallet?.toLowerCase().slice(0, 8) || '...'}...", active: true })`,
                `   → type='learning_follow', profile_wallet='${wallet?.toLowerCase().slice(0, 8) || '...'}...', active=true`,
                `Returns: Profile data with asks, offers, sessions, feedback, availability, and learning follows`,
              ]}
              label="Loading Profile"
            >
              <div className="py-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">Loading profile...</p>
              </div>
            </ArkivQueryTooltip>
          ) : (
            <div className="py-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">Loading profile...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <BackButton href="/profiles" />
          </div>
          <div className="py-12 text-center">
            <p className="text-red-600 dark:text-red-400">{error || 'Profile not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <BackButton href="/profiles" />
        </div>

        {/* Profile Avatar with EIS - Matching Dashboard Format */}
        <div className="mb-6 flex flex-col items-center">
          <div className="relative mb-3">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-emerald-300 bg-white shadow-lg dark:border-emerald-600 dark:bg-gray-800">
              <EmojiIdentitySeed
                profile={profile}
                size="xl"
                showGlow={true}
                className="drop-shadow-[0_0_12px_rgba(34,197,94,0.6)]"
              />
            </div>
            {/* Subtle glow ring */}
            <div
              className="pointer-events-none absolute inset-0 rounded-full opacity-30"
              style={{
                boxShadow: '0 0 20px rgba(34, 197, 94, 0.4), inset 0 0 20px rgba(34, 197, 94, 0.1)',
              }}
            />
          </div>
          <h1 className="mb-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {profile.displayName || 'Anonymous'}
          </h1>
          <p className="mb-2 break-all font-mono text-xs text-gray-500 dark:text-gray-400">
            {wallet}
          </p>
          {profile.username && (
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">@{profile.username}</p>
          )}
          {/* Arkiv Builder Mode: Profile Entity Link */}
          {arkivBuilderMode && profile?.key && (
            <div className="mt-2">
              <ViewOnArkivLink
                entityKey={profile.key}
                txHash={profile.txHash}
                label="View Profile Entity"
                className="text-xs"
              />
              {profile.key && (
                <div className="mt-1 font-mono text-xs text-gray-400 dark:text-gray-500">
                  Key: {profile.key.slice(0, 16)}...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons - only show if viewing someone else's profile and profile is loaded */}
        {userWallet &&
          profile &&
          userWallet.toLowerCase().trim() !== wallet.toLowerCase().trim() && (
            <div className="mb-6 flex justify-center gap-2">
              {/* General "Request Meeting" button - hidden for now, preserved for future implementation */}
              {false && arkivBuilderMode ? (
                <ArkivQueryTooltip
                  query={[
                    `Opens RequestMeetingModal to create session`,
                    `POST /api/sessions { action: 'createSession', ... }`,
                    `Creates: type='session' entity`,
                    `Attributes: mentorWallet='${wallet.toLowerCase().slice(0, 8)}...', learnerWallet='${userWallet?.toLowerCase().slice(0, 8) || '...'}...', skill`,
                    `Payload: Full session data`,
                    `TTL: sessionDate + duration + 1 hour buffer`,
                  ]}
                  label="Request Meeting"
                >
                  <button
                    onClick={() => {
                      setSelectedOffer(null);
                      setMeetingMode('request');
                      // Use setTimeout to ensure state is updated before opening modal
                      setTimeout(() => setShowMeetingModal(true), 0);
                    }}
                    className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    Request Meeting
                  </button>
                </ArkivQueryTooltip>
              ) : (
                false && (
                  <button
                    onClick={() => {
                      setSelectedOffer(null);
                      setMeetingMode('request');
                      // Use setTimeout to ensure state is updated before opening modal
                      setTimeout(() => setShowMeetingModal(true), 0);
                    }}
                    className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    Request Meeting
                  </button>
                )
              )}
              {arkivBuilderMode ? (
                <ArkivQueryTooltip
                  query={[
                    `Opens RequestMeetingModal for peer learning session`,
                    `POST /api/sessions { action: 'createSession', ... }`,
                    `Creates: type='session' entity`,
                    `Attributes: mentorWallet='${wallet.toLowerCase().slice(0, 8)}...', learnerWallet='${userWallet?.toLowerCase().slice(0, 8) || '...'}...', skill`,
                    `Mode: 'peer' (both users are learners)`,
                    `Payload: Full session data`,
                    `TTL: sessionDate + duration + 1 hour buffer`,
                  ]}
                  label="Peer Learning"
                >
                  <button
                    onClick={() => {
                      setSelectedOffer(null);
                      setShowMeetingModal(true);
                      setMeetingMode('peer');
                    }}
                    className="rounded-lg bg-gray-600 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-700"
                  >
                    Peer Learning
                  </button>
                </ArkivQueryTooltip>
              ) : (
                <button
                  onClick={() => {
                    setSelectedOffer(null);
                    setShowMeetingModal(true);
                    setMeetingMode('peer');
                  }}
                  className="rounded-lg bg-gray-600 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-700"
                >
                  Peer Learning
                </button>
              )}
              {arkivBuilderMode ? (
                <ArkivQueryTooltip
                  query={[
                    `Opens GardenNoteComposeModal to create garden note`,
                    `POST /api/garden-notes { action: 'createNote', ... }`,
                    `Creates: type='garden_note' entity`,
                    `Attributes: authorWallet='${userWallet?.toLowerCase().slice(0, 8) || '...'}...', targetWallet='${wallet.toLowerCase().slice(0, 8)}...', channel='public_garden_board'`,
                    `Payload: Full garden note data (message, tags, etc.)`,
                    `TTL: 1 year (31536000 seconds)`,
                  ]}
                  label="Leave a Note"
                >
                  <button
                    onClick={() => {
                      setShowGardenNoteModal(true);
                    }}
                    className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700"
                  >
                    Leave a Note
                  </button>
                </ArkivQueryTooltip>
              ) : (
                <button
                  onClick={() => {
                    setShowGardenNoteModal(true);
                  }}
                  className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700"
                >
                  Leave a Note
                </button>
              )}
            </div>
          )}

        {/* Bio Display */}
        {profile.bioShort && (
          <div className="mb-6 text-center">
            <p className="text-gray-700 dark:text-gray-300">{profile.bioShort}</p>
          </div>
        )}

        {/* Profile Information Display - Above Stats (matching dashboard) */}
        <div className="mb-8 space-y-3 rounded-lg border border-gray-200 bg-white/80 p-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Profile Information
            </h3>
            {/* Arkiv Builder Mode: Profile Query Tooltip */}
            {arkivBuilderMode && (
              <div className="group/query relative">
                <div className="cursor-help rounded border border-gray-300 bg-gray-50 px-2 py-1 font-mono text-xs text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  Query
                </div>
                <div className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 max-w-md rounded-lg bg-gray-900 px-3 py-2 text-left font-mono text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover/query:opacity-100 dark:bg-gray-800">
                  <div className="mb-1 font-semibold">Profile Query:</div>
                  <div>getProfileByWallet('{wallet.slice(0, 8)}...')</div>
                  <div>Query: type='user_profile',</div>
                  <div>wallet='{wallet.slice(0, 8)}...'</div>
                  <div className="absolute right-4 top-full border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                </div>
              </div>
            )}
          </div>

          {profile.username && (
            <div>
              <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Username</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                @{profile.username}
              </p>
            </div>
          )}

          {profile.bio && (
            <div>
              <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Bio</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{profile.bio}</p>
            </div>
          )}

          {profile.bioLong && (
            <div>
              <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">About</p>
              <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                {profile.bioLong}
              </p>
            </div>
          )}

          {(profile as any).exploringStatement && (
            <div>
              <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Exploring</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {(profile as any).exploringStatement}
              </p>
            </div>
          )}

          {profile.timezone && (
            <div>
              <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Timezone</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{profile.timezone}</p>
            </div>
          )}

          {profile.seniority && (
            <div>
              <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Seniority</p>
              <p className="text-sm font-medium capitalize text-gray-900 dark:text-gray-100">
                {profile.seniority}
              </p>
            </div>
          )}

          {profile.languages && profile.languages.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Languages</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {profile.languages.join(', ')}
              </p>
            </div>
          )}

          {profile.domainsOfInterest && profile.domainsOfInterest.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Domains of Interest</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {profile.domainsOfInterest.join(', ')}
              </p>
            </div>
          )}

          {profile.mentorRoles && profile.mentorRoles.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Mentor Roles</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {profile.mentorRoles.join(', ')}
              </p>
            </div>
          )}

          {profile.learnerRoles && profile.learnerRoles.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Learner Roles</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {profile.learnerRoles.join(', ')}
              </p>
            </div>
          )}

          {profile.communityAffiliations && profile.communityAffiliations.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                Community Affiliations
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {profile.communityAffiliations.join(', ')}
              </p>
            </div>
          )}

          {profile.contactLinks && Object.keys(profile.contactLinks).length > 0 && (
            <div>
              <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Contact Links</p>
              <div className="flex flex-wrap gap-2">
                {profile.contactLinks.twitter && (
                  <a
                    href={
                      profile.contactLinks.twitter.startsWith('http')
                        ? profile.contactLinks.twitter
                        : `https://x.com/${profile.contactLinks.twitter.replace(/^@/, '')}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Twitter
                  </a>
                )}
                {profile.contactLinks.github && (
                  <a
                    href={
                      profile.contactLinks.github.startsWith('http')
                        ? profile.contactLinks.github
                        : `https://github.com/${profile.contactLinks.github.replace(/^@/, '')}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    GitHub
                  </a>
                )}
                {profile.contactLinks.telegram && (
                  <a
                    href={profile.contactLinks.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Telegram
                  </a>
                )}
                {profile.contactLinks.discord && (
                  <a
                    href={profile.contactLinks.discord}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Discord
                  </a>
                )}
              </div>
            </div>
          )}

          {profile.skillsArray && profile.skillsArray.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Skills</p>
              <div className="flex flex-wrap gap-2">
                {profile.skillsArray.map((skill, idx) => {
                  const skillIds = (profile as any).skill_ids || [];
                  const skillId = skillIds[idx];
                  const level =
                    skillId && profile.skillExpertise?.[skillId] !== undefined
                      ? profile.skillExpertise[skillId]
                      : undefined;
                  return (
                    <span
                      key={idx}
                      className="rounded bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-200"
                    >
                      {skill}
                      {level !== undefined && ` (${level}/5)`}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {learnerQuestCompletion && (
            <div>
              <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Learning Quests</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {learnerQuestCompletion.percent}% complete ({learnerQuestCompletion.readCount} /{' '}
                {learnerQuestCompletion.totalMaterials} materials)
              </p>
            </div>
          )}

          <div>
            <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Wallet</p>
            <p className="font-mono text-sm text-gray-700 dark:text-gray-300">
              {shortenWallet(profile.wallet)}
            </p>
          </div>

          {/* Arkiv Builder Mode: Metadata Fields */}
          {arkivBuilderMode && (
            <>
              {profile.npsScore !== undefined && profile.npsScore !== null && (
                <div>
                  <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">NPS Score</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{profile.npsScore}</p>
                </div>
              )}

              {profile.reputationScore !== undefined && profile.reputationScore !== null && (
                <div>
                  <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Reputation Score</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {profile.reputationScore}
                  </p>
                </div>
              )}

              {profile.topSkillsUsage && profile.topSkillsUsage.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Top Skills Usage</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.topSkillsUsage.map((usage, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                      >
                        {usage.skill} ({usage.count})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.peerTestimonials && profile.peerTestimonials.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Peer Testimonials</p>
                  <div className="space-y-2">
                    {profile.peerTestimonials.map((testimonial, idx) => (
                      <div
                        key={idx}
                        className="rounded border border-gray-200 bg-gray-100 p-2 text-xs dark:border-gray-600 dark:bg-gray-700"
                      >
                        <p className="text-gray-700 dark:text-gray-300">{testimonial.text}</p>
                        <p className="mt-1 text-gray-500 dark:text-gray-400">
                          From {shortenWallet(testimonial.fromWallet)} •{' '}
                          {new Date(testimonial.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {profile.trustEdges && profile.trustEdges.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Trust Edges</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.trustEdges.map((edge, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-800 dark:bg-purple-900/30 dark:text-purple-200"
                      >
                        {shortenWallet(edge.toWallet)} (strength: {edge.strength})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.lastActiveTimestamp && (
                <div>
                  <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Last Active</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {new Date(profile.lastActiveTimestamp).toLocaleString()}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Profile Stats - Matching Dashboard Format Exactly */}
        {(() => {
          // Calculate session stats (same logic as dashboard)
          const now = Date.now();
          const completedSessions = sessions.filter((s) => {
            if (s.status === 'completed') return true;
            // Also count past scheduled sessions as completed
            if (s.status === 'scheduled') {
              const sessionTime = new Date(s.sessionDate).getTime();
              const sessionEnd = sessionTime + (s.duration || 60) * 60 * 1000;
              return sessionEnd < now;
            }
            return false;
          }).length;

          const upcomingSessions = sessions.filter((s) => {
            if (s.status !== 'scheduled') return false;
            const sessionTime = new Date(s.sessionDate).getTime();
            return sessionTime > now;
          }).length;

          // Calculate average rating (same logic as dashboard)
          const receivedFeedback = feedbacks.filter(
            (f) => f.feedbackTo.toLowerCase() === wallet.toLowerCase()
          );
          const ratings = receivedFeedback
            .map((f) => f.rating)
            .filter((r): r is number => r !== undefined && r > 0);
          const avgRating =
            ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0;

          return (
            <div className="mb-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Sessions Completed */}
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `listSessionsForWallet('${wallet.toLowerCase()}')`,
                      `Query: type='session', (mentorWallet='${wallet.toLowerCase()}' OR learnerWallet='${wallet.toLowerCase()}')`,
                      `Filtered: status='completed' OR (status='scheduled' AND sessionEnd < now)`,
                      `Returns: ${completedSessions} completed sessions`,
                      `Each session is a type='session' entity on Arkiv`,
                    ]}
                    label="Sessions Completed"
                  >
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-center backdrop-blur-sm dark:border-emerald-700 dark:bg-emerald-900/30">
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {completedSessions}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Sessions Completed</p>
                    </div>
                  </ArkivQueryTooltip>
                ) : (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-center backdrop-blur-sm dark:border-emerald-700 dark:bg-emerald-900/30">
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {completedSessions}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Sessions Completed</p>
                  </div>
                )}

                {/* Upcoming Sessions */}
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `listSessionsForWallet('${wallet.toLowerCase()}')`,
                      `Query: type='session', (mentorWallet='${wallet.toLowerCase()}' OR learnerWallet='${wallet.toLowerCase()}')`,
                      `Filtered: status='scheduled' AND sessionDate > now`,
                      `Returns: ${upcomingSessions} upcoming sessions`,
                      `Each session is a type='session' entity on Arkiv`,
                    ]}
                    label="Upcoming Sessions"
                  >
                    <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-center backdrop-blur-sm dark:border-blue-700 dark:bg-blue-900/30">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {upcomingSessions}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Upcoming Sessions</p>
                    </div>
                  </ArkivQueryTooltip>
                ) : (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-center backdrop-blur-sm dark:border-blue-700 dark:bg-blue-900/30">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {upcomingSessions}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Upcoming Sessions</p>
                  </div>
                )}

                {/* Asks */}
                {(() => {
                  // Filter out expired asks (same logic as /me page)
                  const now = Date.now();
                  const activeAsks = asks.filter((ask) => {
                    if (ask.status !== 'open') return false;
                    if (ask.createdAt && ask.ttlSeconds) {
                      const createdAt = new Date(ask.createdAt).getTime();
                      const expiresAt = createdAt + ask.ttlSeconds * 1000;
                      return expiresAt > now;
                    }
                    return true;
                  });
                  const asksCount = activeAsks.length;

                  return arkivBuilderMode ? (
                    <ArkivQueryTooltip
                      query={[
                        `listAsksForWallet('${wallet.toLowerCase()}')`,
                        `Query: type='ask', wallet='${wallet.slice(0, 8)}...', status='open'`,
                        `Filtered: active (not expired)`,
                        `Returns: ${asksCount} active asks`,
                        `Each ask is a type='ask' entity on Arkiv`,
                      ]}
                      label="Asks"
                    >
                      <div className="rounded-lg border border-purple-200 bg-purple-50/80 p-3 text-center backdrop-blur-sm dark:border-purple-700 dark:bg-purple-900/30">
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          🎓 {asksCount}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Asks</p>
                      </div>
                    </ArkivQueryTooltip>
                  ) : (
                    <div className="rounded-lg border border-purple-200 bg-purple-50/80 p-3 text-center backdrop-blur-sm dark:border-purple-700 dark:bg-purple-900/30">
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        🎓 {asksCount}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Asks</p>
                    </div>
                  );
                })()}

                {/* Offers */}
                {(() => {
                  // Filter out expired offers (same logic as /me page)
                  const now = Date.now();
                  const activeOffers = offers.filter((offer) => {
                    if (offer.status !== 'active') return false;
                    if (offer.createdAt && offer.ttlSeconds) {
                      const createdAt = new Date(offer.createdAt).getTime();
                      const expiresAt = createdAt + offer.ttlSeconds * 1000;
                      return expiresAt > now;
                    }
                    return true;
                  });
                  const offersCount = activeOffers.length;

                  return arkivBuilderMode ? (
                    <ArkivQueryTooltip
                      query={[
                        `listOffersForWallet('${wallet.toLowerCase()}')`,
                        `Query: type='offer', wallet='${wallet.slice(0, 8)}...', status='active'`,
                        `Filtered: active (not expired)`,
                        `Returns: ${offersCount} active offers`,
                        `Each offer is a type='offer' entity on Arkiv`,
                      ]}
                      label="Offers"
                    >
                      <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-center backdrop-blur-sm dark:border-amber-700 dark:bg-amber-900/30">
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                          💎 {offersCount}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Offers</p>
                      </div>
                    </ArkivQueryTooltip>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-center backdrop-blur-sm dark:border-amber-700 dark:bg-amber-900/30">
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        💎 {offersCount}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Offers</p>
                    </div>
                  );
                })()}

                {/* Average Rating */}
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `listFeedbackForWallet('${wallet.toLowerCase()}')`,
                      `Query: type='session_feedback', (feedbackFrom='${wallet.toLowerCase()}' OR feedbackTo='${wallet.toLowerCase()}')`,
                      `Filtered: feedbackTo='${wallet.toLowerCase()}' (received feedback)`,
                      `Calculated: average of ${ratings.length} ratings`,
                      `Returns: ${avgRating.toFixed(1)} average rating`,
                      `Each feedback is a type='session_feedback' entity on Arkiv`,
                    ]}
                    label="Average Rating"
                  >
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50/80 p-3 text-center backdrop-blur-sm dark:border-yellow-700 dark:bg-yellow-900/30">
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {avgRating.toFixed(1)} ⭐
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Average Rating</p>
                    </div>
                  </ArkivQueryTooltip>
                ) : (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50/80 p-3 text-center backdrop-blur-sm dark:border-yellow-700 dark:bg-yellow-900/30">
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {avgRating.toFixed(1)} ⭐
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Average Rating</p>
                  </div>
                )}

                {/* Skills Learning */}
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `listLearningFollows({ profile_wallet: '${wallet.toLowerCase()}', active: true })`,
                      `Query: type='learning_follow', profile_wallet='${wallet.toLowerCase()}'`,
                      `Filters out: active=false (soft-delete pattern)`,
                      `Returns: ${skillsLearningCount} active learning follows`,
                      `Each follow is a type='learning_follow' entity on Arkiv`,
                    ]}
                    label="Skills Learning"
                  >
                    <div className="rounded-lg border border-purple-200 bg-purple-50/80 p-3 text-center backdrop-blur-sm dark:border-purple-700 dark:bg-purple-900/30">
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {skillsLearningCount}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Skills Learning</p>
                    </div>
                  </ArkivQueryTooltip>
                ) : (
                  <div className="rounded-lg border border-purple-200 bg-purple-50/80 p-3 text-center backdrop-blur-sm dark:border-purple-700 dark:bg-purple-900/30">
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {skillsLearningCount}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Skills Learning</p>
                  </div>
                )}
              </div>

              {/* Learner Quest Completion */}
              {learnerQuestCompletion && (
                <div className="mt-4">
                  {arkivBuilderMode ? (
                    <ArkivQueryTooltip
                      query={[
                        `GET /api/learner-quests`,
                        `GET /api/learner-quests/progress?questId=...&wallet=${wallet.toLowerCase()}`,
                        `Query: type='learner_quest_progress', wallet='${wallet.toLowerCase()}', status='read'`,
                        `Calculated across all reading_list quests`,
                        `Returns: ${learnerQuestCompletion.percent}% complete (${learnerQuestCompletion.readCount} / ${learnerQuestCompletion.totalMaterials} materials)`,
                      ]}
                      label="Learning Quests"
                    >
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-center backdrop-blur-sm dark:border-emerald-700 dark:bg-emerald-900/30">
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {learnerQuestCompletion.percent}%
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Learning Quests</p>
                        <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-500">
                          {learnerQuestCompletion.readCount} /{' '}
                          {learnerQuestCompletion.totalMaterials} materials
                        </p>
                      </div>
                    </ArkivQueryTooltip>
                  ) : (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-center backdrop-blur-sm dark:border-emerald-700 dark:bg-emerald-900/30">
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {learnerQuestCompletion.percent}%
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Learning Quests</p>
                      <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-500">
                        {learnerQuestCompletion.readCount} / {learnerQuestCompletion.totalMaterials}{' '}
                        materials
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Availability */}
        {(() => {
          // Use availability entity if available, otherwise fall back to profile.availabilityWindow
          const availabilityDisplay =
            availability.length > 0 ? availability[0].timeBlocks : profile.availabilityWindow;

          if (!availabilityDisplay) return null;

          return (
            <div className="mb-8 rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/20">
              {arkivBuilderMode ? (
                <ArkivQueryTooltip
                  query={[
                    `listAvailabilityForWallet('${wallet.toLowerCase()}')`,
                    `Query: type='availability', wallet='${wallet.toLowerCase()}'`,
                    `Filters out: availability_deletion markers`,
                    `Returns: Availability[] (${availability.length} availability entities)`,
                    `Each availability is a type='availability' entity on Arkiv`,
                  ]}
                  label="Availability"
                >
                  <h2 className="mb-3 text-2xl font-semibold">Availability</h2>
                </ArkivQueryTooltip>
              ) : (
                <h2 className="mb-3 text-2xl font-semibold">Availability</h2>
              )}
              <p className="text-gray-700 dark:text-gray-300">
                {formatAvailabilityForDisplay(availabilityDisplay, profile.timezone)}
              </p>
            </div>
          );
        })()}

        {/* Offers (Teaching) */}
        {offers.length > 0 && (
          <div className="mb-8">
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `listOffersForWallet('${wallet.toLowerCase()}')`,
                  `Query: type='offer', wallet='${wallet.toLowerCase()}'`,
                  `Returns: Offer[] (${offers.length} offers)`,
                  `Each offer is a type='offer' entity on Arkiv`,
                ]}
                label={`Teaching Offers (${offers.length})`}
              >
                <h2 className="mb-4 text-2xl font-semibold">Teaching Offers ({offers.length})</h2>
              </ArkivQueryTooltip>
            ) : (
              <h2 className="mb-4 text-2xl font-semibold">Teaching Offers ({offers.length})</h2>
            )}
            <div className="space-y-4">
              {offers.map((offer) => (
                <div
                  key={offer.key}
                  className="rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/20"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {offer.skill}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(offer.createdAt)}
                      </p>
                    </div>
                    <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-200">
                      {getDisplayStatus(offer.status, offer.createdAt, offer.ttlSeconds)}
                    </span>
                  </div>
                  <p className="mb-3 text-gray-700 dark:text-gray-300">{offer.message}</p>
                  {offer.availabilityWindow && (
                    <div className="mb-3 rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                      <p className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                        Availability:
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {formatAvailabilityForDisplay(offer.availabilityWindow)}
                      </p>
                    </div>
                  )}
                  {offer.isPaid && (
                    <div className="mb-3 rounded border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-900/20">
                      <p className="mb-1 text-sm font-medium text-purple-900 dark:text-purple-200">
                        Payment:
                      </p>
                      <p className="text-sm text-purple-800 dark:text-purple-300">
                        <span className="font-medium text-green-600 dark:text-green-400">
                          💰 Requires payment
                        </span>
                        {offer.cost && (
                          <span className="ml-2 text-purple-700 dark:text-purple-300">
                            ({offer.cost})
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>
                        ⏰{' '}
                        {(() => {
                          const timeRemaining = formatTimeRemaining(
                            offer.createdAt,
                            offer.ttlSeconds
                          );
                          return timeRemaining === 'Expired'
                            ? timeRemaining
                            : `${timeRemaining} left`;
                        })()}
                      </span>
                      {arkivBuilderMode && offer.key && (
                        <div className="flex items-center gap-2">
                          <ViewOnArkivLink
                            txHash={offer.txHash}
                            entityKey={offer.key}
                            className="text-xs"
                          />
                          <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                            {offer.key.slice(0, 12)}...
                          </span>
                        </div>
                      )}
                      {!arkivBuilderMode && (
                        <ViewOnArkivLink txHash={offer.txHash} entityKey={offer.key} />
                      )}
                    </div>
                    {/* Request Meeting Button for this specific offer */}
                    {userWallet &&
                      userWallet.toLowerCase() !== wallet.toLowerCase() &&
                      (arkivBuilderMode ? (
                        <ArkivQueryTooltip
                          query={[
                            `Opens RequestMeetingModal to create session`,
                            `POST /api/sessions { action: 'createSession', ... }`,
                            `Creates: type='session' entity`,
                            `Attributes: mentorWallet='${wallet.toLowerCase().slice(0, 8)}...', learnerWallet='${userWallet.toLowerCase().slice(0, 8)}...', skill='${offer.skill}'`,
                            `Payload: Full session data`,
                            `TTL: sessionDate + duration + 1 hour buffer`,
                          ]}
                          label="Request Meeting"
                        >
                          <button
                            onClick={async () => {
                              // Load profile for the offer's wallet
                              const offerProfile = await getProfileByWallet(offer.wallet).catch(
                                () => null
                              );
                              if (offerProfile) {
                                setSelectedOffer(offer);
                                setMeetingMode('request');
                                // Use setTimeout to ensure state is updated before opening modal
                                setTimeout(() => setShowMeetingModal(true), 0);
                              } else {
                                setError('Could not load profile for this offer');
                              }
                            }}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
                          >
                            Request Meeting
                          </button>
                        </ArkivQueryTooltip>
                      ) : (
                        <button
                          onClick={async () => {
                            // Load profile for the offer's wallet
                            const offerProfile = await getProfileByWallet(offer.wallet).catch(
                              () => null
                            );
                            if (offerProfile) {
                              setSelectedOffer(offer);
                              setMeetingMode('request');
                              // Use setTimeout to ensure state is updated before opening modal
                              setTimeout(() => setShowMeetingModal(true), 0);
                            } else {
                              setError('Could not load profile for this offer');
                            }
                          }}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
                        >
                          Request Meeting
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Asks (Learning) */}
        {asks.length > 0 && (
          <div className="mb-8">
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `listAsksForWallet('${wallet.toLowerCase()}')`,
                  `Query: type='ask', wallet='${wallet.toLowerCase()}'`,
                  `Returns: Ask[] (${asks.length} asks)`,
                  `Each ask is a type='ask' entity on Arkiv`,
                ]}
                label={`Learning Requests (${asks.length})`}
              >
                <h2 className="mb-4 text-2xl font-semibold">Learning Requests ({asks.length})</h2>
              </ArkivQueryTooltip>
            ) : (
              <h2 className="mb-4 text-2xl font-semibold">Learning Requests ({asks.length})</h2>
            )}
            <div className="space-y-4">
              {asks.map((ask) => (
                <div
                  key={ask.key}
                  className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                        {ask.skill}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(ask.createdAt)}
                      </p>
                    </div>
                    <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-200">
                      {getDisplayStatus(ask.status, ask.createdAt, ask.ttlSeconds)}
                    </span>
                  </div>
                  <p className="mb-3 text-gray-700 dark:text-gray-300">{ask.message}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>
                      ⏰{' '}
                      {(() => {
                        const timeRemaining = formatTimeRemaining(ask.createdAt, ask.ttlSeconds);
                        return timeRemaining === 'Expired'
                          ? timeRemaining
                          : `${timeRemaining} left`;
                      })()}
                    </span>
                    {arkivBuilderMode && ask.key && (
                      <div className="flex items-center gap-2">
                        <ViewOnArkivLink
                          entityKey={ask.key}
                          txHash={ask.txHash}
                          className="text-xs"
                        />
                        <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                          {ask.key.slice(0, 12)}...
                        </span>
                      </div>
                    )}
                    {!arkivBuilderMode && <ViewOnArkivLink entityKey={ask.key} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State for Asks/Offers */}
        {asks.length === 0 && offers.length === 0 && (
          <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-gray-500 dark:text-gray-400">No asks or offers yet.</p>
          </div>
        )}

        {/* Session History */}
        {(() => {
          // Helper to identify reconstructed/archived sessions
          const isReconstructedSession = (session: Session): boolean => {
            return (
              session.skill === 'Session (expired)' ||
              session.notes === 'Session expired - reconstructed from feedback'
            );
          };

          const completedSessions = sessions.filter((s) => s.status === 'completed');
          const scheduledSessions = sessions.filter((s) => s.status === 'scheduled');
          const allHistorySessions = [...completedSessions, ...scheduledSessions].sort(
            (a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()
          );

          // Separate archived (reconstructed) sessions from regular sessions
          const regularSessions = allHistorySessions.filter((s) => !isReconstructedSession(s));
          const archivedSessions = allHistorySessions.filter((s) => isReconstructedSession(s));

          // Calculate stats
          const sessionsCompleted = completedSessions.length;
          const sessionsGiven = sessions.filter(
            (s) => s.mentorWallet.toLowerCase() === wallet.toLowerCase()
          ).length;
          const sessionsReceived = sessions.filter(
            (s) => s.learnerWallet.toLowerCase() === wallet.toLowerCase()
          ).length;

          if (
            regularSessions.length === 0 &&
            archivedSessions.length === 0 &&
            sessionsCompleted === 0 &&
            sessionsGiven === 0 &&
            sessionsReceived === 0
          ) {
            return null; // Don't show section if no sessions
          }

          // Helper to render a session card
          const renderSessionCard = (session: Session) => {
            const isMentor = session.mentorWallet.toLowerCase() === wallet.toLowerCase();
            const otherWallet = isMentor ? session.learnerWallet : session.mentorWallet;
            const sessionDate = new Date(session.sessionDate);
            const isPast = sessionDate < new Date();
            const isReconstructed = isReconstructedSession(session);

            return (
              <div
                key={session.key}
                className={`rounded-lg border p-6 ${
                  session.status === 'completed'
                    ? 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                    : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                } ${isReconstructed ? 'opacity-75' : ''}`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{session.skill}</h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {isMentor ? '👨‍🏫 As Mentor' : '👨‍🎓 As Learner'} with{' '}
                      {shortenWallet(otherWallet)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isReconstructed && (
                      <span className="rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                        Archived
                      </span>
                    )}
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        session.status === 'completed'
                          ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                      }`}
                    >
                      {session.status === 'completed' ? '✓ Completed' : '📅 Scheduled'}
                    </span>
                    {arkivBuilderMode && session.key && (
                      <ViewOnArkivLink
                        entityKey={session.key}
                        txHash={session.txHash}
                        className="text-xs"
                      />
                    )}
                    {!arkivBuilderMode && session.key && (
                      <ViewOnArkivLink entityKey={session.key} txHash={session.txHash} />
                    )}
                  </div>
                </div>
                <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
                  <strong>Date:</strong>{' '}
                  {sessionDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
                  <strong>Time:</strong>{' '}
                  {sessionDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </p>
                {session.duration && (
                  <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
                    <strong>Duration:</strong> {session.duration} minutes
                  </p>
                )}
                {session.notes && (
                  <div className="mt-3 rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                    <p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                      Notes:
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{session.notes}</p>
                  </div>
                )}
                {arkivBuilderMode && session.key && (
                  <div className="mt-3 flex items-center gap-2">
                    <ViewOnArkivLink
                      entityKey={session.key}
                      txHash={session.txHash}
                      label="View Session Entity"
                      className="text-xs"
                    />
                    <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                      {session.key.slice(0, 12)}...
                    </span>
                  </div>
                )}
              </div>
            );
          };

          return (
            <div className="mb-8">
              {arkivBuilderMode ? (
                <ArkivQueryTooltip
                  query={[
                    `listSessionsForWallet('${wallet.toLowerCase()}')`,
                    `Query: type='session', (mentorWallet='${wallet.toLowerCase()}' OR learnerWallet='${wallet.toLowerCase()}')`,
                    `Returns: Session[] (${sessions.length} sessions)`,
                    `Each session is a type='session' entity on Arkiv`,
                  ]}
                  label="Session History"
                >
                  <h2 className="mb-4 text-2xl font-semibold">Session History</h2>
                </ArkivQueryTooltip>
              ) : (
                <h2 className="mb-4 text-2xl font-semibold">Session History</h2>
              )}

              {/* Stats */}
              {(sessionsCompleted > 0 || sessionsGiven > 0 || sessionsReceived > 0) && (
                <div className="mb-6 grid grid-cols-3 gap-4">
                  {arkivBuilderMode ? (
                    <ArkivQueryTooltip
                      query={[
                        `listSessionsForWallet('${wallet.toLowerCase()}')`,
                        `Query: type='session', (mentorWallet='${wallet.toLowerCase()}' OR learnerWallet='${wallet.toLowerCase()}')`,
                        `Filtered: status='completed'`,
                        `Returns: ${sessionsCompleted} completed sessions`,
                      ]}
                      label="Completed Sessions"
                    >
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-800 dark:bg-blue-900/20">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {sessionsCompleted}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                      </div>
                    </ArkivQueryTooltip>
                  ) : (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-800 dark:bg-blue-900/20">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {sessionsCompleted}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                    </div>
                  )}
                  {arkivBuilderMode ? (
                    <ArkivQueryTooltip
                      query={[
                        `listSessionsForWallet('${wallet.toLowerCase()}')`,
                        `Query: type='session', mentorWallet='${wallet.toLowerCase()}'`,
                        `Returns: ${sessionsGiven} sessions given as mentor`,
                      ]}
                      label="Sessions Given"
                    >
                      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/20">
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {sessionsGiven}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Given (as Mentor)
                        </p>
                      </div>
                    </ArkivQueryTooltip>
                  ) : (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/20">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {sessionsGiven}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Given (as Mentor)</p>
                    </div>
                  )}
                  {arkivBuilderMode ? (
                    <ArkivQueryTooltip
                      query={[
                        `listSessionsForWallet('${wallet.toLowerCase()}')`,
                        `Query: type='session', learnerWallet='${wallet.toLowerCase()}'`,
                        `Returns: ${sessionsReceived} sessions received as learner`,
                      ]}
                      label="Sessions Received"
                    >
                      <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-center dark:border-purple-800 dark:bg-purple-900/20">
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {sessionsReceived}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Received (as Learner)
                        </p>
                      </div>
                    </ArkivQueryTooltip>
                  ) : (
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-center dark:border-purple-800 dark:bg-purple-900/20">
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {sessionsReceived}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Received (as Learner)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Regular Session List */}
              {regularSessions.length > 0 && (
                <div className="mb-6 space-y-4">{regularSessions.map(renderSessionCard)}</div>
              )}

              {/* Archived Sessions (Reconstructed) - Collapsed by default */}
              {archivedSessions.length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => setArchivedSessionsExpanded(!archivedSessionsExpanded)}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-gray-50 p-3 text-left transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
                  >
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Archived Sessions ({archivedSessions.length})
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {archivedSessionsExpanded ? '▼' : '▶'}
                    </span>
                  </button>
                  {archivedSessionsExpanded && (
                    <div className="mt-3 space-y-4">
                      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                        These sessions were reconstructed from feedback after the original session
                        entities expired. Some details may be incomplete.
                      </p>
                      {archivedSessions.map(renderSessionCard)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Feedback Section */}
        {(() => {
          // Filter feedback received (feedbackTo matches wallet)
          const receivedFeedback = feedbacks.filter(
            (f) => f.feedbackTo.toLowerCase() === wallet.toLowerCase()
          );

          if (receivedFeedback.length === 0) {
            return null;
          }

          // Calculate average rating
          const ratings = receivedFeedback
            .map((f) => f.rating)
            .filter((r): r is number => r !== undefined && r > 0);
          const avgRating =
            ratings.length > 0
              ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)
              : null;

          return (
            <div className="mb-8">
              {arkivBuilderMode ? (
                <ArkivQueryTooltip
                  query={[
                    `listFeedbackForWallet('${wallet.toLowerCase()}')`,
                    `Query: type='session_feedback', (feedbackFrom='${wallet.toLowerCase()}' OR feedbackTo='${wallet.toLowerCase()}')`,
                    `Filtered: feedbackTo='${wallet.toLowerCase()}' (received feedback)`,
                    `Returns: Feedback[] (${receivedFeedback.length} feedbacks)`,
                    `Each feedback is a type='session_feedback' entity on Arkiv`,
                  ]}
                  label="Feedback & Ratings"
                >
                  <h2 className="mb-4 text-2xl font-semibold">Feedback & Ratings</h2>
                </ArkivQueryTooltip>
              ) : (
                <h2 className="mb-4 text-2xl font-semibold">Feedback & Ratings</h2>
              )}

              {/* Stats */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `listFeedbackForWallet('${wallet.toLowerCase()}')`,
                      `Query: type='session_feedback', (feedbackFrom='${wallet.toLowerCase()}' OR feedbackTo='${wallet.toLowerCase()}')`,
                      `Filtered: feedbackTo='${wallet.toLowerCase()}' (received feedback)`,
                      `Returns: ${receivedFeedback.length} feedback entities`,
                    ]}
                    label="Total Reviews"
                  >
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center dark:border-yellow-800 dark:bg-yellow-900/20">
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {receivedFeedback.length}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Reviews</p>
                    </div>
                  </ArkivQueryTooltip>
                ) : (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center dark:border-yellow-800 dark:bg-yellow-900/20">
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {receivedFeedback.length}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Reviews</p>
                  </div>
                )}
                {avgRating &&
                  (arkivBuilderMode ? (
                    <ArkivQueryTooltip
                      query={[
                        `listFeedbackForWallet('${wallet.toLowerCase()}')`,
                        `Query: type='session_feedback', (feedbackFrom='${wallet.toLowerCase()}' OR feedbackTo='${wallet.toLowerCase()}')`,
                        `Filtered: feedbackTo='${wallet.toLowerCase()}' (received feedback)`,
                        `Calculated: average of ${ratings.length} ratings`,
                        `Returns: ${avgRating} average rating`,
                      ]}
                      label="Average Rating"
                    >
                      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center dark:border-yellow-800 dark:bg-yellow-900/20">
                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                          {avgRating} ⭐
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Average Rating</p>
                      </div>
                    </ArkivQueryTooltip>
                  ) : (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center dark:border-yellow-800 dark:bg-yellow-900/20">
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {avgRating} ⭐
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Average Rating</p>
                    </div>
                  ))}
              </div>

              {/* Feedback List */}
              <div className="space-y-4">
                {receivedFeedback.map((feedback) => (
                  <div
                    key={feedback.key}
                    className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-800 dark:bg-yellow-900/20"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          From {shortenWallet(feedback.feedbackFrom)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {formatDate(feedback.createdAt)}
                        </p>
                      </div>
                      {feedback.rating && (
                        <div className="text-lg">
                          {'⭐'.repeat(feedback.rating)}
                          <span className="ml-1 text-sm text-gray-600 dark:text-gray-400">
                            ({feedback.rating}/5)
                          </span>
                        </div>
                      )}
                    </div>
                    {feedback.notes && (
                      <p className="mb-2 text-gray-700 dark:text-gray-300">{feedback.notes}</p>
                    )}
                    {feedback.technicalDxFeedback && (
                      <div className="mt-3 rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                        <p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                          Technical DX Feedback:
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {feedback.technicalDxFeedback}
                        </p>
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <ViewOnArkivLink
                        entityKey={feedback.key}
                        txHash={feedback.txHash}
                        label="View Feedback Entity"
                        className="text-xs"
                      />
                      {arkivBuilderMode && feedback.key && (
                        <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                          {feedback.key.slice(0, 12)}...
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Request Meeting Modal */}
        <RequestMeetingModal
          isOpen={showMeetingModal}
          onClose={() => {
            setShowMeetingModal(false);
            setSelectedOffer(null); // Clear selected offer when closing
            setMeetingMode('request'); // Reset to default
          }}
          profile={profile}
          userWallet={userWallet}
          userProfile={userProfile}
          offer={selectedOffer} // Pass the specific offer that was clicked, or null for general request
          mode={meetingMode} // Pass the meeting mode (request, offer, or peer)
          onSuccess={() => {
            // Optionally reload data or show success message
            console.log('Meeting requested successfully');
            setSelectedOffer(null); // Clear selected offer after success
            setMeetingMode('request'); // Reset to default
          }}
        />

        {/* Garden Board - Filter by targetWallet */}
        <GardenBoard
          targetWallet={wallet}
          title={`${profile.displayName || 'Profile'}'s Garden Board`}
          description={`Notes and messages for ${profile.displayName || 'this profile'}`}
          userWallet={userWallet}
          userProfile={userProfile}
          targetProfile={profile}
        />

        {/* Garden Note Modal */}
        <GardenNoteComposeModal
          isOpen={showGardenNoteModal}
          onClose={() => setShowGardenNoteModal(false)}
          targetProfile={profile}
          userWallet={userWallet}
          userProfile={userProfile}
          onSuccess={() => {
            console.log('Garden note posted successfully');
          }}
        />
      </div>
    </div>
  );
}
