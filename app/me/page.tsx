/**
 * User dashboard page
 *
 * Main landing page after authentication.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BetaGate } from '@/components/auth/BetaGate';
import { askColors, askEmojis, offerColors, offerEmojis } from '@/lib/colors';
import { getProfileByWallet, type UserProfile } from '@/lib/arkiv/profile';
import { calculateProfileCompleteness } from '@/lib/profile/completeness';
import { BackgroundImage } from '@/components/BackgroundImage';
import { useOnboardingLevel } from '@/lib/onboarding/useOnboardingLevel';
import type { Skill } from '@/lib/arkiv/skill';
import { listSkills } from '@/lib/arkiv/skill';
import { listLearningFollows } from '@/lib/arkiv/learningFollow';
import { EmojiIdentitySeed } from '@/components/profile/EmojiIdentitySeed';
import { listSessionsForWallet, type Session } from '@/lib/arkiv/sessions';
import { listFeedbackForWallet, type Feedback } from '@/lib/arkiv/feedback';
import { calculateAverageRating } from '@/lib/arkiv/profile';
import { listAsksForWallet, type Ask } from '@/lib/arkiv/asks';
import { listOffersForWallet, type Offer } from '@/lib/arkiv/offers';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { useSkillProfileCounts } from '@/lib/hooks/useSkillProfileCounts';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { SPACE_ID } from '@/lib/config';

export default function MePage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [onboardingChecked, setOnboardingChecked] = useState(false); // Track if onboarding check completed
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [followedSkills, setFollowedSkills] = useState<string[]>([]);
  const [submittingFollow, setSubmittingFollow] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [avgRating, setAvgRating] = useState<number>(0);
  const [ratingCalculation, setRatingCalculation] = useState<{
    totalRatings: number;
    average: number;
  }>({ totalRatings: 0, average: 0 });
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [sessionsUpcoming, setSessionsUpcoming] = useState(0);
  const [asksCount, setAsksCount] = useState(0);
  const [offersCount, setOffersCount] = useState(0);
  const [asks, setAsks] = useState<Ask[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [skillsLearningCount, setSkillsLearningCount] = useState(0); // Count from learning_follow entities
  const [profileSkillsCount, setProfileSkillsCount] = useState(0); // Count from profile.skill_ids or profile.skillsArray
  const [learnerQuestCompletion, setLearnerQuestCompletion] = useState<{
    percent: number;
    readCount: number;
    totalMaterials: number;
  } | null>(null);
  const [individualQuestProgress, setIndividualQuestProgress] = useState<
    Array<{
      questId: string;
      title: string;
      questType: 'reading_list' | 'language_assessment' | 'meta_learning';
      progressPercent: number;
      readCount?: number;
      totalMaterials?: number;
      completedSteps?: number;
      totalSteps?: number;
    }>
  >([]);
  const [hasAvailability, setHasAvailability] = useState<boolean>(false);
  const [badges, setBadges] = useState<
    Array<{
      badgeType: string;
      questId: string;
      issuedAt: string;
      key: string;
      txHash?: string;
    }>
  >([]);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [learningStreak, setLearningStreak] = useState(0);
  const arkivBuilderMode = useArkivBuilderMode();
  const skillProfileCounts = useSkillProfileCounts();
  const [expandedSections, setExpandedSections] = useState<{
    profile: boolean;
  }>({
    profile: true, // Default to expanded
  });
  const router = useRouter();
  const { level } = useOnboardingLevel(walletAddress);

  const shortenWallet = (wallet: string) => {
    if (!wallet || wallet.length < 10) return wallet;
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  useEffect(() => {
    // Check authentication
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (!address) {
        router.push('/auth');
        return;
      }
      setWalletAddress(address);

      // Check for ?edit=profile query param to auto-open edit profile section
      const params = new URLSearchParams(window.location.search);
      if (params.get('edit') === 'profile') {
        setExpandedSections((prev) => ({ ...prev, profile: true }));
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }

      // Check onboarding access (requires level 1 for dashboard - at least profile + skills)
      // Level 0 = no profile, Level 1 = profile + skills, Level 2+ = has ask/offer
      // Dashboard should be accessible once user has profile and skills (they can create asks/offers from dashboard)
      import('@/lib/onboarding/access').then(({ checkOnboardingRoute }) => {
        checkOnboardingRoute(address, 1, '/onboarding')
          .then((hasAccess) => {
            setOnboardingChecked(true); // Mark check as complete
            if (hasAccess) {
              // Has access - continue loading
              loadNotificationCount(address);
              loadProfileStatus(address);
            }
            // If no access, checkOnboardingRoute will redirect
          })
          .catch(() => {
            // On error, allow access (don't block on calculation failure)
            setOnboardingChecked(true);
            loadNotificationCount(address);
            loadProfileStatus(address);
          });
      });

      // Load all skills and followed communities for join/leave functionality
      if (address) {
        Promise.all([
          listSkills({ status: 'active', limit: 200 }),
          listLearningFollows({ profile_wallet: address, active: true }),
        ])
          .then(([skills, follows]) => {
            setAllSkills(skills);
            // Filter follows to only include skills that exist in allSkills
            // This ensures the count matches what's actually displayed
            const skillKeys = new Set(skills.map((s) => s.key));
            const validFollows = follows.filter((f) => skillKeys.has(f.skill_id));
            setFollowedSkills(validFollows.map((f) => f.skill_id));
            setSkillsLearningCount(validFollows.length);
          })
          .catch(() => {
            // Skills or follows not found - that's okay
          });

        // Load sessions and feedback for stats
        loadSessionStats(address);
        loadFeedbackStats(address);
        loadAsksAndOffers(address);
        loadLearnerQuestCompletion(address);
        loadBadges(address);
      }

      // Poll for notifications and profile status every 30 seconds (only if profile exists)
      const interval = setInterval(() => {
        if (hasProfile !== false) {
          // Only poll if we know profile exists or haven't checked yet
          loadNotificationCount(address);
          loadProfileStatus(address);
        }
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [router, hasProfile]);

  const loadNotificationCount = async (wallet: string) => {
    try {
      // Normalize wallet to lowercase for consistent querying (same as notifications page)
      const normalizedWallet = wallet.toLowerCase().trim();
      const res = await fetch(
        `/api/notifications?wallet=${encodeURIComponent(normalizedWallet)}&status=active`
      );
      const data = await res.json();
      if (!data.ok) return;

      // Count unread notifications
      // Use the same logic as the notifications page: filter out archived notifications
      // and count only unread ones
      const notifications = data.notifications || [];
      let unreadCount = 0;

      notifications.forEach((n: any) => {
        const notificationId = n.key;
        const prefStr = localStorage.getItem(`notification_pref_${notificationId}`);
        if (prefStr) {
          try {
            const pref = JSON.parse(prefStr);
            // Filter out archived notifications (same as notifications page)
            if (!pref.archived && !pref.read) {
              unreadCount++;
            }
          } catch (e) {
            // If pref can't be parsed, treat as unread (but not archived)
            unreadCount++;
          }
        } else {
          // No preference stored, treat as unread (same as notifications page)
          unreadCount++;
        }
      });

      setNotificationCount(unreadCount);
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
        // Count skills from profile (skill_ids or skillsArray)
        const skillIds = (profileData as any).skill_ids || [];
        const skillsArray = profileData.skillsArray || [];
        const profileSkills = skillIds.length > 0 ? skillIds.length : skillsArray.length;
        setProfileSkillsCount(profileSkills);
      } else {
        setProfileSkillsCount(0);
      }

      // Check for availability entities (modern format)
      try {
        const { listAvailabilityForWallet } = await import('@/lib/arkiv/availability');
        const availabilities = await listAvailabilityForWallet(wallet);
        setHasAvailability(availabilities.length > 0);
      } catch (err) {
        // If availability check fails, assume no availability
        setHasAvailability(false);
      }
    } catch (err) {
      console.error('Error loading profile status:', err);
      setHasProfile(null);
      setProfile(null);
      setProfileSkillsCount(0);
      setHasAvailability(false);
    }
  };

  const loadSessionStats = async (wallet: string) => {
    try {
      const allSessions = await listSessionsForWallet(wallet);
      setSessions(allSessions);

      const now = Date.now();
      const completed = allSessions.filter((s) => {
        if (s.status === 'completed') return true;
        // Also count past scheduled/pending sessions as completed (including duration + buffer)
        if (s.status === 'scheduled' || s.status === 'pending') {
          const sessionTime = new Date(s.sessionDate).getTime();
          const duration = (s.duration || 60) * 60 * 1000; // Convert minutes to milliseconds
          const buffer = 60 * 60 * 1000; // 1 hour buffer
          const sessionEnd = sessionTime + duration + buffer;
          return sessionEnd < now;
        }
        return false;
      }).length;

      const upcoming = allSessions.filter((s) => {
        // Only count scheduled sessions that haven't ended yet
        if (s.status !== 'scheduled') return false;
        const sessionTime = new Date(s.sessionDate).getTime();
        const duration = (s.duration || 60) * 60 * 1000; // Convert minutes to milliseconds
        const buffer = 60 * 60 * 1000; // 1 hour buffer
        const sessionEnd = sessionTime + duration + buffer;
        return now < sessionEnd;
      }).length;

      setSessionsCompleted(completed);
      setSessionsUpcoming(upcoming);
    } catch (err) {
      console.error('Error loading session stats:', err);
    }
  };

  const loadAsksAndOffers = async (wallet: string) => {
    try {
      const [asksData, offersData] = await Promise.all([
        listAsksForWallet(wallet).catch(() => []),
        listOffersForWallet(wallet).catch(() => []),
      ]);

      // Filter out expired asks/offers (same logic as elsewhere in the app)
      const now = Date.now();
      const activeAsks = asksData.filter((ask) => {
        if (ask.status !== 'open') return false;
        // Check if expired
        if (ask.createdAt && ask.ttlSeconds) {
          const createdAt = new Date(ask.createdAt).getTime();
          const expiresAt = createdAt + ask.ttlSeconds * 1000;
          return expiresAt > now;
        }
        return true;
      });

      const activeOffers = offersData.filter((offer) => {
        if (offer.status !== 'active') return false;
        // Check if expired
        if (offer.createdAt && offer.ttlSeconds) {
          const createdAt = new Date(offer.createdAt).getTime();
          const expiresAt = createdAt + offer.ttlSeconds * 1000;
          return expiresAt > now;
        }
        return true;
      });

      setAsks(activeAsks);
      setOffers(activeOffers);
      setAsksCount(activeAsks.length);
      setOffersCount(activeOffers.length);
    } catch (err) {
      console.error('Error loading asks and offers:', err);
    }
  };

  const loadFeedbackStats = async (wallet: string) => {
    try {
      const allFeedback = await listFeedbackForWallet(wallet);
      setFeedbacks(allFeedback);

      // Calculate average rating from feedback received (query: type='session_feedback', feedbackTo=wallet)
      const receivedFeedback = allFeedback.filter(
        (f) => f.feedbackTo.toLowerCase() === wallet.toLowerCase()
      );

      // Extract ratings from received feedback
      const ratings = receivedFeedback
        .map((f) => f.rating)
        .filter((r): r is number => r !== undefined && r > 0);

      if (ratings.length > 0) {
        const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
        setAvgRating(Math.round(average * 10) / 10); // Round to 1 decimal
        setRatingCalculation({
          totalRatings: ratings.length,
          average: Math.round(average * 10) / 10,
        });
      } else {
        // No ratings yet - show 0
        setAvgRating(0);
        setRatingCalculation({
          totalRatings: 0,
          average: 0,
        });
      }
    } catch (err) {
      console.error('Error loading feedback stats:', err);
      // On error, still show 0
      setAvgRating(0);
      setRatingCalculation({
        totalRatings: 0,
        average: 0,
      });
    }
  };

  const loadBadges = async (wallet: string) => {
    try {
      setBadgesLoading(true);
      const res = await fetch(`/api/badges?wallet=${wallet}`);
      const data = await res.json();

      if (data.ok && data.badges) {
        setBadges(
          data.badges.map((badge: any) => ({
            badgeType: badge.badgeType,
            questId: badge.questId,
            issuedAt: badge.issuedAt,
            key: badge.key,
            txHash: badge.txHash,
          }))
        );

        const dates = new Set<string>();
        for (const badge of data.badges) {
          if (badge.issuedAt) {
            dates.add(new Date(badge.issuedAt).toISOString().slice(0, 10));
          }
        }
        computeStreak(dates);
      } else {
        setBadges([]);
      }
    } catch (err) {
      console.error('Error loading badges:', err);
      setBadges([]);
    } finally {
      setBadgesLoading(false);
    }
  };

  const computeStreak = (activityDates: Set<string>) => {
    if (activityDates.size === 0) {
      setLearningStreak(0);
      return;
    }
    const today = new Date();
    let streak = 0;
    for (let d = 0; d < 365; d++) {
      const check = new Date(today);
      check.setDate(today.getDate() - d);
      const key = check.toISOString().slice(0, 10);
      if (activityDates.has(key)) {
        streak++;
      } else if (d > 0) {
        break;
      }
    }
    setLearningStreak(streak);
  };
  const loadLearnerQuestCompletion = async (walletAddress: string) => {
    try {
      // Fetch all active quests
      const questsRes = await fetch('/api/learner-quests');
      const questsData = await questsRes.json();

      if (!questsData.ok || !questsData.quests || questsData.quests.length === 0) {
        setLearnerQuestCompletion(null);
        setIndividualQuestProgress([]);
        return;
      }

      const allQuests = questsData.quests;
      const readingListQuests = allQuests.filter((q: any) => q.questType === 'reading_list');

      // Load progress for all quests in parallel (reading_list, language_assessment, and meta_learning)
      const progressPromises = allQuests.map(async (quest: any) => {
        try {
          if (quest.questType === 'reading_list') {
            const res = await fetch(
              `/api/learner-quests/progress?questId=${quest.questId}&wallet=${walletAddress}`
            );
            const data = await res.json();

            if (data.ok && data.progress && quest.materials) {
              const readCount = Object.values(data.progress).filter(
                (p: any) => p.status === 'read'
              ).length;
              const totalMaterials = quest.materials.length;
              const progressPercent =
                totalMaterials > 0 ? Math.round((readCount / totalMaterials) * 100) : 0;
              return {
                questId: quest.questId,
                title: quest.title,
                questType: quest.questType,
                progressPercent,
                readCount,
                totalMaterials,
              };
            }
            return {
              questId: quest.questId,
              title: quest.title,
              questType: quest.questType,
              progressPercent: 0,
              readCount: 0,
              totalMaterials: quest.materials?.length || 0,
            };
          } else if (quest.questType === 'meta_learning') {
            // Load meta-learning quest progress
            const res = await fetch(
              `/api/learner-quests/meta-learning/progress?questId=meta_learning&wallet=${walletAddress}`
            );
            const data = await res.json();

            if (data.ok && data.progress) {
              const progress = data.progress;
              const completedSteps = progress.completedSteps || 0;
              const totalSteps = progress.totalSteps || 6;
              const progressPercent =
                totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
              return {
                questId: quest.questId,
                title: quest.title,
                questType: quest.questType,
                progressPercent,
                completedSteps,
                totalSteps,
              };
            }
            return {
              questId: quest.questId,
              title: quest.title,
              questType: quest.questType,
              progressPercent: 0,
              completedSteps: 0,
              totalSteps: 6,
            };
          } else if (quest.questType === 'language_assessment') {
            // Load assessment results for language assessments
            try {
              const resultRes = await fetch(
                `/api/learner-quests/assessment/result?questId=${quest.questId}&wallet=${walletAddress}`
              );

              // 404 is expected when user hasn't completed assessment - don't log as error
              if (resultRes.status === 404) {
                // Silently fall through to fallback (no result found)
              } else if (!resultRes.ok) {
                // Log actual errors (500, network failures, etc.) but not 404
                console.error(`Error loading assessment result for quest ${quest.questId}:`, {
                  status: resultRes.status,
                  statusText: resultRes.statusText,
                });
              } else {
                const resultData = await resultRes.json();
                if (resultData.ok && resultData.result) {
                  const result = resultData.result;
                  return {
                    questId: quest.questId,
                    title: quest.title,
                    questType: quest.questType,
                    progressPercent: result.percentage || 0,
                    assessmentResult: result, // Store full result for display
                  };
                }
              }
            } catch (err) {
              // Only log actual network/parsing errors, not expected 404s
              console.error(`Error loading assessment result for quest ${quest.questId}:`, err);
            }
            // Fallback if no result found
            return {
              questId: quest.questId,
              title: quest.title,
              questType: quest.questType,
              progressPercent: 0,
            };
          }
          return null;
        } catch (err) {
          console.error(`Error loading progress for quest ${quest.questId}:`, err);
          return {
            questId: quest.questId,
            title: quest.title,
            questType: quest.questType,
            progressPercent: 0,
            readCount: 0,
            totalMaterials: quest.materials?.length || 0,
          };
        }
      });

      const results = await Promise.all(progressPromises);
      const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null);
      setIndividualQuestProgress(validResults);

      // Calculate overall completion for reading_list quests only
      if (readingListQuests.length === 0) {
        setLearnerQuestCompletion(null);
        return;
      }

      const readingListResults = validResults.filter((r) => r.questType === 'reading_list');
      const totalRead = readingListResults.reduce((sum, r) => sum + (r.readCount || 0), 0);
      const totalMaterials = readingListResults.reduce(
        (sum, r) => sum + (r.totalMaterials || 0),
        0
      );
      const percent = totalMaterials > 0 ? Math.round((totalRead / totalMaterials) * 100) : 0;

      setLearnerQuestCompletion({ percent, readCount: totalRead, totalMaterials });
    } catch (err) {
      console.error('Error loading learner quest completion:', err);
      setLearnerQuestCompletion(null);
      setIndividualQuestProgress([]);
    }
  };

  // Show loading state until wallet is loaded AND onboarding check is complete
  if (!walletAddress || !onboardingChecked) {
    return (
      <BetaGate>
        <div className="flex min-h-screen items-center justify-center p-4 text-gray-900 dark:text-gray-100">
          <div className="text-center">
            <div className="mb-4 animate-pulse text-2xl">🌱</div>
            <p className="text-gray-600 dark:text-gray-400">Loading your garden...</p>
          </div>
        </div>
      </BetaGate>
    );
  }

  return (
    <BetaGate>
      <div className="relative min-h-screen pb-24 text-gray-900 dark:text-gray-100">
        {/* Forest Background */}
        <BackgroundImage />

        {/* Garden is provided by FixedBackgroundGarden in root layout */}
        {/* Dashboard content floats on top with backdrop blur */}
        <div className="relative z-10 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl">
            {/* Profile Avatar with EIS */}
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
                    boxShadow:
                      '0 0 20px rgba(34, 197, 94, 0.4), inset 0 0 20px rgba(34, 197, 94, 0.1)',
                  }}
                />
              </div>
              {profile?.displayName ? (
                <>
                  <h1 className="mb-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {profile.displayName}
                  </h1>
                  <p className="mb-2 break-all font-mono text-xs text-gray-500 dark:text-gray-400">
                    {walletAddress}
                  </p>
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
                </>
              ) : (
                <>
                  <h1 className="mb-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    Your Dashboard
                  </h1>
                  <p className="mb-2 break-all font-mono text-xs text-gray-500 dark:text-gray-400">
                    {walletAddress}
                  </p>
                </>
              )}
            </div>

            {/* Bio Display */}
            {profile?.bioShort && (
              <div className="mb-6 text-center">
                <p className="text-gray-700 dark:text-gray-300">{profile.bioShort}</p>
              </div>
            )}

            {/* Profile Completeness Indicator */}
            {hasProfile &&
              profile &&
              (() => {
                const completeness = calculateProfileCompleteness(profile, hasAvailability);
                if (completeness.percentage < 100) {
                  return (
                    <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50/80 p-4 backdrop-blur-sm dark:border-yellow-800 dark:bg-yellow-900/30">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-yellow-900 dark:text-yellow-200">
                          Profile {completeness.percentage}% Complete
                        </span>
                        <Link
                          href="/me/profile"
                          className="text-sm text-yellow-800 hover:underline dark:text-yellow-300"
                        >
                          Complete →
                        </Link>
                      </div>
                      <div className="mb-2 h-2 w-full rounded-full bg-yellow-200 dark:bg-yellow-800">
                        <div
                          className="h-2 rounded-full bg-yellow-600 transition-all dark:bg-yellow-400"
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

            {/* Profile Information Display - Above Metric Cards */}
            {hasProfile && profile && (
              <div className="mb-6 space-y-4">
                {/* Profile Information Display */}
                <div className="space-y-3 rounded-lg border border-gray-200 bg-white/80 p-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80">
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
                          <div>type='user_profile',</div>
                          <div>wallet='{walletAddress?.slice(0, 8)}...'</div>
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
                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                        Domains of Interest
                      </p>
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

                  {/* Arkiv Builder Mode: Metadata Fields */}
                  {arkivBuilderMode && (
                    <>
                      {profile.npsScore !== undefined && profile.npsScore !== null && (
                        <div>
                          <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">NPS Score</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {profile.npsScore}
                          </p>
                        </div>
                      )}

                      {profile.reputationScore !== undefined &&
                        profile.reputationScore !== null && (
                          <div>
                            <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                              Reputation Score
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {profile.reputationScore}
                            </p>
                          </div>
                        )}

                      {profile.topSkillsUsage && profile.topSkillsUsage.length > 0 && (
                        <div>
                          <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                            Top Skills Usage
                          </p>
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
                          <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                            Peer Testimonials
                          </p>
                          <div className="space-y-2">
                            {profile.peerTestimonials.map((testimonial, idx) => (
                              <div
                                key={idx}
                                className="rounded border border-gray-200 bg-gray-100 p-2 text-xs dark:border-gray-600 dark:bg-gray-700"
                              >
                                <p className="text-gray-700 dark:text-gray-300">
                                  {testimonial.text}
                                </p>
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
                          <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                            Trust Edges
                          </p>
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
                          <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                            Last Active
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {new Date(profile.lastActiveTimestamp).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Profile Stats - Always visible */}
            <div className="mb-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Sessions Completed */}
                <Link
                  href="/me/sessions"
                  className="group relative cursor-pointer rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-center backdrop-blur-sm transition-all duration-200 hover:border-emerald-400 hover:shadow-md dark:border-emerald-700 dark:bg-emerald-900/30 dark:hover:border-emerald-500"
                >
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {sessionsCompleted}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Sessions Completed</p>
                  {/* Tooltip */}
                  {arkivBuilderMode && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 transform rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 dark:bg-gray-800">
                      <div className="text-left font-mono">
                        <div>Arkiv query: type='session',</div>
                        <div>profile_wallet='{walletAddress?.slice(0, 8)}...'</div>
                        <div>(as mentor OR learner),</div>
                        <div>status='completed' OR</div>
                        <div>(status='scheduled' AND sessionDate &lt; now)</div>
                        <div className="mt-1 border-t border-gray-700 pt-1 text-[10px] text-gray-500">
                          Queries: mentorWallet OR learnerWallet
                        </div>
                      </div>
                      <div className="absolute left-1/2 top-full -translate-x-1/2 transform border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                    </div>
                  )}
                  {/* Arkiv Builder Mode: Show session entities */}
                  {arkivBuilderMode && sessions.length > 0 && (
                    <div className="mt-2 border-t border-emerald-200 pt-2 dark:border-emerald-700">
                      <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                        Session Entities:
                      </div>
                      {sessions
                        .filter(
                          (s) =>
                            s.status === 'completed' ||
                            (s.status === 'scheduled' && new Date(s.sessionDate || 0) < new Date())
                        )
                        .slice(0, 3)
                        .map((session) => (
                          <div key={session.key} className="mt-1 flex items-center gap-2 text-xs">
                            <ViewOnArkivLink
                              entityKey={session.key}
                              txHash={session.txHash}
                              label=""
                              className="text-xs"
                              icon="🔗"
                            />
                            <span className="font-mono text-gray-400 dark:text-gray-500">
                              {session.key.slice(0, 8)}...
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </Link>

                {/* Upcoming Sessions */}
                <Link
                  href="/me/sessions"
                  className="group relative cursor-pointer rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-center backdrop-blur-sm transition-all duration-200 hover:border-blue-400 hover:shadow-md dark:border-blue-700 dark:bg-blue-900/30 dark:hover:border-blue-500"
                >
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {sessionsUpcoming}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Upcoming Sessions</p>
                  {/* Tooltip */}
                  {arkivBuilderMode && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 transform rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 dark:bg-gray-800">
                      <div className="text-left font-mono">
                        <div>Arkiv query: type='session',</div>
                        <div>profile_wallet='{walletAddress?.slice(0, 8)}...'</div>
                        <div>(as mentor OR learner),</div>
                        <div>status='scheduled' AND</div>
                        <div>sessionDate &gt; now</div>
                        <div className="mt-1 border-t border-gray-700 pt-1 text-[10px] text-gray-500">
                          Queries: mentorWallet OR learnerWallet
                        </div>
                      </div>
                      <div className="absolute left-1/2 top-full -translate-x-1/2 transform border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                    </div>
                  )}
                </Link>

                {/* Asks */}
                <Link
                  href="/asks"
                  className="group relative cursor-pointer rounded-lg border border-purple-200 bg-purple-50/80 p-3 text-center backdrop-blur-sm transition-all duration-200 hover:border-purple-400 hover:shadow-md dark:border-purple-700 dark:bg-purple-900/30 dark:hover:border-purple-500"
                >
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    🎓 {asksCount}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Asks</p>
                  {/* Tooltip */}
                  {arkivBuilderMode && (
                    <ArkivQueryTooltip
                      query={[
                        `listAsksForWallet('${walletAddress?.toLowerCase() || ''}')`,
                        `Query: type='ask', wallet='${walletAddress?.slice(0, 8) || ''}...', status='open'`,
                        `Filtered: active (not expired)`,
                        `Returns: ${asksCount} active asks`,
                        `Each ask is a type='ask' entity on Arkiv`,
                      ]}
                      label="Asks"
                    >
                      <div className="absolute inset-0" />
                    </ArkivQueryTooltip>
                  )}
                </Link>

                {/* Offers */}
                <Link
                  href="/offers"
                  className="group relative cursor-pointer rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-center backdrop-blur-sm transition-all duration-200 hover:border-amber-400 hover:shadow-md dark:border-amber-700 dark:bg-amber-900/30 dark:hover:border-amber-500"
                >
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    💎 {offersCount}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Offers</p>
                  {/* Tooltip */}
                  {arkivBuilderMode && (
                    <ArkivQueryTooltip
                      query={[
                        `listOffersForWallet('${walletAddress?.toLowerCase() || ''}')`,
                        `Query: type='offer', wallet='${walletAddress?.slice(0, 8) || ''}...', status='active'`,
                        `Filtered: active (not expired)`,
                        `Returns: ${offersCount} active offers`,
                        `Each offer is a type='offer' entity on Arkiv`,
                      ]}
                      label="Offers"
                    >
                      <div className="absolute inset-0" />
                    </ArkivQueryTooltip>
                  )}
                </Link>

                {/* Learning Streak */}
                {learningStreak > 0 && (
                  <Link
                    href="/learner-quests"
                    className="group relative cursor-pointer rounded-lg border border-orange-200 bg-orange-50/80 p-3 text-center backdrop-blur-sm transition-all duration-200 hover:border-orange-400 hover:shadow-md dark:border-orange-700 dark:bg-orange-900/30 dark:hover:border-orange-500"
                  >
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      🔥 {learningStreak}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Day Streak</p>
                  </Link>
                )}

                {/* Badges Earned - Full Width Row */}
                {badges.length > 0 && (
                  <Link
                    href="/learner-quests"
                    className="group relative col-span-2 cursor-pointer rounded-lg border border-yellow-200 bg-yellow-50/80 p-3 text-center backdrop-blur-sm transition-all duration-200 hover:border-yellow-400 hover:shadow-md dark:border-yellow-700 dark:bg-yellow-900/30 dark:hover:border-yellow-500"
                  >
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      🏆 {badges.length}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Badges Earned</p>
                    {/* Badge List */}
                    <div className="mt-2 flex flex-wrap justify-center gap-1">
                      {badges.slice(0, 5).map((badge, idx) => {
                        // Map badge types to display names
                        const badgeNames: Record<string, string> = {
                          arkiv_builder: 'Arkiv Builder',
                          mandarin_starter: 'Mandarin Starter',
                          spanish_starter: 'Spanish Starter',
                          crypto_basics: 'Crypto Basics',
                          cryptography_basics: 'Crypto Basics',
                          meta_learner: 'Meta-Learner',
                          privacy_fundamentals: 'Privacy Fundamentals',
                          ai_intro: 'AI Intro',
                        };
                        const badgeName = badgeNames[badge.badgeType] || badge.badgeType;
                        return (
                          <span
                            key={idx}
                            className="rounded border border-yellow-200 bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200"
                            title={`Earned: ${new Date(badge.issuedAt).toLocaleDateString()}`}
                          >
                            {badgeName}
                          </span>
                        );
                      })}
                      {badges.length > 5 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          +{badges.length - 5} more
                        </span>
                      )}
                    </div>
                    {/* Tooltip */}
                    {arkivBuilderMode && (
                      <ArkivQueryTooltip
                        query={[
                          `GET /api/badges?wallet=${walletAddress?.toLowerCase() || ''}`,
                          `Query: type='proof_of_skill_badge', wallet='${walletAddress?.slice(0, 8) || ''}...', spaceId='${SPACE_ID}'`,
                          `Returns: ${badges.length} badge entities`,
                          `Each badge is a type='proof_of_skill_badge' entity on Arkiv`,
                          `Badge entity key: badge:${SPACE_ID}:${walletAddress?.slice(0, 8) || ''}...:${badges[0]?.badgeType || 'badgeType'}`,
                        ]}
                        label="Badges"
                      >
                        <div className="absolute inset-0" />
                      </ArkivQueryTooltip>
                    )}
                    {/* Arkiv Builder Mode: Show badge entities */}
                    {arkivBuilderMode && badges.length > 0 && (
                      <div className="mt-2 border-t border-yellow-200 pt-2 dark:border-yellow-700">
                        <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                          Badge Entities:
                        </div>
                        {badges.slice(0, 3).map((badge, idx) => (
                          <div key={idx} className="mt-1 flex items-center gap-2 text-xs">
                            <ViewOnArkivLink
                              entityKey={badge.key}
                              txHash={badge.txHash}
                              label=""
                              className="text-xs"
                              icon="🔗"
                            />
                            <span className="font-mono text-gray-400 dark:text-gray-500">
                              {badge.key.slice(0, 8)}...
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Link>
                )}

                {/* Learner Quests - Full Width Row */}
                {individualQuestProgress.length > 0 && (
                  <Link
                    href="/learner-quests"
                    className="group relative col-span-2 cursor-pointer rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 backdrop-blur-sm transition-all duration-200 hover:border-emerald-400 hover:shadow-md dark:border-emerald-700 dark:bg-emerald-900/30 dark:hover:border-emerald-500"
                  >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      {/* Reading Lists Section */}
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Reading Lists
                        </h3>
                        <div className="space-y-2">
                          {individualQuestProgress
                            .filter((q) => q.questType === 'reading_list')
                            .map((quest) => (
                              <div
                                key={quest.questId}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                                  {quest.title}
                                </span>
                                <span className="ml-2 font-medium text-emerald-600 dark:text-emerald-400">
                                  {quest.progressPercent}%
                                </span>
                              </div>
                            ))}
                          {individualQuestProgress.filter((q) => q.questType === 'reading_list')
                            .length === 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              No reading list quests
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Language Assessments Section */}
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Language Assessments
                        </h3>
                        <div className="space-y-2">
                          {individualQuestProgress
                            .filter((q) => q.questType === 'language_assessment')
                            .map((quest) => (
                              <div
                                key={quest.questId}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                                  {quest.title}
                                </span>
                                <span className="ml-2 font-medium text-blue-600 dark:text-blue-400">
                                  {quest.progressPercent}%
                                </span>
                              </div>
                            ))}
                          {individualQuestProgress.filter(
                            (q) => q.questType === 'language_assessment'
                          ).length === 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              No language assessments
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Meta-Learning Quest Section */}
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Meta-Learning Quest
                        </h3>
                        <div className="space-y-2">
                          {individualQuestProgress
                            .filter((q) => q.questType === 'meta_learning')
                            .map((quest) => (
                              <div
                                key={quest.questId}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                                  {quest.title}
                                </span>
                                <span className="ml-2 font-medium text-purple-600 dark:text-purple-400">
                                  {quest.progressPercent}%
                                </span>
                              </div>
                            ))}
                          {individualQuestProgress.filter((q) => q.questType === 'meta_learning')
                            .length === 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              No meta-learning quest
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tooltip */}
                    {arkivBuilderMode && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 transform rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 dark:bg-gray-800">
                        <div className="text-left font-mono">
                          <div>GET /api/learner-quests</div>
                          <div>→ listLearnerQuests()</div>
                          <div>→ type='learner_quest', status='active'</div>
                          <div className="mt-1 border-t border-gray-700 pt-1 text-[10px] text-gray-500">
                            For each quest: GET /api/learner-quests/progress
                          </div>
                          <div className="text-[10px] text-gray-500">
                            → type='learner_quest_progress', wallet='...', questId='...'
                          </div>
                        </div>
                        <div className="absolute left-1/2 top-full -translate-x-1/2 transform border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                      </div>
                    )}
                  </Link>
                )}

                {/* Average Rating */}
                <div className="group relative cursor-help rounded-lg border border-yellow-200 bg-yellow-50/80 p-3 text-center backdrop-blur-sm dark:border-yellow-700 dark:bg-yellow-900/30">
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {avgRating.toFixed(1)} ⭐
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Average Rating</p>
                  {/* Tooltip - only show in Arkiv Builder Mode */}
                  {arkivBuilderMode && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 transform rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 dark:bg-gray-800">
                      <div className="text-left font-mono">
                        {ratingCalculation.totalRatings > 0 && (
                          <div className="mb-1">
                            from {ratingCalculation.totalRatings} rating
                            {ratingCalculation.totalRatings !== 1 ? 's' : ''}
                          </div>
                        )}
                        <div>Arkiv query: type='session_feedback',</div>
                        <div>feedbackTo='{walletAddress?.slice(0, 8)}...'</div>
                      </div>
                      <div className="absolute left-1/2 top-full -translate-x-1/2 transform border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                    </div>
                  )}
                </div>

                {/* Skills Learning - Full Width Row (Skill Garden) */}
                <div className="group relative col-span-2 rounded-lg border border-purple-200 bg-purple-50/80 p-4 backdrop-blur-sm dark:border-purple-700 dark:bg-purple-900/30">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Skills Learning
                    </h3>
                    {arkivBuilderMode ? (
                      <ArkivQueryTooltip
                        query={[
                          `Skills Count Queries:`,
                          ``,
                          `1. Profile Skills Count: ${profileSkillsCount}`,
                          `   Query: getProfileByWallet('${walletAddress?.slice(0, 8)}...')`,
                          `   → type='user_profile', wallet='${walletAddress?.slice(0, 8)}...'`,
                          `   → Count: profile.skill_ids.length OR profile.skillsArray.length`,
                          `   → Note: Skills added to profile (via /me/skills)`,
                          ``,
                          `2. Learning Communities Count: ${skillsLearningCount}`,
                          `   Query: listLearningFollows({ profile_wallet: '${walletAddress?.slice(0, 8)}...', active: true })`,
                          `   → type='learning_follow', profile_wallet='${walletAddress?.slice(0, 8)}...', active='true'`,
                          `   → Count: learning_follow entities (explicit community joins)`,
                          ``,
                          `Automatic Join Check:`,
                          `→ When skill is created with created_by_profile,`,
                          `→ createLearningFollow() is called automatically`,
                          `→ If mismatch: profile has skills but no learning_follow entities`,
                          `→ User needs to manually join communities`,
                        ]}
                        label="Skills Learning Queries"
                      >
                        <div className="cursor-help rounded border border-gray-300 bg-gray-50 px-2 py-1 font-mono text-xs text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          Profile: {profileSkillsCount} | Communities: {skillsLearningCount}
                        </div>
                      </ArkivQueryTooltip>
                    ) : (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Profile: {profileSkillsCount} | Communities: {skillsLearningCount}
                      </div>
                    )}
                  </div>

                  {walletAddress && followedSkills.length > 0 ? (
                    <div className="mb-4 space-y-2">
                      {followedSkills.slice(0, 5).map((skillId) => {
                        const skillEntity = allSkills.find((s) => s.key === skillId);
                        if (!skillEntity) return null;

                        const skillLink = skillEntity.slug ? `/topic/${skillEntity.slug}` : '#';

                        return (
                          <div
                            key={skillId}
                            className="flex items-center justify-between rounded border border-purple-200 bg-white p-2 dark:border-purple-700 dark:bg-gray-800"
                          >
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {skillEntity.name_canonical}
                            </span>
                            <div className="flex items-center gap-2">
                              <Link
                                href={skillLink}
                                className="text-xs text-purple-600 hover:underline dark:text-purple-400"
                              >
                                View Community →
                              </Link>
                              <button
                                onClick={async () => {
                                  if (submittingFollow === skillId) return;
                                  setSubmittingFollow(skillId);
                                  try {
                                    const res = await fetch('/api/learning-follow', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        action: 'unfollow',
                                        wallet: walletAddress,
                                        skillId: skillId,
                                      }),
                                    });
                                    const data = await res.json();
                                    if (data.ok) {
                                      await new Promise((resolve) => setTimeout(resolve, 1500));
                                      const follows = await listLearningFollows({
                                        profile_wallet: walletAddress,
                                        active: true,
                                      });
                                      // Filter follows to only include skills that exist in allSkills
                                      const skillKeys = new Set(allSkills.map((s) => s.key));
                                      const validFollows = follows.filter((f) =>
                                        skillKeys.has(f.skill_id)
                                      );
                                      setFollowedSkills(validFollows.map((f) => f.skill_id));
                                      setSkillsLearningCount(validFollows.length);
                                    } else {
                                      alert(data.error || 'Failed to leave community');
                                    }
                                  } catch (error: any) {
                                    console.error('Error leaving community:', error);
                                    alert('Failed to leave community');
                                  } finally {
                                    setSubmittingFollow(null);
                                  }
                                }}
                                disabled={submittingFollow === skillId}
                                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                              >
                                {submittingFollow === skillId ? 'Leaving...' : 'Leave'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {followedSkills.length > 5 && (
                        <div className="pt-1 text-center text-xs text-gray-500 dark:text-gray-400">
                          +{followedSkills.length - 5} more
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                      You're not part of any learning communities yet. Join a skill community to see
                      activity in your feed.
                    </p>
                  )}

                  <Link
                    href="/skills/explore"
                    className="block w-full rounded-lg bg-purple-600 px-4 py-2 text-center font-medium text-white transition-colors hover:bg-purple-700"
                  >
                    🔍 Explore All Skills
                  </Link>
                </div>
              </div>
            </div>

            {/* Profile Section - Collapsible */}
            <div className="relative mb-8">
              {/* Subtle radial gradient hint */}
              <div
                className="pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-30"
                style={{
                  background:
                    'radial-gradient(circle at center, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
                }}
              />
              <button
                onClick={() => setExpandedSections((prev) => ({ ...prev, profile: !prev.profile }))}
                className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white p-3 text-left transition-all duration-200 hover:bg-gray-50 hover:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                <span className="pointer-events-none text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Edit Profile
                </span>
                <span className="pointer-events-none text-gray-500 dark:text-gray-400">
                  {expandedSections.profile ? '▼' : '▶'}
                </span>
              </button>
              {expandedSections.profile && (
                <div className="mt-3 space-y-3">
                  {/* Action Links */}
                  <Link
                    href="/me/profile"
                    className="relative block rounded-lg border border-gray-300 bg-white p-3 text-center transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
                  >
                    Edit Information
                    {hasProfile === false && (
                      <span
                        className="absolute right-2 top-2 animate-pulse rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-medium text-white"
                        title="Create your profile"
                      >
                        ⭐
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/me/skills"
                    className="block rounded-lg border border-gray-300 bg-white p-3 text-center transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
                  >
                    Edit Skills
                  </Link>
                  <Link
                    href="/me/availability"
                    className="block rounded-lg border border-gray-300 bg-white p-3 text-center transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
                  >
                    Edit Availability
                  </Link>
                </div>
              )}
            </div>

            {/* Skill Garden Section - Removed, now integrated into Skills Learning box above */}
            {/* Community Section - Removed */}
          </div>
        </div>
      </div>
    </BetaGate>
  );
}
