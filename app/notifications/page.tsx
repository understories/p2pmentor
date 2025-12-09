/**
 * Notifications page
 * 
 * Enhanced notifications with Arkiv-native persistence, filtering, and customization.
 * Uses client-side polling to detect new items and stores read/unread state on-chain.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { BackButton } from '@/components/BackButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { Notification } from '@/lib/notifications';
import type { NotificationPreferenceType } from '@/lib/arkiv/notificationPreferences';
import {
  detectMeetingRequests,
  detectProfileMatches,
  detectAskOfferMatches,
  detectNewOffers,
  detectAdminResponses,
  getUnreadCount,
} from '@/lib/notifications';
import type { Session } from '@/lib/arkiv/sessions';
import type { Ask } from '@/lib/arkiv/asks';
import type { Offer } from '@/lib/arkiv/offers';
import type { UserProfile } from '@/lib/arkiv/profile';

const POLL_INTERVAL = 30000; // 30 seconds

type FilterType = 'all' | 'unread' | 'read';
type FilterNotificationType = 'all' | NotificationPreferenceType;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // Filtering state
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterNotificationType, setFilterNotificationType] = useState<FilterNotificationType>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Track previously seen items to detect new ones
  const previousSessionKeys = useRef<Set<string>>(new Set());
  const previousMatchedWallets = useRef<Set<string>>(new Set());
  const previousMatches = useRef<Set<string>>(new Set());
  const previousOfferKeys = useRef<Set<string>>(new Set());
  const previousResponseKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Get user wallet from localStorage
    const storedWallet = localStorage.getItem('wallet_address');
    if (storedWallet) {
      setUserWallet(storedWallet);
      loadNotifications(storedWallet);
      loadNotificationPreferences(storedWallet);
      
      // Set up polling
      const interval = setInterval(() => {
        loadNotifications(storedWallet);
      }, POLL_INTERVAL);
      
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, []);

  // Load notification preferences from Arkiv
  const loadNotificationPreferences = async (wallet: string) => {
    try {
      const res = await fetch(`/api/notifications/preferences?wallet=${wallet}`);
      const data = await res.json();
      
      if (data.ok && data.preferences) {
        // Map preferences to notifications
        const preferenceMap = new Map<string, boolean>();
        data.preferences.forEach((pref: any) => {
          if (!pref.archived) {
            preferenceMap.set(pref.notificationId, pref.read);
          }
        });
        
        // Update notifications with persisted read state
        setNotifications(prev => prev.map(n => {
          const persistedRead = preferenceMap.get(n.id);
          if (persistedRead !== undefined) {
            return { ...n, read: persistedRead };
          }
          return n;
        }));
      }
    } catch (err) {
      console.error('Error loading notification preferences:', err);
    }
  };

  const loadNotifications = async (wallet: string) => {
    try {
      const res = await fetch(`/api/notifications?wallet=${wallet}`);
      const data = await res.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Failed to load notifications');
      }

      const { sessions, userAsks, allOffers, allProfiles, adminResponses } = data.data;
      
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
      sessions.forEach((s: Session) => previousSessionKeys.current.add(s.key));
      
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
      allOffers.forEach((o: Offer) => previousOfferKeys.current.add(o.key));
      
      // Admin responses
      const adminResponseNotifs = detectAdminResponses(
        adminResponses || [],
        wallet,
        previousResponseKeys.current
      );
      newNotifications.push(...adminResponseNotifs);

      // Update seen response keys
      (adminResponses || []).forEach((r: any) => previousResponseKeys.current.add(r.key));
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

  const markAsRead = async (notificationId: string) => {
    if (!userWallet) return;
    
    // Optimistic update
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    
    // Persist to Arkiv
    try {
      const notification = notifications.find(n => n.id === notificationId);
      if (notification) {
        await fetch('/api/notifications/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: userWallet,
            notificationId,
            notificationType: notification.type,
            read: true,
            archived: false,
          }),
        });
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
      // Revert on error
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: false } : n
        )
      );
    }
  };

  const markAsUnread = async (notificationId: string) => {
    if (!userWallet) return;
    
    // Optimistic update
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: false } : n
      )
    );
    
    // Persist to Arkiv
    try {
      const notification = notifications.find(n => n.id === notificationId);
      if (notification) {
        await fetch('/api/notifications/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: userWallet,
            notificationId,
            notificationType: notification.type,
            read: false,
            archived: false,
          }),
        });
      }
    } catch (err) {
      console.error('Error marking notification as unread:', err);
      // Revert on error
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
    }
  };

  const markAllAsRead = async () => {
    if (!userWallet) return;
    
    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) return;
    
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    
    // Persist to Arkiv
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: userWallet,
          preferences: unreadNotifications.map(n => ({
            notificationId: n.id,
            notificationType: n.type,
            read: true,
            archived: false,
          })),
        }),
      });
    } catch (err) {
      console.error('Error marking all as read:', err);
      // Revert on error
      setNotifications(prev => prev.map(n => {
        const wasUnread = unreadNotifications.some(un => un.id === n.id);
        return wasUnread ? { ...n, read: false } : n;
      }));
    }
  };

  const markAllAsUnread = async () => {
    if (!userWallet) return;
    
    const readNotifications = notifications.filter(n => n.read);
    if (readNotifications.length === 0) return;
    
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: false })));
    
    // Persist to Arkiv
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: userWallet,
          preferences: readNotifications.map(n => ({
            notificationId: n.id,
            notificationType: n.type,
            read: false,
            archived: false,
          })),
        }),
      });
    } catch (err) {
      console.error('Error marking all as unread:', err);
      // Revert on error
      setNotifications(prev => prev.map(n => {
        const wasRead = readNotifications.some(rn => rn.id === n.id);
        return wasRead ? { ...n, read: true } : n;
      }));
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!userWallet) return;
    
    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    
    // Persist to Arkiv (mark as archived)
    try {
      const notification = notifications.find(n => n.id === notificationId);
      if (notification) {
        await fetch('/api/notifications/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: userWallet,
            notificationId,
            notificationType: notification.type,
            read: notification.read,
            archived: true,
          }),
        });
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
      // Revert on error - reload preferences
      loadNotificationPreferences(userWallet);
    }
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
      case 'admin_response':
        return '💬';
      default:
        return '🔔';
    }
  };

  const unreadCount = getUnreadCount(notifications);

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    // Filter by read/unread status
    if (filterType === 'unread' && n.read) return false;
    if (filterType === 'read' && !n.read) return false;
    
    // Filter by notification type
    if (filterNotificationType !== 'all' && n.type !== filterNotificationType) return false;
    
    return true;
  });

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
      <ThemeToggle />
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>
        
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-semibold">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-3 px-2 py-1 text-sm font-medium bg-blue-600 text-white rounded-full">
                  {unreadCount}
                </span>
              )}
            </h1>
            <div className="flex gap-3 items-center">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {showFilters ? 'Hide' : 'Show'} Filters
              </button>
              {notifications.length > 0 && (
                <div className="flex gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                  {notifications.filter(n => n.read).length > 0 && (
                    <button
                      onClick={markAllAsUnread}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Mark all as unread
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as FilterType)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="all">All</option>
                    <option value="unread">Unread</option>
                    <option value="read">Read</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type
                  </label>
                  <select
                    value={filterNotificationType}
                    onChange={(e) => setFilterNotificationType(e.target.value as FilterNotificationType)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="all">All Types</option>
                    <option value="meeting_request">📅 Meeting Requests</option>
                    <option value="profile_match">👤 Profile Matches</option>
                    <option value="ask_offer_match">🔗 Ask & Offer Matches</option>
                    <option value="new_offer">💡 New Offers</option>
                    <option value="admin_response">💬 Admin Responses</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredNotifications.length} of {notifications.length} notifications
              </div>
            </div>
          )}
        </div>

        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              {notifications.length === 0 
                ? 'No notifications yet'
                : 'No notifications match your filters'}
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
              {notifications.length === 0
                ? "You'll see meeting requests, matches, and new offers here"
                : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
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
                    {notification.read ? (
                      <button
                        onClick={() => markAsUnread(notification.id)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Mark as unread"
                      >
                        ↶
                      </button>
                    ) : (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Mark as read"
                      >
                        ✓
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
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


