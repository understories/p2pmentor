/**
 * Hook to access Arkiv Builder Mode state globally
 * 
 * Syncs with localStorage and listens for changes from GlobalToggles component.
 */

'use client';

import { useState, useEffect } from 'react';

export function useArkivBuilderMode(): boolean {
  const [arkivBuilderMode, setArkivBuilderMode] = useState(false);

  useEffect(() => {
    // Load initial state from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('arkiv_builder_mode');
      setArkivBuilderMode(saved === 'true');
      
      // Listen for custom event from GlobalToggles
      const handleModeChange = (e: Event) => {
        const customEvent = e as CustomEvent<{ enabled: boolean }>;
        setArkivBuilderMode(customEvent.detail.enabled);
      };
      
      // Listen for storage changes (from other tabs)
      const handleStorageChange = () => {
        const updated = localStorage.getItem('arkiv_builder_mode');
        setArkivBuilderMode(updated === 'true');
      };
      
      window.addEventListener('arkiv-builder-mode-changed', handleModeChange);
      window.addEventListener('storage', handleStorageChange);
      
      // Also check periodically (since storage event doesn't fire in same tab)
      const interval = setInterval(() => {
        const updated = localStorage.getItem('arkiv_builder_mode');
        if (updated === 'true' !== arkivBuilderMode) {
          setArkivBuilderMode(updated === 'true');
        }
      }, 500);
      
      return () => {
        window.removeEventListener('arkiv-builder-mode-changed', handleModeChange);
        window.removeEventListener('storage', handleStorageChange);
        clearInterval(interval);
      };
    }
  }, [arkivBuilderMode]);

  return arkivBuilderMode;
}

