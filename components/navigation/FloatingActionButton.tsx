/**
 * Floating Action Button (FAB)
 * 
 * Phase 0: Simple "+" button that expands to Create Ask/Offer/Session.
 * Routes to existing create forms.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { askColors, askEmojis, offerColors, offerEmojis } from '@/lib/colors';

export function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Don't show on landing, auth, beta, admin, or docs pages
  const hideNavPaths = ['/', '/auth', '/beta', '/admin', '/docs'];
  if (hideNavPaths.some(path => pathname === path || pathname?.startsWith('/admin') || pathname?.startsWith('/docs'))) {
    return null;
  }

  const actions = [
    {
      href: '/asks',
      label: 'Create Ask',
      icon: askEmojis.default,
      color: askColors.button,
    },
    {
      href: '/offers',
      label: 'Create Offer',
      icon: offerEmojis.default,
      color: offerColors.button,
    },
    {
      href: '/garden/public-board',
      label: 'Leave Garden Note',
      icon: '🌱',
      color: 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600',
      queryParam: 'create=true',
    },
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
          onClick={() => setIsOpen(false)}
          style={{
            transition: 'opacity 150ms ease-out',
          }}
        />
      )}

      {/* FAB Container - positioned above FloatingButtonCluster */}
      <div className="fixed bottom-24 right-6 z-50 md:bottom-6 md:left-24">
        {/* Action Buttons */}
        {isOpen && (
          <div
            className="flex flex-col-reverse gap-3 mb-3"
            style={{
              animation: 'fadeInUp 150ms ease-out',
            }}
          >
            {actions.map((action, index) => {
              // Add query param to trigger create form
              const hrefWithCreate = action.href === '/asks' 
                ? '/asks?create=true'
                : action.href === '/offers'
                ? '/offers?create=true'
                : action.queryParam
                ? `${action.href}?${action.queryParam}`
                : action.href;
              
              return (
                <Link
                  key={action.href}
                  href={hrefWithCreate}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center gap-3
                    px-4 py-3
                    rounded-full
                    ${action.color}
                    shadow-lg
                    transition-transform duration-150 ease-out
                    hover:scale-105
                  `}
                  style={{
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  <span className="text-xl">{action.icon}</span>
                  <span className="text-sm font-medium text-white whitespace-nowrap">
                    {action.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Main FAB Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-14 h-14
            rounded-full
            bg-blue-600 hover:bg-blue-700
            dark:bg-blue-500 dark:hover:bg-blue-600
            text-white
            shadow-lg hover:shadow-xl
            flex items-center justify-center
            transition-all duration-150 ease-out
            ${isOpen ? 'rotate-45' : ''}
          `}
          aria-label={isOpen ? 'Close menu' : 'Create'}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
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

