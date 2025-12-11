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
import { askEmojis, offerEmojis } from '@/lib/colors';
import { useNotificationCount } from '@/lib/hooks/useNotificationCount';
import { navTokens } from '@/lib/design/navTokens';
import { ConstellationLines } from '@/components/navigation/ConstellationLines';
import { useOnboardingLevel } from '@/lib/onboarding/useOnboardingLevel';

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
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedWallet = localStorage.getItem('wallet_address');
      setWallet(storedWallet);
    }
  }, []);

  // Primary navigation items with unlock levels
  const allNavItems: Array<NavItem & { minLevel?: number }> = [
    {
      href: '/me',
      label: 'Me',
      icon: '👤',
      minLevel: 0, // Always available
    },
    {
      href: '/garden/public-board',
      label: 'Garden',
      icon: '🌱',
      minLevel: 1, // After identity + skills
    },
    {
      href: '/asks',
      label: 'Asks',
      icon: askEmojis.default,
      minLevel: 2, // After first ask or offer
    },
    {
      href: '/offers',
      label: 'Offers',
      icon: offerEmojis.default,
      minLevel: 2, // After first ask or offer
    },
    {
      href: '/me/sessions',
      label: 'Sessions',
      icon: '📅',
      minLevel: 4, // After community join
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
      return pathname === '/me' || pathname.startsWith('/me/');
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
    <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 z-30 bg-white/60 dark:bg-gray-900/60 backdrop-blur-md border-r border-gray-200/50 dark:border-gray-700/50">
      <div className="relative flex flex-col items-center py-4 space-y-2 w-full">
        {/* Constellation Lines */}
        <ConstellationLines
          itemCount={navItems.length}
          itemHeight={72} // Approximate height per item (py-3 + space-y-2)
          containerHeight={navItems.length * 72}
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
                relative flex flex-col items-center justify-center
                w-full py-3 px-2
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
              <span className="relative text-2xl mb-1">
                {item.icon}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>
              <span className="text-xs font-medium text-center leading-tight">
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
      </div>
    </nav>
  );
}

