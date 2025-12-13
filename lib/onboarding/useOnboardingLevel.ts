/**
 * React Hook for Onboarding Level
 * 
 * Provides onboarding level and completion status with caching.
 */

import { useState, useEffect } from 'react';
import { calculateOnboardingLevel, isOnboardingComplete, getOnboardingProgress } from './state';
import { OnboardingLevel, OnboardingProgress } from './types';

export function useOnboardingLevel(wallet: string | null | undefined) {
  const [level, setLevel] = useState<OnboardingLevel | null>(null);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!wallet) {
      setLevel(0);
      setIsComplete(false);
      setProgress(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const walletAddress = wallet; // Type narrowing

    async function fetchLevel() {
      try {
        setLoading(true);
        setError(null);

        const [calculatedLevel, complete, progressData] = await Promise.all([
          calculateOnboardingLevel(walletAddress),
          isOnboardingComplete(walletAddress),
          getOnboardingProgress(walletAddress),
        ]);

        if (!cancelled) {
          setLevel(calculatedLevel);
          setIsComplete(complete);
          setProgress(progressData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to calculate onboarding level'));
          setLevel(0); // Default to level 0 on error
          setIsComplete(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchLevel();

    return () => {
      cancelled = true;
    };
  }, [wallet]);

  return {
    level: level ?? 0,
    isComplete,
    progress,
    loading,
    error,
  };
}
