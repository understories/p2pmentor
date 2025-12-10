/**
 * Auto Theme Switcher
 * 
 * Automatically switches between dark and light mode every 30 seconds
 * with a soft fade transition. No visual indicators - completely subtle.
 * Only active on landing page.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from '@/lib/theme';
import { usePathname } from 'next/navigation';

// Track if user has manually toggled theme (shared across instances)
let userHasToggled = false;

const SWITCH_INTERVAL = 30000; // 30 seconds

export function SunriseSunsetTimer() {
  const { setTheme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only run on landing page
    if (pathname !== '/') {
      return;
    }

    // Check if user has already set a preference (manual toggle)
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      // User has a saved preference - don't auto-switch
      userHasToggled = true;
      return;
    }

    // Ensure we start in dark mode on first visit (only if no saved preference)
    if (!userHasToggled) {
      setTheme('dark');
    }

    // Listen for manual theme toggles
    const handleThemeToggle = () => {
      userHasToggled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    
    window.addEventListener('theme-toggled', handleThemeToggle);
    
    // Switch theme every 30 seconds with soft fade (only if user hasn't toggled)
    if (!userHasToggled) {
      intervalRef.current = setInterval(() => {
        // Check again before toggling (user might have toggled)
        if (userHasToggled) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return;
        }
        toggleTheme();
      }, SWITCH_INTERVAL);
    }

    return () => {
      window.removeEventListener('theme-toggled', handleThemeToggle);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [setTheme, toggleTheme, pathname]);

  // No visual output - completely invisible
  return null;
}
