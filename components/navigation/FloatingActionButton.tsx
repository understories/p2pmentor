/**
 * Floating Action Button (FAB)
 * 
 * Phase 6: Magical garden-themed FAB with seed-to-sprout transformation.
 * Filters actions based on onboarding level.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { askColors, askEmojis, offerColors, offerEmojis } from '@/lib/colors';
import { useOnboardingLevel } from '@/lib/onboarding/useOnboardingLevel';
import { hasOnboardingBypass } from '@/lib/onboarding/access';

export function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const [wallet, setWallet] = useState<string | null>(null);
  const { level, error: levelError } = useOnboardingLevel(wallet);
  const [hasBypass, setHasBypass] = useState(false);

  // Get wallet from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedWallet = localStorage.getItem('wallet_address');
      setWallet(storedWallet);
      setHasBypass(hasOnboardingBypass());
    }
  }, []);

  // Don't show on landing, auth, beta, admin, docs, or onboarding pages
  const hideNavPaths = ['/', '/auth', '/beta', '/admin', '/docs', '/onboarding'];
  if (hideNavPaths.some(path => pathname === path || pathname?.startsWith('/admin') || pathname?.startsWith('/docs') || pathname?.startsWith('/onboarding'))) {
    return null;
  }

  // All possible actions with their minimum onboarding levels
  const allActions = [
    {
      href: '/asks',
      label: 'Create Ask',
      icon: askEmojis.default,
      color: askColors.button,
      minLevel: 1, // After identity + skills
    },
    {
      href: '/offers',
      label: 'Create Offer',
      icon: offerEmojis.default,
      color: offerColors.button,
      minLevel: 1, // After identity + skills
    },
  ];

  // Filter actions based on onboarding level
  // On error or bypass, show all actions to avoid locking out users
  const actions = allActions.filter(action => {
    if (hasBypass || levelError) return true; // Show all during bypass or on error
    return level >= action.minLevel;
  });

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 md:hidden"
          onClick={() => setIsOpen(false)}
          style={{
            transition: 'opacity 150ms ease-out',
          }}
        />
      )}

      {/* FAB Container - positioned above FloatingButtonCluster, hidden on desktop */}
      <div className="fixed bottom-24 right-6 z-50 md:hidden">
        {/* Action Buttons - Grow from seed */}
        {isOpen && actions.length > 0 && (
          <div
            className="flex flex-col-reverse gap-3 mb-3"
            style={{
              animation: 'fadeInUp 200ms ease-out',
            }}
          >
            {actions.map((action, index) => {
              // Add query param to trigger create form
              const hrefWithCreate = action.href === '/asks' 
                ? '/asks?create=true'
                : action.href === '/offers'
                ? '/offers?create=true'
                : action.href;
              
              return (
                <Link
                  key={action.href}
                  href={hrefWithCreate}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center gap-2
                    px-3 py-2
                    rounded-full
                    ${action.color}
                    shadow-lg
                    transition-all duration-200 ease-out
                    hover:scale-105
                    ml-4
                    mb-1
                    hg-anim-plant-grow-in
                  `}
                  style={{
                    animationDelay: `${index * 80}ms`,
                  }}
                >
                  <span className="text-lg">{action.icon}</span>
                  <span className="text-sm font-medium text-white whitespace-nowrap">
                    {action.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Main FAB Button - Seed that becomes Sprout */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-14 h-14
            rounded-full
            bg-green-600 hover:bg-green-700
            dark:bg-green-500 dark:hover:bg-green-600
            text-white
            shadow-lg hover:shadow-xl
            flex items-center justify-center
            transition-all duration-300 ease-out
            ${isOpen ? 'hg-anim-plant-pulse' : 'hg-anim-plant-idle'}
          `}
          aria-label={isOpen ? 'Close menu' : 'Create'}
          style={{
            filter: isOpen ? 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.6))' : 'none',
          }}
        >
          <span 
            className="text-2xl transition-all duration-300"
            style={{
              transform: isOpen ? 'scale(1.1) rotate(5deg)' : 'scale(1)',
            }}
          >
            {isOpen ? '🌿' : '🌱'}
          </span>
        </button>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

