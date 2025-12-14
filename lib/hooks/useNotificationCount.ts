/**
 * Hook to fetch unread notification count
 * 
 * Uses the EXACT same logic as the notifications page:
 * 1. Loads notifications from /api/notifications
 * 2. Loads preferences from /api/notifications/preferences (Arkiv-native)
 * 3. Filters out archived notifications
 * 4. Counts unread notifications
 * 
 * This ensures the badge count matches the notifications page count.
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
        // Normalize wallet to lowercase for consistent querying (same as notifications page)
        const normalizedWallet = wallet.toLowerCase().trim();
        
        // Load preferences FIRST (same as notifications page)
        // This ensures we use Arkiv-native preferences, not localStorage
        const [notificationsRes, preferencesRes] = await Promise.all([
          fetch(`/api/notifications?wallet=${encodeURIComponent(normalizedWallet)}&status=active`),
          fetch(`/api/notifications/preferences?wallet=${encodeURIComponent(normalizedWallet)}`)
        ]);
        
        const notificationsData = await notificationsRes.json();
        const preferencesData = await preferencesRes.json();
        
        if (!notificationsData.ok) {
          setCount(0);
          return;
        }
        
        // Build preferences map (same as notifications page)
        const preferencesMap = new Map<string, { read: boolean; archived: boolean }>();
        if (preferencesData.ok && preferencesData.preferences) {
          preferencesData.preferences.forEach((pref: any) => {
            preferencesMap.set(pref.notificationId, {
              read: pref.read,
              archived: pref.archived,
            });
          });
        }
        
        // Count unread notifications using EXACT same logic as notifications page
        const notifications = notificationsData.notifications || [];
        let unreadCount = 0;
        
        notifications.forEach((n: any) => {
          const notificationId = n.key;
          const pref = preferencesMap.get(notificationId);
          
          // Filter out archived notifications (same as notifications page)
          if (pref?.archived) {
            return; // Skip archived notifications
          }
          
          // Count unread (same as notifications page: pref?.read ?? false means default to unread)
          const isRead = pref?.read ?? false;
          if (!isRead) {
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
    
    // Poll every 30 seconds to keep count updated (same interval as notifications page)
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return count;
}
