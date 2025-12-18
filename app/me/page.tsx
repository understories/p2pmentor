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
import { GardenLayer } from '@/components/garden/GardenLayer';
import { profileToGardenSkills, type GardenSkill } from '@/lib/garden/types';
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

export default function MePage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [gardenSkills, setGardenSkills] = useState<GardenSkill[]>([]);
  const [allSystemSkills, setAllSystemSkills] = useState<GardenSkill[]>([]);
  const [onboardingChecked, setOnboardingChecked] = useState(false); // Track if onboarding check completed
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [followedSkills, setFollowedSkills] = useState<string[]>([]);
  const [submittingFollow, setSubmittingFollow] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [avgRating, setAvgRating] = useState<number>(0);
  const [ratingCalculation, setRatingCalculation] = useState<{ totalRatings: number; average: number }>({ totalRatings: 0, average: 0 });
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [sessionsUpcoming, setSessionsUpcoming] = useState(0);
  const [asksCount, setAsksCount] = useState(0);
  const [offersCount, setOffersCount] = useState(0);
  const [asks, setAsks] = useState<Ask[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [skillsLearningCount, setSkillsLearningCount] = useState(0); // Count from learning_follow entities
  const [profileSkillsCount, setProfileSkillsCount] = useState(0); // Count from profile.skill_ids or profile.skillsArray
  const [learnerQuestCompletion, setLearnerQuestCompletion] = useState<{ percent: number; readCount: number; totalMaterials: number } | null>(null);
  const [individualQuestProgress, setIndividualQuestProgress] = useState<Array<{
    questId: string;
    title: string;
    questType: 'reading_list' | 'language_assessment';
    progressPercent: number;
    readCount?: number;
    totalMaterials?: number;
  }>>([]);
  const arkivBuilderMode = useArkivBuilderMode();
  const skillProfileCounts = useSkillProfileCounts();
  const [expandedSections, setExpandedSections] = useState<{
    profile: boolean;
  }>({
    profile: true, // Default to expanded
  });
  const router = useRouter();
  const { level } = useOnboardingLevel(walletAddress);

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
        setExpandedSections(prev => ({ ...prev, profile: true }));
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }
      
      // Check onboarding access (requires level 1 for dashboard - at least profile + skills)
      // Level 0 = no profile, Level 1 = profile + skills, Level 2+ = has ask/offer
      // Dashboard should be accessible once user has profile and skills (they can create asks/offers from dashboard)
      import('@/lib/onboarding/access').then(({ checkOnboardingRoute }) => {
        checkOnboardingRoute(address, 1, '/onboarding').then((hasAccess) => {
          setOnboardingChecked(true); // Mark check as complete
          if (hasAccess) {
            // Has access - continue loading
            loadNotificationCount(address);
            loadProfileStatus(address);
          }
          // If no access, checkOnboardingRoute will redirect
        }).catch(() => {
          // On error, allow access (don't block on calculation failure)
          setOnboardingChecked(true);
          loadNotificationCount(address);
          loadProfileStatus(address);
        });
      });
      
      // Load all system skills for background garden
      loadAllSystemSkills();
      
      // Load all skills and followed communities for join/leave functionality
      if (address) {
        Promise.all([
          listSkills({ status: 'active', limit: 200 }),
          listLearningFollows({ profile_wallet: address, active: true }),
        ]).then(([skills, follows]) => {
          setAllSkills(skills);
          setFollowedSkills(follows.map(f => f.skill_id));
          setSkillsLearningCount(follows.length);
        }).catch(() => {
          // Skills or follows not found - that's okay
        });
        
        // Load sessions and feedback for stats
        loadSessionStats(address);
        loadFeedbackStats(address);
        loadAsksAndOffers(address);
        loadLearnerQuestCompletion(address);
      }
      
      // Poll for notifications and profile status every 30 seconds (only if profile exists)
      const interval = setInterval(() => {
        if (hasProfile !== false) { // Only poll if we know profile exists or haven't checked yet
          loadNotificationCount(address);
          loadProfileStatus(address);
        }
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [router, hasProfile]);
  
  const loadAllSystemSkills = async () => {
    try {
      const { listSkills } = await import('@/lib/arkiv/skill');
      const skills: Skill[] = await listSkills({ status: 'active', limit: 100 });
      
      // Convert to GardenSkill format (all as sprout emojis, level 0)
      // Use skill.key as id to match learningSkillIds (skill entity keys)
      const gardenSkills: GardenSkill[] = skills.map((skill) => ({
        id: skill.key, // Use key to match learningSkillIds
        name: skill.name_canonical,
        level: 0, // All as sprout emojis for now
      }));
      
      setAllSystemSkills(gardenSkills);
    } catch (error) {
      console.error('Error loading all system skills:', error);
    }
  };

  const loadNotificationCount = async (wallet: string) => {
    try {
      // Normalize wallet to lowercase for consistent querying (same as notifications page)
      const normalizedWallet = wallet.toLowerCase().trim();
      const res = await fetch(`/api/notifications?wallet=${encodeURIComponent(normalizedWallet)}&status=active`);
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
        const skills = profileToGardenSkills(profileData.skillsArray, profileData.skillExpertise);
        setGardenSkills(skills);
        
        // Count skills from profile (skill_ids or skillsArray)
        const skillIds = (profileData as any).skill_ids || [];
        const skillsArray = profileData.skillsArray || [];
        const profileSkills = skillIds.length > 0 ? skillIds.length : skillsArray.length;
        setProfileSkillsCount(profileSkills);
      } else {
        setProfileSkillsCount(0);
      }
    } catch (err) {
      console.error('Error loading profile status:', err);
      setHasProfile(null);
      setProfile(null);
      setProfileSkillsCount(0);
    }
  };

  const loadSessionStats = async (wallet: string) => {
    try {
      const allSessions = await listSessionsForWallet(wallet);
      setSessions(allSessions);
      
      const now = Date.now();
      const completed = allSessions.filter(s => {
        if (s.status === 'completed') return true;
        // Also count past scheduled sessions as completed
        if (s.status === 'scheduled') {
          const sessionTime = new Date(s.sessionDate).getTime();
          const sessionEnd = sessionTime + (s.duration || 60) * 60 * 1000;
          return sessionEnd < now;
        }
        return false;
      }).length;
      
      const upcoming = allSessions.filter(s => {
        if (s.status !== 'scheduled') return false;
        const sessionTime = new Date(s.sessionDate).getTime();
        return sessionTime > now;
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
      const activeAsks = asksData.filter(ask => {
        if (ask.status !== 'open') return false;
        // Check if expired
        if (ask.createdAt && ask.ttlSeconds) {
          const createdAt = new Date(ask.createdAt).getTime();
          const expiresAt = createdAt + (ask.ttlSeconds * 1000);
          return expiresAt > now;
        }
        return true;
      });
      
      const activeOffers = offersData.filter(offer => {
        if (offer.status !== 'active') return false;
        // Check if expired
        if (offer.createdAt && offer.ttlSeconds) {
          const createdAt = new Date(offer.createdAt).getTime();
          const expiresAt = createdAt + (offer.ttlSeconds * 1000);
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
      const receivedFeedback = allFeedback.filter(f => 
        f.feedbackTo.toLowerCase() === wallet.toLowerCase()
      );
      
      // Extract ratings from received feedback
      const ratings = receivedFeedback
        .map(f => f.rating)
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

      // Load progress for all quests in parallel (both reading_list and language_assessment)
      const progressPromises = allQuests.map(async (quest: any) => {
        try {
          if (quest.questType === 'reading_list') {
            const res = await fetch(`/api/learner-quests/progress?questId=${quest.questId}&wallet=${walletAddress}`);
            const data = await res.json();

            if (data.ok && data.progress && quest.materials) {
              const readCount = Object.values(data.progress).filter((p: any) => p.status === 'read').length;
              const totalMaterials = quest.materials.length;
              const progressPercent = totalMaterials > 0 ? Math.round((readCount / totalMaterials) * 100) : 0;
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
          } else if (quest.questType === 'language_assessment') {
            // Load assessment results for language assessments
            try {
              const resultRes = await fetch(`/api/learner-quests/assessment/result?questId=${quest.questId}&wallet=${walletAddress}`);
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
            } catch (err) {
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

      const readingListResults = validResults.filter(r => r.questType === 'reading_list');
      const totalRead = readingListResults.reduce((sum, r) => sum + (r.readCount || 0), 0);
      const totalMaterials = readingListResults.reduce((sum, r) => sum + (r.totalMaterials || 0), 0);
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
        <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-pulse text-2xl mb-4">🌱</div>
            <p className="text-gray-600 dark:text-gray-400">Loading your garden...</p>
          </div>
        </div>
      </BetaGate>
    );
  }

  return (
    <BetaGate>
    <div className="min-h-screen relative text-gray-900 dark:text-gray-100 pb-24">
      {/* Forest Background */}
      <BackgroundImage />
      
      {/* Garden Layer - persistent garden showing all system skills, with user's skills glowing */}
      <GardenLayer 
        skills={gardenSkills} 
        allSkills={allSystemSkills}
        skillProfileCounts={skillProfileCounts}
        learningSkillIds={followedSkills}
      />
      
      <div className="relative z-10 p-4 backdrop-blur-sm">
      <div className="max-w-2xl mx-auto">
        
        {/* Profile Avatar with EIS */}
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
          {profile?.displayName ? (
            <>
              <h1 className="text-2xl font-semibold mb-1 text-gray-900 dark:text-gray-100">
                {profile.displayName}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-mono break-all">
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
                    <div className="mt-1 text-xs text-gray-400 dark:text-gray-500 font-mono">
                      Key: {profile.key.slice(0, 16)}...
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold mb-1 text-gray-900 dark:text-gray-100">
                Your Dashboard
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-mono break-all">
                {walletAddress}
              </p>
            </>
          )}
        </div>

        {/* Profile Completeness Indicator */}
        {hasProfile && profile && (() => {
          const completeness = calculateProfileCompleteness(profile);
          if (completeness.percentage < 100) {
            return (
              <div className="mb-6 p-4 bg-yellow-50/80 dark:bg-yellow-900/30 backdrop-blur-sm border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-yellow-900 dark:text-yellow-200">
                    Profile {completeness.percentage}% Complete
                  </span>
                  <Link
                    href="/me/profile"
                    className="text-sm text-yellow-800 dark:text-yellow-300 hover:underline"
                  >
                    Complete →
                  </Link>
                </div>
                <div className="w-full bg-yellow-200 dark:bg-yellow-800 rounded-full h-2 mb-2">
                  <div
                    className="bg-yellow-600 dark:bg-yellow-400 h-2 rounded-full transition-all"
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
            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm space-y-3">
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
                      <div>type='user_profile',</div>
                      <div>wallet='{walletAddress?.slice(0, 8)}...'</div>
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
              
              {profile.timezone && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Timezone</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{profile.timezone}</p>
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
                      <a href={profile.contactLinks.twitter.startsWith('http') ? profile.contactLinks.twitter : `https://x.com/${profile.contactLinks.twitter.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                        Twitter
                      </a>
                    )}
                    {profile.contactLinks.github && (
                      <a href={profile.contactLinks.github.startsWith('http') ? profile.contactLinks.github : `https://github.com/${profile.contactLinks.github.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
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
            </div>
          </div>
        )}

        {/* Profile Stats - Always visible */}
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Sessions Completed */}
            <Link
              href="/me/sessions"
              className="group relative p-3 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-900/30 backdrop-blur-sm text-center cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md transition-all duration-200"
            >
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {sessionsCompleted}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Sessions Completed</p>
              {/* Tooltip */}
              {arkivBuilderMode && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  <div className="font-mono text-left">
                    <div>Arkiv query: type='session',</div>
                    <div>profile_wallet='{walletAddress?.slice(0, 8)}...'</div>
                    <div>(as mentor OR learner),</div>
                    <div>status='completed' OR</div>
                    <div>(status='scheduled' AND sessionDate &lt; now)</div>
                    <div className="mt-1 pt-1 border-t border-gray-700 text-[10px] text-gray-500">
                      Queries: mentorWallet OR learnerWallet
                    </div>
                  </div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                </div>
              )}
              {/* Arkiv Builder Mode: Show session entities */}
              {arkivBuilderMode && sessions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Session Entities:</div>
                  {sessions.filter(s => s.status === 'completed' || (s.status === 'scheduled' && new Date(s.sessionDate || 0) < new Date())).slice(0, 3).map(session => (
                    <div key={session.key} className="text-xs flex items-center gap-2 mt-1">
                      <ViewOnArkivLink
                        entityKey={session.key}
                        txHash={session.txHash}
                        label=""
                        className="text-xs"
                        icon="🔗"
                      />
                      <span className="text-gray-400 dark:text-gray-500 font-mono">
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
              className="group relative p-3 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50/80 dark:bg-blue-900/30 backdrop-blur-sm text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all duration-200"
            >
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {sessionsUpcoming}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Upcoming Sessions</p>
              {/* Tooltip */}
              {arkivBuilderMode && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  <div className="font-mono text-left">
                    <div>Arkiv query: type='session',</div>
                    <div>profile_wallet='{walletAddress?.slice(0, 8)}...'</div>
                    <div>(as mentor OR learner),</div>
                    <div>status='scheduled' AND</div>
                    <div>sessionDate &gt; now</div>
                    <div className="mt-1 pt-1 border-t border-gray-700 text-[10px] text-gray-500">
                      Queries: mentorWallet OR learnerWallet
                    </div>
                  </div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                </div>
              )}
            </Link>

            {/* Asks */}
            <Link
              href="/asks"
              className="group relative p-3 rounded-lg border border-purple-200 dark:border-purple-700 bg-purple-50/80 dark:bg-purple-900/30 backdrop-blur-sm text-center cursor-pointer hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition-all duration-200"
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
                    `Each ask is a type='ask' entity on Arkiv`
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
              className="group relative p-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-900/30 backdrop-blur-sm text-center cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-md transition-all duration-200"
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
                    `Each offer is a type='offer' entity on Arkiv`
                  ]}
                  label="Offers"
                >
                  <div className="absolute inset-0" />
                </ArkivQueryTooltip>
              )}
            </Link>

            {/* Learner Quests - Full Width Row */}
            {individualQuestProgress.length > 0 && (
              <Link
                href="/learner-quests"
                className="col-span-2 group relative p-4 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-900/30 backdrop-blur-sm hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md transition-all duration-200 cursor-pointer"
              >
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Reading Lists Section */}
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Reading Lists
                    </h3>
                    <div className="space-y-2">
                      {individualQuestProgress
                        .filter(q => q.questType === 'reading_list')
                        .map((quest) => (
                          <div
                            key={quest.questId}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-gray-700 dark:text-gray-300 truncate flex-1">
                              {quest.title}
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-2">
                              {quest.progressPercent}%
                            </span>
                          </div>
                        ))}
                      {individualQuestProgress.filter(q => q.questType === 'reading_list').length === 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">No reading list quests</p>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="w-px bg-emerald-200 dark:bg-emerald-700"></div>

                  {/* Language Assessments Section */}
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Language Assessments
                    </h3>
                    <div className="space-y-2">
                      {individualQuestProgress
                        .filter(q => q.questType === 'language_assessment')
                        .map((quest) => (
                          <div
                            key={quest.questId}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-gray-700 dark:text-gray-300 truncate flex-1">
                              {quest.title}
                            </span>
                            <span className="text-blue-600 dark:text-blue-400 font-medium ml-2">
                              {quest.progressPercent}%
                            </span>
                          </div>
                        ))}
                      {individualQuestProgress.filter(q => q.questType === 'language_assessment').length === 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">No language assessments</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tooltip */}
                {arkivBuilderMode && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                    <div className="font-mono text-left">
                      <div>GET /api/learner-quests</div>
                      <div>→ listLearnerQuests()</div>
                      <div>→ type='learner_quest', status='active'</div>
                      <div className="mt-1 pt-1 border-t border-gray-700 text-[10px] text-gray-500">
                        For each quest: GET /api/learner-quests/progress
                      </div>
                      <div className="text-[10px] text-gray-500">
                        → type='learner_quest_progress', wallet='...', questId='...'
                      </div>
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                  </div>
                )}
              </Link>
            )}
            
            {/* Average Rating */}
            <div className="group relative p-3 rounded-lg border border-yellow-200 dark:border-yellow-700 bg-yellow-50/80 dark:bg-yellow-900/30 backdrop-blur-sm text-center cursor-help">
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {avgRating.toFixed(1)} ⭐
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Average Rating</p>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                <div className="font-mono text-left">
                  {ratingCalculation.totalRatings > 0 && (
                    <div className="mb-1">
                      from {ratingCalculation.totalRatings} rating{ratingCalculation.totalRatings !== 1 ? 's' : ''}
                    </div>
                  )}
                  <div>Arkiv query: type='session_feedback',</div>
                  <div>feedbackTo='{walletAddress?.slice(0, 8)}...'</div>
                </div>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
              </div>
            </div>
            
            {/* Skills Learning - Full Width Row (Skill Garden) */}
            <div className="col-span-2 group relative p-4 rounded-lg border border-purple-200 dark:border-purple-700 bg-purple-50/80 dark:bg-purple-900/30 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
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
                      `→ User needs to manually join communities`
                    ]}
                    label="Skills Learning Queries"
                  >
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono cursor-help border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-gray-50 dark:bg-gray-800">
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
                <div className="space-y-2 mb-4">
                  {followedSkills.slice(0, 5).map((skillId) => {
                    const skillEntity = allSkills.find(s => s.key === skillId);
                    if (!skillEntity) return null;

                    const skillLink = skillEntity.slug ? `/topic/${skillEntity.slug}` : '#';

                    return (
                      <div
                        key={skillId}
                        className="flex items-center justify-between p-2 rounded bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700"
                      >
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {skillEntity.name_canonical}
                        </span>
                        <div className="flex items-center gap-2">
                          <Link
                            href={skillLink}
                            className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
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
                                  await new Promise(resolve => setTimeout(resolve, 1500));
                                  const follows = await listLearningFollows({ profile_wallet: walletAddress, active: true });
                                  setFollowedSkills(follows.map(f => f.skill_id));
                                  setSkillsLearningCount(follows.length);
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
                            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {submittingFollow === skillId ? 'Leaving...' : 'Leave'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {followedSkills.length > 5 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-1">
                      +{followedSkills.length - 5} more
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  You're not part of any learning communities yet. Join a skill community to see activity in your feed.
                </p>
              )}

              <Link
                href="/skills/explore"
                className="block w-full px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-center transition-colors"
              >
                🔍 Explore All Skills
              </Link>

            </div>
          </div>
        </div>

        {/* Profile Section - Collapsible */}
        <div className="mb-8 relative">
          {/* Subtle radial gradient hint */}
          <div 
            className="absolute inset-0 rounded-2xl opacity-30 pointer-events-none -z-10"
            style={{
              background: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
            }}
          />
          <button
            onClick={() => setExpandedSections(prev => ({ ...prev, profile: !prev.profile }))}
            className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md transition-all duration-200 text-left cursor-pointer"
          >
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 pointer-events-none">Edit Profile</span>
            <span className="text-gray-500 dark:text-gray-400 pointer-events-none">
              {expandedSections.profile ? '▼' : '▶'}
            </span>
          </button>
          {expandedSections.profile && (
            <div className="mt-3 space-y-3">
              {/* Action Links */}
              <Link
                href="/me/profile"
                className="relative block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center"
              >
                Edit Information
                {hasProfile === false && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium bg-yellow-500 text-white rounded-full animate-pulse" title="Create your profile">
                    ⭐
                  </span>
                )}
              </Link>
              <Link
                href="/me/skills"
                className="block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center"
              >
                Edit Skills
              </Link>
              <Link
                href="/me/availability"
                className="block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center"
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

