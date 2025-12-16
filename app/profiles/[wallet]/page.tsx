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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingMode, setMeetingMode] = useState<'request' | 'peer'>('request');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [showGardenNoteModal, setShowGardenNoteModal] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'view'>('view'); // 'edit' = show edit controls, 'view' = view as others
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
        getProfileByWallet(address.toLowerCase().trim()).then(setUserProfile).catch(() => null);
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
        
      const [profileData, asksData, offersData, sessionsData, feedbackData, availabilityData, learningFollowsData] = await Promise.all([
        getProfileByWallet(normalizedWallet).catch(() => null),
        listAsksForWallet(normalizedWallet).catch(() => []),
        listOffersForWallet(normalizedWallet).catch(() => []),
        listSessionsForWallet(normalizedWallet).catch(() => []),
        listFeedbackForWallet(normalizedWallet).catch(() => []),
        listAvailabilityForWallet(normalizedWallet).catch(() => []),
        listLearningFollows({ profile_wallet: normalizedWallet, active: true }).catch(() => []),
      ]);

      // Record performance metrics
        const durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
        const payloadBytes = JSON.stringify({
          profile: profileData,
        asks: asksData,
        offers: offersData,
        sessions: sessionsData,
        feedback: feedbackData,
        availability: availabilityData,
        }).length;
        
        // Record performance sample (async, don't block)
        import('@/lib/metrics/perf').then(({ recordPerfSample }) => {
          recordPerfSample({
            source: 'arkiv',
            operation: 'loadProfileData',
            route: '/profiles/[wallet]',
            durationMs: Math.round(durationMs),
            payloadBytes,
          httpRequests: 6, // 6 parallel arkiv queries
            createdAt: new Date().toISOString(),
          });
        }).catch(() => {
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
    const expires = created + (ttlSeconds * 1000);
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

  const isExpired = (createdAt: string, ttlSeconds: number): boolean => {
    const created = new Date(createdAt).getTime();
    const expires = created + (ttlSeconds * 1000);
    return Date.now() >= expires;
  };

  const getDisplayStatus = (status: string, createdAt: string, ttlSeconds: number): string => {
    return isExpired(createdAt, ttlSeconds) ? 'closed' : status;
  };

  if (loading) {
    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <BackButton href="/profiles" />
          </div>
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <BackButton href="/profiles" />
          </div>
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">
              {error || 'Profile not found'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <BackButton href="/profiles" />
        </div>

        {/* Profile Avatar with EIS - Matching Dashboard Format */}
        <div className="mb-6 flex flex-col items-center">
          <div className="relative mb-3">
            <div className="w-24 h-24 rounded-full bg-white dark:bg-gray-800 border-2 border-emerald-300 dark:border-emerald-600 flex items-center justify-center shadow-lg">
              <EmojiIdentitySeed 
                profile={profile} 
                size="xl" 
                showGlow={true}
                className="drop-shadow-[0_0_12px_rgba(34,197,94,0.6)]"
              />
            </div>
            {/* Subtle glow ring */}
            <div 
              className="absolute inset-0 rounded-full opacity-30 pointer-events-none"
              style={{
                boxShadow: '0 0 20px rgba(34, 197, 94, 0.4), inset 0 0 20px rgba(34, 197, 94, 0.1)',
              }}
            />
          </div>
          <h1 className="text-2xl font-semibold mb-1 text-gray-900 dark:text-gray-100">
                    {profile.displayName || 'Anonymous'}
                  </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-mono break-all">
            {wallet}
          </p>
                  {profile.username && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">@{profile.username}</p>
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
                <div className="mt-1 text-xs text-gray-400 dark:text-gray-500 font-mono">
                        Key: {profile.key.slice(0, 16)}...
                    </div>
                  )}
                    </div>
                  )}
                </div>

        {/* Action Buttons - only show if viewing someone else's profile and profile is loaded */}
        {userWallet && profile && userWallet.toLowerCase().trim() !== wallet.toLowerCase().trim() && (
          <div className="mb-6 flex justify-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedOffer(null);
                          setShowMeetingModal(true);
                          setMeetingMode('request');
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Request Meeting
                      </button>
                      <button
                        onClick={() => {
                          setSelectedOffer(null);
                          setShowMeetingModal(true);
                          setMeetingMode('peer');
                        }}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Peer Learning
                      </button>
                      <button
                        onClick={() => {
                          setShowGardenNoteModal(true);
                        }}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Leave a Note
                      </button>
                    </div>
                  )}

        {/* Bio Display */}
        {profile.bioShort && (
          <div className="mb-6 text-center">
            <p className="text-gray-700 dark:text-gray-300">{profile.bioShort}</p>
                </div>
        )}

        {/* Profile Information Display - Above Stats (matching dashboard) */}
        <div className="mb-8 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Profile Information</h3>
            {/* Arkiv Builder Mode: Profile Query Tooltip */}
            {arkivBuilderMode && (
              <div className="group/query relative">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono cursor-help border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-gray-50 dark:bg-gray-800">
                  Query
                </div>
                <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/query:opacity-100 transition-opacity duration-200 pointer-events-none z-10 font-mono text-left max-w-md">
                  <div className="font-semibold mb-1">Profile Query:</div>
                  <div>getProfileByWallet('{wallet.slice(0, 8)}...')</div>
                  <div>Query: type='user_profile',</div>
                  <div>wallet='{wallet.slice(0, 8)}...'</div>
                  <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                </div>
              </div>
            )}
          </div>

          {profile.username && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Username</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">@{profile.username}</p>
            </div>
          )}

          {profile.bio && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Bio</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{profile.bio}</p>
              </div>
        )}

          {profile.bioLong && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">About</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{profile.bioLong}</p>
            </div>
          )}

          {(profile as any).exploringStatement && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Exploring</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{(profile as any).exploringStatement}</p>
            </div>
          )}

          {profile.timezone && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Timezone</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{profile.timezone}</p>
          </div>
          )}

          {profile.seniority && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Seniority</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{profile.seniority}</p>
        </div>
          )}

          {profile.languages && profile.languages.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Languages</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{profile.languages.join(', ')}</p>
            </div>
          )}

          {profile.domainsOfInterest && profile.domainsOfInterest.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Domains of Interest</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{profile.domainsOfInterest.join(', ')}</p>
          </div>
        )}

          {profile.mentorRoles && profile.mentorRoles.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Mentor Roles</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{profile.mentorRoles.join(', ')}</p>
          </div>
        )}

          {profile.learnerRoles && profile.learnerRoles.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Learner Roles</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{profile.learnerRoles.join(', ')}</p>
            </div>
          )}

        {profile.contactLinks && Object.keys(profile.contactLinks).length > 0 && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Contact Links</p>
              <div className="flex flex-wrap gap-2">
              {profile.contactLinks.twitter && (
                  <a href={profile.contactLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    Twitter
                </a>
              )}
              {profile.contactLinks.github && (
                  <a href={profile.contactLinks.github} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    GitHub
                </a>
              )}
              {profile.contactLinks.telegram && (
                  <a href={profile.contactLinks.telegram} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    Telegram
                </a>
              )}
              {profile.contactLinks.discord && (
                  <a href={profile.contactLinks.discord} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    Discord
                  </a>
                )}
              </div>
            </div>
          )}

          {profile.skillsArray && profile.skillsArray.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Skills</p>
              <div className="flex flex-wrap gap-2">
                {profile.skillsArray.map((skill, idx) => (
                  <span key={idx} className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                    {skill}
                </span>
                ))}
              </div>
            </div>
              )}

          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Wallet</p>
            <p className="text-sm font-mono text-gray-700 dark:text-gray-300">{shortenWallet(profile.wallet)}</p>
            </div>
          </div>

        {/* Profile Stats - Matching Dashboard Format Exactly */}
        {(() => {
          // Calculate session stats (same logic as dashboard)
          const now = Date.now();
          const completedSessions = sessions.filter(s => {
            if (s.status === 'completed') return true;
            // Also count past scheduled sessions as completed
            if (s.status === 'scheduled') {
              const sessionTime = new Date(s.sessionDate).getTime();
              const sessionEnd = sessionTime + (s.duration || 60) * 60 * 1000;
              return sessionEnd < now;
            }
            return false;
          }).length;
          
          const upcomingSessions = sessions.filter(s => {
            if (s.status !== 'scheduled') return false;
            const sessionTime = new Date(s.sessionDate).getTime();
            return sessionTime > now;
          }).length;

          // Calculate average rating (same logic as dashboard)
          const receivedFeedback = feedbacks.filter(f => 
            f.feedbackTo.toLowerCase() === wallet.toLowerCase()
          );
          const ratings = receivedFeedback
            .map(f => f.rating)
            .filter((r): r is number => r !== undefined && r > 0);
          const avgRating = ratings.length > 0
            ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length)
            : 0;

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
                      `Each session is a type='session' entity on Arkiv`
                    ]}
                    label="Sessions Completed"
                  >
                    <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-900/30 backdrop-blur-sm text-center">
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {completedSessions}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Sessions Completed</p>
                    </div>
                  </ArkivQueryTooltip>
                ) : (
                  <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-900/30 backdrop-blur-sm text-center">
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
                      `Each session is a type='session' entity on Arkiv`
                    ]}
                    label="Upcoming Sessions"
                  >
                    <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50/80 dark:bg-blue-900/30 backdrop-blur-sm text-center">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {upcomingSessions}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Upcoming Sessions</p>
                    </div>
                  </ArkivQueryTooltip>
                ) : (
                  <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50/80 dark:bg-blue-900/30 backdrop-blur-sm text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {upcomingSessions}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Upcoming Sessions</p>
                  </div>
                )}
                
                {/* Average Rating */}
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `listFeedbackForWallet('${wallet.toLowerCase()}')`,
                      `Query: type='session_feedback', (feedbackFrom='${wallet.toLowerCase()}' OR feedbackTo='${wallet.toLowerCase()}')`,
                      `Filtered: feedbackTo='${wallet.toLowerCase()}' (received feedback)`,
                      `Calculated: average of ${ratings.length} ratings`,
                      `Returns: ${avgRating.toFixed(1)} average rating`,
                      `Each feedback is a type='session_feedback' entity on Arkiv`
                    ]}
                    label="Average Rating"
                  >
                    <div className="p-3 rounded-lg border border-yellow-200 dark:border-yellow-700 bg-yellow-50/80 dark:bg-yellow-900/30 backdrop-blur-sm text-center">
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {avgRating.toFixed(1)} ⭐
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Average Rating</p>
                    </div>
                  </ArkivQueryTooltip>
                ) : (
                  <div className="p-3 rounded-lg border border-yellow-200 dark:border-yellow-700 bg-yellow-50/80 dark:bg-yellow-900/30 backdrop-blur-sm text-center">
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
                      `Each follow is a type='learning_follow' entity on Arkiv`
                    ]}
                    label="Skills Learning"
                  >
                    <div className="p-3 rounded-lg border border-purple-200 dark:border-purple-700 bg-purple-50/80 dark:bg-purple-900/30 backdrop-blur-sm text-center">
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {skillsLearningCount}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Skills Learning</p>
                    </div>
                  </ArkivQueryTooltip>
                ) : (
                  <div className="p-3 rounded-lg border border-purple-200 dark:border-purple-700 bg-purple-50/80 dark:bg-purple-900/30 backdrop-blur-sm text-center">
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {skillsLearningCount}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Skills Learning</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Availability */}
        {(() => {
          // Use availability entity if available, otherwise fall back to profile.availabilityWindow
          const availabilityDisplay = availability.length > 0
            ? availability[0].timeBlocks
            : profile.availabilityWindow;

          if (!availabilityDisplay) return null;

          return (
            <div className="mb-8 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              {arkivBuilderMode ? (
                <ArkivQueryTooltip
                  query={[
                    `listAvailabilityForWallet('${wallet.toLowerCase()}')`,
                    `Query: type='availability', wallet='${wallet.toLowerCase()}'`,
                    `Filters out: availability_deletion markers`,
                    `Returns: Availability[] (${availability.length} availability entities)`,
                    `Each availability is a type='availability' entity on Arkiv`
                  ]}
                  label="Availability"
                >
                  <h2 className="text-2xl font-semibold mb-3">Availability</h2>
                </ArkivQueryTooltip>
              ) : (
                <h2 className="text-2xl font-semibold mb-3">Availability</h2>
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
                  `Each offer is a type='offer' entity on Arkiv`
                ]}
                label={`Teaching Offers (${offers.length})`}
              >
                <h2 className="text-2xl font-semibold mb-4">Teaching Offers ({offers.length})</h2>
              </ArkivQueryTooltip>
            ) : (
              <h2 className="text-2xl font-semibold mb-4">Teaching Offers ({offers.length})</h2>
            )}
            <div className="space-y-4">
              {offers.map((offer) => (
                <div
                  key={offer.key}
                  className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {offer.skill}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {formatDate(offer.createdAt)}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                      {getDisplayStatus(offer.status, offer.createdAt, offer.ttlSeconds)}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 mb-3">{offer.message}</p>
                  {offer.availabilityWindow && (
                    <div className="mb-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                        Availability:
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {formatAvailabilityForDisplay(offer.availabilityWindow)}
                      </p>
                    </div>
                  )}
                  {offer.isPaid && (
                    <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded">
                      <p className="text-sm font-medium text-purple-900 dark:text-purple-200 mb-1">
                        Payment:
                      </p>
                      <p className="text-sm text-purple-800 dark:text-purple-300">
                        <span className="text-green-600 dark:text-green-400 font-medium">💰 Requires payment</span>
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
                      <span>⏰ {(() => {
                        const timeRemaining = formatTimeRemaining(offer.createdAt, offer.ttlSeconds);
                        return timeRemaining === 'Expired' ? timeRemaining : `${timeRemaining} left`;
                      })()}</span>
                      {arkivBuilderMode && offer.key && (
                        <div className="flex items-center gap-2">
                          <ViewOnArkivLink txHash={offer.txHash} entityKey={offer.key} className="text-xs" />
                          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                            {offer.key.slice(0, 12)}...
                          </span>
                        </div>
                      )}
                      {!arkivBuilderMode && (
                        <ViewOnArkivLink txHash={offer.txHash} entityKey={offer.key} />
                      )}
                    </div>
                    {/* Request Meeting Button for this specific offer */}
                    {userWallet && userWallet.toLowerCase() !== wallet.toLowerCase() && (
                      <button
                        onClick={() => {
                          setSelectedOffer(offer); // Set the specific offer
                          setMeetingMode('request');
                          setShowMeetingModal(true);
                        }}
                        className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Request Meeting
                      </button>
                    )}
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
                  `Each ask is a type='ask' entity on Arkiv`
                ]}
                label={`Learning Requests (${asks.length})`}
              >
                <h2 className="text-2xl font-semibold mb-4">Learning Requests ({asks.length})</h2>
              </ArkivQueryTooltip>
            ) : (
              <h2 className="text-2xl font-semibold mb-4">Learning Requests ({asks.length})</h2>
            )}
            <div className="space-y-4">
              {asks.map((ask) => (
                <div
                  key={ask.key}
                  className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                        {ask.skill}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {formatDate(ask.createdAt)}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                      {getDisplayStatus(ask.status, ask.createdAt, ask.ttlSeconds)}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 mb-3">{ask.message}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>⏰ {(() => {
                      const timeRemaining = formatTimeRemaining(ask.createdAt, ask.ttlSeconds);
                      return timeRemaining === 'Expired' ? timeRemaining : `${timeRemaining} left`;
                    })()}</span>
                    {arkivBuilderMode && ask.key && (
                      <div className="flex items-center gap-2">
                        <ViewOnArkivLink entityKey={ask.key} txHash={ask.txHash} className="text-xs" />
                        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                          {ask.key.slice(0, 12)}...
                        </span>
                      </div>
                    )}
                    {!arkivBuilderMode && (
                      <ViewOnArkivLink entityKey={ask.key} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State for Asks/Offers */}
        {asks.length === 0 && offers.length === 0 && (
          <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No asks or offers yet.
            </p>
          </div>
        )}

        {/* Session History */}
        {(() => {
          const completedSessions = sessions.filter(s => s.status === 'completed');
          const scheduledSessions = sessions.filter(s => s.status === 'scheduled');
          const allHistorySessions = [...completedSessions, ...scheduledSessions].sort(
            (a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()
          );
          
          // Calculate stats
          const sessionsCompleted = completedSessions.length;
          const sessionsGiven = sessions.filter(s => 
            s.mentorWallet.toLowerCase() === wallet.toLowerCase()
          ).length;
          const sessionsReceived = sessions.filter(s => 
            s.learnerWallet.toLowerCase() === wallet.toLowerCase()
          ).length;

          if (allHistorySessions.length === 0 && sessionsCompleted === 0 && sessionsGiven === 0 && sessionsReceived === 0) {
            return null; // Don't show section if no sessions
          }

          return (
            <div className="mb-8">
              {arkivBuilderMode ? (
                <ArkivQueryTooltip
                  query={[
                    `listSessionsForWallet('${wallet.toLowerCase()}')`,
                    `Query: type='session', (mentorWallet='${wallet.toLowerCase()}' OR learnerWallet='${wallet.toLowerCase()}')`,
                    `Returns: Session[] (${sessions.length} sessions)`,
                    `Each session is a type='session' entity on Arkiv`
                  ]}
                  label="Session History"
                >
                  <h2 className="text-2xl font-semibold mb-4">Session History</h2>
                </ArkivQueryTooltip>
              ) : (
                <h2 className="text-2xl font-semibold mb-4">Session History</h2>
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
                        `Returns: ${sessionsCompleted} completed sessions`
                      ]}
                      label="Completed Sessions"
                    >
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{sessionsCompleted}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                      </div>
                    </ArkivQueryTooltip>
                  ) : (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{sessionsCompleted}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                    </div>
                  )}
                  {arkivBuilderMode ? (
                    <ArkivQueryTooltip
                      query={[
                        `listSessionsForWallet('${wallet.toLowerCase()}')`,
                        `Query: type='session', mentorWallet='${wallet.toLowerCase()}'`,
                        `Returns: ${sessionsGiven} sessions given as mentor`
                      ]}
                      label="Sessions Given"
                    >
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{sessionsGiven}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Given (as Mentor)</p>
                      </div>
                    </ArkivQueryTooltip>
                  ) : (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{sessionsGiven}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Given (as Mentor)</p>
                    </div>
                  )}
                  {arkivBuilderMode ? (
                    <ArkivQueryTooltip
                      query={[
                        `listSessionsForWallet('${wallet.toLowerCase()}')`,
                        `Query: type='session', learnerWallet='${wallet.toLowerCase()}'`,
                        `Returns: ${sessionsReceived} sessions received as learner`
                      ]}
                      label="Sessions Received"
                    >
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg text-center">
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{sessionsReceived}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Received (as Learner)</p>
                      </div>
                    </ArkivQueryTooltip>
                  ) : (
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg text-center">
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{sessionsReceived}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Received (as Learner)</p>
                    </div>
                  )}
                </div>
              )}

              {/* Session List */}
              {allHistorySessions.length > 0 && (
                <div className="space-y-4">
                  {allHistorySessions.map((session) => {
                    const isMentor = session.mentorWallet.toLowerCase() === wallet.toLowerCase();
                    const otherWallet = isMentor ? session.learnerWallet : session.mentorWallet;
                    const sessionDate = new Date(session.sessionDate);
                    const isPast = sessionDate < new Date();

                    return (
                      <div
                        key={session.key}
                        className={`p-6 border rounded-lg ${
                          session.status === 'completed'
                            ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="text-lg font-semibold">{session.skill}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {isMentor ? '👨‍🏫 As Mentor' : '👨‍🎓 As Learner'} with {shortenWallet(otherWallet)}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            session.status === 'completed'
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                          }`}>
                            {session.status === 'completed' ? '✓ Completed' : '📅 Scheduled'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                          <strong>Date:</strong> {sessionDate.toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                          <strong>Time:</strong> {sessionDate.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </p>
                        {session.duration && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                            <strong>Duration:</strong> {session.duration} minutes
                          </p>
                        )}
                        {session.notes && (
                          <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes:</p>
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
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                              {session.key.slice(0, 12)}...
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Feedback Section */}
        {(() => {
          // Filter feedback received (feedbackTo matches wallet)
          const receivedFeedback = feedbacks.filter(f => 
            f.feedbackTo.toLowerCase() === wallet.toLowerCase()
          );
          
          if (receivedFeedback.length === 0) {
            return null;
          }

          // Calculate average rating
          const ratings = receivedFeedback
            .map(f => f.rating)
            .filter((r): r is number => r !== undefined && r > 0);
          const avgRating = ratings.length > 0
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
                    `Each feedback is a type='session_feedback' entity on Arkiv`
                  ]}
                  label="Feedback & Ratings"
                >
                  <h2 className="text-2xl font-semibold mb-4">Feedback & Ratings</h2>
                </ArkivQueryTooltip>
              ) : (
                <h2 className="text-2xl font-semibold mb-4">Feedback & Ratings</h2>
              )}
              
              {/* Stats */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `listFeedbackForWallet('${wallet.toLowerCase()}')`,
                      `Query: type='session_feedback', (feedbackFrom='${wallet.toLowerCase()}' OR feedbackTo='${wallet.toLowerCase()}')`,
                      `Filtered: feedbackTo='${wallet.toLowerCase()}' (received feedback)`,
                      `Returns: ${receivedFeedback.length} feedback entities`
                    ]}
                    label="Total Reviews"
                  >
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-center">
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {receivedFeedback.length}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Reviews</p>
                    </div>
                  </ArkivQueryTooltip>
                ) : (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-center">
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {receivedFeedback.length}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Reviews</p>
                  </div>
                )}
                {avgRating && (
                  arkivBuilderMode ? (
                    <ArkivQueryTooltip
                      query={[
                        `listFeedbackForWallet('${wallet.toLowerCase()}')`,
                        `Query: type='session_feedback', (feedbackFrom='${wallet.toLowerCase()}' OR feedbackTo='${wallet.toLowerCase()}')`,
                        `Filtered: feedbackTo='${wallet.toLowerCase()}' (received feedback)`,
                        `Calculated: average of ${ratings.length} ratings`,
                        `Returns: ${avgRating} average rating`
                      ]}
                      label="Average Rating"
                    >
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-center">
                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                          {avgRating} ⭐
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Average Rating</p>
                      </div>
                    </ArkivQueryTooltip>
                  ) : (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-center">
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {avgRating} ⭐
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Average Rating</p>
                    </div>
                  )
                )}
              </div>

              {/* Feedback List */}
              <div className="space-y-4">
                {receivedFeedback.map((feedback) => (
                  <div
                    key={feedback.key}
                    className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
                  >
                    <div className="flex justify-between items-start mb-3">
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
                          <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
                            ({feedback.rating}/5)
                          </span>
                        </div>
                      )}
                    </div>
                    {feedback.notes && (
                      <p className="text-gray-700 dark:text-gray-300 mb-2">{feedback.notes}</p>
                    )}
                    {feedback.technicalDxFeedback && (
                      <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
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
                        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
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

