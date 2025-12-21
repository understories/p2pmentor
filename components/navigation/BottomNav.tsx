/**
 * Top Navigation Bar (Mobile)
 * 
 * Phase 0: Simple top nav bar with 4-5 primary sections.
 * Minimal motion (120-200ms, ease-out).
 */

'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useTheme } from '@/lib/theme';
import { useNotificationCount } from '@/lib/hooks/useNotificationCount';
import { useOnboardingLevel } from '@/lib/onboarding/useOnboardingLevel';
import { hasOnboardingBypass } from '@/lib/onboarding/access';
import { navTokens } from '@/lib/design/navTokens';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
  minLevel?: number; // Minimum onboarding level required
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const notificationCount = useNotificationCount();
  const [wallet, setWallet] = useState<string | null>(null);
  const { level, loading: levelLoading } = useOnboardingLevel(wallet);
  const [hasBypass, setHasBypass] = useState(false);
  const [hideText, setHideText] = useState(false);
  const [showOnboardingPopup, setShowOnboardingPopup] = useState(false);

  // Primary navigation items with unlock levels - same as SidebarNav
  const allNavItems: Array<NavItem> = [
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
      minLevel: 1, // After profile creation (matches desktop sidebar)
    },
    {
      href: '/skills/explore',
      label: 'Skills',
      icon: '🌿',
      minLevel: 1, // After profile creation
    },
    {
      href: '/learner-quests',
      label: 'Quests',
      icon: '🧭',
      minLevel: 1, // After profile creation (like other nav items)
    },
    {
      href: '/me/sessions',
      label: 'Sessions',
      icon: '📅',
      minLevel: 1, // After profile creation
    },
    {
      href: '/notifications',
      label: 'Notifications',
      icon: '🔔',
      badge: notificationCount !== null && notificationCount > 0 ? notificationCount : undefined,
      minLevel: 1, // After profile creation
    },
  ];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedWallet = localStorage.getItem('wallet_address');
      setWallet(storedWallet);
      // Check bypass flag
      setHasBypass(hasOnboardingBypass());
    }
  }, []);

  // Filter nav items based on onboarding level
  // If bypass is active or level is loading, show all items
  // Otherwise, filter based on level
  const navItems = allNavItems
    .filter(item => {
      if (item.minLevel === undefined) return true;
      if (hasBypass || levelLoading) return true; // Show all during bypass or loading
      return level >= item.minLevel;
    })
    .map(({ minLevel, ...item }) => item); // Remove minLevel from final items

  // Check if we should hide text based on viewport width and item count
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkTextVisibility = () => {
        const totalItems = navItems.length + 2; // +2 for theme and logout
        const viewportWidth = window.innerWidth;
        // Hide text if viewport is narrow OR if we have more than 5 items
        // Roughly 60px per item with text, 40px per item without text
        const needsText = totalItems * 60 > viewportWidth;
        setHideText(needsText || totalItems > 5);
      };
      
      checkTextVisibility();
      window.addEventListener('resize', checkTextVisibility);
      return () => window.removeEventListener('resize', checkTextVisibility);
    }
  }, [navItems.length]);

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
      className="md:hidden fixed top-0 left-0 right-0 z-50 border-b border-gray-200/30 dark:border-emerald-900/30 safe-area-inset-top bg-white/95 dark:bg-emerald-950/95 backdrop-blur-sm"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0)',
      }}
    >
      <div className="flex items-center h-14 w-full px-0.5">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const isDashboard = item.href === '/me';

          // Intercept all navigation clicks during onboarding
          const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
              // Check if we're on onboarding page
              if (pathname === '/onboarding') {
                e.preventDefault();
              setShowOnboardingPopup(true);
                return;
              }

              // Check if onboarding is complete (level >= 2 means ask or offer created)
              // Level 0 = no profile, Level 1 = profile + skills, Level 2+ = has ask/offer
            if (wallet && !levelLoading && level !== null && level < 2) {
                e.preventDefault();
              setShowOnboardingPopup(true);
                return;
            }
          };

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={`
                relative flex flex-col items-center justify-center
                flex-1 h-full min-w-0 max-w-full
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
                flexBasis: 0, // Ensure equal distribution
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
              <span className="text-lg mb-0.5 flex-shrink-0">{item.icon}</span>
              {!hideText && (
                <div className="flex flex-col items-center min-w-0 w-full">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate w-full text-center">
                    {item.label}
                  </span>
                  {item.href === '/me' && wallet && (
                    <span className="text-[9px] text-gray-500 dark:text-gray-500 font-mono leading-tight mt-0.5 truncate w-full text-center">
                      {wallet.slice(0, 6)}...{wallet.slice(-4)}
                    </span>
                  )}
                </div>
              )}
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
              className="flex flex-col items-center justify-center flex-1 h-full min-w-0 max-w-full transition-opacity duration-150 ease-out opacity-60 hover:opacity-80"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ flexBasis: 0 }}
            >
              <span className="text-lg mb-0.5 flex-shrink-0">{theme === 'dark' ? '☀️' : '🌙'}</span>
              {!hideText && (
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate w-full text-center">Theme</span>
              )}
        </button>
        {/* Logout Button */}
        <button
              onClick={async () => {
                if (typeof window !== 'undefined') {
                  // Disconnect MetaMask if it's a MetaMask wallet
                  const walletAddress = localStorage.getItem('wallet_address');
                  if (walletAddress) {
                    const walletType = localStorage.getItem(`wallet_type_${walletAddress.toLowerCase()}`);
                    if (walletType === 'metamask' && window.ethereum) {
                      try {
                        const { disconnectWallet } = await import('@/lib/auth/metamask');
                        await disconnectWallet();
                      } catch (error) {
                        // Silently fail - clearing localStorage is the important part
                        console.warn('Failed to disconnect MetaMask:', error);
                      }
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
              className="flex flex-col items-center justify-center flex-1 h-full min-w-0 max-w-full transition-opacity duration-150 ease-out opacity-60 hover:opacity-80"
              title="Disconnect wallet and logout"
              style={{ flexBasis: 0 }}
            >
              <span className="text-lg mb-0.5 flex-shrink-0">⚡</span>
              {!hideText && (
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate w-full text-center">Logout</span>
              )}
        </button>
      </div>

      {/* Onboarding Popup */}
      {showOnboardingPopup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="text-6xl mb-4">🌱</div>
              <h3 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Click grow to start
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Complete onboarding to unlock navigation.
              </p>
              <button
                onClick={() => setShowOnboardingPopup(false)}
                className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 font-medium text-lg shadow-lg hover:shadow-xl"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

