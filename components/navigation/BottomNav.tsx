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
import { createPortal } from 'react-dom';
import { useTheme } from '@/lib/theme';
import { useNotificationCount } from '@/lib/hooks/useNotificationCount';
import { useOnboardingLevel } from '@/lib/onboarding/useOnboardingLevel';
import { hasOnboardingBypass, hasReviewModeBypass } from '@/lib/onboarding/access';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import type { UserProfile } from '@/lib/arkiv/profile';
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
  const { level, loading: levelLoading, error: levelError } = useOnboardingLevel(wallet);
  const [hasBypass, setHasBypass] = useState(false);
  const [hideText, setHideText] = useState(false);
  const [showOnboardingPopup, setShowOnboardingPopup] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

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
    }
  }, []);

  // Filter nav items based on onboarding level
  // If bypass is active, level is loading, or there's an error, show all items
  // Otherwise, filter based on level
  // On error, be permissive to avoid locking out users
  const navItems = allNavItems
    .filter((item) => {
      if (item.minLevel === undefined) return true;
      if (hasBypass || levelLoading || levelError) return true; // Show all during bypass, loading, or on error
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
  if (hideNavPaths.some((path) => pathname === path || pathname.startsWith('/admin'))) {
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
      className="safe-area-inset-top fixed left-0 right-0 top-0 z-50 border-b border-gray-200/30 bg-white/95 backdrop-blur-sm dark:border-emerald-900/30 dark:bg-emerald-950/95 md:hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0)',
      }}
    >
      <div className="flex h-14 w-full items-center px-0.5">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const isDashboard = item.href === '/me';

          // Intercept all navigation clicks during onboarding
          const handleNavClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
            // Check if we're on onboarding page
            if (pathname === '/onboarding') {
              e.preventDefault();
              setShowOnboardingPopup(true);
              return;
            }

            // Don't block if bypass is active, review mode bypass is active, loading, or there's an error
            if (hasBypass || hasReviewModeBypass() || levelLoading || levelError) {
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
              !levelLoading &&
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
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={`relative flex h-full min-w-0 max-w-full flex-1 flex-col items-center justify-center transition-all duration-150 ease-out ${
                active ? 'opacity-100' : 'opacity-60 hover:opacity-80'
              } `}
              style={{
                boxShadow: active ? `0 0 8px ${navTokens.node.active.glow}` : undefined,
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
              <span className="mb-0.5 flex-shrink-0 text-lg">{item.icon}</span>
              {!hideText && (
                <div className="flex w-full min-w-0 flex-col items-center">
                  <span className="w-full truncate text-center text-xs font-medium text-gray-700 dark:text-gray-300">
                    {item.label}
                  </span>
                  {item.href === '/me' && wallet && (
                    <span className="mt-0.5 w-full truncate text-center font-mono text-[9px] leading-tight text-gray-500 dark:text-gray-500">
                      {wallet.slice(0, 6)}...{wallet.slice(-4)}
                    </span>
                  )}
                </div>
              )}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute right-1/2 top-0 flex h-[18px] min-w-[18px] translate-x-2 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
              {active && (
                <div
                  className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-t bg-emerald-500 dark:bg-emerald-400"
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
          className="flex h-full min-w-0 max-w-full flex-1 flex-col items-center justify-center opacity-60 transition-opacity duration-150 ease-out hover:opacity-80"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{ flexBasis: 0 }}
        >
          <span className="mb-0.5 flex-shrink-0 text-lg">{theme === 'dark' ? '☀️' : '🌙'}</span>
          {!hideText && (
            <span className="w-full truncate text-center text-xs font-medium text-gray-700 dark:text-gray-300">
              Theme
            </span>
          )}
        </button>
        {/* Logout Button */}
        <button
          onClick={async () => {
            if (typeof window !== 'undefined') {
              // Disconnect wallet based on type
              const walletAddress = localStorage.getItem('wallet_address');
              if (walletAddress) {
                const walletType = localStorage.getItem(
                  `wallet_type_${walletAddress.toLowerCase()}`
                );

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
                    await disconnectWalletConnect(walletAddress);
                  } catch (error) {
                    // Silently fail - clearing localStorage is the important part
                    console.warn('Failed to disconnect WalletConnect:', error);
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
              keysToRemove.forEach((key) => localStorage.removeItem(key));
              // Redirect to auth page
              window.location.href = '/auth';
            }
          }}
          className="flex h-full min-w-0 max-w-full flex-1 flex-col items-center justify-center opacity-60 transition-opacity duration-150 ease-out hover:opacity-80"
          title="Disconnect wallet and logout"
          style={{ flexBasis: 0 }}
        >
          <span className="mb-0.5 flex-shrink-0 text-lg">⚡</span>
          {!hideText && (
            <span className="w-full truncate text-center text-xs font-medium text-gray-700 dark:text-gray-300">
              Logout
            </span>
          )}
        </button>
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
