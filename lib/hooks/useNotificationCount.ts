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
        const res = await fetch(`/api/notifications?wallet=${wallet}&status=active`);
        const data = await res.json();
        if (!data.ok) {
          setCount(0);
          return;
        }
        
        // Count unread notifications
        // Check localStorage for notification preferences to determine read status
        const notifications = data.notifications || [];
        let unreadCount = 0;
        
        notifications.forEach((n: any) => {
          const notificationId = n.key;
          const prefStr = localStorage.getItem(`notification_pref_${notificationId}`);
          if (prefStr) {
            try {
              const pref = JSON.parse(prefStr);
              if (!pref.read && !pref.archived) {
                unreadCount++;
              }
            } catch (e) {
              // If pref can't be parsed, treat as unread
              unreadCount++;
            }
          } else {
            // No preference stored, treat as unread
            unreadCount++;
          }
        });
        
        setCount(unreadCount);
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
