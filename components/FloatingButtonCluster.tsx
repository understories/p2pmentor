'use client';

/**
 * Floating Button Cluster
 *
 * Organic cluster of logo buttons that grow on hover.
 * Matches the garden aesthetic with proximity-based scaling.
 * On mobile, buttons are fixed below content (for lite page).
 */

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { AppFeedbackModal } from './AppFeedbackModal';

interface FloatingButton {
  id: string;
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  tooltip: string;
  ariaLabel: string;
  className?: string;
}

export function FloatingButtonCluster() {
  const pathname = usePathname();
  const isLitePage = pathname === '/lite';
  const { theme, toggleTheme } = useTheme();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const clusterRef = useRef<HTMLDivElement>(null);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Track wallet from localStorage
  useEffect(() => {
    const getWallet = () => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('wallet_address');
        if (stored) {
          setWallet(stored);
        }
      }
    };

    getWallet();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', getWallet);
      const interval = setInterval(getWallet, 1000);
      return () => {
        window.removeEventListener('storage', getWallet);
        clearInterval(interval);
      };
    }
  }, []);

  // Check if profile exists
  useEffect(() => {
    const checkProfile = async () => {
      if (!wallet) {
        setHasProfile(null);
        return;
      }

      try {
        const res = await fetch(`/api/profile?wallet=${encodeURIComponent(wallet)}`);
        const data = await res.json();
        setHasProfile(data.ok && data.profile !== null);
      } catch (err) {
        console.error('Error checking profile:', err);
        setHasProfile(null);
      }
    };

    checkProfile();
    // Poll every 30 seconds to check for profile creation
    const interval = setInterval(checkProfile, 30000);
    return () => clearInterval(interval);
  }, [wallet]);

  // Track mouse position for proximity-based scaling (desktop only)
  useEffect(() => {
    if (isMobile) return; // Skip on mobile

    const handleMouseMove = (e: MouseEvent) => {
      if (clusterRef.current) {
        const rect = clusterRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        setMousePos({
          x: e.clientX - centerX,
          y: e.clientY - centerY,
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isMobile]);

  // Calculate distance from mouse to cluster center (desktop only)
  const distance = Math.sqrt(mousePos.x ** 2 + mousePos.y ** 2);
  const proximityScale = isMobile ? 1 : Math.max(1, 1.1 - distance / 1000); // Scale up when mouse is close

  const handleThemeToggle = () => {
    toggleTheme();
    // Mark that user has manually toggled (stops auto-switching on landing page)
    if (pathname === '/') {
      window.dispatchEvent(new Event('theme-toggled'));
    }
  };

  const buttons: FloatingButton[] = [
    {
      id: 'understories',
      href: 'https://understories.github.io',
      icon: (
        <div className="relative h-5 w-5">
          {/* Glowing background */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(150, 255, 150, 0.6) 0%, rgba(50, 200, 50, 0.3) 40%, transparent 70%)',
              boxShadow: `
                0 0 20px rgba(150, 255, 150, 0.6),
                0 0 40px rgba(100, 255, 100, 0.4),
                0 0 60px rgba(50, 255, 50, 0.2),
                inset 0 0 20px rgba(200, 255, 200, 0.3)
              `,
              animation: 'glowPulse 2s ease-in-out infinite',
            }}
          />
          {/* Stem */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-sm"
            style={{
              width: '2px',
              height: '40%',
              background:
                'linear-gradient(180deg, rgba(100, 200, 100, 0.8) 0%, rgba(50, 150, 50, 0.6) 100%)',
              boxShadow: '0 0 10px rgba(100, 255, 100, 0.4)',
            }}
          />
          {/* Leaves container */}
          <div className="absolute left-1/2 top-[20%] h-[60%] w-[60%] -translate-x-1/2">
            {/* Leaf 1 - Top */}
            <div
              className="absolute left-1/2 top-0 -translate-x-1/2 -rotate-45"
              style={{
                width: '40%',
                height: '40%',
                background:
                  'radial-gradient(circle, rgba(150, 255, 150, 0.9) 0%, rgba(50, 200, 50, 0.7) 100%)',
                borderRadius: '50% 0',
                boxShadow: '0 0 15px rgba(150, 255, 150, 0.6)',
              }}
            />
            {/* Leaf 2 - Left */}
            <div
              className="absolute left-0 top-[33%] rotate-45"
              style={{
                width: '40%',
                height: '40%',
                background:
                  'radial-gradient(circle, rgba(150, 255, 150, 0.9) 0%, rgba(50, 200, 50, 0.7) 100%)',
                borderRadius: '50% 0',
                boxShadow: '0 0 15px rgba(150, 255, 150, 0.6)',
              }}
            />
            {/* Leaf 3 - Right */}
            <div
              className="absolute right-0 top-[33%] -rotate-45"
              style={{
                width: '40%',
                height: '40%',
                background:
                  'radial-gradient(circle, rgba(150, 255, 150, 0.9) 0%, rgba(50, 200, 50, 0.7) 100%)',
                borderRadius: '50% 0',
                boxShadow: '0 0 15px rgba(150, 255, 150, 0.6)',
              }}
            />
            {/* Leaf 4 - Bottom */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 rotate-45"
              style={{
                width: '40%',
                height: '40%',
                background:
                  'radial-gradient(circle, rgba(150, 255, 150, 0.9) 0%, rgba(50, 200, 50, 0.7) 100%)',
                borderRadius: '50% 0',
                boxShadow: '0 0 15px rgba(150, 255, 150, 0.6)',
              }}
            />
          </div>
        </div>
      ),
      tooltip: 'Grown by Understories',
      ariaLabel: 'Grown by Understories',
      className: 'bg-transparent',
    },
    {
      id: 'arkiv',
      href: 'http://arkiv.network',
      icon: <span className="text-sm font-bold leading-none">[A]</span>,
      tooltip: 'Powered by Arkiv',
      ariaLabel: 'Powered by Arkiv',
      className:
        'bg-gradient-to-br from-purple-600 to-indigo-700 dark:from-purple-500 dark:to-indigo-600',
    },
    {
      id: 'github',
      href: 'https://github.com/understories/p2pmentor',
      icon: (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            clipRule="evenodd"
          />
        </svg>
      ),
      tooltip: 'View on GitHub',
      ariaLabel: 'View source code on GitHub',
      className: 'bg-gray-800 dark:bg-gray-100',
    },
    {
      id: 'x',
      href: 'http://x.com/p2pmentor',
      icon: (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      tooltip: 'follow us on X',
      ariaLabel: 'follow us on X',
      className: 'bg-black dark:bg-gray-900',
    },
    {
      id: 'docs',
      href: isLitePage ? '/docs/user-flows/lite-version' : '/docs',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      ),
      tooltip: isLitePage ? 'Lite version docs' : 'Beta docs',
      ariaLabel: isLitePage ? 'View lite version documentation' : 'View beta documentation',
      className: 'bg-amber-600 hover:bg-amber-700',
    },
    // Theme toggle button - only on lite page
    ...(isLitePage
      ? [
          {
            id: 'theme',
            onClick: handleThemeToggle,
            icon: <span className="text-lg">{theme === 'dark' ? '☀️' : '🌙'}</span>,
            tooltip: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
            ariaLabel: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
            className: 'bg-gray-700 dark:bg-gray-300 hover:bg-gray-600 dark:hover:bg-gray-400',
          },
        ]
      : []),
    // Hide feedback button on lite page
    ...(isLitePage
      ? []
      : [
          {
            id: 'feedback',
            onClick: () => setIsFeedbackOpen(true),
            icon: (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
            ),
            tooltip: 'Share feedback',
            ariaLabel: 'Share feedback',
            className: 'bg-blue-600 hover:bg-blue-700',
          },
        ]),
  ];

  // On mobile for lite page, position below content instead of floating
  const isMobileLite = isMobile && isLitePage;

  const renderButton = (button: FloatingButton) => {
    const isHovered = hoveredId === button.id;
    const scale = isHovered ? 1.4 : 1;
    const zIndex = isHovered ? 60 : 50;

    const buttonContent = (
      <div
        className={`relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full shadow-lg transition-all duration-300 ease-out hover:shadow-xl ${button.className || ''} `}
        style={{
          transform: `scale(${scale})`,
          zIndex,
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease-out',
        }}
        onMouseEnter={() => setHoveredId(button.id)}
        onMouseLeave={() => setHoveredId(null)}
        onClick={button.onClick}
        aria-label={button.ariaLabel}
        title={button.tooltip}
      >
        <div
          className={
            button.id === 'github'
              ? 'text-white dark:text-gray-800'
              : button.id === 'x'
                ? 'text-white'
                : button.id === 'theme'
                  ? 'text-white dark:text-gray-900'
                  : 'text-white'
          }
        >
          {button.icon}
        </div>

        {/* Tooltip */}
        {isHovered && (
          <div
            className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg dark:bg-gray-800 dark:text-white"
            style={{
              animation: 'fadeIn 0.2s ease-out',
              color: 'white',
            }}
          >
            {button.tooltip}
            <div className="absolute right-4 top-full h-0 w-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
          </div>
        )}
      </div>
    );

    if (button.href) {
      return (
        <a
          key={button.id}
          href={button.href}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          {buttonContent}
        </a>
      );
    }

    return <div key={button.id}>{buttonContent}</div>;
  };

  return (
    <>
      <div
        ref={clusterRef}
        className={
          isMobileLite
            ? 'sticky bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-2 border-t border-gray-200 bg-white/90 p-4 backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/90'
            : 'fixed bottom-6 right-6 z-50 flex items-center gap-1.5'
        }
        style={
          isMobileLite
            ? {}
            : {
                transform: `scale(${proximityScale})`,
                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }
        }
      >
        {/* Collapsible: show buttons only when expanded (desktop non-lite) */}
        {isMobileLite ? (
          buttons.map(renderButton)
        ) : (
          <>
            {isExpanded && (
              <div
                className="flex items-center gap-1.5"
                style={{ animation: 'fadeIn 0.2s ease-out' }}
              >
                {buttons.map(renderButton)}
              </div>
            )}
            <div
              className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-gray-700 shadow-lg transition-all duration-300 hover:shadow-xl dark:bg-gray-600"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? 'Collapse menu' : 'Expand menu'}
              title={isExpanded ? 'Collapse menu' : 'Expand menu'}
            >
              <svg
                className="h-5 w-5 text-white transition-transform duration-300"
                style={{ transform: isExpanded ? 'rotate(45deg)' : 'rotate(0deg)' }}
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
            </div>
          </>
        )}
      </div>

      <AppFeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        userWallet={wallet}
      />
    </>
  );
}
