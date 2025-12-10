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

    // Ensure we start in dark mode
    setTheme('dark');
    
    // Switch theme every 30 seconds with soft fade
    // Use toggleTheme to avoid dependency on theme state
    intervalRef.current = setInterval(() => {
      // Smooth transition handled by CSS transitions (2s ease)
      toggleTheme();
    }, SWITCH_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [setTheme, toggleTheme, pathname]);

  // No visual output - completely invisible
  return null;
}
