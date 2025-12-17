/**
 * Notifications page
 *
 * Enhanced notifications with Arkiv-native persistence, filtering, and customization.
 * Uses client-side polling to detect new items and stores read/unread state on-chain.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { FeedbackModal } from '@/components/FeedbackModal';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import type { Notification } from '@/lib/notifications';
import type { NotificationPreferenceType } from '@/lib/arkiv/notificationPreferences';
import { getUnreadCount } from '@/lib/notifications';
import type { Session } from '@/lib/arkiv/sessions';

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

  // Arkiv Builder Mode state (global)
  const arkivBuilderMode = useArkivBuilderMode();

  // Store notification preferences to use for read/archived state
  const notificationPreferences = useRef<Map<string, { read: boolean; archived: boolean }>>(new Map());

  // Flag to prevent reloading preferences while a save operation is in progress
  // This ensures that optimistic updates aren't overwritten by stale API responses
  const isSavingPreferences = useRef<boolean>(false);

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
        // Don't reload if a save operation is in progress
        if (!isSavingPreferences.current) {
          loadNotificationPreferences(storedWallet).then(() => {
            loadNotifications(storedWallet);
          });
        }
      }, POLL_INTERVAL);

      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, []);

  // Load notification preferences from Arkiv
  // CRITICAL: Don't reload if a save operation is in progress to prevent overwriting optimistic updates
  const loadNotificationPreferences = async (wallet: string): Promise<void> => {
    // Skip reload if a save operation is in progress
    if (isSavingPreferences.current) {
      return;
    }

    try {
      const res = await fetch(`/api/notifications/preferences?wallet=${wallet}`);
      const data = await res.json();

      if (data.ok && data.preferences) {
        // Store preferences in ref for use during notification detection
        // Merge with existing preferences to preserve any optimistic updates
        const prefMap = new Map<string, { read: boolean; archived: boolean }>();
        data.preferences.forEach((pref: any) => {
          prefMap.set(pref.notificationId, {
            read: pref.read,
            archived: pref.archived,
          });
        });

        // Merge with existing preferences (preserve optimistic updates if save is in progress)
        // Only update preferences that aren't currently being saved
        if (!isSavingPreferences.current) {
          notificationPreferences.current = prefMap;
        } else {
          // If save is in progress, merge: keep optimistic updates, add new ones from API
          data.preferences.forEach((pref: any) => {
            // Only update if we don't have a pending optimistic update
            if (!notificationPreferences.current.has(pref.notificationId)) {
              notificationPreferences.current.set(pref.notificationId, {
                read: pref.read,
                archived: pref.archived,
              });
            }
          });
        }

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
      // Normalize wallet to lowercase for consistent querying
      const normalizedWallet = wallet.toLowerCase().trim();
      const res = await fetch(`/api/notifications?wallet=${encodeURIComponent(normalizedWallet)}&status=active`);
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
            metadata: {
              ...(n.metadata || {}),
              // Include full Arkiv entity data for Builder Mode
              sourceEntityKey: n.sourceEntityKey,
              sourceEntityType: n.sourceEntityType,
              notificationKey: n.key,
              notificationTxHash: n.txHash,
            },
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

    // Store previous state for revert
    const currentPref = notificationPreferences.current.get(notificationId);

    // Set save flag to prevent reloads from overwriting optimistic updates
    isSavingPreferences.current = true;

    // Optimistic update
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );

    // Update preferences ref immediately (source of truth)
    notificationPreferences.current.set(notificationId, {
      read: true,
      archived: currentPref?.archived || false,
    });

    // Persist to Arkiv
    try {
      const notification = notifications.find(n => n.id === notificationId);
      if (notification) {
        const response = await fetch('/api/notifications/preferences', {
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

        if (!response.ok) {
          throw new Error('Failed to save preference');
        }

        // Success: preferences are now persisted, keep the optimistic update
        // The preferences ref already has the correct state, so no need to reload

        // Dispatch event to notify other components (e.g., navbar) of the change
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('notification-preferences-updated', {
            detail: { wallet: userWallet }
          }));
        }
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
    } finally {
      // Always clear the save flag, even on error
      isSavingPreferences.current = false;
    }
  };

  const markAsUnread = async (notificationId: string) => {
    if (!userWallet) return;

    // Store previous state for revert
    const currentPref = notificationPreferences.current.get(notificationId);

    // Set save flag to prevent reloads from overwriting optimistic updates
    isSavingPreferences.current = true;

    // Optimistic update
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: false } : n
      )
    );

    // Update preferences ref immediately (source of truth)
    notificationPreferences.current.set(notificationId, {
      read: false,
      archived: currentPref?.archived || false,
    });

    // Persist to Arkiv
    try {
      const notification = notifications.find(n => n.id === notificationId);
      if (notification) {
        const response = await fetch('/api/notifications/preferences', {
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

        if (!response.ok) {
          throw new Error('Failed to save preference');
        }

        // Success: preferences are now persisted, keep the optimistic update
        // The preferences ref already has the correct state, so no need to reload

        // Dispatch event to notify other components (e.g., navbar) of the change
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('notification-preferences-updated', {
            detail: { wallet: userWallet }
          }));
        }
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
    } finally {
      // Always clear the save flag, even on error
      isSavingPreferences.current = false;
    }
  };

  const markAllAsRead = async () => {
    if (!userWallet) return;

    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) return;

    // Store previous state for revert
    const previousPrefs = new Map(notificationPreferences.current);

    // Set save flag to prevent reloads from overwriting optimistic updates
    isSavingPreferences.current = true;

    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    // Update preferences ref immediately (source of truth)
    unreadNotifications.forEach(n => {
      const currentPref = notificationPreferences.current.get(n.id);
      notificationPreferences.current.set(n.id, {
        read: true,
        archived: currentPref?.archived || false,
      });
    });

    // Persist to Arkiv
    try {
      const response = await fetch('/api/notifications/preferences', {
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save preferences');
      }

      const data = await response.json();
      
      // Calculate delay based on number of updates to allow Arkiv indexing
      // Each entity needs time to be indexed, so we wait longer for bulk updates
      // Using 200ms per notification + 500ms base delay to ensure all entities are indexed
      const indexingDelay = Math.max(1500, 500 + (unreadNotifications.length * 200));
      
      // Verify all preferences were updated successfully
      if (data.updated < unreadNotifications.length) {
        console.warn(`[markAllAsRead] Only ${data.updated}/${unreadNotifications.length} preferences updated. Waiting for indexing before checking...`);
        // Wait for indexing before reloading to check actual state
        await new Promise(resolve => setTimeout(resolve, indexingDelay));
        // Reload preferences to get accurate state after indexing
        await loadNotificationPreferences(userWallet);
        // Reload notifications to reflect accurate read state
        await loadNotifications(userWallet);
      } else {
        // All updates succeeded - wait for Arkiv to index all entities before dispatching event
        // This ensures the count refresh sees all updated preferences
        await new Promise(resolve => setTimeout(resolve, indexingDelay));
      }

      // Success: preferences are now persisted, keep the optimistic updates
      // The preferences ref already has the correct state, so no need to reload

      // Dispatch event to update sidebar notification count
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-preferences-updated', {
          detail: { wallet: userWallet },
        }));
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
      // Revert on error
      setNotifications(prev => prev.map(n => {
        const wasUnread = unreadNotifications.some(un => un.id === n.id);
        return wasUnread ? { ...n, read: false } : n;
      }));
      // Revert preferences ref
      notificationPreferences.current = previousPrefs;
    } finally {
      // Always clear the save flag, even on error
      isSavingPreferences.current = false;
    }
  };

  const markAllAsUnread = async () => {
    if (!userWallet) return;

    const readNotifications = notifications.filter(n => n.read);
    if (readNotifications.length === 0) return;

    // Store previous state for revert
    const previousPrefs = new Map(notificationPreferences.current);

    // Set save flag to prevent reloads from overwriting optimistic updates
    isSavingPreferences.current = true;

    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: false })));

    // Update preferences ref immediately (source of truth)
    readNotifications.forEach(n => {
      const currentPref = notificationPreferences.current.get(n.id);
      notificationPreferences.current.set(n.id, {
        read: false,
        archived: currentPref?.archived || false,
      });
    });

    // Persist to Arkiv
    try {
      const response = await fetch('/api/notifications/preferences', {
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

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      const data = await response.json();
      
      // Calculate delay based on number of updates to allow Arkiv indexing
      // Using 200ms per notification + 500ms base delay to ensure all entities are indexed
      const indexingDelay = Math.max(1500, 500 + (readNotifications.length * 200));
      
      // Wait for Arkiv to index all entities before dispatching event
      await new Promise(resolve => setTimeout(resolve, indexingDelay));

      // Success: preferences are now persisted, keep the optimistic updates
      // The preferences ref already has the correct state, so no need to reload

      // Dispatch event to notify other components (e.g., navbar) of the change
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-preferences-updated', {
          detail: { wallet: userWallet }
        }));
      }
    } catch (err) {
      console.error('Error marking all as unread:', err);
      // Revert on error
      setNotifications(prev => prev.map(n => {
        const wasRead = readNotifications.some(rn => rn.id === n.id);
        return wasRead ? { ...n, read: true } : n;
      }));
      // Revert preferences ref
      notificationPreferences.current = previousPrefs;
    } finally {
      // Always clear the save flag, even on error
      isSavingPreferences.current = false;
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
      case 'new_garden_note':
        return '💌';
      case 'new_skill_created':
        return '🌱';
      case 'community_meeting_scheduled':
        return '📅';
      case 'session_completed_feedback_needed':
        return '⭐';
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
      // Normalize wallet to lowercase for consistent querying
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
        // Add a small delay to allow Arkiv to index the new entity
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
      return; // Already loaded or loading
    }

    if (!feedbackKey) {
      console.warn('[loadFeedbackDetails] No feedbackKey provided');
      return;
    }

    setLoadingFeedback(prev => ({ ...prev, [feedbackKey]: true }));
    try {
      // Query feedback directly by key (works for any profile, not just current user)
      const res = await fetch(`/api/app-feedback?key=${encodeURIComponent(feedbackKey)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.feedback) {
          setFeedbackDetails(prev => ({ ...prev, [feedbackKey]: data.feedback }));
        } else {
          console.warn(`[loadFeedbackDetails] Feedback ${feedbackKey} not found in response:`, data);
        }
      } else if (res.status === 404) {
        // Feedback not found - might be from a different profile or deleted
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

  // Load session feedback details for entity_created notifications with sourceEntityType='session_feedback'
  const loadSessionFeedbackDetails = async (feedbackKey: string) => {
    if (sessionFeedbackDetails[feedbackKey] || loadingSessionFeedback[feedbackKey]) {
      return; // Already loaded or loading
    }

    if (!feedbackKey) {
      console.warn('[loadSessionFeedbackDetails] No feedbackKey provided');
      return;
    }

    setLoadingSessionFeedback(prev => ({ ...prev, [feedbackKey]: true }));
    try {
      // Query session feedback directly by key
      const res = await fetch(`/api/feedback?key=${encodeURIComponent(feedbackKey)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.feedback) {
          setSessionFeedbackDetails(prev => ({ ...prev, [feedbackKey]: data.feedback }));
        } else {
          console.warn(`[loadSessionFeedbackDetails] Session feedback ${feedbackKey} not found in response:`, data);
        }
      } else if (res.status === 404) {
        // Feedback not found - might be from a different profile or deleted
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

  // Load session details for session_completed_feedback_needed notifications
  const loadSessionDetails = async (sessionKey: string) => {
    if (sessionDetails[sessionKey] || loadingSession[sessionKey]) {
      return; // Already loaded or loading
    }

    setLoadingSession(prev => ({ ...prev, [sessionKey]: true }));
    try {
      // Load all sessions and find the one matching the key
      const res = await fetch(`/api/sessions?wallet=${encodeURIComponent(userWallet || '')}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.sessions) {
          const session = data.sessions.find((s: Session) => s.key === sessionKey);
          if (session) {
            setSessionDetails(prev => ({ ...prev, [sessionKey]: session }));
          }
        }
      }
    } catch (err) {
      console.error('Error loading session details:', err);
    } finally {
      setLoadingSession(prev => ({ ...prev, [sessionKey]: false }));
    }
  };

  // Handle opening feedback modal for a session
  const handleOpenFeedback = async (sessionKey: string) => {
    // Load session if not already loaded
    if (!sessionDetails[sessionKey] && !loadingSession[sessionKey]) {
      await loadSessionDetails(sessionKey);
    }

    const session = sessionDetails[sessionKey];
    if (session) {
      setFeedbackSession(session);
    }
  };

  // Load admin response details for admin_response notifications
  const loadAdminResponseDetails = async (responseKey: string) => {
    if (adminResponseDetails[responseKey] || loadingAdminResponse[responseKey]) {
      return; // Already loaded or loading
    }

    if (!responseKey) {
      console.warn('[loadAdminResponseDetails] No responseKey provided');
      return;
    }

    setLoadingAdminResponse(prev => ({ ...prev, [responseKey]: true }));
    try {
      // Query admin response directly by key (works for any profile, not just current user)
      const res = await fetch(`/api/admin/response?key=${encodeURIComponent(responseKey)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.response) {
          setAdminResponseDetails(prev => ({ ...prev, [responseKey]: data.response }));
        } else {
          console.warn(`[loadAdminResponseDetails] Admin response ${responseKey} not found in response:`, data);
        }
      } else if (res.status === 404) {
        // Admin response not found - might be from a different profile or deleted
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
                    <option value="app_feedback_submitted">🔔 Feedback Submitted</option>
                    <option value="issue_resolved">✅ Issue Resolved</option>
                    <option value="new_garden_note">💌 New Garden Note</option>
                    <option value="new_skill_created">🌱 New Skill Created</option>
                    <option value="community_meeting_scheduled">📅 Community Meeting</option>
                    <option value="session_completed_feedback_needed">⭐ Session Feedback Needed</option>
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
              const isAdminResponseNotification = notification.type === 'admin_response';
              const isSessionFeedbackNeeded = notification.type === 'session_completed_feedback_needed';
              const isSessionFeedbackSubmitted = (notification.type === 'entity_created' as any) && notification.metadata?.sourceEntityType === 'session_feedback';

              // For session feedback notifications, load session details
              if (isSessionFeedbackNeeded) {
                const sessionKey = notification.metadata?.sessionKey;
                if (sessionKey && !sessionDetails[sessionKey] && !loadingSession[sessionKey]) {
                  loadSessionDetails(sessionKey);
                }
              }

              // Use sourceEntityKey (from notification metadata - added at line 171) or feedbackKey (from metadata) as fallback
              // sourceEntityKey is added to metadata when converting from Arkiv notification to client Notification format
              const feedbackKey = notification.metadata?.sourceEntityKey || notification.metadata?.feedbackKey;
              const feedback = feedbackKey ? feedbackDetails[feedbackKey] : null;
              const isLoadingFeedback = feedbackKey ? loadingFeedback[feedbackKey] : false;

              // For session feedback submitted, use sourceEntityKey (the feedback key)
              const sessionFeedbackKey = isSessionFeedbackSubmitted ? (notification.metadata?.sourceEntityKey || notification.metadata?.feedbackKey) : null;
              const sessionFeedback = sessionFeedbackKey ? sessionFeedbackDetails[sessionFeedbackKey] : null;
              const isLoadingSessionFeedback = sessionFeedbackKey ? loadingSessionFeedback[sessionFeedbackKey] : false;

              // For admin_response, use sourceEntityKey (the response key) or responseKey from metadata
              // sourceEntityKey is added to metadata when converting from Arkiv notification to client Notification format
              const responseKey = notification.metadata?.sourceEntityKey || notification.metadata?.responseKey;
              const adminResponse = responseKey ? adminResponseDetails[responseKey] : null;
              const isLoadingAdminResponse = responseKey ? loadingAdminResponse[responseKey] : false;

              // Load feedback details if needed
              if (isFeedbackNotification && feedbackKey && !feedback && !isLoadingFeedback) {
                // Debug: log the key being used
                if (arkivBuilderMode) {
                  console.log('[Notifications] Loading feedback details for key:', feedbackKey, 'from notification:', notification.id);
                }
                loadFeedbackDetails(feedbackKey);
              }

              // Load session feedback details if needed
              if (isSessionFeedbackSubmitted && sessionFeedbackKey && !sessionFeedback && !isLoadingSessionFeedback) {
                // Debug: log the key being used
                if (arkivBuilderMode) {
                  console.log('[Notifications] Loading session feedback details for key:', sessionFeedbackKey, 'from notification:', notification.id);
                }
                loadSessionFeedbackDetails(sessionFeedbackKey);
              }

              // Load admin response details if needed
              if (isAdminResponseNotification && responseKey && !adminResponse && !isLoadingAdminResponse) {
                // Debug: log the key being used
                if (arkivBuilderMode) {
                  console.log('[Notifications] Loading admin response details for key:', responseKey, 'from notification:', notification.id);
                }
                loadAdminResponseDetails(responseKey);
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

                      {/* Arkiv Builder Mode: Query Information Tooltip */}
                      {arkivBuilderMode && (
                        <div className="mt-2 group/query relative">
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono cursor-help border border-gray-300 dark:border-gray-600 rounded px-2 py-1 inline-block bg-gray-50 dark:bg-gray-800">
                            Arkiv Query
                          </div>
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/query:opacity-100 transition-opacity duration-200 pointer-events-none z-10 font-mono text-left max-w-md">
                            <div className="font-semibold mb-1">Notification Query:</div>
                            <div>type='notification',</div>
                            <div>wallet='{userWallet?.slice(0, 8)}...',</div>
                            <div>status='active'</div>
                            <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      {notification.read ? (
                        <div className="relative group/action">
                          <button
                            onClick={() => markAsUnread(notification.id)}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Mark as unread"
                          >
                            ↶
                          </button>
                          {arkivBuilderMode && (
                            <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/action:opacity-100 transition-opacity duration-200 pointer-events-none z-10 font-mono text-left whitespace-nowrap">
                              <div>Creates: notification_preference</div>
                              <div>read=false</div>
                              <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative group/action">
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Mark as read"
                          >
                            ✓
                          </button>
                          {arkivBuilderMode && (
                            <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/action:opacity-100 transition-opacity duration-200 pointer-events-none z-10 font-mono text-left whitespace-nowrap">
                              <div>Creates: notification_preference</div>
                              <div>read=true</div>
                              <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="relative group/action">
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Delete"
                        >
                          ×
                        </button>
                        {arkivBuilderMode && (
                          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/action:opacity-100 transition-opacity duration-200 pointer-events-none z-10 font-mono text-left whitespace-nowrap">
                            <div>Creates: notification_preference</div>
                            <div>archived=true</div>
                            <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Arkiv Builder Mode: Entity Links and Information */}
                  {arkivBuilderMode && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                      <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                        Arkiv Entities:
                      </div>

                      {/* Notification Entity */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Notification:</span>
                        {notification.metadata?.notificationKey && (
                          <ViewOnArkivLink
                            entityKey={notification.metadata.notificationKey}
                            txHash={notification.metadata.notificationTxHash}
                            label="View Notification Entity"
                            className="text-xs"
                            icon="🔔"
                          />
                        )}
                        {notification.metadata?.notificationKey && (
                          <span className="text-gray-400 dark:text-gray-500 font-mono text-xs">
                            ({notification.metadata.notificationKey.slice(0, 8)}...)
                          </span>
                        )}
                      </div>

                      {/* Source Entity */}
                      {notification.metadata?.sourceEntityKey && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500 dark:text-gray-400">
                            Source ({notification.metadata.sourceEntityType}):
                          </span>
                          <ViewOnArkivLink
                            entityKey={notification.metadata.sourceEntityKey}
                            label={`View ${notification.metadata.sourceEntityType} Entity`}
                            className="text-xs"
                            icon="🔗"
                          />
                          <span className="text-gray-400 dark:text-gray-500 font-mono text-xs">
                            ({notification.metadata.sourceEntityKey.slice(0, 8)}...)
                          </span>
                        </div>
                      )}

                      {/* Entity Keys Display */}
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                          {notification.metadata?.notificationKey && (
                            <div className="font-mono">
                              <span className="text-gray-600 dark:text-gray-300">Key:</span>{' '}
                              <span className="text-gray-400 dark:text-gray-500 break-all">
                                {notification.metadata.notificationKey}
                              </span>
                            </div>
                          )}
                          {notification.metadata?.notificationTxHash && (
                            <div className="font-mono">
                              <span className="text-gray-600 dark:text-gray-300">TxHash:</span>{' '}
                              <span className="text-gray-400 dark:text-gray-500 break-all">
                                {notification.metadata.notificationTxHash}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Show full admin response details for admin_response notifications */}
                  {isAdminResponseNotification && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      {isLoadingAdminResponse ? (
                        <div className="text-sm text-gray-500 dark:text-gray-400">Loading response details...</div>
                      ) : adminResponse ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400 font-medium">Date:</span>{' '}
                              <span className="text-gray-900 dark:text-gray-100">
                                {new Date(adminResponse.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400 font-medium">From:</span>{' '}
                              <span className="text-gray-900 dark:text-gray-100 font-mono text-xs">
                                {adminResponse.adminWallet.slice(0, 8)}...
                              </span>
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400 font-medium text-sm">Response:</span>
                            <p className="text-gray-900 dark:text-gray-100 mt-1 whitespace-pre-wrap">
                              {adminResponse.message}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {adminResponse.txHash && (
                              <ViewOnArkivLink
                                entityKey={adminResponse.key}
                                txHash={adminResponse.txHash}
                                label="View on Arkiv"
                                className="text-xs"
                              />
                            )}
                            {arkivBuilderMode && adminResponse.key && (
                              <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                Key: {adminResponse.key.slice(0, 16)}...
                              </div>
                            )}
                          </div>
                          {/* Link to original feedback if available */}
                          {adminResponse.feedbackKey && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-medium">Related Feedback:</span>{' '}
                              {arkivBuilderMode ? (
                                <ViewOnArkivLink
                                  entityKey={adminResponse.feedbackKey}
                                  label="View Feedback Entity"
                                  className="text-xs"
                                  icon="🔗"
                                />
                              ) : (
                                <span className="font-mono">{adminResponse.feedbackKey.slice(0, 8)}...</span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 dark:text-gray-400">Response details not available</div>
                      )}
                    </div>
                  )}

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
                            {arkivBuilderMode && feedback.key && (
                              <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                Key: {feedback.key.slice(0, 16)}...
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 dark:text-gray-400">Feedback details not available</div>
                      )}
                    </div>
                  )}

                  {/* Show link for other notification types (but not app_feedback_submitted, session_feedback_submitted, or admin_response) */}
                  {!isFeedbackNotification && !isSessionFeedbackSubmitted && !isAdminResponseNotification && notification.link && (
                    <div className="mt-3">
                      <a
                        href={notification.link}
                        className="inline-block text-sm text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 transition-colors"
                        onClick={() => markAsRead(notification.id)}
                      >
                        View →
                      </a>
                      {arkivBuilderMode && notification.metadata?.sourceEntityKey && (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Links to: {notification.metadata.sourceEntityType} entity
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Feedback Modal */}
      {feedbackSession && userWallet && (
        <FeedbackModal
          isOpen={!!feedbackSession}
          onClose={() => {
            setFeedbackSession(null);
            // Reload notifications to update feedback status
            if (userWallet) {
              loadNotifications(userWallet);
            }
          }}
          session={feedbackSession}
          userWallet={userWallet}
          onSuccess={() => {
            // Reload notifications after successful feedback submission
            if (userWallet) {
              loadNotifications(userWallet);
            }
          }}
        />
      )}
    </div>
  );
}


