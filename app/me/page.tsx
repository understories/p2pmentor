/**
 * User dashboard page
 * 
 * Main landing page after authentication.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
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
import { ArkivBuilderModeToggle } from '@/components/ArkivBuilderModeToggle';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';

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
  const [skillsLearningCount, setSkillsLearningCount] = useState(0);
  const [arkivBuilderMode, setArkivBuilderMode] = useState(false);

  // Sync Arkiv Builder Mode to localStorage for sidebar access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('arkiv_builder_mode', String(arkivBuilderMode));
    }
  }, [arkivBuilderMode]);

  // Load Arkiv Builder Mode from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('arkiv_builder_mode');
      if (saved === 'true') {
        setArkivBuilderMode(true);
      }
    }
  }, []);
  const [expandedSections, setExpandedSections] = useState<{
    profile: boolean;
    skillGarden: boolean;
    community: boolean;
  }>({
    profile: true, // Default to expanded
    skillGarden: false,
    community: false,
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
      const gardenSkills: GardenSkill[] = skills.map((skill) => ({
        id: skill.slug || skill.key,
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
      const res = await fetch(`/api/notifications?wallet=${wallet}&status=active`);
      const data = await res.json();
      if (!data.ok) return;
      
      // Count unread notifications
      // Check localStorage for notification preferences to determine read status
      const notifications = data.notifications || [];
      let unreadCount = 0;
      
      notifications.forEach((n: any) => {
        const notificationId = n.key;
        const prefStr = localStorage.getItem(`notification_pref_${notificationId}`);
        if (prefStr) {
          try {
            const pref = JSON.parse(prefStr);
            if (!pref.read && !pref.archived) {
              unreadCount++;
            }
          } catch (e) {
            // If pref can't be parsed, treat as unread
            unreadCount++;
          }
        } else {
          // No preference stored, treat as unread
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
      }
    } catch (err) {
      console.error('Error loading profile status:', err);
      setHasProfile(null);
      setProfile(null);
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
      <GardenLayer skills={gardenSkills} allSkills={allSystemSkills} />
      
      <div className="relative z-10 p-4">
        <div className="flex justify-between items-center mb-4">
          <ThemeToggle />
          <ArkivBuilderModeToggle enabled={arkivBuilderMode} onToggle={setArkivBuilderMode} />
        </div>
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
            </div>
          </div>
        )}

        {/* Profile Stats - Always visible */}
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Sessions Completed */}
            <div className="group relative p-3 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-900/30 backdrop-blur-sm text-center cursor-help">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {sessionsCompleted}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Sessions Completed</p>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                <div className="font-mono text-left">
                  <div>Arkiv query: type='session',</div>
                  <div>(mentorWallet='{walletAddress?.slice(0, 8)}...' OR</div>
                  <div>learnerWallet='{walletAddress?.slice(0, 8)}...'),</div>
                  <div>status='completed' OR</div>
                  <div>(status='scheduled' AND sessionDate &lt; now)</div>
                </div>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
              </div>
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
            </div>
            
            {/* Upcoming Sessions */}
            <div className="group relative p-3 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50/80 dark:bg-blue-900/30 backdrop-blur-sm text-center cursor-help">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {sessionsUpcoming}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Upcoming Sessions</p>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                <div className="font-mono text-left">
                  <div>Arkiv query: type='session',</div>
                  <div>(mentorWallet='{walletAddress?.slice(0, 8)}...' OR</div>
                  <div>learnerWallet='{walletAddress?.slice(0, 8)}...'),</div>
                  <div>status='scheduled' AND</div>
                  <div>sessionDate &gt; now</div>
                </div>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
              </div>
            </div>
            
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
            
            {/* Skills Learning */}
            <div className="group relative p-3 rounded-lg border border-purple-200 dark:border-purple-700 bg-purple-50/80 dark:bg-purple-900/30 backdrop-blur-sm text-center cursor-help">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {skillsLearningCount}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Skills Learning</p>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                <div className="font-mono text-left">
                  <div>Arkiv query: type='learning_follow',</div>
                  <div>profile_wallet='{walletAddress?.slice(0, 8)}...',</div>
                  <div>active=true</div>
                </div>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
              </div>
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

        {/* Skill Garden Section - Collapsible */}
        <div className="mb-8 relative">
          {/* Subtle radial gradient hint */}
          <div 
            className="absolute inset-0 rounded-2xl opacity-30 pointer-events-none -z-10"
            style={{
              background: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
            }}
          />
          <button
            onClick={() => setExpandedSections(prev => ({ ...prev, skillGarden: !prev.skillGarden }))}
            className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md transition-all duration-200 text-left cursor-pointer"
          >
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 pointer-events-none">Skill Garden</span>
            <span className="text-gray-500 dark:text-gray-400 pointer-events-none">
              {expandedSections.skillGarden ? '▼' : '▶'}
            </span>
          </button>
          {expandedSections.skillGarden && (
            <div className="mt-3 space-y-3">
              <Link
                href="/garden/public-board"
                className="block p-3 rounded-lg border border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center font-medium"
              >
                🌱 Public Garden Board
              </Link>
              {walletAddress && gardenSkills.length > 0 && (() => {
                // Deduplicate skills by name (case-insensitive) - keep first occurrence
                const seenSkills = new Set<string>();
                const uniqueSkills = gardenSkills.filter((skill) => {
                  const normalizedName = skill.name.toLowerCase().trim();
                  if (seenSkills.has(normalizedName)) {
                    return false;
                  }
                  seenSkills.add(normalizedName);
                  return true;
                });
                
                return (
                  <div className="space-y-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      Your Skills
                    </div>
                    <div className="space-y-2">
                      {uniqueSkills.map((gardenSkill) => {
                        // Find matching skill entity by name or slug
                        const skillEntity = allSkills.find(s => 
                          s.name_canonical?.toLowerCase().trim() === gardenSkill.name.toLowerCase().trim() ||
                          s.slug?.toLowerCase().trim() === gardenSkill.name.toLowerCase().trim().replace(/\s+/g, '-')
                        );
                        const isJoined = skillEntity ? followedSkills.includes(skillEntity.key) : false;
                        
                        // Handle click to ensure skill entity exists before navigating
                        const handleViewCommunity = async (e: React.MouseEvent) => {
                          e.preventDefault();
                          const { getSkillTopicLink } = await import('@/lib/arkiv/skill-helpers');
                          const topicLink = await getSkillTopicLink(gardenSkill.name);
                          if (topicLink) {
                            window.location.href = topicLink;
                          } else {
                            // Fallback to network page if skill creation fails
                            window.location.href = `/network?skill=${encodeURIComponent(gardenSkill.name)}`;
                          }
                        };
                        
                        const skillLink = skillEntity ? `/topic/${skillEntity.slug}` : '#';
                        
                        return (
                          <div
                            key={gardenSkill.id}
                            className="flex items-center justify-between p-2 rounded bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-700"
                          >
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {gardenSkill.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="relative group/link">
                                <Link
                                  href={skillLink}
                                  onClick={!skillEntity ? handleViewCommunity : undefined}
                                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                                >
                                  View Community →
                                </Link>
                                {/* Arkiv Builder Mode: Query Tooltip */}
                                {arkivBuilderMode && skillEntity && (
                                  <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/link:opacity-100 transition-opacity duration-200 pointer-events-none z-10 font-mono text-left whitespace-nowrap">
                                    <div className="font-semibold mb-1">Skill Query:</div>
                                    <div>type='skill',</div>
                                    <div>slug='{skillEntity.slug || 'N/A'}'</div>
                                    {skillEntity.key && (
                                      <>
                                        <div className="mt-2 pt-2 border-t border-gray-700">
                                          <div className="text-xs text-gray-400">Entity Key:</div>
                                          <div className="text-xs">{skillEntity.key.slice(0, 16)}...</div>
                                        </div>
                                      </>
                                    )}
                                    <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                                  </div>
                                )}
                              </div>
                              {skillEntity && (
                                <div className="relative group/button">
                                  <button
                                    onClick={async () => {
                                      if (!walletAddress || !skillEntity.key || submittingFollow === skillEntity.key) return;
                                      
                                      const action = isJoined ? 'unfollow' : 'follow';
                                      setSubmittingFollow(skillEntity.key);
                                      try {
                                        const res = await fetch('/api/learning-follow', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            action,
                                            profile_wallet: walletAddress,
                                            skill_id: skillEntity.key,
                                          }),
                                        });
                                        
                                        const data = await res.json();
                                        if (data.ok) {
                                          // Wait for Arkiv to index the new entity (especially important for joins)
                                          await new Promise(resolve => setTimeout(resolve, 1500));
                                          // Reload followed skills
                                          const follows = await listLearningFollows({ profile_wallet: walletAddress, active: true });
                                          setFollowedSkills(follows.map(f => f.skill_id));
                                        } else {
                                          alert(data.error || `Failed to ${isJoined ? 'leave' : 'join'} community`);
                                        }
                                      } catch (error: any) {
                                        console.error(`Error ${isJoined ? 'leaving' : 'joining'} community:`, error);
                                        alert(`Failed to ${isJoined ? 'leave' : 'join'} community`);
                                      } finally {
                                        setSubmittingFollow(null);
                                      }
                                    }}
                                    disabled={submittingFollow === skillEntity.key}
                                    className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {submittingFollow === skillEntity.key 
                                      ? (isJoined ? 'Leaving...' : 'Joining...') 
                                      : (isJoined ? 'Leave' : 'Join')
                                    }
                                  </button>
                                  {/* Arkiv Builder Mode: Entity Creation Tooltip */}
                                  {arkivBuilderMode && (
                                    <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/button:opacity-100 transition-opacity duration-200 pointer-events-none z-10 font-mono text-left whitespace-nowrap">
                                      <div className="font-semibold mb-1">Creates Entity:</div>
                                      <div>type='learning_follow',</div>
                                      <div>profile_wallet='{walletAddress?.slice(0, 8)}...',</div>
                                      <div>skill_id='{skillEntity.key.slice(0, 8)}...',</div>
                                      <div>active={isJoined ? 'false' : 'true'}</div>
                                      <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400">
                                        {isJoined ? 'Unfollow: Creates new entity with active=false' : 'Follow: Creates new entity with active=true'}
                                      </div>
                                      <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* Explore Other Skills */}
              <Link
                href="/skills/explore"
                className="block p-3 rounded-lg border border-blue-300 dark:border-blue-600 bg-blue-50/80 dark:bg-blue-900/30 backdrop-blur-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center font-medium"
              >
                🔍 Explore Other Skills
              </Link>
              <div className="block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed text-center">
                Learning Quests (Coming Soon)
              </div>
            </div>
          )}
        </div>

        {/* Community Section - Collapsible */}
        <div className="relative">
          {/* Subtle radial gradient hint */}
          <div 
            className="absolute inset-0 rounded-2xl opacity-30 pointer-events-none -z-10"
            style={{
              background: 'radial-gradient(circle at center, rgba(168, 85, 247, 0.08) 0%, transparent 70%)',
            }}
          />
          <button
            onClick={() => setExpandedSections(prev => ({ ...prev, community: !prev.community }))}
            className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md transition-all duration-200 text-left cursor-pointer"
          >
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 pointer-events-none">Community</span>
            <span className="text-gray-500 dark:text-gray-400 pointer-events-none">
              {expandedSections.community ? '▼' : '▶'}
            </span>
          </button>
          {expandedSections.community && (
            <div className="mt-3 space-y-3">
              <Link
                href="/network"
                className="block p-3 rounded-lg border border-blue-300 dark:border-blue-600 bg-blue-50/80 dark:bg-blue-900/30 backdrop-blur-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center font-medium"
              >
                🌐 Browse Network
              </Link>
              <Link
                href="/me/sessions"
                className="block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center"
              >
                📅 Sessions
              </Link>
              <Link
                href="/notifications"
                className="relative block p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center"
              >
                🔔 Notifications
                {notificationCount > 0 && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium bg-emerald-600 dark:bg-emerald-500 text-white rounded-full">
                    {notificationCount}
                  </span>
                )}
              </Link>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
    </BetaGate>
  );
}

