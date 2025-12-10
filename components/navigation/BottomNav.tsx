/**
 * Bottom Navigation Component (Mobile)
 * 
 * Phase 0: Simple bottom nav with 4-5 primary sections.
 * Minimal motion (120-200ms, ease-out).
 */

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { askEmojis, offerEmojis } from '@/lib/colors';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
}

export function BottomNav() {
  const pathname = usePathname();

  // Primary navigation items (4-5 max)
  const navItems: NavItem[] = [
    {
      href: '/me',
      label: 'Me',
      icon: '👤',
    },
    {
      href: '/network',
      label: 'Network',
      icon: '🌐',
    },
    {
      href: '/asks',
      label: 'Asks',
      icon: askEmojis.default,
    },
    {
      href: '/offers',
      label: 'Offers',
      icon: offerEmojis.default,
    },
    {
      href: '/me/sessions',
      label: 'Sessions',
      icon: '📅',
    },
  ];

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

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 safe-area-inset-bottom"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      <div className="flex items-center justify-around h-16 max-w-2xl mx-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                relative flex flex-col items-center justify-center
                flex-1 h-full
                transition-opacity duration-150 ease-out
                ${active 
                  ? 'opacity-100' 
                  : 'opacity-60 hover:opacity-80'
                }
              `}
            >
              <span className="text-xl mb-0.5">{item.icon}</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {item.label}
              </span>
              {active && (
                <div 
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t"
                  style={{
                    transition: 'opacity 150ms ease-out',
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

