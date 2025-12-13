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
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import type { Notification } from '@/lib/notifications';
import type { NotificationPreferenceType } from '@/lib/arkiv/notificationPreferences';
import { getUnreadCount } from '@/lib/notifications';

const POLL_INTERVAL = 30000; // 30 seconds

type FilterType = 'all' | 'unread' | 'read';
type FilterNotificationType = 'all' | NotificationPreferenceType;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userWallet, setUserWallet] = useState<string | null>(null);
  
  // Filtering state
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterNotificationType, setFilterNotificationType] = useState<FilterNotificationType>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Store notification preferences to use for read/archived state
  const notificationPreferences = useRef<Map<string, { read: boolean; archived: boolean }>>(new Map());

  useEffect(() => {
    // Get user wallet from localStorage
    const storedWallet = localStorage.getItem('wallet_address');
    if (storedWallet) {
      setUserWallet(storedWallet);
      // Load preferences FIRST, then notifications
      loadNotificationPreferences(storedWallet).then(() => {
        loadNotifications(storedWallet);
      });
      
      // Set up polling
      const interval = setInterval(() => {
        loadNotificationPreferences(storedWallet).then(() => {
          loadNotifications(storedWallet);
        });
      }, POLL_INTERVAL);
      
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, []);

  // Load notification preferences from Arkiv
  const loadNotificationPreferences = async (wallet: string): Promise<void> => {
    try {
      const res = await fetch(`/api/notifications/preferences?wallet=${wallet}`);
      const data = await res.json();
      
      if (data.ok && data.preferences) {
        // Store preferences in ref for use during notification detection
        const prefMap = new Map<string, { read: boolean; archived: boolean }>();
        data.preferences.forEach((pref: any) => {
          prefMap.set(pref.notificationId, {
            read: pref.read,
            archived: pref.archived,
          });
        });
        notificationPreferences.current = prefMap;
        
        // Also update existing notifications with persisted read/archived state
        setNotifications(prev => {
          return prev.map(n => {
            const pref = notificationPreferences.current.get(n.id);
            if (pref) {
              return { ...n, read: pref.read };
            }
            return n;
          }).filter(n => {
            // Filter out archived notifications
            const pref = notificationPreferences.current.get(n.id);
            return !pref || !pref.archived;
          });
        });
      }
    } catch (err) {
      console.error('Error loading notification preferences:', err);
    }
  };

  const loadNotifications = async (wallet: string) => {
    try {
      const res = await fetch(`/api/notifications?wallet=${wallet}&status=active`);
      const data = await res.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Failed to load notifications');
      }

      // Notifications are now Arkiv entities, query directly
      const arkivNotifications = data.notifications || [];
      
      // Convert Arkiv notification entities to client Notification format
      // and apply preferences for read/archived state
      const notificationsWithPreferences = arkivNotifications
        .map((n: any): Notification | null => {
          // Use notification key as ID (Arkiv-native)
          const notificationId = n.key;
          const pref = notificationPreferences.current.get(notificationId);
          
          // Filter out archived notifications
          if (pref?.archived) {
            return null;
          }
          
          // Convert to client Notification format
          return {
            id: notificationId,
            type: n.notificationType,
            title: n.title,
            message: n.message,
            timestamp: n.createdAt,
            link: n.link,
            read: pref?.read ?? false, // Default to unread if no preference
            metadata: n.metadata || {},
          };
        })
        .filter((n: Notification | null): n is Notification => n !== null);

      // Update state with notifications from Arkiv
      setNotifications(notificationsWithPreferences.sort((a: Notification, b: Notification) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));
      
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
    
    // Update preferences ref
    const currentPref = notificationPreferences.current.get(notificationId);
    notificationPreferences.current.set(notificationId, {
      read: true,
      archived: currentPref?.archived || false,
    });
    
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
      // Revert preferences ref
      if (currentPref) {
        notificationPreferences.current.set(notificationId, currentPref);
      } else {
        notificationPreferences.current.delete(notificationId);
      }
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
    
    // Update preferences ref
    const currentPref = notificationPreferences.current.get(notificationId);
    notificationPreferences.current.set(notificationId, {
      read: false,
      archived: currentPref?.archived || false,
    });
    
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
      // Revert preferences ref
      if (currentPref) {
        notificationPreferences.current.set(notificationId, currentPref);
      } else {
        notificationPreferences.current.delete(notificationId);
      }
    }
  };

  const markAllAsRead = async () => {
    if (!userWallet) return;
    
    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) return;
    
    // Store previous state for revert
    const previousPrefs = new Map(notificationPreferences.current);
    
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    
    // Update preferences ref
    unreadNotifications.forEach(n => {
      const currentPref = notificationPreferences.current.get(n.id);
      notificationPreferences.current.set(n.id, {
        read: true,
        archived: currentPref?.archived || false,
      });
    });
    
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
      // Revert preferences ref
      notificationPreferences.current = previousPrefs;
    }
  };

  const markAllAsUnread = async () => {
    if (!userWallet) return;
    
    const readNotifications = notifications.filter(n => n.read);
    if (readNotifications.length === 0) return;
    
    // Store previous state for revert
    const previousPrefs = new Map(notificationPreferences.current);
    
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: false })));
    
    // Update preferences ref
    readNotifications.forEach(n => {
      const currentPref = notificationPreferences.current.get(n.id);
      notificationPreferences.current.set(n.id, {
        read: false,
        archived: currentPref?.archived || false,
      });
    });
    
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
      // Revert preferences ref
      notificationPreferences.current = previousPrefs;
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!userWallet) return;
    
    // Store previous state for revert
    const previousPref = notificationPreferences.current.get(notificationId);
    
    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    
    // Update preferences ref (mark as archived)
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notificationPreferences.current.set(notificationId, {
        read: notification.read,
        archived: true,
      });
    }
    
    // Persist to Arkiv (mark as archived)
    try {
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
      // Revert on error
      if (previousPref) {
        notificationPreferences.current.set(notificationId, previousPref);
      } else {
        notificationPreferences.current.delete(notificationId);
      }
      // Reload preferences to restore state
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
      case 'app_feedback_submitted':
        return '🔔';
      case 'issue_resolved':
        return '✅';
      default:
        return '🔔';
    }
  };

  // State for feedback details (for app_feedback_submitted notifications)
  const [feedbackDetails, setFeedbackDetails] = useState<Record<string, any>>({});
  const [loadingFeedback, setLoadingFeedback] = useState<Record<string, boolean>>({});

  // Load feedback details for app_feedback_submitted notifications
  const loadFeedbackDetails = async (feedbackKey: string) => {
    if (feedbackDetails[feedbackKey] || loadingFeedback[feedbackKey]) {
      return; // Already loaded or loading
    }

    setLoadingFeedback(prev => ({ ...prev, [feedbackKey]: true }));
    try {
      const res = await fetch(`/api/app-feedback?wallet=${userWallet}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.feedbacks) {
          const feedback = data.feedbacks.find((f: any) => f.key === feedbackKey);
          if (feedback) {
            setFeedbackDetails(prev => ({ ...prev, [feedbackKey]: feedback }));
          }
        }
      }
    } catch (err) {
      console.error('Error loading feedback details:', err);
    } finally {
      setLoadingFeedback(prev => ({ ...prev, [feedbackKey]: false }));
    }
  };

  // Format page path (same as admin dashboard)
  const formatPagePath = (page: string): string => {
    const profileMatch = page.match(/^\/profiles\/(0x[a-fA-F0-9]+)/);
    if (profileMatch) {
      return '/profiles/0x****...';
    }
    return page;
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
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
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
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
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
    <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
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
                <span className="ml-3 px-2 py-1 text-sm font-medium bg-emerald-600 dark:bg-emerald-500 text-white rounded-full">
                  {unreadCount}
                </span>
              )}
            </h1>
            <div className="flex gap-3 items-center">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="text-sm text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 px-3 py-1.5 rounded-full border border-emerald-300/50 dark:border-emerald-600/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-colors"
              >
                {showFilters ? 'Hide' : 'Show'} Filters
              </button>
              {notifications.length > 0 && (
                <div className="flex gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-sm text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 transition-colors"
                    >
                      Mark all as read
                    </button>
                  )}
                  {notifications.filter(n => n.read).length > 0 && (
                    <button
                      onClick={markAllAsUnread}
                      className="text-sm text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 transition-colors"
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
            {filteredNotifications.map((notification) => {
              const isFeedbackNotification = notification.type === 'app_feedback_submitted';
              const feedbackKey = notification.metadata?.feedbackKey;
              const feedback = feedbackKey ? feedbackDetails[feedbackKey] : null;
              const isLoadingFeedback = feedbackKey ? loadingFeedback[feedbackKey] : false;

              // Load feedback details if needed
              if (isFeedbackNotification && feedbackKey && !feedback && !isLoadingFeedback && userWallet) {
                loadFeedbackDetails(feedbackKey);
              }

              return (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border ${
                    notification.read
                      ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      : 'bg-emerald-50/30 dark:bg-emerald-900/20 border-emerald-200/50 dark:border-emerald-800/50'
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
                          <span className="text-xs opacity-75">✨</span>
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

                  {/* Show full feedback details for app_feedback_submitted notifications */}
                  {isFeedbackNotification && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      {isLoadingFeedback ? (
                        <div className="text-sm text-gray-500 dark:text-gray-400">Loading feedback details...</div>
                      ) : feedback ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400 font-medium">Date:</span>{' '}
                              <span className="text-gray-900 dark:text-gray-100">
                                {new Date(feedback.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400 font-medium">Type:</span>{' '}
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                feedback.feedbackType === 'issue'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                              }`}>
                                {feedback.feedbackType === 'issue' ? '🐛 Issue' : '💬 Feedback'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400 font-medium">Page:</span>{' '}
                              <span className="text-gray-900 dark:text-gray-100" title={feedback.page}>
                                {formatPagePath(feedback.page)}
                              </span>
                            </div>
                            {feedback.rating && (
                              <div>
                                <span className="text-gray-600 dark:text-gray-400 font-medium">Rating:</span>{' '}
                                <span className="text-yellow-500">
                                  {'★'.repeat(feedback.rating)}{'☆'.repeat(5 - feedback.rating)}
                                </span>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-600 dark:text-gray-400 font-medium">Status:</span>{' '}
                              {feedback.feedbackType === 'issue' ? (
                                feedback.resolved ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                    ✓ Resolved
                                    {feedback.resolvedAt && (
                                      <span className="ml-1 text-xs opacity-75">
                                        {new Date(feedback.resolvedAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                                    ⏳ Pending
                                  </span>
                                )
                              ) : (
                                feedback.hasResponse ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                    ✓ Responded
                                    {feedback.responseAt && (
                                      <span className="ml-1 text-xs opacity-75">
                                        {new Date(feedback.responseAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                    📬 Waiting Response
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400 font-medium text-sm">Message:</span>
                            <p className="text-gray-900 dark:text-gray-100 mt-1 whitespace-pre-wrap">
                              {feedback.message}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {feedback.txHash && (
                              <ViewOnArkivLink
                                entityKey={feedback.key}
                                txHash={feedback.txHash}
                                label="View on Arkiv"
                                className="text-xs"
                              />
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 dark:text-gray-400">Feedback details not available</div>
                      )}
                    </div>
                  )}

                  {/* Show link for other notification types (but not app_feedback_submitted) */}
                  {!isFeedbackNotification && notification.link && (
                    <a
                      href={notification.link}
                      className="mt-3 inline-block text-sm text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 transition-colors"
                      onClick={() => markAsRead(notification.id)}
                    >
                      View →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


