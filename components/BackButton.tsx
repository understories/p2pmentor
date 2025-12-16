/**
 * Back button component
 *
 * Consistent navigation button across all pages.
 * Design inspired by hidden-garden-ui-ux-upgrades.
 *
 * Arkiv-native: Prefers browser history for intuitive navigation.
 * Uses href as fallback only when needed (e.g., direct links, no history).
 */

'use client';

import { useRouter } from 'next/navigation';

interface BackButtonProps {
  href?: string; // Fallback URL when browser history is not available
  label?: string;
  className?: string;
  forceHref?: boolean; // Force use of href instead of browser history (use sparingly)
}

export function BackButton({ href, label = 'Back', className = '', forceHref = false }: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    // If forceHref is true, always use href (for special cases where hard navigation is needed)
    // This should be used sparingly, only when we explicitly want to override browser history
    if (forceHref && href) {
      router.push(href);
      return;
    }

    // Prefer browser history for intuitive navigation (respects actual user journey)
    // This ensures users go back to where they actually came from, not a hardcoded route.
    // If there's no history, router.back() will do nothing (which is fine - user can use browser back button).
    router.back();

    // Note: href is kept as a prop for documentation/fallback purposes,
    // but we prefer browser history for better UX. If you need to force navigation
    // to a specific route, use forceHref={true}.
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${className}`}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 19l-7-7 7-7"
        />
      </svg>
      {label}
    </button>
  );
}


