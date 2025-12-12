/**
 * Top Navigation Bar (Mobile)
 * 
 * Phase 0: Simple top nav bar with 4-5 primary sections.
 * Minimal motion (120-200ms, ease-out).
 */

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from '@/lib/theme';
import { useNotificationCount } from '@/lib/hooks/useNotificationCount';
import { navTokens } from '@/lib/design/navTokens';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
}

export function BottomNav() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const notificationCount = useNotificationCount();

  // Primary navigation items - simplified for mobile
  const navItems: NavItem[] = [
    {
      href: '/me',
      label: 'Dashboard',
      icon: '👤',
    },
    {
      href: '/network',
      label: 'Network',
      icon: '🌐',
    },
    {
      href: '/me/sessions',
      label: 'Sessions',
      icon: '📅',
    },
    {
      href: '/notifications',
      label: 'Notifications',
      icon: '🔔',
      badge: notificationCount !== null && notificationCount > 0 ? notificationCount : undefined,
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
      className="md:hidden fixed top-0 left-0 right-0 z-40 border-b border-gray-200/30 dark:border-gray-700/30 safe-area-inset-top"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0)',
      }}
    >
      <div className="flex items-center h-14 max-w-2xl mx-auto px-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                relative flex flex-col items-center justify-center
                flex-1 h-full min-w-0
                transition-all duration-150 ease-out
                ${active 
                  ? 'opacity-100' 
                  : 'opacity-60 hover:opacity-80'
                }
              `}
              style={{
                boxShadow: active
                  ? `0 0 8px ${navTokens.node.active.glow}`
                  : undefined,
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.boxShadow = `0 0 6px ${navTokens.node.hover.glow}`;
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.boxShadow = '';
                }
              }}
            >
              <span className="text-lg mb-0.5">{item.icon}</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {item.label}
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-0 right-1/2 translate-x-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
              {active && (
                <div 
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-emerald-500 dark:bg-emerald-400 rounded-t"
                  style={{
                    transition: 'opacity 150ms ease-out',
                    boxShadow: `0 0 4px ${navTokens.node.active.borderGlow}`,
                  }}
                />
              )}
            </Link>
          );
        })}
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex flex-col items-center justify-center flex-1 h-full min-w-0 transition-opacity duration-150 ease-out opacity-60 hover:opacity-80"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="text-lg mb-0.5">{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Theme</span>
        </button>
        {/* Logout Button */}
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
          className="flex flex-col items-center justify-center flex-1 h-full min-w-0 transition-opacity duration-150 ease-out opacity-60 hover:opacity-80"
          title="Disconnect wallet and logout"
        >
          <span className="text-lg mb-0.5">⚡</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Logout</span>
        </button>
      </div>
    </nav>
  );
}

