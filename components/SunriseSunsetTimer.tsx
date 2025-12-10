/**
 * Sunrise/Sunset Timer Component
 * 
 * Shows a sunrise/sunset animation with circular progress timer on the landing page.
 * Starts in dark mode, transitions to light mode after timer, then back to dark.
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useTheme } from '@/lib/theme';

const TIMER_DURATION = 8000; // 8 seconds - slow enough to not distract, fast enough to see

interface SunriseSunsetTimerProps {
  onComplete?: () => void;
}

export function SunriseSunsetTimer({ onComplete }: SunriseSunsetTimerProps) {
  const { theme, setTheme } = useTheme();
  const [phase, setPhase] = useState<'sunrise' | 'sunset' | 'idle'>('sunrise');
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
    // Ensure we start in dark mode
    setTheme('dark');
    
    // Start sunrise timer after a brief delay
    const delay = setTimeout(() => {
      startSunrise();
    }, 1000);

    return () => {
      clearTimeout(delay);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startSunrise = () => {
    setPhase('sunrise');
    setProgress(0);
    startTimeRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        const newProgress = Math.min((elapsed / TIMER_DURATION) * 100, 100);
        setProgress(newProgress);

        if (newProgress >= 100) {
          // Complete sunrise - transition to light mode with smooth fade
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          
          // Smooth transition over 1 second
          const transitionDuration = 1000;
          const startTransition = Date.now();
          const transitionInterval = setInterval(() => {
            const elapsed = Date.now() - startTransition;
            if (elapsed >= transitionDuration) {
              clearInterval(transitionInterval);
              setTheme('light');
              setPhase('idle');
              
              // Wait a bit, then start sunset
              setTimeout(() => {
                startSunset();
              }, 2000);
            }
          }, 16); // ~60fps
        }
      }
    }, 50); // Update every 50ms for smooth animation
  };

  const startSunset = () => {
    setPhase('sunset');
    setProgress(0);
    startTimeRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        const newProgress = Math.min((elapsed / TIMER_DURATION) * 100, 100);
        setProgress(newProgress);

        if (newProgress >= 100) {
          // Complete sunset - transition to dark mode with smooth fade
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          
          // Smooth transition over 1 second
          const transitionDuration = 1000;
          const startTransition = Date.now();
          const transitionInterval = setInterval(() => {
            const elapsed = Date.now() - startTransition;
            if (elapsed >= transitionDuration) {
              clearInterval(transitionInterval);
              setTheme('dark');
              setPhase('idle');
              onComplete?.();
            }
          }, 16); // ~60fps
        }
      }
    }, 50);
  };

  if (!mounted || phase === 'idle') {
    return null;
  }

  const isSunrise = phase === 'sunrise';
  const emoji = isSunrise ? '🌅' : '🌇';
  const remaining = Math.ceil((TIMER_DURATION - (progress / 100) * TIMER_DURATION) / 1000);
  
  // Calculate circle progress (SVG circle)
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex items-center gap-3 p-3 rounded-lg border transition-all duration-500"
      style={{
        backgroundColor: theme === 'dark' 
          ? 'rgba(5, 20, 5, 0.6)' 
          : 'rgba(240, 240, 240, 0.9)',
        borderColor: theme === 'dark'
          ? 'rgba(255, 200, 100, 0.4)'
          : 'rgba(255, 150, 50, 0.3)',
        backdropFilter: 'blur(10px)',
        boxShadow: theme === 'dark'
          ? '0 0 20px rgba(255, 200, 100, 0.2), inset 0 0 20px rgba(255, 200, 100, 0.1)'
          : '0 0 20px rgba(255, 150, 50, 0.15)',
      }}
    >
      {/* Circular Progress Timer */}
      <div className="relative w-12 h-12">
        <svg className="transform -rotate-90 w-12 h-12">
          <circle
            cx="24"
            cy="24"
            r={radius}
            stroke={theme === 'dark' ? 'rgba(255, 200, 100, 0.3)' : 'rgba(255, 150, 50, 0.3)'}
            strokeWidth="3"
            fill="none"
          />
          <circle
            cx="24"
            cy="24"
            r={radius}
            stroke={theme === 'dark' ? 'rgba(255, 200, 100, 0.9)' : 'rgba(255, 150, 50, 0.9)'}
            strokeWidth="3"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.1s linear',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl">{emoji}</span>
        </div>
      </div>

      {/* Countdown Text */}
      <div className="flex flex-col">
        <span
          className="text-sm font-medium"
          style={{
            color: theme === 'dark'
              ? 'rgba(255, 200, 100, 0.9)'
              : 'rgba(255, 150, 50, 0.9)',
          }}
        >
          {isSunrise ? 'Sunrise' : 'Sunset'}
        </span>
        <span
          className="text-xs opacity-75"
          style={{
            color: theme === 'dark'
              ? 'rgba(255, 200, 100, 0.7)'
              : 'rgba(255, 150, 50, 0.7)',
          }}
        >
          {remaining}s
        </span>
      </div>
    </div>
  );
}
