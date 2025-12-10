/**
 * Sidebar Navigation Component (Desktop)
 * 
 * Phase 0: Simple vertical nav with icons + labels.
 * Same sections as bottom nav.
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

export function SidebarNav() {
  const pathname = usePathname();

  // Primary navigation items (same as bottom nav)
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
    <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-r border-gray-200 dark:border-gray-700">
      <div className="flex flex-col items-center py-4 space-y-2 w-full">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center justify-center
                w-full py-3 px-2
                rounded-lg
                transition-all duration-150 ease-out
                ${active
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }
              `}
              title={item.label}
            >
              <span className="text-2xl mb-1">{item.icon}</span>
              <span className="text-xs font-medium text-center leading-tight">
                {item.label}
              </span>
              {active && (
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 dark:bg-blue-400 rounded-r"
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

