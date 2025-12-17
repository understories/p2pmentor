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
import { useNotificationCount } from '@/lib/hooks/useNotificationCount';
import { navTokens } from '@/lib/design/navTokens';
import { ConstellationLines } from '@/components/navigation/ConstellationLines';
import { useOnboardingLevel } from '@/lib/onboarding/useOnboardingLevel';
import { hasOnboardingBypass } from '@/lib/onboarding/access';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { profileToGardenSkills, levelToEmoji } from '@/lib/garden/types';
import { listSessionsForWallet } from '@/lib/arkiv/sessions';
import { getSidebarSkillId } from '@/lib/sessions/display';
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

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const notificationCount = useNotificationCount();
  const [hoveredIndex, setHoveredIndex] = useState<number | undefined>();
  
  // Get onboarding level for navigation unlocking
  const [wallet, setWallet] = useState<string | null>(null);
  const { level } = useOnboardingLevel(wallet);
  const [gardenSkills, setGardenSkills] = useState<any[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [skillsMap, setSkillsMap] = useState<Record<string, Skill>>({});
  const [followedCommunities, setFollowedCommunities] = useState<LearningFollow[]>([]);
  const [arkivBuilderMode, setArkivBuilderMode] = useState(false);
  const [pendingConfirmationsCount, setPendingConfirmationsCount] = useState(0);

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
        if (updated === 'true' !== arkivBuilderMode) {
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
      
      // Load all skills for mapping skill_id to name_canonical
      // This is used to display skill names in sessions sidebar
      // CRITICAL: Load skills first so skillsMap is ready when sessions render
      listSkills({ status: 'active', limit: 200 })
        .then((skills) => {
          const map: Record<string, Skill> = {};
          skills.forEach(skill => {
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
          .filter(s => {
            if (s.status !== 'scheduled') return false;
            const sessionTime = new Date(s.sessionDate).getTime();
            return sessionTime > now;
          })
          .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime())
          .slice(0, 3); // Show up to 3 upcoming sessions
        console.log('[SidebarNav] Loaded sessions:', { total: sessions.length, upcoming: upcoming.length, upcomingSessions: upcoming });
        setUpcomingSessions(upcoming);

        // Check for pending sessions that need user confirmation
        const normalizedWallet = wallet.toLowerCase();
        const pendingNeedingConfirmation = sessions.filter(s => {
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
  // Only Dashboard in main nav (Network is shown later in sidebar, Notifications moved to bottom above Logout)
  const allNavItems: Array<NavItem & { minLevel?: number }> = [
    {
      href: '/me',
      label: 'Dashboard',
      icon: '👤',
      minLevel: 0, // Always available
    },
  ];

  // Check bypass flag
  const hasBypass = typeof window !== 'undefined' && hasOnboardingBypass();
  
  // Filter nav items based on onboarding level
  // If bypass is active or level is loading, show all items
  // Otherwise, filter based on level
  // CRITICAL: Items are filtered out, not redirected to onboarding
  const navItems = allNavItems
    .filter(item => {
      if (item.minLevel === undefined) return true;
      if (hasBypass || level === null) return true; // Show all during bypass or while loading
      return level >= item.minLevel;
    })
    .map(({ minLevel, ...item }) => item); // Remove minLevel from final items

  // Don't show on landing, auth, beta, or admin pages
  const hideNavPaths = ['/', '/auth', '/beta', '/admin'];
  if (hideNavPaths.some(path => pathname === path || pathname.startsWith('/admin'))) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === '/me') {
      // Only active for /me exactly, or /me/* routes that don't have their own nav items
      // Exclude routes that have dedicated nav items (sessions, etc.)
      if (pathname === '/me') return true;
      if (!pathname.startsWith('/me/')) return false;
      // Check if this is a route with its own nav item
      const routesWithNavItems = ['/me/sessions'];
      if (routesWithNavItems.some(route => pathname.startsWith(route))) {
        return false; // This route has its own nav item, don't highlight "Me"
      }
      return true; // Other /me/* routes should highlight "Me"
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const activeIndex = navItems.findIndex(item => {
    if (item.href === '/me') {
      return pathname === '/me' || pathname.startsWith('/me/');
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });

  return (
    <nav className="group hidden md:flex fixed left-0 top-0 bottom-0 w-4 hover:w-56 z-30 border-r border-gray-200/30 dark:border-gray-700/30 transition-all duration-300 ease-out overflow-visible bg-white/95 dark:bg-emerald-950/95 backdrop-blur-sm">
      {/* Visual indicator - vertical line with emerald glow */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500/20 via-emerald-400/40 to-emerald-500/20 dark:from-emerald-400/30 dark:via-emerald-300/50 dark:to-emerald-400/30 opacity-60 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <div className="relative flex flex-col items-start h-full w-full px-0 group-hover:px-3 min-w-[224px] overflow-y-auto overflow-x-visible transition-all duration-300">
        <div className="flex flex-col items-start py-4 space-y-2 w-full flex-shrink-0 min-h-0">
        {/* Constellation Lines - only show when sidebar is expanded */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <ConstellationLines
            itemCount={navItems.length}
            itemHeight={48} // Approximate height per item (py-2.5 + space-y-2)
            containerHeight={navItems.length * 48}
            activeIndex={activeIndex >= 0 ? activeIndex : undefined}
            hoveredIndex={hoveredIndex}
          />
        </div>
        
        {navItems.map((item, index) => {
          const active = isActive(item.href);
          // Items are already filtered by level, so they should never be locked
          // But check bypass flag to ensure we don't redirect incorrectly
          const hasBypass = typeof window !== 'undefined' && hasOnboardingBypass();
          const isDashboard = item.href === '/me';

          // Intercept dashboard clicks during onboarding
          const handleDashboardClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
            if (isDashboard && wallet && level !== null) {
              // Check if we're on onboarding page
              if (pathname === '/onboarding') {
                e.preventDefault();
                return;
              }

              // Check if onboarding is complete (level >= 2 means ask or offer created)
              // Level 0 = no profile, Level 1 = profile + skills, Level 2+ = has ask/offer
              if (level !== null && level < 2) {
                e.preventDefault();
                // Redirect to onboarding
                router.push('/onboarding');
                return;
              }
            }
          };

          return (
            <div className="relative group/nav">
              <Link
                key={item.href}
                href={item.href}
                onClick={handleDashboardClick}
                className={`
                  relative flex flex-row items-center gap-3
                  w-full py-2.5 pl-1 group-hover:pl-2 group-hover:pr-1
                  rounded-lg
                  transition-all duration-150 ease-out
                  ${active
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                `}
                title={item.label}
                style={{
                  boxShadow: active
                    ? `0 0 12px ${navTokens.node.active.glow}`
                    : undefined,
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
              <span className="relative text-3xl flex-shrink-0 flex items-center justify-center w-6 h-8 overflow-visible group-hover:w-8 group-hover:h-10 transition-all duration-300">
                {item.icon}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>
              <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                <span className="text-sm font-medium leading-tight">
                  {item.label}
                </span>
                {item.href === '/me' && wallet && (
                  <span className="text-[10px] text-gray-500 dark:text-gray-500 font-mono leading-tight mt-0.5">
                    {wallet.slice(0, 6)}...{wallet.slice(-4)}
                  </span>
                )}
              </div>
              {active && (
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 dark:bg-emerald-400 rounded-r"
                  style={{
                    transition: 'opacity 150ms ease-out',
                    boxShadow: `0 0 4px ${navTokens.node.active.borderGlow}`,
                  }}
                />
              )}
              </Link>
              {/* Arkiv Builder Mode: Query Tooltip */}
              {arkivBuilderMode && (
                <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/nav:opacity-100 transition-opacity duration-200 pointer-events-none z-[9999] font-mono text-left whitespace-nowrap max-w-md">
                  <div className="font-semibold mb-1">Arkiv Queries:</div>
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
                  <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-gray-800"></div>
                </div>
              )}
            </div>
          );
        })}
        
        {/* Sessions Button - above upcoming sessions */}
        {level >= 1 && (
          <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 w-full">
            <div className="relative group/sessions">
              <Link
                href="/me/sessions"
                className={`
                  relative flex flex-row items-center gap-3
                  w-full py-2.5 pl-1 group-hover:pl-2 group-hover:pr-1
                  rounded-lg
                  transition-all duration-150 ease-out
                  ${isActive('/me/sessions')
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : pendingConfirmationsCount > 0
                    ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                `}
                style={pendingConfirmationsCount > 0 && !isActive('/me/sessions') ? {
                  boxShadow: `0 0 8px ${navTokens.node.hover.glow}`,
                } : undefined}
              >
                <span className="text-3xl flex-shrink-0 relative flex items-center justify-center w-6 h-8 overflow-visible group-hover:w-8 group-hover:h-10 transition-all duration-300">
                  📅
                  {pendingConfirmationsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
                      {pendingConfirmationsCount > 9 ? '9+' : pendingConfirmationsCount}
                    </span>
                  )}
                </span>
                <span className="text-sm font-medium leading-tight opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">Sessions</span>
                {(isActive('/me/sessions') || pendingConfirmationsCount > 0) && (
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 dark:bg-emerald-400 rounded-r"
                    style={{
                      transition: 'opacity 150ms ease-out',
                      boxShadow: `0 0 4px ${navTokens.node.active.borderGlow}`,
                    }}
                  />
                )}
              </Link>
              {/* Arkiv Builder Mode: Query Tooltip */}
              {arkivBuilderMode && wallet && (
                <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/sessions:opacity-100 transition-opacity duration-200 pointer-events-none z-[9999] font-mono text-left whitespace-nowrap max-w-md">
                  <div className="font-semibold mb-1">Arkiv Query:</div>
                  <div>listSessionsForWallet()</div>
                  <div className="text-gray-400">type='session',</div>
                  <div className="text-gray-400">profile_wallet='{wallet.slice(0, 8)}...'</div>
                  <div className="text-gray-400">(as mentor OR learner)</div>
                  <div className="mt-1 pt-1 border-t border-gray-700 text-[10px] text-gray-500">
                    Queries: mentorWallet OR learnerWallet
                  </div>
                  <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-gray-800"></div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Upcoming Sessions - Always show if user has sessions, tied to profile identity */}
        {upcomingSessions.length > 0 && (() => {
          // Deduplicate sessions by skill_id and determine type
          const sessionMap = new Map<string, { skillName: string; isCommunity: boolean; session: Session }>();
          
          upcomingSessions.forEach((session) => {
            // Get skill_id for deduplication
            const skillId = session.skill_id || session.community || '[legacy data]';
            const normalizedSkillId = skillId.toLowerCase().trim();
            
            // Get skill name from skills map (will use skill_id as fallback if not found)
            const skillTitle = getSidebarSkillId(session, skillsMap);
            
            const isCommunity = Boolean(
              session.skill === 'virtual_gathering_rsvp' || 
              session.gatheringKey ||
              session.notes?.includes('gatheringKey:') ||
              session.notes?.includes('virtual_gathering_rsvp:')
            );
            
            // Keep the earliest session for each skill_id
            if (!sessionMap.has(normalizedSkillId)) {
              sessionMap.set(normalizedSkillId, { skillName: skillTitle, isCommunity, session });
            } else {
              const existing = sessionMap.get(normalizedSkillId)!;
              const existingDate = new Date(existing.session.sessionDate).getTime();
              const currentDate = new Date(session.sessionDate).getTime();
              if (currentDate < existingDate) {
                sessionMap.set(normalizedSkillId, { skillName: skillTitle, isCommunity, session });
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
                <div className="flex flex-col gap-2 w-full">
                  {uniqueSessions.map(({ skillName, isCommunity, session }) => {
                    const sessionDate = new Date(session.sessionDate);
                    const isToday = sessionDate.toDateString() === new Date().toDateString();
                    const dateStr = isToday 
                      ? 'Today' 
                      : sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const timeStr = sessionDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    
                    return (
                      <div key={session.key} className="relative group/session">
                        <div
                          className="flex flex-row items-center gap-3 py-2.5 pl-1 group-hover:pl-2 group-hover:pr-1 rounded-lg"
                          title={`${skillName} - ${dateStr} at ${timeStr}`}
                        >
                          <span className="text-3xl flex-shrink-0 flex items-center justify-center w-6 h-8 overflow-visible group-hover:w-8 group-hover:h-10 transition-all duration-300">📖</span>
                          <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                            <span className="text-sm font-medium leading-tight">
                              {skillName}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
                              {dateStr} {timeStr}
                            </span>
                          </div>
                        </div>
                        {/* Arkiv Builder Mode: Session Entity Tooltip */}
                        {arkivBuilderMode && session.key && (
                          <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/session:opacity-100 transition-opacity duration-200 pointer-events-none z-[9999] font-mono text-left whitespace-nowrap max-w-md">
                            <div className="font-semibold mb-1">Session Entity:</div>
                            <div className="text-gray-400">Key: {session.key.slice(0, 16)}...</div>
                            {session.txHash && (
                              <div className="text-gray-400">TxHash: {session.txHash.slice(0, 16)}...</div>
                            )}
                            <div className="mt-2 pt-2 border-t border-gray-700 text-xs">
                              <div>Query: getSessionByKey()</div>
                              <div className="text-gray-400">type='session',</div>
                              <div className="text-gray-400">key='{session.key.slice(0, 8)}...'</div>
                            </div>
                            <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-gray-800"></div>
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
          <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 w-full">
            <Link
                href="/network"
                className={`
                  relative flex flex-row items-center gap-3
                  w-full py-2.5 pl-1 group-hover:pl-2 group-hover:pr-1
                  rounded-lg
                  transition-all duration-150 ease-out
                  ${isActive('/network')
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                `}
            >
              <span className="text-3xl flex-shrink-0 flex items-center justify-center w-6 h-8 overflow-visible group-hover:w-8 group-hover:h-10 transition-all duration-300">🌐</span>
              <span className="text-sm font-medium leading-tight opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">Network</span>
              {isActive('/network') && (
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 dark:bg-emerald-400 rounded-r"
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
              className={`
                relative flex flex-row items-center gap-3
                w-full py-2.5 pl-1 group-hover:pl-2 group-hover:pr-1
                rounded-lg
                transition-all duration-150 ease-out
                ${isActive('/asks')
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }
              `}
              title="Asks"
            >
              <span className="text-3xl flex-shrink-0 flex items-center justify-center w-6 h-8 overflow-visible group-hover:w-8 group-hover:h-10 transition-all duration-300">🎓</span>
              <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                <span className="text-sm font-medium leading-tight">Asks</span>
              </div>
              {isActive('/asks') && (
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 dark:bg-emerald-400 rounded-r"
                  style={{
                    transition: 'opacity 150ms ease-out',
                    boxShadow: `0 0 4px ${navTokens.node.active.borderGlow}`,
                  }}
                />
              )}
            </Link>
            <Link
              href="/offers"
              className={`
                relative flex flex-row items-center gap-3
                w-full py-2.5 pl-1 group-hover:pl-2 group-hover:pr-1
                rounded-lg
                transition-all duration-150 ease-out
                ${isActive('/offers')
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }
              `}
              title="Offers"
            >
              <span className="text-3xl flex-shrink-0 flex items-center justify-center w-6 h-8 overflow-visible group-hover:w-8 group-hover:h-10 transition-all duration-300">💎</span>
              <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                <span className="text-sm font-medium leading-tight">Offers</span>
              </div>
              {isActive('/offers') && (
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 dark:bg-emerald-400 rounded-r"
                  style={{
                    transition: 'opacity 150ms ease-out',
                    boxShadow: `0 0 4px ${navTokens.node.active.borderGlow}`,
                  }}
                />
              )}
            </Link>
            <Link
              href="/matches"
              className={`
                relative flex flex-row items-center gap-3
                w-full py-2.5 pl-1 group-hover:pl-2 group-hover:pr-1
                rounded-lg
                transition-all duration-150 ease-out
                ${isActive('/matches')
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }
              `}
              title="Matches"
            >
              <span className="text-3xl flex-shrink-0 flex items-center justify-center w-6 h-8 overflow-visible group-hover:w-8 group-hover:h-10 transition-all duration-300">✨</span>
              <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                <span className="text-sm font-medium leading-tight">Matches</span>
              </div>
              {isActive('/matches') && (
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 dark:bg-emerald-400 rounded-r"
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
        {gardenSkills.length > 0 && (() => {
          // Remove duplicates by skill name (case-insensitive)
          const uniqueSkills = gardenSkills.reduce((acc: typeof gardenSkills, skill) => {
            const normalizedName = skill.name.toLowerCase().trim();
            if (!acc.find((s: typeof gardenSkills[0]) => s.name.toLowerCase().trim() === normalizedName)) {
              acc.push(skill);
            }
            return acc;
          }, [] as typeof gardenSkills);
          
          return (
            <div className="mt-2 w-full">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2">
                  {uniqueSkills.slice(0, 6).map((skill) => {
                    // Find skill entity by name to get slug for topic page link
                    const skillEntity = Object.values(skillsMap).find(s => 
                      s.name_canonical?.toLowerCase().trim() === skill.name.toLowerCase().trim() ||
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
                        <span className="text-3xl flex-shrink-0 flex items-center justify-center w-6 h-8 overflow-visible group-hover:w-8 group-hover:h-10 transition-all duration-300">
                          {levelToEmoji(skill.level)}
                        </span>
                        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
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
                          className="relative flex flex-row items-center gap-3 w-full py-2.5 pl-1 group-hover:pl-2 group-hover:pr-1 rounded-lg transition-all duration-150 ease-out text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
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
                          className="relative flex flex-row items-center gap-3 w-full py-2.5 pl-1 group-hover:pl-2 group-hover:pr-1 rounded-lg transition-all duration-150 ease-out text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-left"
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
                  className="relative flex flex-row items-center gap-3 w-full py-2.5 pl-1 group-hover:pl-2 group-hover:pr-1 rounded-lg transition-all duration-150 ease-out text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Public Garden Board"
                >
                  <span className="text-3xl flex-shrink-0 flex items-center justify-center w-6 h-8 overflow-visible group-hover:w-8 group-hover:h-10 transition-all duration-300">💌</span>
                  <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                    <span className="text-sm font-medium leading-tight">Public Board</span>
                  </div>
                </Link>
                {/* Browse Profiles */}
                <Link
                  href="/profiles"
                  className="relative flex flex-row items-center gap-3 w-full py-2.5 pl-1 group-hover:pl-2 group-hover:pr-1 rounded-lg transition-all duration-150 ease-out text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Browse Profiles"
                >
                  <span className="text-3xl flex-shrink-0 flex items-center justify-center w-6 h-8 overflow-visible group-hover:w-8 group-hover:h-10 transition-all duration-300">👤</span>
                  <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                    <span className="text-sm font-medium leading-tight">Browse Profiles</span>
                  </div>
                </Link>
                {/* Learner Communities */}
                <Link
                  href="/skills/explore"
                  className="relative flex flex-row items-center gap-3 w-full py-2.5 pl-1 group-hover:pl-2 group-hover:pr-1 rounded-lg transition-all duration-150 ease-out text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Learner Communities"
                >
                  <span className="text-3xl flex-shrink-0 flex items-center justify-center w-6 h-8 overflow-visible group-hover:w-8 group-hover:h-10 transition-all duration-300">🌱</span>
                  <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                    <span className="text-sm font-medium leading-tight">Learner Communities</span>
                  </div>
                </Link>
                {/* Learning Quests */}
                <Link
                  href="/learner-quests"
                  className="relative flex flex-row items-center gap-3 w-full py-2.5 pl-1 group-hover:pl-2 group-hover:pr-1 rounded-lg transition-all duration-150 ease-out text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Learning Quests"
                >
                  <span className="text-3xl flex-shrink-0 flex items-center justify-center w-6 h-8 overflow-visible group-hover:w-8 group-hover:h-10 transition-all duration-300">📚</span>
                  <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                    <span className="text-sm font-medium leading-tight">Learning Quests</span>
                  </div>
                </Link>
              </div>
            </div>
          );
        })()}
        
        {/* Notifications - above logout */}
        {wallet && (
          <div className="mt-auto pt-4 border-t border-gray-200/50 dark:border-gray-700/50 w-full">
            <Link
              href="/notifications"
                className={`
                  relative flex flex-row items-center gap-3
                  w-full py-2.5 pl-1 group-hover:pl-2 group-hover:pr-1
                  rounded-lg
                  transition-all duration-150 ease-out
                  ${isActive('/notifications')
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                `}
            >
              <span className="relative text-3xl flex-shrink-0 flex items-center justify-center w-6 h-8 overflow-visible group-hover:w-8 group-hover:h-10 transition-all duration-300">
                🔔
                {notificationCount !== null && notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </span>
              <span className="text-sm font-medium leading-tight opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">Notifications</span>
              {isActive('/notifications') && (
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 dark:bg-emerald-400 rounded-r"
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
          <div className="mt-auto pt-2 pb-4 border-t border-gray-200/50 dark:border-gray-700/50 w-full flex-shrink-0">
            <button
              onClick={async () => {
                if (typeof window !== 'undefined') {
                  // Disconnect MetaMask if it's a MetaMask wallet
                  const walletType = localStorage.getItem(`wallet_type_${wallet.toLowerCase()}`);
                  if (walletType === 'metamask' && window.ethereum) {
                    try {
                      const { disconnectWallet } = await import('@/lib/auth/metamask');
                      await disconnectWallet();
                    } catch (error) {
                      // Silently fail - clearing localStorage is the important part
                      console.warn('Failed to disconnect MetaMask:', error);
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
                  keysToRemove.forEach(key => localStorage.removeItem(key));
                  // Redirect to auth page
                  window.location.href = '/auth';
                }
              }}
              className="w-full flex flex-row items-center gap-3 py-2.5 pl-1 group-hover:pl-2 group-hover:pr-1 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150 ease-out"
              title="Disconnect wallet and logout"
            >
              <span className="text-3xl flex-shrink-0 flex items-center justify-center w-6 h-8 overflow-visible group-hover:w-8 group-hover:h-10 transition-all duration-300">⚡</span>
              <span className="text-sm font-medium leading-tight opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">Logout</span>
            </button>
          </div>
        )}
        </div>
      </div>
    </nav>
  );
}

