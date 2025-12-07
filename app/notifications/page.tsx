/**
 * Notifications page
 * 
 * UI-only notifications for meeting requests, matches, etc.
 * Uses client-side polling to detect new items.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { BackButton } from '@/components/BackButton';
import type { Notification } from '@/lib/notifications';
import {
  detectMeetingRequests,
  detectProfileMatches,
  detectAskOfferMatches,
  detectNewOffers,
  getUnreadCount,
} from '@/lib/notifications';
import type { Session } from '@/lib/arkiv/sessions';
import type { Ask, Offer } from '@/lib/arkiv/asks';
import type { UserProfile } from '@/lib/arkiv/profile';

const POLL_INTERVAL = 30000; // 30 seconds

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // Track previously seen items to detect new ones
  const previousSessionKeys = useRef<Set<string>>(new Set());
  const previousMatchedWallets = useRef<Set<string>>(new Set());
  const previousMatches = useRef<Set<string>>(new Set());
  const previousOfferKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Get user wallet from localStorage
    const storedWallet = localStorage.getItem('wallet_address');
    if (storedWallet) {
      setUserWallet(storedWallet);
      loadNotifications(storedWallet);
      
      // Set up polling
      const interval = setInterval(() => {
        loadNotifications(storedWallet);
      }, POLL_INTERVAL);
      
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, []);

  const loadNotifications = async (wallet: string) => {
    try {
      const res = await fetch(`/api/notifications?wallet=${wallet}`);
      const data = await res.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Failed to load notifications');
      }

      const { sessions, userAsks, allOffers, allProfiles } = data.data;
      
      // Load user profile
      if (!userProfile) {
        try {
          const profileRes = await fetch(`/api/profile?wallet=${wallet}`);
          const profileData = await profileRes.json();
          if (profileData.ok && profileData.profile) {
            setUserProfile(profileData.profile);
          }
        } catch (e) {
          console.error('Error loading user profile:', e);
        }
      }

      // Detect new notifications
      const newNotifications: Notification[] = [];
      
      // Meeting requests
      const meetingRequestNotifs = detectMeetingRequests(
        sessions,
        wallet,
        previousSessionKeys.current
      );
      newNotifications.push(...meetingRequestNotifs);
      
      // Update seen session keys
      sessions.forEach(s => previousSessionKeys.current.add(s.key));
      
      // Profile matches
      if (userProfile) {
        const profileMatchNotifs = detectProfileMatches(
          userProfile,
          allProfiles,
          wallet,
          previousMatchedWallets.current
        );
        newNotifications.push(...profileMatchNotifs);
        
        // Update seen matched wallets
        profileMatchNotifs.forEach(n => {
          if (n.metadata?.wallet) {
            previousMatchedWallets.current.add(n.metadata.wallet.toLowerCase());
          }
        });
      }
      
      // Ask & offer matches
      const askOfferMatchNotifs = detectAskOfferMatches(
        userAsks,
        allOffers,
        previousMatches.current
      );
      newNotifications.push(...askOfferMatchNotifs);
      
      // Update seen matches
      askOfferMatchNotifs.forEach(n => {
        if (n.metadata?.askKey && n.metadata?.offerKey) {
          previousMatches.current.add(`${n.metadata.askKey}_${n.metadata.offerKey}`);
        }
      });
      
      // New offers
      const newOfferNotifs = detectNewOffers(
        allOffers,
        wallet,
        previousOfferKeys.current
      );
      newNotifications.push(...newOfferNotifs);
      
      // Update seen offer keys
      allOffers.forEach(o => previousOfferKeys.current.add(o.key));
      
      // Merge with existing notifications (avoid duplicates)
      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id));
        const uniqueNew = newNotifications.filter(n => !existingIds.has(n.id));
        return [...uniqueNew, ...prev].sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      });
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error loading notifications:', err);
      setLoading(false);
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'meeting_request':
        return '📅';
      case 'profile_match':
        return '👤';
      case 'ask_offer_match':
        return '🔗';
      case 'new_offer':
        return '💡';
      default:
        return '🔔';
    }
  };

  const unreadCount = getUnreadCount(notifications);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <BackButton href="/me" />
          </div>
          <h1 className="text-3xl font-semibold mb-6">Notifications</h1>
          <p>Loading notifications...</p>
        </div>
      </div>
    );
  }

  if (!userWallet) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <BackButton href="/me" />
          </div>
          <h1 className="text-3xl font-semibold mb-6">Notifications</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Please connect your wallet to see notifications.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-semibold">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-3 px-2 py-1 text-sm font-medium bg-blue-600 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              No notifications yet
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
              You'll see meeting requests, matches, and new offers here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border ${
                  notification.read
                    ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{getNotificationIcon(notification.type)}</span>
                      <h3 className={`font-semibold ${notification.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-gray-100'}`}>
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {formatTime(notification.timestamp)}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        title="Mark as read"
                      >
                        ✓
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                </div>
                {notification.link && (
                  <a
                    href={notification.link}
                    className="mt-3 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={() => markAsRead(notification.id)}
                  >
                    View →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


