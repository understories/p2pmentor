/**
 * Hook to fetch unread notification count
 * 
 * Complete overhaul following admin notification pattern (Pattern B).
 * Uses notification.read directly from notification payload, no separate preferences.
 * 
 * Key changes:
 * - Removed separate notification_preference entities
 * - Read/archived state stored directly in notification payload
 * - Simplified code, no preference management needed
 * 
 * Reference: refs/docs/admin-vs-regular-notifications-comparison.md
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
        // Normalize wallet to lowercase for consistent querying
        const normalizedWallet = wallet.toLowerCase().trim();
        
        // Load notifications (read/archived state is in payload)
        const res = await fetch(`/api/notifications?wallet=${encodeURIComponent(normalizedWallet)}&archived=false`);
        const data = await res.json();
        
        if (!data.ok) {
          setCount(0);
          return;
        }
        
        // Count unread notifications (read state is in notification payload)
        const notifications = data.notifications || [];
        const unreadCount = notifications.filter((n: any) => !n.archived && !(n.read ?? false)).length;
        
        setCount(unreadCount);
      } catch (err) {
        console.error('Error loading notification count:', err);
        setCount(0);
      }
    };

    loadCount();
    
    // Poll every 30 seconds to keep count updated
    const interval = setInterval(loadCount, 30000);
    
    // Listen for notification updates from notifications page
    const handleNotificationUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ wallet?: string }>;
      const currentWallet = typeof window !== 'undefined' 
        ? localStorage.getItem('wallet_address')?.toLowerCase().trim()
        : null;
      
      // Only refresh if the update is for the current wallet (or no wallet specified)
      if (!customEvent.detail.wallet || 
          customEvent.detail.wallet.toLowerCase().trim() === currentWallet) {
        // Small delay to ensure Arkiv has indexed the update
        setTimeout(() => {
          loadCount();
        }, 500);
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('notification-preferences-updated', handleNotificationUpdate);
    }
    
    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('notification-preferences-updated', handleNotificationUpdate);
      }
    };
  }, []);

  return count;
}
