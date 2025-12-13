/**
 * Hook to fetch unread notification count
 * 
 * Uses the same logic as the dashboard to count pending sessions
 * where the user hasn't confirmed yet.
 */

'use client';

import { useState, useEffect } from 'react';

export function useNotificationCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const wallet = typeof window !== 'undefined' 
      ? localStorage.getItem('wallet_address')
      : null;

    if (!wallet) {
      setCount(null);
      return;
    }

    const loadCount = async () => {
      try {
        const res = await fetch(`/api/notifications?wallet=${wallet}`);
        const data = await res.json();
        if (!data.ok) {
          setCount(0);
          return;
        }
        
        // Simple count: pending sessions where user hasn't confirmed
        const { sessions } = data.data;
        const pendingCount = sessions.filter((s: any) => {
          if (s.status !== 'pending') return false;
          const isMentor = s.mentorWallet.toLowerCase() === wallet.toLowerCase();
          const isLearner = s.learnerWallet.toLowerCase() === wallet.toLowerCase();
          if (!isMentor && !isLearner) return false;
          const hasConfirmed = isMentor ? s.mentorConfirmed : s.learnerConfirmed;
          return !hasConfirmed;
        }).length;
        
        setCount(pendingCount);
      } catch (err) {
        console.error('Error loading notification count:', err);
        setCount(0);
      }
    };

    loadCount();
    
    // Poll every 30 seconds to keep count updated
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return count;
}
