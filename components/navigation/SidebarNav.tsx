/**
 * Sidebar Navigation Component (Desktop)
 * 
 * Phase 0: Simple vertical nav with icons + labels.
 * Same sections as bottom nav.
 */

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useNotificationCount } from '@/lib/hooks/useNotificationCount';
import { navTokens } from '@/lib/design/navTokens';
import { ConstellationLines } from '@/components/navigation/ConstellationLines';
import { useOnboardingLevel } from '@/lib/onboarding/useOnboardingLevel';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { profileToGardenSkills, levelToEmoji } from '@/lib/garden/types';
import { listSessionsForWallet } from '@/lib/arkiv/sessions';
import { getSidebarSkillId } from '@/lib/sessions/display';
import { listLearningFollows } from '@/lib/arkiv/learningFollow';
import { listSkills } from '@/lib/arkiv/skill';
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
  const notificationCount = useNotificationCount();
  const [hoveredIndex, setHoveredIndex] = useState<number | undefined>();
  
  // Get onboarding level for navigation unlocking
  const [wallet, setWallet] = useState<string | null>(null);
  const { level } = useOnboardingLevel(wallet);
  const [gardenSkills, setGardenSkills] = useState<any[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [skillsMap, setSkillsMap] = useState<Record<string, Skill>>({});
  const [followedCommunities, setFollowedCommunities] = useState<LearningFollow[]>([]);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedWallet = localStorage.getItem('wallet_address');
      setWallet(storedWallet);
      
      // Load all skills for mapping skill_id to name_canonical
      // This is used to display skill names in sessions sidebar
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
        })
        .catch(() => {
          // Skills not found - that's okay
        });
      
      // Load garden skills and upcoming sessions for sidebar
      if (storedWallet) {
        getProfileByWallet(storedWallet)
          .then((profile: UserProfile | null) => {
            if (profile) {
              const skills = profileToGardenSkills(profile.skillsArray, profile.skillExpertise);
              setGardenSkills(skills);
            }
          })
          .catch(() => {
            // Profile not found - that's okay
          });
        
        // Load upcoming sessions
        listSessionsForWallet(storedWallet)
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
            setUpcomingSessions(upcoming);
          })
          .catch(() => {
            // Sessions not found - that's okay
          });
        
        // Load followed communities for join/leave state
        listLearningFollows({ profile_wallet: storedWallet, active: true })
          .then((follows) => {
            setFollowedCommunities(follows);
          })
          .catch(() => {
            // Communities not found - that's okay
          });
      }
    }
  }, []);

  // Primary navigation items with unlock levels
  // Only Dashboard, Network, and Notifications in main nav
  const allNavItems: Array<NavItem & { minLevel?: number }> = [
    {
      href: '/me',
      label: 'Dashboard',
      icon: '👤',
      minLevel: 0, // Always available
    },
    {
      href: '/network',
      label: 'Network',
      icon: '🌐',
      minLevel: 3, // After network exploration
    },
    {
      href: '/notifications',
      label: 'Notifications',
      icon: '🔔',
      badge: notificationCount !== null && notificationCount > 0 ? notificationCount : undefined,
      minLevel: 0, // Always available
    },
  ];

  // Filter nav items based on onboarding level
  const navItems = allNavItems
    .filter(item => {
      if (item.minLevel === undefined) return true;
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
    <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-56 z-30 border-r border-gray-200/30 dark:border-gray-700/30">
      <div className="relative flex flex-col items-start py-4 space-y-2 w-full px-3">
        {/* Constellation Lines */}
        <ConstellationLines
          itemCount={navItems.length}
          itemHeight={48} // Approximate height per item (py-2.5 + space-y-2)
          containerHeight={navItems.length * 48}
          activeIndex={activeIndex >= 0 ? activeIndex : undefined}
          hoveredIndex={hoveredIndex}
        />
        
        {navItems.map((item, index) => {
          const active = isActive(item.href);
          const itemMinLevel = allNavItems.find(ni => ni.href === item.href)?.minLevel ?? 0;
          const isLocked = itemMinLevel > level;
          
          return (
            <Link
              key={item.href}
              href={isLocked ? '/onboarding' : item.href}
              className={`
                relative flex flex-row items-center gap-3
                w-full py-2.5 px-3
                rounded-lg
                transition-all duration-150 ease-out
                ${isLocked 
                  ? 'opacity-30 cursor-not-allowed'
                  : active
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }
              `}
              title={isLocked ? `Complete onboarding to unlock ${item.label}` : item.label}
              onClick={(e) => {
                if (isLocked) {
                  e.preventDefault();
                }
              }}
              style={{
                boxShadow: active
                  ? `0 0 12px ${navTokens.node.active.glow}`
                  : undefined,
                transform: active ? `scale(${navTokens.node.active.scale})` : undefined,
              }}
              onMouseEnter={(e) => {
                if (!isLocked) {
                  setHoveredIndex(index);
                  if (!active) {
                    e.currentTarget.style.boxShadow = `0 0 8px ${navTokens.node.hover.glow}`;
                    e.currentTarget.style.transform = `scale(${navTokens.node.hover.scale})`;
                  }
                }
              }}
              onMouseLeave={(e) => {
                setHoveredIndex(undefined);
                if (!active && !isLocked) {
                  e.currentTarget.style.boxShadow = '';
                  e.currentTarget.style.transform = '';
                }
              }}
            >
              <span className="relative text-xl flex-shrink-0">
                {item.icon}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>
              <span className="text-sm font-medium leading-tight">
                {item.label}
              </span>
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
          );
        })}
        
        {/* Sessions Button - above upcoming sessions */}
        {level >= 1 && (
          <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 w-full">
            <Link
              href="/me/sessions"
              className={`
                relative flex flex-row items-center gap-3
                w-full py-2.5 px-3
                rounded-lg
                transition-all duration-150 ease-out
                ${isActive('/me/sessions')
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }
              `}
            >
              <span className="text-xl flex-shrink-0">📅</span>
              <span className="text-sm font-medium leading-tight">Sessions</span>
              {isActive('/me/sessions') && (
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
                      <div
                        key={session.key}
                        className="flex flex-row items-center gap-2 p-2 rounded-lg"
                        title={`${skillName} - ${dateStr} at ${timeStr}`}
                      >
                        <span className="text-base flex-shrink-0">📖</span>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm text-gray-700 dark:text-gray-300 font-medium leading-tight">
                            {skillName}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {dateStr} {timeStr}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
        
        
        {/* Garden Button - above your skills */}
        {level >= 1 && (
          <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 w-full">
            <Link
              href="/garden/public-board"
              className={`
                relative flex flex-row items-center gap-3
                w-full py-2.5 px-3
                rounded-lg
                transition-all duration-150 ease-out
                ${isActive('/garden/public-board')
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }
              `}
            >
              <span className="text-xl flex-shrink-0">🌱</span>
              <span className="text-sm font-medium leading-tight">Garden</span>
              {isActive('/garden/public-board') && (
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
        
        {/* Your Skills - shows profile's skills (deduplicated) with links to topic pages */}
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
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium px-3">
                  your skills
                </div>
                <div className="flex flex-wrap gap-2">
                  {uniqueSkills.slice(0, 6).map((skill) => {
                    // Find skill entity by name to get slug for topic page link
                    const skillEntity = Object.values(skillsMap).find(s => 
                      s.name_canonical?.toLowerCase().trim() === skill.name.toLowerCase().trim()
                    );
                    // If skill entity found, link to topic page; otherwise link to network with onboarding param to bypass check
                    const skillLink = skillEntity 
                      ? `/topic/${skillEntity.slug}` 
                      : `/network?skill=${encodeURIComponent(skill.name)}&onboarding=true`;
                    
                    return (
                      <Link
                        key={skill.id}
                        href={skillLink}
                        className="relative flex items-center gap-1.5 hg-anim-plant-idle hover:opacity-80 transition-opacity"
                        title={`${skill.name} - ${skill.level === 0 ? 'Beginner' : skill.level === 2 ? 'Intermediate' : skill.level >= 3 && skill.level <= 4 ? 'Advanced' : 'Expert'}`}
                      >
                        <span className="text-lg flex-shrink-0">
                          {levelToEmoji(skill.level)}
                        </span>
                        <span 
                          className="text-xs text-gray-600 dark:text-gray-400 leading-tight"
                          style={{
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            lineHeight: '1.3',
                          }}
                          title={skill.name}
                        >
                          {skill.name}
                        </span>
                      </Link>
                    );
                  })}
                  {uniqueSkills.length > 6 && (
                    <div className="text-sm text-gray-400 dark:text-gray-500">
                      +{uniqueSkills.length - 6}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
        
        {/* Logout Button */}
        {wallet && (
          <div className="mt-auto pt-4 border-t border-gray-200/50 dark:border-gray-700/50 w-full">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
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
              className="w-full flex flex-row items-center gap-3 py-2.5 px-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150 ease-out"
              title="Disconnect wallet and logout"
            >
              <span className="text-xl flex-shrink-0">⚡</span>
              <span className="text-sm font-medium leading-tight">Logout</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

