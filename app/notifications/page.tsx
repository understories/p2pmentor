/**
 * Notifications page
 *
 * Complete overhaul following admin notification pattern (Pattern B).
 * Uses updateEntity for state changes with state stored in notification payload.
 * 
 * Key changes:
 * - Removed separate notification_preference entities
 * - Read/archived state stored directly in notification payload
 * - Uses /api/notifications/state for state updates
 * - Simplified code, no preference management needed
 * 
 * Reference: refs/docs/admin-vs-regular-notifications-comparison.md
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { FeedbackModal } from '@/components/FeedbackModal';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { appendBuilderModeParams } from '@/lib/utils/builderMode';
import type { Notification } from '@/lib/notifications';
import { getUnreadCount } from '@/lib/notifications';
import type { Session } from '@/lib/arkiv/sessions';
import { deriveNotificationId } from '@/lib/arkiv/notifications';

const POLL_INTERVAL = 30000; // 30 seconds

type FilterType = 'all' | 'unread' | 'read';
type FilterNotificationType = 'all' | Notification['type'];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userWallet, setUserWallet] = useState<string | null>(null);

  // Filtering state
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterNotificationType, setFilterNotificationType] = useState<FilterNotificationType>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Arkiv Builder Mode state (global)
  const arkivBuilderMode = useArkivBuilderMode();

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
      // Normalize wallet to lowercase for consistent querying
      const normalizedWallet = wallet.toLowerCase().trim();
      const notificationsParams = `?wallet=${encodeURIComponent(normalizedWallet)}&archived=false`;
      const res = await fetch(`/api/notifications${appendBuilderModeParams(arkivBuilderMode, notificationsParams)}`);
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to load notifications');
      }

      // Notifications now include read/archived state in payload
      const arkivNotifications = data.notifications || [];

      // Convert Arkiv notification entities to client Notification format
      const notificationsList = arkivNotifications
        .filter((n: any) => !n.archived) // Filter out archived notifications
        .map((n: any): Notification => {
          // Ensure notificationId is available (from attributes, not metadata)
          const notificationId = n.notificationId || deriveNotificationId(n.sourceEntityType, n.sourceEntityKey);
          
          return {
            id: n.key, // Use entity key as ID
            type: n.notificationType,
            title: n.title,
            message: n.message,
            timestamp: n.createdAt,
            link: n.link,
            read: n.read ?? false, // Read state from notification payload
            metadata: {
              ...(n.metadata || {}),
              // Include full Arkiv entity data for Builder Mode
              sourceEntityKey: n.sourceEntityKey,
              sourceEntityType: n.sourceEntityType,
              notificationKey: n.key,
              notificationId: notificationId, // Store notificationId for state updates (critical!)
              notificationTxHash: n.txHash,
            },
          };
        });

      // Update state with notifications from Arkiv
      setNotifications(notificationsList.sort((a: Notification, b: Notification) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));

      setLoading(false);
    } catch (err: any) {
      console.error('Error loading notifications:', err);
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!userWallet) {
      console.error('[markAsRead] No userWallet, aborting');
      return;
    }

    const walletLower = userWallet.toLowerCase().trim();
    const notification = notifications.find(n => n.id === notificationId);
    
    if (!notification) {
      console.error('[markAsRead] Notification not found:', notificationId);
      return;
    }

    // Get notificationId from metadata (derived from sourceEntityType + sourceEntityKey)
    const notificationIdForUpdate = notification.metadata?.notificationId;
    if (!notificationIdForUpdate) {
      console.error('[markAsRead] Missing notificationId in metadata');
      return;
    }

    // Optimistic update
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );

    // Persist to Arkiv
    try {
      const response = await fetch('/api/notifications/state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletLower,
          notificationId: notificationIdForUpdate,
          read: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to mark as read');
      }

      // Small delay to ensure Arkiv has indexed the update
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh notifications to get updated state from Arkiv
      await loadNotifications(userWallet);

      // Dispatch event to notify other components (e.g., navbar) of the change
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-preferences-updated', {
          detail: { wallet: walletLower },
        }));
      }
    } catch (err) {
      console.error('[markAsRead] Error marking notification as read:', err);
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

    const walletLower = userWallet.toLowerCase().trim();
    const notification = notifications.find(n => n.id === notificationId);
    
    if (!notification) {
      console.error('[markAsUnread] Notification not found:', notificationId);
      return;
    }

    // Get notificationId from metadata
    const notificationIdForUpdate = notification.metadata?.notificationId;
    if (!notificationIdForUpdate) {
      console.error('[markAsUnread] Missing notificationId in metadata');
      return;
    }

    // Optimistic update
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: false } : n
      )
    );

    // Persist to Arkiv
    try {
      const response = await fetch('/api/notifications/state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletLower,
          notificationId: notificationIdForUpdate,
          read: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to mark as unread');
      }

      // Small delay to ensure Arkiv has indexed the update
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh notifications to get updated state from Arkiv
      await loadNotifications(userWallet);

      // Dispatch event to notify other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-preferences-updated', {
          detail: { wallet: walletLower },
        }));
      }
    } catch (err) {
      console.error('[markAsUnread] Error marking notification as unread:', err);
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

    // Persist to Arkiv (update each notification)
    try {
      const walletLower = userWallet.toLowerCase().trim();
      const updates = unreadNotifications.map(n => {
        const notificationId = n.metadata?.notificationId;
        if (!notificationId) {
          console.warn('[markAllAsRead] Skipping notification without notificationId:', n.id);
          return null;
        }
        
        return fetch('/api/notifications/state', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: walletLower,
            notificationId,
            read: true,
          }),
        });
      }).filter(Boolean) as Promise<Response>[];

      // Wait for all updates to complete (use allSettled to handle individual failures)
      const results = await Promise.allSettled(updates);
      
      // Log any failures
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`[markAllAsRead] Failed to update notification ${unreadNotifications[index]?.id}:`, result.reason);
        } else if (result.status === 'fulfilled' && !result.value.ok) {
          console.error(`[markAllAsRead] Update failed for notification ${unreadNotifications[index]?.id}:`, result.value.status);
        }
      });

      // Refresh notifications to get updated state from Arkiv
      await loadNotifications(userWallet);

      // Dispatch event to notify other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-preferences-updated', {
          detail: { wallet: walletLower },
        }));
      }
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

    // Persist to Arkiv (update each notification)
    try {
      const walletLower = userWallet.toLowerCase().trim();
      const updates = readNotifications.map(n => {
        const notificationId = n.metadata?.notificationId;
        if (!notificationId) {
          console.warn('[markAllAsUnread] Skipping notification without notificationId:', n.id);
          return null;
        }
        
        return fetch('/api/notifications/state', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: walletLower,
            notificationId,
            read: false,
          }),
        });
      }).filter(Boolean) as Promise<Response>[];

      // Wait for all updates to complete
      const results = await Promise.allSettled(updates);
      
      // Log any failures
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`[markAllAsUnread] Failed to update notification ${readNotifications[index]?.id}:`, result.reason);
        } else if (result.status === 'fulfilled' && !result.value.ok) {
          console.error(`[markAllAsUnread] Update failed for notification ${readNotifications[index]?.id}:`, result.value.status);
        }
      });

      // Small delay to ensure Arkiv has indexed the updates
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh notifications to get updated state from Arkiv
      await loadNotifications(userWallet);

      // Dispatch event to notify other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-preferences-updated', {
          detail: { wallet: walletLower },
        }));
      }
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

    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;

    // Get notificationId from metadata
    const notificationIdForUpdate = notification.metadata?.notificationId;
    if (!notificationIdForUpdate) {
      console.error('[deleteNotification] Missing notificationId in metadata');
      return;
    }

    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== notificationId));

    // Persist to Arkiv (mark as archived)
    try {
      const walletLower = userWallet.toLowerCase().trim();
      const response = await fetch('/api/notifications/state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletLower,
          notificationId: notificationIdForUpdate,
          archived: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to archive notification');
      }

      // Small delay to ensure Arkiv has indexed the update
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh notifications to get updated state from Arkiv
      await loadNotifications(userWallet);

      // Dispatch event to notify other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-preferences-updated', {
          detail: { wallet: walletLower },
        }));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
      // Revert on error - reload notifications
      await loadNotifications(userWallet);
    }
  };

  const deleteAllNotifications = async () => {
    if (!userWallet) return;

    // Confirm with user
    if (!confirm(`Are you sure you want to delete all ${notifications.length} notifications? This cannot be undone.`)) {
      return;
    }

    // Optimistic update
    setNotifications([]);

    try {
      const walletLower = userWallet.toLowerCase().trim();
      const response = await fetch(`/api/notifications?wallet=${encodeURIComponent(walletLower)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete all notifications');
      }

      const data = await response.json();
      console.log(`[deleteAllNotifications] Deleted ${data.archived || 0} notifications`);

      // Small delay to ensure Arkiv has indexed the updates
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Refresh notifications to get updated state from Arkiv
      await loadNotifications(userWallet);

      // Dispatch event to notify other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-preferences-updated', {
          detail: { wallet: walletLower },
        }));
      }
    } catch (err) {
      console.error('Error deleting all notifications:', err);
      // Revert on error - reload notifications
      await loadNotifications(userWallet);
    }
  };

  const deleteAllNotifications = async () => {
    if (!userWallet) return;

    // Confirm with user
    if (!confirm(`Are you sure you want to delete all ${notifications.length} notifications? This cannot be undone.`)) {
      return;
    }

    // Optimistic update
    setNotifications([]);

    try {
      const walletLower = userWallet.toLowerCase().trim();
      const response = await fetch(`/api/notifications?wallet=${encodeURIComponent(walletLower)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete all notifications');
      }

      const data = await response.json();
      console.log(`[deleteAllNotifications] Deleted ${data.archived || 0} notifications`);

      // Small delay to ensure Arkiv has indexed the updates
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Refresh notifications to get updated state from Arkiv
      await loadNotifications(userWallet);

      // Dispatch event to notify other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-preferences-updated', {
          detail: { wallet: walletLower },
        }));
      }
    } catch (err) {
      console.error('Error deleting all notifications:', err);
      // Revert on error - reload notifications
      await loadNotifications(userWallet);
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
      case 'new_garden_note':
        return '💌';
      case 'new_skill_created':
        return '🌱';
      case 'community_meeting_scheduled':
        return '📅';
      case 'session_completed_feedback_needed':
        return '⭐';
      case 'entity_created':
        return '✨';
      default:
        return '🔔';
    }
  };

  // State for join/leave community functionality
  const [followedSkills, setFollowedSkills] = useState<string[]>([]);
  const [isSubmittingFollow, setIsSubmittingFollow] = useState<string | null>(null);

  // Load followed skills on mount
  useEffect(() => {
    if (userWallet) {
      loadFollowedSkills(userWallet);
    }
  }, [userWallet]);

  const loadFollowedSkills = async (wallet: string) => {
    try {
      const normalizedWallet = wallet.toLowerCase().trim();
      const res = await fetch(`/api/learning-follow?profile_wallet=${encodeURIComponent(normalizedWallet)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.follows) {
          setFollowedSkills(data.follows.map((f: any) => f.skill_id));
        }
      }
    } catch (err) {
      console.error('Error loading followed skills:', err);
    }
  };

  const handleFollow = async (skillId: string, action: 'follow' | 'unfollow') => {
    if (!userWallet || !skillId) return;

    setIsSubmittingFollow(skillId);
    try {
      const res = await fetch('/api/learning-follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action === 'follow' ? 'createFollow' : 'unfollow',
          profile_wallet: userWallet,
          skill_id: skillId,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        await loadFollowedSkills(userWallet);
      } else {
        alert(data.error || `Failed to ${action} community`);
      }
    } catch (error: any) {
      console.error(`Error ${action}ing community:`, error);
      alert(`Failed to ${action} community`);
    } finally {
      setIsSubmittingFollow(null);
    }
  };

  // State for feedback details (for app_feedback_submitted notifications)
  const [feedbackDetails, setFeedbackDetails] = useState<Record<string, any>>({});
  const [loadingFeedback, setLoadingFeedback] = useState<Record<string, boolean>>({});

  // State for session feedback details (for entity_created notifications with sourceEntityType='session_feedback')
  const [sessionFeedbackDetails, setSessionFeedbackDetails] = useState<Record<string, any>>({});
  const [loadingSessionFeedback, setLoadingSessionFeedback] = useState<Record<string, boolean>>({});

  // State for admin response details (for admin_response notifications)
  const [adminResponseDetails, setAdminResponseDetails] = useState<Record<string, any>>({});
  const [loadingAdminResponse, setLoadingAdminResponse] = useState<Record<string, boolean>>({});

  // State for session feedback modal
  const [feedbackSession, setFeedbackSession] = useState<Session | null>(null);
  const [sessionDetails, setSessionDetails] = useState<Record<string, Session>>({});
  const [loadingSession, setLoadingSession] = useState<Record<string, boolean>>({});

  // Load feedback details for app_feedback_submitted notifications
  const loadFeedbackDetails = async (feedbackKey: string) => {
    if (feedbackDetails[feedbackKey] || loadingFeedback[feedbackKey]) {
      return;
    }

    if (!feedbackKey) {
      console.warn('[loadFeedbackDetails] No feedbackKey provided');
      return;
    }

    setLoadingFeedback(prev => ({ ...prev, [feedbackKey]: true }));
    try {
      const res = await fetch(`/api/app-feedback?key=${encodeURIComponent(feedbackKey)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.feedback) {
          setFeedbackDetails(prev => ({ ...prev, [feedbackKey]: data.feedback }));
        } else {
          console.warn(`[loadFeedbackDetails] Feedback ${feedbackKey} not found in response:`, data);
        }
      } else if (res.status === 404) {
        console.warn(`[loadFeedbackDetails] Feedback ${feedbackKey} not found (404)`);
      } else {
        console.error(`[loadFeedbackDetails] Error fetching feedback ${feedbackKey}:`, res.status, res.statusText);
      }
    } catch (err) {
      console.error('[loadFeedbackDetails] Error loading feedback details:', err);
    } finally {
      setLoadingFeedback(prev => ({ ...prev, [feedbackKey]: false }));
    }
  };

  // Load session feedback details for entity_created notifications
  const loadSessionFeedbackDetails = async (feedbackKey: string) => {
    if (sessionFeedbackDetails[feedbackKey] || loadingSessionFeedback[feedbackKey]) {
      return;
    }

    if (!feedbackKey) {
      console.warn('[loadSessionFeedbackDetails] No feedbackKey provided');
      return;
    }

    setLoadingSessionFeedback(prev => ({ ...prev, [feedbackKey]: true }));
    try {
      const res = await fetch(`/api/feedback?key=${encodeURIComponent(feedbackKey)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.feedback) {
          setSessionFeedbackDetails(prev => ({ ...prev, [feedbackKey]: data.feedback }));
        } else {
          console.warn(`[loadSessionFeedbackDetails] Session feedback ${feedbackKey} not found in response:`, data);
        }
      } else if (res.status === 404) {
        console.warn(`[loadSessionFeedbackDetails] Session feedback ${feedbackKey} not found (404)`);
      } else {
        console.error(`[loadSessionFeedbackDetails] Error fetching session feedback ${feedbackKey}:`, res.status, res.statusText);
      }
    } catch (err) {
      console.error('[loadSessionFeedbackDetails] Error loading session feedback details:', err);
    } finally {
      setLoadingSessionFeedback(prev => ({ ...prev, [feedbackKey]: false }));
    }
  };

  // Load admin response details for admin_response notifications
  const loadAdminResponseDetails = async (responseKey: string) => {
    if (adminResponseDetails[responseKey] || loadingAdminResponse[responseKey]) {
      return;
    }

    if (!responseKey) {
      console.warn('[loadAdminResponseDetails] No responseKey provided');
      return;
    }

    setLoadingAdminResponse(prev => ({ ...prev, [responseKey]: true }));
    try {
      const res = await fetch(`/api/admin/response?key=${encodeURIComponent(responseKey)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.response) {
          setAdminResponseDetails(prev => ({ ...prev, [responseKey]: data.response }));
        } else {
          console.warn(`[loadAdminResponseDetails] Admin response ${responseKey} not found in response:`, data);
        }
      } else if (res.status === 404) {
        console.warn(`[loadAdminResponseDetails] Admin response ${responseKey} not found (404)`);
      } else {
        console.error(`[loadAdminResponseDetails] Error fetching admin response ${responseKey}:`, res.status, res.statusText);
      }
    } catch (err) {
      console.error('[loadAdminResponseDetails] Error loading admin response details:', err);
    } finally {
      setLoadingAdminResponse(prev => ({ ...prev, [responseKey]: false }));
    }
  };

  // Load session details for meeting_request and session_completed_feedback_needed notifications
  const loadSessionDetails = async (sessionKey: string) => {
    if (sessionDetails[sessionKey] || loadingSession[sessionKey]) {
      return;
    }

    if (!sessionKey) {
      console.warn('[loadSessionDetails] No sessionKey provided');
      return;
    }

    setLoadingSession(prev => ({ ...prev, [sessionKey]: true }));
    try {
      const res = await fetch(`/api/sessions?key=${encodeURIComponent(sessionKey)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.session) {
          setSessionDetails(prev => ({ ...prev, [sessionKey]: data.session }));
        } else {
          console.warn(`[loadSessionDetails] Session ${sessionKey} not found in response:`, data);
        }
      } else if (res.status === 404) {
        console.warn(`[loadSessionDetails] Session ${sessionKey} not found (404)`);
      } else {
        console.error(`[loadSessionDetails] Error fetching session ${sessionKey}:`, res.status, res.statusText);
      }
    } catch (err) {
      console.error('[loadSessionDetails] Error loading session details:', err);
    } finally {
      setLoadingSession(prev => ({ ...prev, [sessionKey]: false }));
    }
  };

  // Apply filters
  let filteredNotifications = notifications;
  if (filterType === 'unread') {
    filteredNotifications = filteredNotifications.filter(n => !n.read);
  } else if (filterType === 'read') {
    filteredNotifications = filteredNotifications.filter(n => n.read);
  }

  if (filterNotificationType !== 'all') {
    filteredNotifications = filteredNotifications.filter(n => n.type === filterNotificationType);
  }

  const unreadCount = getUnreadCount(notifications);

  if (loading) {
    return (
      <main className="min-h-screen text-gray-900 dark:text-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <BackButton />
          <div className="mt-8 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-gray-900 dark:text-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <BackButton />
        
        <div className="mt-8 mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50 mb-2">
              Notifications
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {unreadCount > 0 ? (
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {unreadCount} unread
                </span>
              ) : (
                'All caught up!'
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg transition-colors"
              >
                Mark All Read
              </button>
            )}
            {notifications.filter(n => n.read).length > 0 && (
              <button
                onClick={markAllAsUnread}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg transition-colors"
              >
                Mark All Unread
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg transition-colors"
            >
              {showFilters ? 'Hide' : 'Show'} Filters
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as FilterType)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All Types</option>
                  <option value="meeting_request">Meeting Request</option>
                  <option value="profile_match">Profile Match</option>
                  <option value="ask_offer_match">Ask & Offer Match</option>
                  <option value="new_offer">New Offer</option>
                  <option value="admin_response">Admin Response</option>
                  <option value="issue_resolved">Issue Resolved</option>
                  <option value="app_feedback_submitted">App Feedback</option>
                  <option value="new_garden_note">Garden Note</option>
                  <option value="new_skill_created">New Skill</option>
                  <option value="community_meeting_scheduled">Community Meeting</option>
                  <option value="session_completed_feedback_needed">Feedback Needed</option>
                  <option value="entity_created">Entity Created</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {filteredNotifications.length === 0 ? (
          <div className="p-8 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
            <p className="text-gray-600 dark:text-gray-400">
              {notifications.length === 0
                ? 'No notifications yet.'
                : 'No notifications match your filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border ${
                  notification.read
                    ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-50">
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatTime(notification.timestamp)}</span>
                      {notification.link && (
                        <Link
                          href={notification.link}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View →
                        </Link>
                      )}
                      {notification.metadata?.notificationKey && (
                        <ViewOnArkivLink
                          entityKey={notification.metadata.notificationKey}
                          txHash={notification.metadata.notificationTxHash}
                          label="View on Arkiv"
                          className="text-xs"
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {!notification.read ? (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 transition-colors"
                        title="Mark as read"
                      >
                        Mark Read
                      </button>
                    ) : (
                      <button
                        onClick={() => markAsUnread(notification.id)}
                        className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 transition-colors"
                        title="Mark as unread"
                      >
                        Mark Unread
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-white dark:bg-gray-700 rounded border border-red-300 dark:border-red-600 transition-colors"
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Feedback Modal */}
        {feedbackSession && userWallet && (
          <FeedbackModal
            isOpen={!!feedbackSession}
            onClose={() => {
              setFeedbackSession(null);
              if (userWallet) {
                loadNotifications(userWallet);
              }
            }}
            session={feedbackSession}
            userWallet={userWallet}
            onSuccess={() => {
              setFeedbackSession(null);
              if (userWallet) {
                loadNotifications(userWallet);
              }
            }}
          />
        )}
      </div>
    </main>
  );
}
