/**
 * Sidebar Navigation Component (Desktop)
 *
 * Phase 0: Simple vertical nav with icons + labels.
 * Same sections as bottom nav.
 */

'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNotificationCount } from '@/lib/hooks/useNotificationCount';
import { navTokens } from '@/lib/design/navTokens';
import { ConstellationLines } from '@/components/navigation/ConstellationLines';
import { useOnboardingLevel } from '@/lib/onboarding/useOnboardingLevel';
import { hasOnboardingBypass, hasReviewModeBypass } from '@/lib/onboarding/access';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { profileToGardenSkills, levelToEmoji } from '@/lib/garden/types';
import { listSessionsForWallet } from '@/lib/arkiv/sessions';
import { formatSessionTitle } from '@/lib/sessions/display';
import { listLearningFollows } from '@/lib/arkiv/learningFollow';
import { listSkills, normalizeSkillSlug } from '@/lib/arkiv/skill';
import type { UserProfile } from '@/lib/arkiv/profile';
import type { Session } from '@/lib/arkiv/sessions';
import type { Skill } from '@/lib/arkiv/skill';
import type { LearningFollow } from '@/lib/arkiv/learningFollow';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
}

interface SidebarNavProps {
  allowOnExplorer?: boolean; // Explicit opt-in for explorer rendering
  nested?: boolean; // If true, render without fixed positioning (for nesting in ExplorerSidebar)
}

export function SidebarNav({ allowOnExplorer = false, nested = false }: SidebarNavProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const notificationCount = useNotificationCount();
  const [hoveredIndex, setHoveredIndex] = useState<number | undefined>();

  // Get onboarding level for navigation unlocking
  const [wallet, setWallet] = useState<string | null>(null);
  const { level, error: levelError } = useOnboardingLevel(wallet);
  const [gardenSkills, setGardenSkills] = useState<any[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [skillsMap, setSkillsMap] = useState<Record<string, Skill>>({});
  const [followedCommunities, setFollowedCommunities] = useState<LearningFollow[]>([]);
  const [arkivBuilderMode, setArkivBuilderMode] = useState(false);
  const [pendingConfirmationsCount, setPendingConfirmationsCount] = useState(0);
  const [showOnboardingPopup, setShowOnboardingPopup] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Load Arkiv Builder Mode from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('arkiv_builder_mode');
      setArkivBuilderMode(saved === 'true');

      // Listen for changes from other components
      const handleStorageChange = () => {
        const updated = localStorage.getItem('arkiv_builder_mode');
        setArkivBuilderMode(updated === 'true');
      };
      window.addEventListener('storage', handleStorageChange);
      // Also check periodically (since storage event doesn't fire in same tab)
      const interval = setInterval(() => {
        const updated = localStorage.getItem('arkiv_builder_mode');
        if ((updated === 'true') !== arkivBuilderMode) {
          setArkivBuilderMode(updated === 'true');
        }
      }, 500);

      return () => {
        window.removeEventListener('storage', handleStorageChange);
        clearInterval(interval);
      };
    }
  }, [arkivBuilderMode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedWallet = localStorage.getItem('wallet_address');
      setWallet(storedWallet);

      // Load user profile to check if they're an existing user
      if (storedWallet) {
        getProfileByWallet(storedWallet)
          .then((profile) => {
            setUserProfile(profile);
          })
          .catch(() => {
            // Profile not found - that's okay, user is new
            setUserProfile(null);
          });
      }

      // Load all skills for mapping skill_id to name_canonical
      // This is used to display skill names in sessions sidebar
      // CRITICAL: Load skills first so skillsMap is ready when sessions render
      listSkills({ status: 'active', limit: 200 })
        .then((skills) => {
          const map: Record<string, Skill> = {};
          skills.forEach((skill) => {
            map[skill.key] = skill;
            // Also index by slug for community session lookups
            if (skill.slug) {
              map[skill.slug] = skill;
            }
          });
          setSkillsMap(map);

          // Only load sessions AFTER skills map is ready to avoid race condition
          if (storedWallet) {
            loadSessionsAndProfile(storedWallet);
          }
        })
        .catch((error) => {
          console.error('[SidebarNav] Error loading skills:', error);
          // Still try to load sessions even if skills fail
          if (storedWallet) {
            loadSessionsAndProfile(storedWallet);
          }
        });

      // Poll for session updates every 30 seconds to reflect confirmations
      // This ensures the sidebar updates automatically when sessions are confirmed
      // without requiring manual page refresh
      let interval: NodeJS.Timeout | null = null;
      if (storedWallet) {
        interval = setInterval(() => {
          loadSessionsAndProfile(storedWallet);
        }, 30000); // 30 seconds - same interval as notifications polling
      }

      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    }
  }, []); // Empty deps - only run on mount

  // Separate function to load sessions and profile data
  const loadSessionsAndProfile = (wallet: string) => {
    // Load garden skills
    getProfileByWallet(wallet)
      .then((profile: UserProfile | null) => {
        if (profile) {
          const skills = profileToGardenSkills(profile.skillsArray, profile.skillExpertise);
          setGardenSkills(skills);
        }
      })
      .catch((error) => {
        console.error('[SidebarNav] Error loading profile:', error);
      });

    // Load upcoming sessions - CRITICAL: This must work for sessions to show
    listSessionsForWallet(wallet)
      .then((sessions: Session[]) => {
        const now = Date.now();
        const upcoming = sessions
          .filter((s) => {
            // Only show scheduled sessions that haven't ended yet
            if (s.status !== 'scheduled') return false;
            const sessionTime = new Date(s.sessionDate).getTime();
            const duration = (s.duration || 60) * 60 * 1000; // Convert minutes to milliseconds
            const buffer = 60 * 60 * 1000; // 1 hour buffer
            const sessionEnd = sessionTime + duration + buffer;
            return now < sessionEnd;
          })
          .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime())
          .slice(0, 3); // Show up to 3 upcoming sessions
        console.log('[SidebarNav] Loaded sessions:', {
          total: sessions.length,
          upcoming: upcoming.length,
          upcomingSessions: upcoming,
        });
        setUpcomingSessions(upcoming);

        // Check for pending sessions that need user confirmation
        const normalizedWallet = wallet.toLowerCase();
        const pendingNeedingConfirmation = sessions.filter((s) => {
          if (s.status !== 'pending') return false;
          // Check if user is mentor and hasn't confirmed
          const isMentor = s.mentorWallet.toLowerCase() === normalizedWallet;
          const isLearner = s.learnerWallet.toLowerCase() === normalizedWallet;
          if (isMentor && !s.mentorConfirmed) return true;
          if (isLearner && !s.learnerConfirmed) return true;
          return false;
        });
        setPendingConfirmationsCount(pendingNeedingConfirmation.length);
      })
      .catch((error) => {
        console.error('[SidebarNav] Error loading sessions:', error);
        // Set empty array on error so we know it failed
        setUpcomingSessions([]);
        setPendingConfirmationsCount(0);
      });

    // Load followed communities for join/leave state
    listLearningFollows({ profile_wallet: wallet, active: true })
      .then((follows) => {
        setFollowedCommunities(follows);
      })
      .catch((error) => {
        console.error('[SidebarNav] Error loading communities:', error);
      });
  };

  // Primary navigation items with unlock levels
  // Only Dashboard in main nav (Network, Skills, Quests, Sessions, Notifications shown later in sidebar in dedicated sections)
  // Note: BottomNav uses its own allNavItems array, so mobile nav is unaffected
  const allNavItems: Array<NavItem & { minLevel?: number }> = [
    {
      href: '/me',
      label: 'Dashboard',
      icon: '👤',
      minLevel: 0, // Always available
    },
    // Network, Skills, Quests, Sessions, Notifications removed from top nav to avoid duplicates
    // They appear in dedicated sections below (Network button, Sessions button, Notifications at bottom)
  ];

  // Check bypass flag
  const hasBypass = typeof window !== 'undefined' && hasOnboardingBypass();

  // Filter nav items based on onboarding level
  // If bypass is active, level is loading, or there's an error, show all items
  // Otherwise, filter based on level
  // CRITICAL: Items are filtered out, not redirected to onboarding
  // On error, be permissive to avoid locking out users
  const navItems = allNavItems
    .filter((item) => {
      if (item.minLevel === undefined) return true;
      if (hasBypass || level === null || levelError) return true; // Show all during bypass, loading, or on error
      return level >= item.minLevel;
    })
    .map(({ minLevel, ...item }) => item); // Remove minLevel from final items

  // Update hide logic - explicit checks for clarity
  const isAdmin = pathname?.startsWith('/admin');
  const isHidden = pathname === '/' || pathname === '/auth' || pathname === '/beta';

  // Explicit ordering: check admin first, then explorer, then other hidden paths
  if (isAdmin) return null;
  if (pathname === '/explorer' && !allowOnExplorer) return null;
  if (isHidden) return null;

  const isActive = (href: string) => {
    if (href === '/me') {
      // Only active for /me exactly, or /me/* routes that don't have their own nav items
      // Exclude routes that have dedicated nav items (sessions, etc.)
      if (pathname === '/me') return true;
      if (!pathname.startsWith('/me/')) return false;
      // Check if this is a route with its own nav item
      const routesWithNavItems = ['/me/sessions'];
      if (routesWithNavItems.some((route) => pathname.startsWith(route))) {
        return false; // This route has its own nav item, don't highlight "Me"
      }
      return true; // Other /me/* routes should highlight "Me"
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const activeIndex = navItems.findIndex((item) => {
    if (item.href === '/me') {
      return pathname === '/me' || pathname.startsWith('/me/');
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });

  // When nested, use relative positioning instead of fixed
  // ExplorerSidebar handles the container positioning
  const navClasses = nested
    ? 'group w-full h-full flex flex-col overflow-visible'
    : 'group hidden md:flex fixed left-0 top-0 bottom-0 w-4 hover:w-56 z-30 group-hover:border-r group-hover:border-gray-200/30 group-hover:dark:border-gray-700/30 transition-all duration-300 ease-out overflow-visible bg-white/95 dark:bg-emerald-950/95 backdrop-blur-sm';

  const containerClasses = nested
    ? 'relative flex flex-col items-start h-full w-full px-3 min-w-full overflow-y-auto overflow-x-visible'
    : 'relative flex flex-col items-start h-full w-full px-0 group-hover:px-3 min-w-[224px] overflow-y-auto overflow-x-visible transition-all duration-300 pointer-events-none';

  // Label opacity: always visible when nested, hover-revealed when not nested
  const labelOpacityClass = nested ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';

  return (
    <nav className={navClasses}>
      {/* Pointer events and visual indicator - only when not nested */}
      {!nested && (
        <>
          <div className="pointer-events-auto absolute bottom-0 left-0 top-0 w-4 transition-all duration-300 ease-out group-hover:w-56" />
          <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-4 bg-gradient-to-b from-emerald-500/20 via-emerald-400/40 to-emerald-500/20 opacity-60 transition-all duration-300 group-hover:w-1 group-hover:opacity-100 dark:from-emerald-400/30 dark:via-emerald-300/50 dark:to-emerald-400/30" />
        </>
      )}
      <div className={containerClasses}>
        <div className="flex min-h-0 w-full flex-shrink-0 flex-col items-start space-y-2 py-4">
          {/* Constellation Lines - only show when sidebar is expanded (not in nested mode) */}
          {!nested && (
            <div className="hidden group-hover:block">
              <ConstellationLines
                itemCount={navItems.length}
                itemHeight={48} // Approximate height per item (py-2.5 + space-y-2)
                containerHeight={navItems.length * 48}
                activeIndex={activeIndex >= 0 ? activeIndex : undefined}
                hoveredIndex={hoveredIndex}
              />
            </div>
          )}

          {navItems.map((item, index) => {
            const active = isActive(item.href);
            // Items are already filtered by level, so they should never be locked
            // But check bypass flag to ensure we don't redirect incorrectly
            const hasBypass = typeof window !== 'undefined' && hasOnboardingBypass();
            const isDashboard = item.href === '/me';

            // Intercept all navigation clicks during onboarding
            const handleNavClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
              // Check if we're on onboarding page
              if (pathname === '/onboarding') {
                e.preventDefault();
                setShowOnboardingPopup(true);
                return;
              }

              // Don't block if bypass is active, review mode bypass is active, or there's an error
              if (hasBypass || hasReviewModeBypass() || levelError) {
                return; // Allow navigation
              }

              // Check if user has a profile (existing user) - if yes, never lock
              if (userProfile) {
                return; // Existing user with profile - allow navigation
              }

              // If no profile, check if they have skills
              // Load profile if not already loaded
              if (!userProfile && wallet) {
                try {
                  const profile = await getProfileByWallet(wallet);
                  if (profile) {
                    setUserProfile(profile);
                    return; // Profile exists - allow navigation
                  }
                } catch {
                  // Profile not found - continue to check skills
                }
              }

              // Check if user has skills (even without profile)
              // If they have skills, they're progressing and shouldn't be locked
              if (userProfile) {
                const skills = (userProfile as UserProfile).skillsArray;
                if (skills && skills.length > 0) {
                  return; // User has skills - allow navigation
                }
              }

              // Only lock if: no profile AND no skills AND no review toggle
              // This matches the requirement: "ONLY apply to users with zero skills that log in without the arkiv review toggle"
              if (
                wallet &&
                !hasBypass &&
                !hasReviewModeBypass() &&
                !levelError &&
                level !== null &&
                level < 2
              ) {
                e.preventDefault();
                setShowOnboardingPopup(true);
                return;
              }
            };

            return (
              <div key={item.href} className="group/nav pointer-events-auto relative">
                <Link
                  href={item.href}
                  onClick={handleNavClick}
                  className={`relative flex w-full flex-row items-center gap-3 py-2.5 ${nested ? 'pl-2 pr-1' : 'pl-1 group-hover:pl-2 group-hover:pr-1'} pointer-events-auto rounded-lg transition-all duration-150 ease-out ${
                    active
                      ? `${nested ? 'bg-blue-50 dark:bg-blue-900/20' : 'group-hover:bg-blue-50 group-hover:dark:bg-blue-900/20'} text-blue-600 dark:text-blue-400`
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  } `}
                  title={item.label}
                  style={{
                    boxShadow: active ? `0 0 12px ${navTokens.node.active.glow}` : undefined,
                    transform: active ? `scale(${navTokens.node.active.scale})` : undefined,
                  }}
                  onMouseEnter={(e) => {
                    setHoveredIndex(index);
                    if (!active) {
                      e.currentTarget.style.boxShadow = `0 0 8px ${navTokens.node.hover.glow}`;
                      e.currentTarget.style.transform = `scale(${navTokens.node.hover.scale})`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    setHoveredIndex(undefined);
                    if (!active) {
                      e.currentTarget.style.boxShadow = '';
                      e.currentTarget.style.transform = '';
                    }
                  }}
                >
                  <span className="relative flex h-8 w-6 flex-shrink-0 items-center justify-center overflow-visible text-3xl transition-all duration-300 group-hover:h-10 group-hover:w-8">
                    {item.icon}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </span>
                  <div
                    className={`flex flex-col ${labelOpacityClass} whitespace-nowrap transition-opacity duration-200`}
                  >
                    <span className="text-sm font-medium leading-tight">{item.label}</span>
                    {item.href === '/me' && wallet && (
                      <span className="mt-0.5 font-mono text-[10px] leading-tight text-gray-500 dark:text-gray-500">
                        {wallet.slice(0, 6)}...{wallet.slice(-4)}
                      </span>
                    )}
                  </div>
                  {active && (
                    <div
                      className="absolute bottom-0 left-0 top-0 w-1 rounded-r bg-emerald-500 dark:bg-emerald-400"
                      style={{
                        transition: 'opacity 150ms ease-out',
                        boxShadow: `0 0 4px ${navTokens.node.active.borderGlow}`,
                      }}
                    />
                  )}
                </Link>
                {/* Arkiv Builder Mode: Query Tooltip */}
                {arkivBuilderMode && (
                  <div className="pointer-events-none absolute left-full top-1/2 z-[9999] ml-2 max-w-md -translate-y-1/2 transform whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-left font-mono text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover/nav:opacity-100 dark:bg-gray-800">
                    <div className="mb-1 font-semibold">Arkiv Queries:</div>
                    {item.href === '/me' && wallet && (
                      <>
                        <div>getProfileByWallet()</div>
                        <div className="text-gray-400">type='user_profile',</div>
                        <div className="text-gray-400">wallet='{wallet.slice(0, 8)}...'</div>
                      </>
                    )}
                    {item.href === '/network' && (
                      <>
                        <div>listSkills()</div>
                        <div className="text-gray-400">type='skill',</div>
                        <div className="text-gray-400">status='active'</div>
                      </>
                    )}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 transform border-4 border-transparent border-r-gray-900 dark:border-r-gray-800"></div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Sessions Button - above upcoming sessions */}
          {level >= 1 && (
            <div className="mt-4 w-full pt-4 group-hover:border-t group-hover:border-gray-200/50 group-hover:dark:border-gray-700/50">
              <div className="group/sessions pointer-events-auto relative">
                <Link
                  href="/me/sessions"
                  className={`relative flex w-full flex-row items-center gap-3 py-2.5 ${nested ? 'pl-2 pr-1' : 'pl-1 group-hover:pl-2 group-hover:pr-1'} pointer-events-auto rounded-lg transition-all duration-150 ease-out ${
                    isActive('/me/sessions')
                      ? 'text-blue-600 group-hover:bg-blue-50 dark:text-blue-400 group-hover:dark:bg-blue-900/20'
                      : pendingConfirmationsCount > 0
                        ? 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  } `}
                  style={
                    pendingConfirmationsCount > 0 && !isActive('/me/sessions')
                      ? {
                          boxShadow: `0 0 8px ${navTokens.node.hover.glow}`,
                        }
                      : undefined
                  }
                >
                  <span
                    className={`relative flex flex-shrink-0 items-center justify-center text-3xl ${nested ? 'h-10 w-8' : 'h-8 w-6 overflow-visible group-hover:h-10 group-hover:w-8'} transition-all duration-300`}
                  >
                    📅
                    {pendingConfirmationsCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] animate-pulse items-center justify-center rounded-full bg-emerald-500 px-1 text-xs font-bold text-white">
                        {pendingConfirmationsCount > 9 ? '9+' : pendingConfirmationsCount}
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-sm font-medium leading-tight ${labelOpacityClass} whitespace-nowrap transition-opacity duration-200`}
                  >
                    Sessions
                  </span>
                  {(isActive('/me/sessions') || pendingConfirmationsCount > 0) && (
                    <div
                      className="absolute bottom-0 left-0 top-0 w-1 rounded-r bg-emerald-500 dark:bg-emerald-400"
                      style={{
                        transition: 'opacity 150ms ease-out',
                        boxShadow: `0 0 4px ${navTokens.node.active.borderGlow}`,
                      }}
                    />
                  )}
                </Link>
                {/* Arkiv Builder Mode: Query Tooltip */}
                {arkivBuilderMode && wallet && (
                  <div className="pointer-events-none absolute left-full top-1/2 z-[9999] ml-2 max-w-md -translate-y-1/2 transform whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-left font-mono text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover/sessions:opacity-100 dark:bg-gray-800">
                    <div className="mb-1 font-semibold">Arkiv Query:</div>
                    <div>listSessionsForWallet()</div>
                    <div className="text-gray-400">type='session',</div>
                    <div className="text-gray-400">profile_wallet='{wallet.slice(0, 8)}...'</div>
                    <div className="text-gray-400">(as mentor OR learner)</div>
                    <div className="mt-1 border-t border-gray-700 pt-1 text-[10px] text-gray-500">
                      Queries: mentorWallet OR learnerWallet
                    </div>
                    <div className="absolute right-full top-1/2 -translate-y-1/2 transform border-4 border-transparent border-r-gray-900 dark:border-r-gray-800"></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upcoming Sessions - Always show if user has sessions, tied to profile identity */}
          {upcomingSessions.length > 0 &&
            (() => {
              // Deduplicate sessions by skill_id and determine type
              const sessionMap = new Map<
                string,
                { skillName: string; isCommunity: boolean; session: Session }
              >();

              upcomingSessions.forEach((session) => {
                // Get skill_id for deduplication
                const skillId = session.skill_id || session.community || '[legacy data]';
                const normalizedSkillId = skillId.toLowerCase().trim();

                // Use formatSessionTitle for consistent skill name display (same as main content)
                // This handles skill title lookup, legacy data, and community sessions correctly
                const skillTitle = formatSessionTitle(session, skillsMap);

                const isCommunity = Boolean(
                  session.skill === 'virtual_gathering_rsvp' ||
                    session.gatheringKey ||
                    session.notes?.includes('gatheringKey:') ||
                    session.notes?.includes('virtual_gathering_rsvp:')
                );

                // Keep the earliest session for each skill_id
                if (!sessionMap.has(normalizedSkillId)) {
                  sessionMap.set(normalizedSkillId, {
                    skillName: skillTitle,
                    isCommunity,
                    session,
                  });
                } else {
                  const existing = sessionMap.get(normalizedSkillId)!;
                  const existingDate = new Date(existing.session.sessionDate).getTime();
                  const currentDate = new Date(session.sessionDate).getTime();
                  if (currentDate < existingDate) {
                    sessionMap.set(normalizedSkillId, {
                      skillName: skillTitle,
                      isCommunity,
                      session,
                    });
                  }
                }
              });

              const uniqueSessions = Array.from(sessionMap.values());

              // Only render if we have sessions to show
              if (uniqueSessions.length === 0) {
                return null;
              }

              return (
                <div className="mt-2 w-full">
                  <div className="flex flex-col gap-2">
                    <div className="flex w-full flex-col gap-2">
                      {uniqueSessions.map(({ skillName, isCommunity, session }) => {
                        const sessionDate = new Date(session.sessionDate);
                        const isToday = sessionDate.toDateString() === new Date().toDateString();
                        const dateStr = isToday
                          ? 'Today'
                          : sessionDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            });
                        const timeStr = sessionDate.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        });

                        return (
                          <div key={session.key} className="group/session relative">
                            <div
                              className="flex flex-row items-center gap-3 rounded-lg py-2.5 pl-1 group-hover:pl-2 group-hover:pr-1"
                              title={`${skillName} - ${dateStr} at ${timeStr}`}
                            >
                              <span className="flex h-8 w-6 flex-shrink-0 items-center justify-center overflow-visible text-3xl transition-all duration-300 group-hover:h-10 group-hover:w-8">
                                📖
                              </span>
                              <div
                                className={`flex flex-col ${labelOpacityClass} whitespace-nowrap transition-opacity duration-200`}
                              >
                                <span className="text-sm font-medium leading-tight">
                                  {skillName}
                                </span>
                                <span className="mt-0.5 text-xs leading-tight text-gray-500 dark:text-gray-400">
                                  {dateStr} {timeStr}
                                </span>
                              </div>
                            </div>
                            {/* Arkiv Builder Mode: Session Entity Tooltip */}
                            {arkivBuilderMode && session.key && (
                              <div className="pointer-events-none absolute left-full top-1/2 z-[9999] ml-2 max-w-md -translate-y-1/2 transform whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-left font-mono text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover/session:opacity-100 dark:bg-gray-800">
                                <div className="mb-1 font-semibold">Session Entity:</div>
                                <div className="text-gray-400">
                                  Key: {session.key.slice(0, 16)}...
                                </div>
                                {session.txHash && (
                                  <div className="text-gray-400">
                                    TxHash: {session.txHash.slice(0, 16)}...
                                  </div>
                                )}
                                <div className="mt-2 border-t border-gray-700 pt-2 text-xs">
                                  <div>Query: getSessionByKey()</div>
                                  <div className="text-gray-400">type='session',</div>
                                  <div className="text-gray-400">
                                    key='{session.key.slice(0, 8)}...'
                                  </div>
                                </div>
                                <div className="absolute right-full top-1/2 -translate-y-1/2 transform border-4 border-transparent border-r-gray-900 dark:border-r-gray-800"></div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

          {/* Network Button - above skills */}
          {level >= 1 && (
            <div className="mt-4 w-full pt-4 group-hover:border-t group-hover:border-gray-200/50 group-hover:dark:border-gray-700/50">
              <Link
                href="/network"
                className={`relative flex w-full flex-row items-center gap-3 py-2.5 ${nested ? 'pl-2 pr-1' : 'pl-1 group-hover:pl-2 group-hover:pr-1'} pointer-events-auto rounded-lg transition-all duration-150 ease-out ${
                  isActive('/network')
                    ? 'text-blue-600 group-hover:bg-blue-50 dark:text-blue-400 group-hover:dark:bg-blue-900/20'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                } `}
              >
                <span className="flex h-8 w-6 flex-shrink-0 items-center justify-center overflow-visible text-3xl transition-all duration-300 group-hover:h-10 group-hover:w-8">
                  🌐
                </span>
                <span
                  className={`text-sm font-medium leading-tight ${labelOpacityClass} whitespace-nowrap transition-opacity duration-200`}
                >
                  Network
                </span>
                {isActive('/network') && (
                  <div
                    className="absolute bottom-0 left-0 top-0 w-1 rounded-r bg-emerald-500 dark:bg-emerald-400"
                    style={{
                      transition: 'opacity 150ms ease-out',
                      boxShadow: `0 0 4px ${navTokens.node.active.borderGlow}`,
                    }}
                  />
                )}
              </Link>
            </div>
          )}

          {/* Asks, Offers, Matches - always vertical layout */}
          {level >= 1 && (
            <div className="mt-2 w-full space-y-0.5">
              <Link
                href="/asks"
                className={`pointer-events-auto relative flex w-full flex-row items-center gap-3 rounded-lg py-2.5 pl-1 transition-all duration-150 ease-out group-hover:pl-2 group-hover:pr-1 ${
                  isActive('/asks')
                    ? 'text-blue-600 group-hover:bg-blue-50 dark:text-blue-400 group-hover:dark:bg-blue-900/20'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                } `}
                title="Asks"
              >
                <span className="flex h-8 w-6 flex-shrink-0 items-center justify-center overflow-visible text-3xl transition-all duration-300 group-hover:h-10 group-hover:w-8">
                  🎓
                </span>
                <div className="flex flex-col whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span className="text-sm font-medium leading-tight">Asks</span>
                </div>
                {isActive('/asks') && (
                  <div
                    className="absolute bottom-0 left-0 top-0 w-1 rounded-r bg-emerald-500 dark:bg-emerald-400"
                    style={{
                      transition: 'opacity 150ms ease-out',
                      boxShadow: `0 0 4px ${navTokens.node.active.borderGlow}`,
                    }}
                  />
                )}
              </Link>
              <Link
                href="/offers"
                className={`pointer-events-auto relative flex w-full flex-row items-center gap-3 rounded-lg py-2.5 pl-1 transition-all duration-150 ease-out group-hover:pl-2 group-hover:pr-1 ${
                  isActive('/offers')
                    ? 'text-blue-600 group-hover:bg-blue-50 dark:text-blue-400 group-hover:dark:bg-blue-900/20'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                } `}
                title="Offers"
              >
                <span className="flex h-8 w-6 flex-shrink-0 items-center justify-center overflow-visible text-3xl transition-all duration-300 group-hover:h-10 group-hover:w-8">
                  💎
                </span>
                <div className="flex flex-col whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span className="text-sm font-medium leading-tight">Offers</span>
                </div>
                {isActive('/offers') && (
                  <div
                    className="absolute bottom-0 left-0 top-0 w-1 rounded-r bg-emerald-500 dark:bg-emerald-400"
                    style={{
                      transition: 'opacity 150ms ease-out',
                      boxShadow: `0 0 4px ${navTokens.node.active.borderGlow}`,
                    }}
                  />
                )}
              </Link>
              <Link
                href="/matches"
                className={`pointer-events-auto relative flex w-full flex-row items-center gap-3 rounded-lg py-2.5 pl-1 transition-all duration-150 ease-out group-hover:pl-2 group-hover:pr-1 ${
                  isActive('/matches')
                    ? 'text-blue-600 group-hover:bg-blue-50 dark:text-blue-400 group-hover:dark:bg-blue-900/20'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                } `}
                title="Matches"
              >
                <span className="flex h-8 w-6 flex-shrink-0 items-center justify-center overflow-visible text-3xl transition-all duration-300 group-hover:h-10 group-hover:w-8">
                  ✨
                </span>
                <div className="flex flex-col whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span className="text-sm font-medium leading-tight">Matches</span>
                </div>
                {isActive('/matches') && (
                  <div
                    className="absolute bottom-0 left-0 top-0 w-1 rounded-r bg-emerald-500 dark:bg-emerald-400"
                    style={{
                      transition: 'opacity 150ms ease-out',
                      boxShadow: `0 0 4px ${navTokens.node.active.borderGlow}`,
                    }}
                  />
                )}
              </Link>
            </div>
          )}

          {/* Skills - shows profile's skills (deduplicated) with links to topic pages */}
          {gardenSkills.length > 0 &&
            (() => {
              // Remove duplicates by skill name (case-insensitive)
              const uniqueSkills = gardenSkills.reduce(
                (acc: typeof gardenSkills, skill) => {
                  const normalizedName = skill.name.toLowerCase().trim();
                  if (
                    !acc.find(
                      (s: (typeof gardenSkills)[0]) =>
                        s.name.toLowerCase().trim() === normalizedName
                    )
                  ) {
                    acc.push(skill);
                  }
                  return acc;
                },
                [] as typeof gardenSkills
              );

              return (
                <div className="mt-2 w-full">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-2">
                      {uniqueSkills.slice(0, 6).map((skill) => {
                        // Find skill entity by name to get slug for topic page link
                        const skillEntity = Object.values(skillsMap).find(
                          (s) =>
                            s.name_canonical?.toLowerCase().trim() ===
                              skill.name.toLowerCase().trim() ||
                            s.slug?.toLowerCase().trim() === normalizeSkillSlug(skill.name)
                        );

                        // Handle click to ensure skill entity exists before navigating
                        const handleSkillClick = async (e: React.MouseEvent) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const { getSkillTopicLink } = await import('@/lib/arkiv/skill-helpers');
                          const topicLink = await getSkillTopicLink(skill.name);
                          if (topicLink) {
                            window.location.href = topicLink;
                          } else {
                            // Fallback to network page if skill creation fails
                            window.location.href = `/network?skill=${encodeURIComponent(skill.name)}`;
                          }
                        };

                        const skillTitle = `${skill.name} - ${skill.level === 0 ? 'Beginner' : skill.level === 2 ? 'Intermediate' : skill.level >= 3 && skill.level <= 4 ? 'Advanced' : 'Expert'}`;
                        const skillContent = (
                          <>
                            <span className="flex h-8 w-6 flex-shrink-0 items-center justify-center overflow-visible text-3xl transition-all duration-300 group-hover:h-10 group-hover:w-8">
                              {levelToEmoji(skill.level)}
                            </span>
                            <div className="flex flex-col whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                              <span className="text-sm font-medium leading-tight">
                                {skill.name}
                              </span>
                            </div>
                          </>
                        );

                        // If skill entity found, use Link; otherwise use button to create entity first
                        if (skillEntity) {
                          return (
                            <Link
                              key={skill.id}
                              href={`/topic/${skillEntity.slug}`}
                              className="pointer-events-auto relative flex w-full flex-row items-center gap-3 rounded-lg py-2.5 pl-1 text-gray-600 transition-all duration-150 ease-out hover:bg-gray-100 group-hover:pl-2 group-hover:pr-1 dark:text-gray-400 dark:hover:bg-gray-800"
                              title={skillTitle}
                            >
                              {skillContent}
                            </Link>
                          );
                        } else {
                          return (
                            <button
                              key={skill.id}
                              onClick={handleSkillClick}
                              className="pointer-events-auto relative flex w-full flex-row items-center gap-3 rounded-lg py-2.5 pl-1 text-left text-gray-600 transition-all duration-150 ease-out hover:bg-gray-100 group-hover:pl-2 group-hover:pr-1 dark:text-gray-400 dark:hover:bg-gray-800"
                              title={skillTitle}
                            >
                              {skillContent}
                            </button>
                          );
                        }
                      })}
                      {uniqueSkills.length > 6 && (
                        <div className="text-sm text-gray-400 dark:text-gray-500">
                          +{uniqueSkills.length - 6}
                        </div>
                      )}
                    </div>
                    {/* Public Garden Board */}
                    <Link
                      href="/garden/public-board"
                      className="pointer-events-auto relative flex w-full flex-row items-center gap-3 rounded-lg py-2.5 pl-1 text-gray-600 transition-all duration-150 ease-out hover:bg-gray-100 group-hover:pl-2 group-hover:pr-1 dark:text-gray-400 dark:hover:bg-gray-800"
                      title="Public Garden Board"
                    >
                      <span className="flex h-8 w-6 flex-shrink-0 items-center justify-center overflow-visible text-3xl transition-all duration-300 group-hover:h-10 group-hover:w-8">
                        💌
                      </span>
                      <div className="flex flex-col whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <span className="text-sm font-medium leading-tight">Public Board</span>
                      </div>
                    </Link>
                    {/* Browse Profiles */}
                    <Link
                      href="/profiles"
                      className="pointer-events-auto relative flex w-full flex-row items-center gap-3 rounded-lg py-2.5 pl-1 text-gray-600 transition-all duration-150 ease-out hover:bg-gray-100 group-hover:pl-2 group-hover:pr-1 dark:text-gray-400 dark:hover:bg-gray-800"
                      title="Browse Profiles"
                    >
                      <span className="flex h-8 w-6 flex-shrink-0 items-center justify-center overflow-visible text-3xl transition-all duration-300 group-hover:h-10 group-hover:w-8">
                        👤
                      </span>
                      <div className="flex flex-col whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <span className="text-sm font-medium leading-tight">Browse Profiles</span>
                      </div>
                    </Link>
                    {/* Explore Skills */}
                    <Link
                      href="/skills/explore"
                      className="pointer-events-auto relative flex w-full flex-row items-center gap-3 rounded-lg py-2.5 pl-1 text-gray-600 transition-all duration-150 ease-out hover:bg-gray-100 group-hover:pl-2 group-hover:pr-1 dark:text-gray-400 dark:hover:bg-gray-800"
                      title="Explore Skills"
                    >
                      <span className="flex h-8 w-6 flex-shrink-0 items-center justify-center overflow-visible text-3xl transition-all duration-300 group-hover:h-10 group-hover:w-8">
                        🌱
                      </span>
                      <div className="flex flex-col whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <span className="text-sm font-medium leading-tight">Explore Skills</span>
                      </div>
                    </Link>
                    {/* Learning Quests */}
                    <Link
                      href="/learner-quests"
                      className="pointer-events-auto relative flex w-full flex-row items-center gap-3 rounded-lg py-2.5 pl-1 text-gray-600 transition-all duration-150 ease-out hover:bg-gray-100 group-hover:pl-2 group-hover:pr-1 dark:text-gray-400 dark:hover:bg-gray-800"
                      title="Learning Quests"
                    >
                      <span className="flex h-8 w-6 flex-shrink-0 items-center justify-center overflow-visible text-3xl transition-all duration-300 group-hover:h-10 group-hover:w-8">
                        📚
                      </span>
                      <div className="flex flex-col whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <span className="text-sm font-medium leading-tight">Learning Quests</span>
                      </div>
                    </Link>
                  </div>
                </div>
              );
            })()}

          {/* Notifications - above logout */}
          {wallet && (
            <div className="mt-auto w-full pt-4 group-hover:border-t group-hover:border-gray-200/50 group-hover:dark:border-gray-700/50">
              <Link
                href="/notifications"
                onClick={(e) => {
                  // Check if we're on onboarding page
                  if (pathname === '/onboarding') {
                    e.preventDefault();
                    setShowOnboardingPopup(true);
                    return;
                  }

                  // Check if onboarding is complete (level >= 2 means ask or offer created)
                  // Level 0 = no profile, Level 1 = profile + skills, Level 2+ = has ask/offer
                  // Don't block if bypass is active or there's an error (be permissive)
                  if (wallet && !hasBypass && !levelError && level !== null && level < 2) {
                    e.preventDefault();
                    setShowOnboardingPopup(true);
                    return;
                  }
                }}
                className={`relative flex w-full flex-row items-center gap-3 py-2.5 ${nested ? 'pl-2 pr-1' : 'pl-1 group-hover:pl-2 group-hover:pr-1'} pointer-events-auto rounded-lg transition-all duration-150 ease-out ${
                  isActive('/notifications')
                    ? 'text-blue-600 group-hover:bg-blue-50 dark:text-blue-400 group-hover:dark:bg-blue-900/20'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                } `}
              >
                <span className="relative flex h-8 w-6 flex-shrink-0 items-center justify-center overflow-visible text-3xl transition-all duration-300 group-hover:h-10 group-hover:w-8">
                  🔔
                  {notificationCount !== null && notificationCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </span>
                  )}
                </span>
                <span
                  className={`text-sm font-medium leading-tight ${labelOpacityClass} whitespace-nowrap transition-opacity duration-200`}
                >
                  Notifications
                </span>
                {isActive('/notifications') && (
                  <div
                    className="absolute bottom-0 left-0 top-0 w-1 rounded-r bg-emerald-500 dark:bg-emerald-400"
                    style={{
                      transition: 'opacity 150ms ease-out',
                      boxShadow: `0 0 4px ${navTokens.node.active.borderGlow}`,
                    }}
                  />
                )}
              </Link>
            </div>
          )}

          {/* Logout Button - sticky at bottom to ensure visibility across browsers */}
          {wallet && (
            <div className="mt-auto w-full flex-shrink-0 pb-4 pt-2 group-hover:border-t group-hover:border-gray-200/50 group-hover:dark:border-gray-700/50">
              <button
                onClick={async () => {
                  if (typeof window !== 'undefined') {
                    // Disconnect wallet based on type
                    const walletType = localStorage.getItem(`wallet_type_${wallet.toLowerCase()}`);

                    // Disconnect MetaMask if it's a MetaMask wallet
                    if (walletType === 'metamask' && window.ethereum) {
                      try {
                        const { disconnectWallet } = await import('@/lib/auth/metamask');
                        await disconnectWallet();
                      } catch (error) {
                        // Silently fail - clearing localStorage is the important part
                        console.warn('Failed to disconnect MetaMask:', error);
                      }
                    }

                    // Disconnect WalletConnect if it's a WalletConnect wallet
                    if (walletType === 'walletconnect') {
                      try {
                        const { disconnectWalletConnect } = await import(
                          '@/lib/wallet/walletconnectProvider'
                        );
                        await disconnectWalletConnect(wallet);
                      } catch (error) {
                        // Silently fail - clearing localStorage is the important part
                        console.warn('Failed to disconnect WalletConnect:', error);
                      }
                    }

                    // Clear all wallet-related localStorage
                    localStorage.removeItem('wallet_address');
                    localStorage.removeItem('passkey_user_id');
                    // Clear all passkey-related keys
                    const keysToRemove: string[] = [];
                    for (let i = 0; i < localStorage.length; i++) {
                      const key = localStorage.key(i);
                      if (key && (key.startsWith('passkey_') || key.startsWith('wallet_type_'))) {
                        keysToRemove.push(key);
                      }
                    }
                    keysToRemove.forEach((key) => localStorage.removeItem(key));
                    // Redirect to auth page
                    window.location.href = '/auth';
                  }
                }}
                className="pointer-events-auto flex w-full flex-row items-center gap-3 rounded-lg py-2.5 pl-1 text-gray-600 transition-all duration-150 ease-out hover:bg-gray-100 group-hover:pl-2 group-hover:pr-1 dark:text-gray-400 dark:hover:bg-gray-800"
                title="Disconnect wallet and logout"
              >
                <span className="flex h-8 w-6 flex-shrink-0 items-center justify-center overflow-visible text-3xl transition-all duration-300 group-hover:h-10 group-hover:w-8">
                  ⚡
                </span>
                <span
                  className={`text-sm font-medium leading-tight ${labelOpacityClass} whitespace-nowrap transition-opacity duration-200`}
                >
                  Logout
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Onboarding Popup - rendered as portal for proper centering */}
      {showOnboardingPopup &&
        typeof window !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800">
              <div className="text-center">
                <div className="mb-4 text-6xl">🌱</div>
                <h3 className="mb-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  Click grow to start
                </h3>
                <p className="mb-6 text-gray-600 dark:text-gray-400">
                  Complete onboarding to unlock navigation.
                </p>
                <button
                  onClick={() => setShowOnboardingPopup(false)}
                  className="w-full rounded-lg bg-green-600 px-6 py-3 text-lg font-medium text-white shadow-lg transition-all duration-200 hover:bg-green-700 hover:shadow-xl"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </nav>
  );
}
