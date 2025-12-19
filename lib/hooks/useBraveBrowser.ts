/**
 * Hook to detect Brave browser
 * 
 * PRESERVED FOR FUTURE USE: This hook is currently disabled due to issues.
 * It can be re-enabled when needed by uncommenting the import and usage in AppShell.tsx
 * 
 * Brave browser has a unique user agent and navigator.brave property.
 * This hook detects Brave and returns a boolean.
 * 
 * Reference: https://brave.com/privacy/browser/
 */

'use client';

import { useState, useEffect } from 'react';

// PRESERVED FOR FUTURE USE: Currently disabled
export function useBraveBrowser(): boolean {
  const [isBrave, setIsBrave] = useState(false);

  useEffect(() => {
    // Check for Brave-specific properties
    // Brave sets navigator.brave and has a unique user agent
    const checkBrave = () => {
      // Method 1: Check for navigator.brave property (most reliable)
      if (typeof window !== 'undefined' && (window.navigator as any).brave) {
        return true;
      }

      // Method 2: Check user agent for Brave indicators
      if (typeof window !== 'undefined' && window.navigator.userAgent) {
        const ua = window.navigator.userAgent.toLowerCase();
        // Brave user agent contains "brave" or has specific patterns
        if (ua.includes('brave')) {
          return true;
        }
      }

      return false;
    };

    setIsBrave(checkBrave());
  }, []);

  return isBrave;
}

