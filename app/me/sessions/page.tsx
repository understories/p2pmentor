/**
 * Sessions page
 *
 * View and manage mentorship sessions (pending, scheduled, completed).
 * Allows confirming/rejecting pending sessions.
 *
 * Based on mentor-graph implementation.
 * Reference: refs/mentor-graph/pages/network.tsx (session display and confirmation)
 */

'use client';

import { useState, useEffect } from 'react';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Alert } from '@/components/Alert';
import { FeedbackModal } from '@/components/FeedbackModal';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { formatSessionTitle } from '@/lib/sessions/display';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { appendBuilderModeParams } from '@/lib/utils/builderMode';
import { canGiveFeedbackForSessionSync, hasSessionEnded } from '@/lib/feedback/canGiveFeedback';
import type { Session } from '@/lib/arkiv/sessions';
import type { UserProfile } from '@/lib/arkiv/profile';
import type { Skill } from '@/lib/arkiv/skill';
import type { VirtualGathering } from '@/lib/arkiv/virtualGathering';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import Link from 'next/link';

function shortenWallet(wallet: string): string {
  if (!wallet || wallet.length < 10) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function formatSessionDate(sessionDate: string): {
  date: string;
  time: string;
  isPast: boolean;
  isToday: boolean;
} {
  const date = new Date(sessionDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const isPast = date < now;
  const isToday = sessionDay.getTime() === today.getTime();

  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return { date: dateStr, time: timeStr, isPast, isToday };
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [skillsMap, setSkillsMap] = useState<Record<string, Skill>>({});
  const [gatherings, setGatherings] = useState<Record<string, VirtualGathering>>({}); // gatheringKey -> gathering
  const [rsvpWallets, setRsvpWallets] = useState<Record<string, string[]>>({}); // gatheringKey -> array of wallet addresses
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState<string | null>(null);
  const [paymentTxHashInput, setPaymentTxHashInput] = useState<Record<string, string>>({});
  const [validatingPayment, setValidatingPayment] = useState<string | null>(null);
  const [feedbackSession, setFeedbackSession] = useState<Session | null>(null);
  const [sessionFeedbacks, setSessionFeedbacks] = useState<Record<string, any[]>>({});
  const [sessionTypeFilter, setSessionTypeFilter] = useState<'all' | 'p2p' | 'community'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed'>('all');
  const [pendingExpanded, setPendingExpanded] = useState(false);
  const [scheduledExpanded, setScheduledExpanded] = useState(false);
  const [archivedSessionsExpanded, setArchivedSessionsExpanded] = useState(false);
  const arkivBuilderMode = useArkivBuilderMode();

  useEffect(() => {
    // Get current user's wallet
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (address) {
        setUserWallet(address);
        loadSessions(address);
      } else {
        setError('Please connect your wallet first');
        setLoading(false);
      }
    }
  }, []);

  const loadSessions = async (wallet: string) => {
    try {
      setLoading(true);
      setError('');

      // Load skills for mapping skill_id to name_canonical
      const { listSkills } = await import('@/lib/arkiv/skill');
      const skills = await listSkills({ status: 'active', limit: 200 });
      const skillsMap: Record<string, Skill> = {};
      skills.forEach((skill) => {
        skillsMap[skill.key] = skill;
      });
      setSkillsMap(skillsMap);

      // Fetch sessions
      const sessionsParams = `?wallet=${encodeURIComponent(wallet)}`;
      const sessionsRes = await fetch(
        `/api/sessions${appendBuilderModeParams(arkivBuilderMode, sessionsParams)}`
      );
      if (!sessionsRes.ok) {
        throw new Error('Failed to fetch sessions');
      }
      const sessionsData = await sessionsRes.json();
      const sessionsList = sessionsData.sessions || [];
      setSessions(sessionsList);

      // Load feedbacks for all sessions
      // Arkiv-native: Use session's spaceId to ensure we query feedback from the correct space
      const feedbackPromises = sessionsList.map(async (session: Session) => {
        try {
          const spaceIdParam = session.spaceId
            ? `&spaceId=${encodeURIComponent(session.spaceId)}`
            : '';
          const feedbackRes = await fetch(
            `/api/feedback?sessionKey=${encodeURIComponent(session.key)}${spaceIdParam}`
          );
          if (feedbackRes.ok) {
            const feedbackData = await feedbackRes.json();
            return { sessionKey: session.key, feedbacks: feedbackData.feedbacks || [] };
          }
        } catch (e) {
          console.error(`Failed to fetch feedback for session ${session.key}:`, e);
        }
        return { sessionKey: session.key, feedbacks: [] };
      });
      const feedbackResults = await Promise.all(feedbackPromises);
      const feedbacksMap: Record<string, any[]> = {};
      feedbackResults.forEach(({ sessionKey, feedbacks }) => {
        feedbacksMap[sessionKey] = feedbacks;
      });
      setSessionFeedbacks(feedbacksMap);

      // Fetch user profile
      const profileRes = await fetch(`/api/profile?wallet=${encodeURIComponent(wallet)}`);
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setUserProfile(profileData.profile);
      }

      // Fetch all unique wallet addresses from sessions
      const uniqueWallets = new Set<string>();
      sessionsData.sessions?.forEach((s: Session) => {
        uniqueWallets.add(s.mentorWallet);
        uniqueWallets.add(s.learnerWallet);
      });

      // Fetch profiles for all participants
      const profilePromises = Array.from(uniqueWallets).map(async (w) => {
        try {
          const res = await fetch(`/api/profile?wallet=${encodeURIComponent(w)}`);
          if (res.ok) {
            const data = await res.json();
            return { wallet: w, profile: data.profile };
          }
        } catch (e) {
          console.error(`Failed to fetch profile for ${w}:`, e);
        }
        return null;
      });

      const profileResults = await Promise.all(profilePromises);
      const profileMap: Record<string, UserProfile> = {};
      profileResults.forEach((result) => {
        if (result && result.profile) {
          profileMap[result.wallet.toLowerCase()] = result.profile;
        }
      });
      setProfiles(profileMap);

      // For community gathering sessions, fetch gathering info and RSVP wallets
      const communitySessions = sessionsList.filter(
        (s: Session) =>
          s.gatheringKey ||
          s.skill === 'virtual_gathering_rsvp' ||
          s.notes?.includes('virtual_gathering_rsvp:')
      );

      if (communitySessions.length > 0) {
        const gatheringKeys = new Set<string>();
        communitySessions.forEach((s: Session) => {
          const gatheringKey =
            s.gatheringKey ||
            s.notes?.match(/virtual_gathering_rsvp:([^\s,]+)/)?.[1] ||
            (s.notes?.includes('virtual_gathering_rsvp:')
              ? s.notes.split('virtual_gathering_rsvp:')[1]?.split(',')[0]?.trim()
              : null);
          if (gatheringKey) {
            gatheringKeys.add(gatheringKey);
          }
        });

        // Fetch gathering information and RSVP wallets for each gathering
        const gatheringPromises = Array.from(gatheringKeys).map(async (gatheringKey) => {
          try {
            // Fetch gathering info and RSVP wallets in parallel
            const [gathering, rsvpRes] = await Promise.all([
              (async () => {
                const { getVirtualGatheringByKey } = await import('@/lib/arkiv/virtualGathering');
                return await getVirtualGatheringByKey(gatheringKey);
              })(),
              fetch(`/api/virtual-gatherings?gatheringKey=${encodeURIComponent(gatheringKey)}`)
                .then((r) => r.json())
                .catch(() => ({ ok: false, rsvpWallets: [] })),
            ]);

            return {
              gatheringKey,
              gathering: gathering || null,
              rsvpWallets: rsvpRes?.rsvpWallets || [],
            };
          } catch (err) {
            console.warn(`Error fetching gathering ${gatheringKey}:`, err);
            return { gatheringKey, gathering: null, rsvpWallets: [] };
          }
        });

        const gatheringResults = await Promise.all(gatheringPromises);
        const gatheringsMap: Record<string, VirtualGathering> = {};
        const rsvpWalletsMap: Record<string, string[]> = {};

        gatheringResults.forEach(({ gatheringKey, gathering, rsvpWallets: wallets }) => {
          if (gathering) {
            gatheringsMap[gatheringKey] = gathering;
          }
          if (wallets && wallets.length > 0) {
            rsvpWalletsMap[gatheringKey] = wallets;
          }
        });

        setGatherings(gatheringsMap);
        setRsvpWallets(rsvpWalletsMap);

        // Load profiles for all RSVP wallets
        const allRsvpWallets = new Set<string>();
        Object.values(rsvpWalletsMap).forEach((wallets) => {
          wallets.forEach((wallet) => allRsvpWallets.add(wallet));
        });

        const rsvpProfilePromises = Array.from(allRsvpWallets).map(async (wallet) => {
          try {
            const profile = await getProfileByWallet(wallet);
            return { wallet, profile };
          } catch {
            return { wallet, profile: null };
          }
        });

        const rsvpProfileResults = await Promise.all(rsvpProfilePromises);
        const updatedProfiles = { ...profileMap };
        rsvpProfileResults.forEach(({ wallet, profile }) => {
          if (profile) {
            updatedProfiles[wallet.toLowerCase()] = profile;
          }
        });
        setProfiles(updatedProfiles);
      }
    } catch (err: any) {
      console.error('Error loading sessions:', err);
      setError(err.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (session: Session) => {
    if (!userWallet) {
      alert('Please connect your wallet first');
      return;
    }

    setConfirming(session.key);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirmSession',
          wallet: userWallet,
          sessionKey: session.key,
          confirmedByWallet: userWallet,
          mentorWallet: session.mentorWallet,
          learnerWallet: session.learnerWallet,
          spaceId: session.spaceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Check for concurrent confirmation error
        if (data.concurrentError || res.status === 409) {
          // User-friendly message for concurrent confirmation
          alert(
            'You both might have clicked at the same time! Wait a moment then try again. The confirmation may have already succeeded.'
          );
          // Reload sessions to check if confirmation succeeded
          if (userWallet) {
            setTimeout(() => loadSessions(userWallet), 2000);
          }
          return;
        }
        throw new Error(data.error || 'Failed to confirm session');
      }

      // Check if already confirmed (concurrent confirmation case)
      if (data.alreadyConfirmed) {
        alert(
          data.message ||
            'Session was already confirmed. Both parties may have clicked at the same time!'
        );
      } else {
        alert('Session confirmed!');
      }

      // Reload sessions
      if (userWallet) {
        loadSessions(userWallet);
      }
    } catch (err: any) {
      console.error('Error confirming session:', err);
      // Check if error message indicates concurrent confirmation
      if (err.message?.includes('same time') || err.message?.includes('concurrent')) {
        alert(err.message);
        // Reload sessions to check if confirmation succeeded
        if (userWallet) {
          setTimeout(() => loadSessions(userWallet), 2000);
        }
      } else {
        alert(`Error: ${err.message || 'Failed to confirm session'}`);
      }
    } finally {
      setConfirming(null);
    }
  };

  const handleReject = async (session: Session) => {
    if (!userWallet) {
      alert('Please connect your wallet first');
      return;
    }

    if (!confirm('Are you sure you want to reject this meeting request?')) {
      return;
    }

    setRejecting(session.key);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rejectSession',
          wallet: userWallet,
          sessionKey: session.key,
          rejectedByWallet: userWallet,
          mentorWallet: session.mentorWallet,
          learnerWallet: session.learnerWallet,
          spaceId: session.spaceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reject session');
      }

      alert('Session rejected.');
      // Reload sessions
      if (userWallet) {
        loadSessions(userWallet);
      }
    } catch (err: any) {
      console.error('Error rejecting session:', err);
      alert(`Error: ${err.message || 'Failed to reject session'}`);
    } finally {
      setRejecting(null);
    }
  };

  const handleSubmitPayment = async (session: Session) => {
    if (!userWallet) {
      alert('Please connect your wallet first');
      return;
    }

    const paymentTxHash = paymentTxHashInput[session.key]?.trim();
    if (!paymentTxHash) {
      alert('Please enter a payment transaction hash');
      return;
    }

    if (!confirm(`Submit payment transaction ${paymentTxHash.slice(0, 10)}...?`)) {
      return;
    }

    setSubmittingPayment(session.key);

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submitPayment',
          wallet: userWallet,
          sessionKey: session.key,
          paymentTxHash,
          submittedByWallet: userWallet,
          mentorWallet: session.mentorWallet,
          learnerWallet: session.learnerWallet,
          spaceId: session.spaceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit payment');
      }

      alert('Payment submitted successfully! The mentor will validate it.');
      // Clear input
      setPaymentTxHashInput((prev) => {
        const next = { ...prev };
        delete next[session.key];
        return next;
      });
      // Reload sessions
      if (userWallet) {
        loadSessions(userWallet);
      }
    } catch (err: any) {
      console.error('Error submitting payment:', err);
      alert(`Error: ${err.message || 'Failed to submit payment'}`);
    } finally {
      setSubmittingPayment(null);
    }
  };

  const handleValidatePayment = async (session: Session) => {
    if (!userWallet) {
      alert('Please connect your wallet first');
      return;
    }

    if (!session.paymentTxHash) {
      alert('No payment transaction hash found for this session');
      return;
    }

    if (!confirm(`Validate payment transaction ${session.paymentTxHash.slice(0, 10)}...?`)) {
      return;
    }

    setValidatingPayment(session.key);

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validatePayment',
          wallet: userWallet,
          sessionKey: session.key,
          paymentTxHash: session.paymentTxHash,
          validatedByWallet: userWallet,
          mentorWallet: session.mentorWallet,
          learnerWallet: session.learnerWallet,
          spaceId: session.spaceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to validate payment');
      }

      alert('Payment validated successfully!');
      // Reload sessions
      if (userWallet) {
        loadSessions(userWallet);
      }
    } catch (err: any) {
      console.error('Error validating payment:', err);
      alert(`Error: ${err.message || 'Failed to validate payment'}`);
    } finally {
      setValidatingPayment(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <BackButton href="/me" />
          </div>
          <PageHeader title="Sessions" />
          {arkivBuilderMode ? (
            <ArkivQueryTooltip
              query={[
                `loadSessions("${userWallet?.toLowerCase() || '...'}")`,
                `Queries:`,
                `1. listSkills({ status: 'active', limit: 200 })`,
                `   → type='skill', status='active'`,
                `2. GET /api/sessions?wallet=${userWallet?.toLowerCase() || '...'}`,
                `   → type='session', (mentorWallet='${userWallet?.toLowerCase() || '...'}' OR learnerWallet='${userWallet?.toLowerCase() || '...'}')`,
                `3. GET /api/profile?wallet=${userWallet?.toLowerCase() || '...'}`,
                `   → type='user_profile', wallet='${userWallet?.toLowerCase() || '...'}'`,
                `4. GET /api/profile?wallet=... (for each participant)`,
                `   → type='user_profile', wallet='...'`,
              ]}
              label="Loading Sessions"
            >
              <LoadingSpinner text="Loading sessions..." className="py-12" />
            </ArkivQueryTooltip>
          ) : (
            <LoadingSpinner text="Loading sessions..." className="py-12" />
          )}
        </div>
      </div>
    );
  }

  if (error && !userWallet) {
    return (
      <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <BackButton href="/me" />
          </div>
          <PageHeader title="Sessions" />
          <Alert type="error" message={error} />
        </div>
      </div>
    );
  }

  // Helper function to check if a session is a community session (arkiv-native: checks gatheringKey field)
  const isCommunitySession = (s: Session): boolean => {
    return Boolean(
      s.gatheringKey ||
        s.skill === 'virtual_gathering_rsvp' ||
        s.notes?.includes('virtual_gathering_rsvp:')
    );
  };

  // Filter sessions by type (p2p vs community) - arkiv-native: uses gatheringKey from session entity
  const filterSessionsByType = (sessionList: Session[]): Session[] => {
    if (sessionTypeFilter === 'all') return sessionList;
    if (sessionTypeFilter === 'community') {
      return sessionList.filter(isCommunitySession);
    }
    // p2p: filter out community sessions
    return sessionList.filter((s) => !isCommunitySession(s));
  };

  // Helper function to check if a session is upcoming (hasn't started yet)
  // Used for "upcoming" filter - only shows future sessions (not currently happening)
  // Arkiv-native: Uses consistent sessionTime calculation
  const isSessionUpcoming = (s: Session): boolean => {
    if (!s.sessionDate) return false; // Defensive: no date means invalid
    if (s.status === 'completed' || s.status === 'declined' || s.status === 'cancelled') {
      return false; // Exclude completed/declined/cancelled
    }
    const now = Date.now();
    const sessionTime = new Date(s.sessionDate).getTime();
    // Defensive: check if date parsing succeeded
    if (isNaN(sessionTime)) {
      console.warn(
        '[isSessionUpcoming] Invalid sessionDate:',
        s.sessionDate,
        'for session:',
        s.key
      );
      return false;
    }
    // Session is upcoming if it hasn't started yet (future sessions only)
    return now < sessionTime;
  };

  // Helper function to check if a session hasn't started yet (for "Next Session" highlight)
  // Arkiv-native: Only show sessions that haven't started as "Next Session"
  const isSessionNotStarted = (s: Session): boolean => {
    if (!s.sessionDate) return false; // Defensive: no date means invalid
    if (s.status === 'completed' || s.status === 'declined' || s.status === 'cancelled') {
      return false; // Exclude completed/declined/cancelled
    }
    const now = Date.now();
    const sessionTime = new Date(s.sessionDate).getTime();
    // Defensive: check if date parsing succeeded
    if (isNaN(sessionTime)) {
      console.warn(
        '[isSessionNotStarted] Invalid sessionDate:',
        s.sessionDate,
        'for session:',
        s.key
      );
      return false;
    }
    // Session hasn't started if current time is before session start time
    return now < sessionTime;
  };

  // Helper function to check if a session is past (has started or ended)
  // Arkiv-native: Uses consistent sessionTime and sessionEnd calculation
  // Past includes: sessions that have started (now >= sessionTime) OR ended (now >= sessionEnd)
  const isSessionPast = (s: Session): boolean => {
    if (!s.sessionDate) return false; // Defensive: no date means invalid
    if (s.status === 'completed' || s.status === 'declined' || s.status === 'cancelled') {
      return true; // Explicitly past
    }
    const now = Date.now();
    const sessionTime = new Date(s.sessionDate).getTime();
    // Defensive: check if date parsing succeeded
    if (isNaN(sessionTime)) {
      console.warn('[isSessionPast] Invalid sessionDate:', s.sessionDate, 'for session:', s.key);
      return false;
    }
    // Session is past if it has started (now >= sessionTime)
    // This includes sessions that are currently happening
    return now >= sessionTime;
  };

  // Filter sessions by time (upcoming vs past)
  // Arkiv-native: Consistent logic - upcoming = hasn't started, past = has started
  const filterSessionsByTime = (sessionList: Session[]): Session[] => {
    if (timeFilter === 'all') return sessionList;
    if (timeFilter === 'upcoming') {
      // For "upcoming" filter, show only sessions that haven't started yet (future sessions)
      return sessionList.filter(isSessionUpcoming);
    }
    // past: filter sessions that have started (includes currently happening and ended)
    // Arkiv-native: Use dedicated helper for consistency
    return sessionList.filter(isSessionPast);
  };

  // Filter sessions by status (pending vs confirmed)
  const filterSessionsByStatus = (sessionList: Session[]): Session[] => {
    if (statusFilter === 'all') return sessionList;
    if (statusFilter === 'pending') {
      return sessionList.filter(
        (s) => s.status === 'pending' || !s.mentorConfirmed || !s.learnerConfirmed
      );
    }
    // confirmed: both mentor and learner confirmed, and status is scheduled or completed
    return sessionList.filter(
      (s) =>
        s.mentorConfirmed &&
        s.learnerConfirmed &&
        (s.status === 'scheduled' || s.status === 'completed')
    );
  };

  // Apply all filters
  const applyAllFilters = (sessionList: Session[]): Session[] => {
    let filtered = sessionList;
    filtered = filterSessionsByType(filtered);
    filtered = filterSessionsByTime(filtered);
    filtered = filterSessionsByStatus(filtered);
    return filtered;
  };

  // Group sessions by status, then apply all filters
  // Arkiv-native: All session lists use the same filtered set (respects type, time, status filters)
  const allSessionsFiltered = applyAllFilters(sessions);
  const pendingSessions = allSessionsFiltered.filter((s) => s.status === 'pending');
  // Helper to identify reconstructed/archived sessions
  const isReconstructedSession = (session: Session): boolean => {
    return (
      session.skill === 'Session (expired)' ||
      session.notes === 'Session expired - reconstructed from feedback'
    );
  };

  // Scheduled sessions: already filtered by applyAllFilters (respects time filter)
  // When timeFilter is "past", includes sessions that have started
  // When timeFilter is "upcoming", includes sessions that haven't ended
  // When timeFilter is "all", includes all scheduled sessions
  const scheduledSessions = allSessionsFiltered.filter((s) => s.status === 'scheduled');
  const allCompletedSessions = allSessionsFiltered.filter((s) => s.status === 'completed');
  const completedSessions = allCompletedSessions.filter((s) => !isReconstructedSession(s));
  const archivedSessions = allCompletedSessions.filter((s) => isReconstructedSession(s));
  const declinedSessions = allSessionsFiltered.filter((s) => s.status === 'declined');
  const cancelledSessions = allSessionsFiltered.filter((s) => s.status === 'cancelled');
  // Show declined and cancelled together in UI (they're semantically different but both represent ended sessions)
  const endedSessions = [...declinedSessions, ...cancelledSessions];

  // Find upcoming session (next scheduled session that hasn't started yet)
  // Arkiv-native: Use filtered sessions and respect all active filters (type, status)
  // Only show sessions that haven't started yet (for "Next Session" display)
  // CRITICAL: Filter by isSessionNotStarted to ensure we only show future sessions
  const upcomingSession = scheduledSessions.filter(isSessionNotStarted).sort((a, b) => {
    const aTime = new Date(a.sessionDate).getTime();
    const bTime = new Date(b.sessionDate).getTime();
    // Defensive: handle invalid dates
    if (isNaN(aTime) || isNaN(bTime)) {
      console.warn('[upcomingSession] Invalid sessionDate in sort:', {
        a: a.sessionDate,
        b: b.sessionDate,
      });
      return 0;
    }
    return aTime - bTime;
  })[0];

  const hasAnySessions =
    pendingSessions.length > 0 ||
    scheduledSessions.length > 0 ||
    completedSessions.length > 0 ||
    endedSessions.length > 0;

  return (
    <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>

        <PageHeader
          title="Sessions"
          description="Manage your mentorship sessions: pending requests, scheduled meetings, and completed sessions."
        />

        {/* Filters - Best practice: grouped logically with clear labels */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Type:</span>
              <div className="flex gap-2">
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `Filter: Type = All`,
                      `Shows all sessions (no type filtering)`,
                      `Query: type='session', (mentorWallet='${userWallet?.slice(0, 8) || '...'}...' OR learnerWallet='${userWallet?.slice(0, 8) || '...'}...')`,
                      `Returns: All sessions regardless of gatheringKey`,
                    ]}
                    label="All"
                  >
                    <button
                      onClick={() => setSessionTypeFilter('all')}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        sessionTypeFilter === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      All
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    onClick={() => setSessionTypeFilter('all')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      sessionTypeFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    All
                  </button>
                )}
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `Filter: Type = P2P`,
                      `Filters out community sessions`,
                      `Client-side filter: !isCommunitySession(session)`,
                      `isCommunitySession: session.gatheringKey !== undefined`,
                      `Returns: Sessions without gatheringKey (P2P only)`,
                    ]}
                    label="P2P"
                  >
                    <button
                      onClick={() => setSessionTypeFilter('p2p')}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        sessionTypeFilter === 'p2p'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      P2P
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    onClick={() => setSessionTypeFilter('p2p')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      sessionTypeFilter === 'p2p'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    P2P
                  </button>
                )}
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `Filter: Type = Community`,
                      `Filters to community sessions only`,
                      `Client-side filter: isCommunitySession(session)`,
                      `isCommunitySession: session.gatheringKey !== undefined`,
                      `Returns: Sessions with gatheringKey (community only)`,
                    ]}
                    label="Community"
                  >
                    <button
                      onClick={() => setSessionTypeFilter('community')}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        sessionTypeFilter === 'community'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      Community
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    onClick={() => setSessionTypeFilter('community')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      sessionTypeFilter === 'community'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    Community
                  </button>
                )}
              </div>
            </div>

            {/* Time Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Time:</span>
              <div className="flex gap-2">
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `Filter: Time = All`,
                      `Shows all sessions (no time filtering)`,
                      `Query: type='session', (mentorWallet='${userWallet?.slice(0, 8) || '...'}...' OR learnerWallet='${userWallet?.slice(0, 8) || '...'}...')`,
                      `Returns: All sessions regardless of sessionDate`,
                    ]}
                    label="All"
                  >
                    <button
                      onClick={() => setTimeFilter('all')}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        timeFilter === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      All
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    onClick={() => setTimeFilter('all')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      timeFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    All
                  </button>
                )}
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `Filter: Time = Upcoming`,
                      `Client-side filter: sessionDate > now`,
                      `Query: type='session', (mentorWallet='${userWallet?.slice(0, 8) || '...'}...' OR learnerWallet='${userWallet?.slice(0, 8) || '...'}...')`,
                      `Filtered: new Date(session.sessionDate).getTime() > Date.now()`,
                      `Returns: Sessions scheduled in the future`,
                    ]}
                    label="Upcoming"
                  >
                    <button
                      onClick={() => setTimeFilter('upcoming')}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        timeFilter === 'upcoming'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      Upcoming
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    onClick={() => setTimeFilter('upcoming')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      timeFilter === 'upcoming'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    Upcoming
                  </button>
                )}
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `Filter: Time = Past`,
                      `Client-side filter: sessionEnd < now OR status in ['completed', 'declined', 'cancelled']`,
                      `sessionEnd = sessionDate + duration + 1 hour buffer`,
                      `Query: type='session', (mentorWallet='${userWallet?.slice(0, 8) || '...'}...' OR learnerWallet='${userWallet?.slice(0, 8) || '...'}...')`,
                      `Returns: Sessions that have ended or are completed/declined/cancelled`,
                    ]}
                    label="Past"
                  >
                    <button
                      onClick={() => setTimeFilter('past')}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        timeFilter === 'past'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      Past
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    onClick={() => setTimeFilter('past')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      timeFilter === 'past'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    Past
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</span>
              <div className="flex gap-2">
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `Filter: Status = All`,
                      `Shows all sessions (no status filtering)`,
                      `Query: type='session', (mentorWallet='${userWallet?.slice(0, 8) || '...'}...' OR learnerWallet='${userWallet?.slice(0, 8) || '...'}...')`,
                      `Returns: All sessions regardless of status`,
                    ]}
                    label="All"
                  >
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        statusFilter === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      All
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      statusFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    All
                  </button>
                )}
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `Filter: Status = Pending`,
                      `Client-side filter: status='pending' OR !mentorConfirmed OR !learnerConfirmed`,
                      `Query: type='session', (mentorWallet='${userWallet?.slice(0, 8) || '...'}...' OR learnerWallet='${userWallet?.slice(0, 8) || '...'}...')`,
                      `Returns: Sessions awaiting confirmation from mentor or learner`,
                    ]}
                    label="Pending"
                  >
                    <button
                      onClick={() => {
                        setStatusFilter('pending');
                        setPendingExpanded(true);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        statusFilter === 'pending'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      Pending
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    onClick={() => {
                      setStatusFilter('pending');
                      setPendingExpanded(true);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      statusFilter === 'pending'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    Pending
                  </button>
                )}
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `Filter: Status = Confirmed`,
                      `Client-side filter: mentorConfirmed && learnerConfirmed && (status='scheduled' || status='completed')`,
                      `Query: type='session', (mentorWallet='${userWallet?.slice(0, 8) || '...'}...' OR learnerWallet='${userWallet?.slice(0, 8) || '...'}...')`,
                      `Returns: Sessions confirmed by both parties (scheduled or completed)`,
                    ]}
                    label="Confirmed"
                  >
                    <button
                      onClick={() => {
                        setStatusFilter('confirmed');
                        setScheduledExpanded(true);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        statusFilter === 'confirmed'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      Confirmed
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    onClick={() => {
                      setStatusFilter('confirmed');
                      setScheduledExpanded(true);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      statusFilter === 'confirmed'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    Confirmed
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <Alert type="error" message={error} onClose={() => setError('')} className="mb-4" />
        )}

        {/* Upcoming Session Highlight - only show when not filtering by past */}
        {upcomingSession &&
          timeFilter !== 'past' &&
          (() => {
            // Defensive: Double-check that session hasn't started (safety check)
            const now = Date.now();
            const sessionDateTime = new Date(upcomingSession.sessionDate).getTime();
            if (isNaN(sessionDateTime) || now >= sessionDateTime) {
              // Session has started or invalid date - don't show as "Next Session"
              return null;
            }

            const isMentor =
              userWallet?.toLowerCase() === upcomingSession.mentorWallet.toLowerCase();
            const otherWallet = isMentor
              ? upcomingSession.learnerWallet
              : upcomingSession.mentorWallet;
            const otherProfile = profiles[otherWallet.toLowerCase()];
            const sessionTime = formatSessionDate(upcomingSession.sessionDate);
            const remaining = sessionDateTime - now;
            const daysUntil = Math.floor(remaining / (1000 * 60 * 60 * 24));
            const hoursUntil = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutesUntil = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

            // Check if this is a community gathering session
            const gatheringKey =
              upcomingSession.gatheringKey ||
              upcomingSession.notes?.match(/virtual_gathering_rsvp:([^\s,]+)/)?.[1] ||
              (upcomingSession.notes?.includes('virtual_gathering_rsvp:')
                ? upcomingSession.notes.split('virtual_gathering_rsvp:')[1]?.split(',')[0]?.trim()
                : null);
            const isCommunityGathering =
              gatheringKey &&
              (upcomingSession.skill === 'virtual_gathering_rsvp' ||
                upcomingSession.notes?.includes('virtual_gathering_rsvp:'));
            const gathering = gatheringKey ? gatherings[gatheringKey] : null;

            // Use gathering's videoJoinUrl if available (for community gatherings)
            const videoJoinUrl =
              isCommunityGathering && gathering?.videoJoinUrl
                ? gathering.videoJoinUrl
                : upcomingSession.videoJoinUrl;

            return (
              <div className="mb-6 rounded-lg border-2 border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/20">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200">
                    📅 Next Session
                  </h3>
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {daysUntil > 0
                      ? `${daysUntil}d ${hoursUntil}h ${minutesUntil}m left`
                      : hoursUntil > 0
                        ? `${hoursUntil}h ${minutesUntil}m left`
                        : `${minutesUntil}m left`}
                  </span>
                </div>
                <p className="mb-1 text-sm text-blue-800 dark:text-blue-300">
                  <strong>{formatSessionTitle(upcomingSession, skillsMap)}</strong>
                  {!isCommunityGathering &&
                    ` with ${otherProfile?.displayName || shortenWallet(otherWallet)}`}
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  {sessionTime.date} at {sessionTime.time}
                </p>
                {isCommunityGathering && gathering && gathering.rsvpCount !== undefined && (
                  <p className="text-sm text-blue-600 dark:text-blue-300">
                    {gathering.rsvpCount} {gathering.rsvpCount === 1 ? 'RSVP' : 'RSVPs'}
                  </p>
                )}
                {videoJoinUrl && (
                  <a
                    href={videoJoinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    🎥 Join Meeting
                  </a>
                )}
              </div>
            );
          })()}

        {/* Pending Sessions */}
        {pendingSessions.length > 0 && (
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              {arkivBuilderMode ? (
                <ArkivQueryTooltip
                  query={[
                    `GET /api/sessions?wallet=${userWallet?.toLowerCase() || '...'}`,
                    `Query: type='session', (mentorWallet='${userWallet?.toLowerCase() || '...'}' OR learnerWallet='${userWallet?.toLowerCase() || '...'}')`,
                    `Filtered: status='pending'`,
                    `Returns: Session[] (${pendingSessions.length} pending sessions)`,
                    `Each session is a type='session' entity on Arkiv`,
                  ]}
                  label={`⏳ Pending (${pendingSessions.length})`}
                >
                  <h2 className="text-xl font-semibold text-orange-600 dark:text-orange-400">
                    ⏳ Pending ({pendingSessions.length})
                  </h2>
                </ArkivQueryTooltip>
              ) : (
                <h2 className="text-xl font-semibold text-orange-600 dark:text-orange-400">
                  ⏳ Pending ({pendingSessions.length})
                </h2>
              )}
              <button
                onClick={() => setPendingExpanded(!pendingExpanded)}
                className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title={pendingExpanded ? 'Collapse pending sessions' : 'Expand pending sessions'}
              >
                {pendingExpanded ? '▼ Collapse' : '▶ Expand'}
              </button>
            </div>
            {pendingExpanded && (
              <div className="space-y-4">
                {pendingSessions.map((session) => {
                  const isMentor = Boolean(
                    userWallet && userWallet.toLowerCase() === session.mentorWallet.toLowerCase()
                  );
                  const isLearner = Boolean(
                    userWallet && userWallet.toLowerCase() === session.learnerWallet.toLowerCase()
                  );
                  const canConfirm = isMentor || isLearner;
                  const userConfirmed = isMentor
                    ? session.mentorConfirmed
                    : isLearner
                      ? session.learnerConfirmed
                      : false;
                  const otherConfirmed = isMentor
                    ? session.learnerConfirmed
                    : isLearner
                      ? session.mentorConfirmed
                      : false;

                  const otherWallet = isMentor ? session.learnerWallet : session.mentorWallet;
                  const otherProfile = profiles[otherWallet.toLowerCase()];
                  const sessionTime = formatSessionDate(session.sessionDate);

                  return (
                    <div
                      key={session.key}
                      className="rounded-lg border border-orange-200 bg-orange-50 p-6 dark:border-orange-800 dark:bg-orange-900/20"
                    >
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-2">
                            <h3 className="text-lg font-semibold">
                              📅 {formatSessionTitle(session, skillsMap)}
                            </h3>
                            {(() => {
                              const sessionTime = new Date(session.sessionDate).getTime();
                              const isExpired = sessionTime < Date.now();
                              return isExpired ? (
                                <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-200">
                                  Expired
                                </span>
                              ) : (
                                <span className="rounded bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-200">
                                  Pending
                                </span>
                              );
                            })()}
                            {arkivBuilderMode && session.key && (
                              <div className="ml-auto flex items-center gap-2">
                                <ViewOnArkivLink
                                  entityKey={session.key}
                                  txHash={session.txHash}
                                  label="View Session Entity"
                                  className="text-xs"
                                />
                                <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                                  {session.key.slice(0, 12)}...
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="mb-2 text-gray-700 dark:text-gray-300">
                            <strong>With:</strong>{' '}
                            {otherProfile?.displayName || shortenWallet(otherWallet)}
                          </p>
                          <p className="mb-2 text-gray-600 dark:text-gray-400">
                            <strong>Date:</strong> {sessionTime.date}
                          </p>
                          <p className="mb-2 text-gray-600 dark:text-gray-400">
                            <strong>Time:</strong> {sessionTime.time}
                          </p>
                          {session.duration && (
                            <p className="mb-2 text-gray-600 dark:text-gray-400">
                              <strong>Duration:</strong> {session.duration} minutes
                            </p>
                          )}
                          {session.notes && (
                            <div className="mt-3">
                              <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                                Notes:
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {session.notes}
                              </p>
                            </div>
                          )}
                          {session.paymentTxHash && (
                            <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-2 dark:border-blue-800 dark:bg-blue-900/20">
                              <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                                💰 Payment Transaction:
                              </p>
                              <div className="flex items-center gap-2">
                                <code className="font-mono text-xs text-gray-600 dark:text-gray-400">
                                  {session.paymentTxHash.slice(0, 10)}...
                                  {session.paymentTxHash.slice(-8)}
                                </code>
                                <a
                                  href={`https://explorer.kaolin.hoodi.arkiv.network/tx/${session.paymentTxHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                                >
                                  View
                                </a>
                              </div>
                              {session.paymentValidated ? (
                                <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                                  ✓ Validated by{' '}
                                  {session.paymentValidatedBy
                                    ? shortenWallet(session.paymentValidatedBy)
                                    : 'unknown'}
                                </p>
                              ) : (
                                <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                                  ⏳ Payment not yet validated
                                </p>
                              )}
                            </div>
                          )}
                          <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                            {userConfirmed ? (
                              <span className="text-green-600 dark:text-green-400">
                                ✓ You confirmed
                              </span>
                            ) : otherConfirmed ? (
                              <span className="text-orange-600 dark:text-orange-400">
                                ⏳ Waiting for you
                              </span>
                            ) : (
                              <span>⏳ Awaiting confirmation</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Payment Flow Progress Indicator */}
                      {session.requiresPayment && (
                        <div className="mt-4 border-t border-orange-200 pt-4 dark:border-orange-800">
                          <p className="mb-3 text-xs font-medium text-gray-600 dark:text-gray-400">
                            Payment Progress:
                          </p>
                          <div className="mb-3 flex items-center gap-2">
                            {/* Step 1: Mentor Confirms */}
                            <div
                              className={`flex items-center gap-2 ${session.mentorConfirmed ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}
                            >
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${session.mentorConfirmed ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
                              >
                                {session.mentorConfirmed ? '✓' : '1'}
                              </span>
                              <span className="text-xs">Mentor confirms</span>
                            </div>
                            <div
                              className={`h-0.5 flex-1 ${session.mentorConfirmed ? 'bg-green-300 dark:bg-green-700' : 'bg-gray-200 dark:bg-gray-700'}`}
                            />
                            {/* Step 2: Learner Submits Payment */}
                            <div
                              className={`flex items-center gap-2 ${session.paymentTxHash ? 'text-green-600 dark:text-green-400' : session.mentorConfirmed ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}
                            >
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${session.paymentTxHash ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : session.mentorConfirmed ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
                              >
                                {session.paymentTxHash ? '✓' : '2'}
                              </span>
                              <span className="text-xs">Payment submitted</span>
                            </div>
                            <div
                              className={`h-0.5 flex-1 ${session.paymentValidated ? 'bg-green-300 dark:bg-green-700' : session.paymentTxHash ? 'bg-blue-300 dark:bg-blue-700' : 'bg-gray-200 dark:bg-gray-700'}`}
                            />
                            {/* Step 3: Mentor Validates Payment */}
                            <div
                              className={`flex items-center gap-2 ${session.paymentValidated ? 'text-green-600 dark:text-green-400' : session.paymentTxHash ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}
                            >
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${session.paymentValidated ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : session.paymentTxHash ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
                              >
                                {session.paymentValidated ? '✓' : '3'}
                              </span>
                              <span className="text-xs">Payment validated</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Payment submission UI (for learner after mentor confirms) */}
                      {session.requiresPayment &&
                        !session.paymentTxHash &&
                        session.mentorConfirmed &&
                        isLearner && (
                          <div className="mt-4 border-t border-orange-200 pt-4 dark:border-orange-800">
                            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                              Session confirmed! Please submit your payment (Step 2 of 3):
                            </p>
                            <div className="mb-3">
                              <input
                                type="text"
                                value={paymentTxHashInput[session.key] || ''}
                                onChange={(e) =>
                                  setPaymentTxHashInput((prev) => ({
                                    ...prev,
                                    [session.key]: e.target.value,
                                  }))
                                }
                                placeholder="Enter payment transaction hash (0x...)"
                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                              />
                            </div>
                            {arkivBuilderMode ? (
                              <ArkivQueryTooltip
                                query={[
                                  `POST /api/sessions { action: 'submitPayment', ... }`,
                                  `Creates: type='session_payment_submission' entity`,
                                  `Attributes: sessionKey='${session.key.slice(0, 12)}...', submittedBy='${userWallet?.toLowerCase().slice(0, 8) || '...'}...', paymentTxHash`,
                                  `Payload: { submittedAt: ISO timestamp, paymentTxHash }`,
                                  `TTL: Matches session expiration`,
                                  `Note: Learner submits payment transaction hash for mentor validation`,
                                ]}
                                label="Submit Payment"
                              >
                                <button
                                  onClick={() => handleSubmitPayment(session)}
                                  disabled={
                                    submittingPayment === session.key ||
                                    !paymentTxHashInput[session.key]?.trim()
                                  }
                                  className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {submittingPayment === session.key
                                    ? 'Submitting...'
                                    : '💰 Submit Payment'}
                                </button>
                              </ArkivQueryTooltip>
                            ) : (
                              <button
                                onClick={() => handleSubmitPayment(session)}
                                disabled={
                                  submittingPayment === session.key ||
                                  !paymentTxHashInput[session.key]?.trim()
                                }
                                className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {submittingPayment === session.key
                                  ? 'Submitting...'
                                  : '💰 Submit Payment'}
                              </button>
                            )}
                          </div>
                        )}

                      {canConfirm && !userConfirmed && (
                        <div className="mt-4 border-t border-orange-200 pt-4 dark:border-orange-800">
                          {/* Payment validation button (if payment exists and not validated) */}
                          {session.paymentTxHash && !session.paymentValidated && isMentor && (
                            <div className="mb-3 rounded border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                Payment submitted! Please validate (Step 3 of 3):
                              </p>
                              {arkivBuilderMode ? (
                                <ArkivQueryTooltip
                                  query={[
                                    `POST /api/sessions { action: 'validatePayment', ... }`,
                                    `Creates: type='session_payment_validation' entity`,
                                    `Attributes: sessionKey='${session.key.slice(0, 12)}...', validatedBy='${userWallet?.toLowerCase().slice(0, 8) || '...'}...', paymentTxHash`,
                                    `Payload: { validatedAt: ISO timestamp, paymentTxHash }`,
                                    `TTL: Matches session expiration`,
                                    `Note: Mentor validates payment transaction hash submitted by learner`,
                                  ]}
                                  label="Validate Payment"
                                >
                                  <button
                                    onClick={() => handleValidatePayment(session)}
                                    disabled={validatingPayment === session.key}
                                    className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {validatingPayment === session.key
                                      ? 'Validating...'
                                      : '💰 Validate Payment'}
                                  </button>
                                </ArkivQueryTooltip>
                              ) : (
                                <button
                                  onClick={() => handleValidatePayment(session)}
                                  disabled={validatingPayment === session.key}
                                  className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {validatingPayment === session.key
                                    ? 'Validating...'
                                    : '💰 Validate Payment'}
                                </button>
                              )}
                              <p className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
                                Validate the payment transaction before confirming
                              </p>
                            </div>
                          )}
                          <div className="flex gap-3">
                            {arkivBuilderMode ? (
                              <ArkivQueryTooltip
                                query={[
                                  `POST /api/sessions { action: 'confirmSession', ... }`,
                                  `Creates: type='session_confirmation' entity`,
                                  `Attributes: sessionKey='${session.key.slice(0, 12)}...', confirmedBy='${userWallet?.toLowerCase().slice(0, 8) || '...'}...', mentorWallet, learnerWallet`,
                                  `Payload: { confirmedAt: ISO timestamp }`,
                                  `TTL: Matches session expiration`,
                                  `Note: When both parties confirm, creates session_jitsi entity`,
                                ]}
                                label="Confirm Session"
                              >
                                <button
                                  onClick={() => handleConfirm(session)}
                                  disabled={
                                    confirming === session.key ||
                                    Boolean(
                                      session.paymentTxHash && !session.paymentValidated && isMentor
                                    )
                                  }
                                  className="min-w-[140px] flex-1 rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  title={
                                    session.paymentTxHash && !session.paymentValidated && isMentor
                                      ? 'Please validate payment first'
                                      : ''
                                  }
                                >
                                  {confirming === session.key ? 'Confirming...' : '✓ Confirm'}
                                </button>
                              </ArkivQueryTooltip>
                            ) : (
                              <button
                                onClick={() => handleConfirm(session)}
                                disabled={
                                  confirming === session.key ||
                                  Boolean(
                                    session.paymentTxHash && !session.paymentValidated && isMentor
                                  )
                                }
                                className="min-w-[140px] flex-1 rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                title={
                                  session.paymentTxHash && !session.paymentValidated && isMentor
                                    ? 'Please validate payment first'
                                    : ''
                                }
                              >
                                {confirming === session.key ? 'Confirming...' : '✓ Confirm'}
                              </button>
                            )}
                            {arkivBuilderMode ? (
                              <ArkivQueryTooltip
                                query={[
                                  `POST /api/sessions { action: 'rejectSession', ... }`,
                                  `Creates: type='session_rejection' entity`,
                                  `Attributes: sessionKey='${session.key.slice(0, 12)}...', rejectedBy='${userWallet?.toLowerCase().slice(0, 8) || '...'}...', mentorWallet, learnerWallet`,
                                  `Payload: { rejectedAt: ISO timestamp }`,
                                  `TTL: Matches session expiration`,
                                  `Note: Sets session status to 'declined' (rejecting pending request)`,
                                ]}
                                label="Reject Session"
                              >
                                <button
                                  onClick={() => handleReject(session)}
                                  disabled={rejecting === session.key}
                                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {rejecting === session.key ? 'Rejecting...' : '✗ Reject'}
                                </button>
                              </ArkivQueryTooltip>
                            ) : (
                              <button
                                onClick={() => handleReject(session)}
                                disabled={rejecting === session.key}
                                className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {rejecting === session.key ? 'Rejecting...' : '✗ Reject'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Scheduled Sessions */}
        {scheduledSessions.length > 0 &&
          (() => {
            // Determine if all sessions in this list are past (for section header)
            const allPast = scheduledSessions.every((s) => isSessionPast(s));
            const sectionLabel =
              allPast && timeFilter === 'past'
                ? `📅 Past Sessions (${scheduledSessions.length})`
                : `✅ Scheduled (${scheduledSessions.length})`;
            const sectionColor =
              allPast && timeFilter === 'past'
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-green-600 dark:text-green-400';

            return (
              <div className="mb-8">
                <div className="mb-4 flex items-center justify-between">
                  {arkivBuilderMode ? (
                    <ArkivQueryTooltip
                      query={[
                        `GET /api/sessions?wallet=${userWallet?.toLowerCase() || '...'}`,
                        `Query: type='session', (mentorWallet='${userWallet?.toLowerCase() || '...'}' OR learnerWallet='${userWallet?.toLowerCase() || '...'}')`,
                        `Filtered: status='scheduled'${timeFilter === 'past' ? ', isSessionPast=true' : ''}`,
                        `Returns: Session[] (${scheduledSessions.length} ${allPast && timeFilter === 'past' ? 'past' : 'scheduled'} sessions)`,
                        `Each session is a type='session' entity on Arkiv`,
                      ]}
                      label={sectionLabel}
                    >
                      <h2 className={`text-xl font-semibold ${sectionColor}`}>{sectionLabel}</h2>
                    </ArkivQueryTooltip>
                  ) : (
                    <h2 className={`text-xl font-semibold ${sectionColor}`}>{sectionLabel}</h2>
                  )}
                  <button
                    onClick={() => setScheduledExpanded(!scheduledExpanded)}
                    className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    title={
                      scheduledExpanded
                        ? 'Collapse scheduled sessions'
                        : 'Expand scheduled sessions'
                    }
                  >
                    {scheduledExpanded ? '▼ Collapse' : '▶ Expand'}
                  </button>
                </div>
                {scheduledExpanded && (
                  <div className="space-y-4">
                    {scheduledSessions.map((session) => {
                      const isMentor =
                        userWallet?.toLowerCase() === session.mentorWallet.toLowerCase();
                      const otherWallet = isMentor ? session.learnerWallet : session.mentorWallet;
                      const otherProfile = profiles[otherWallet.toLowerCase()];
                      const sessionTime = formatSessionDate(session.sessionDate);
                      const sessionHasEnded = hasSessionEnded(session);

                      // Check if user can give feedback for past scheduled sessions
                      const existingFeedbacks = sessionFeedbacks[session.key] || [];
                      const canGiveFeedback =
                        userWallet &&
                        sessionHasEnded &&
                        canGiveFeedbackForSessionSync(session, userWallet, existingFeedbacks);
                      const hasGivenFeedback =
                        userWallet &&
                        existingFeedbacks.some(
                          (f: any) => f.feedbackFrom.toLowerCase() === userWallet.toLowerCase()
                        );

                      // Check if this is a community gathering session
                      const gatheringKey =
                        session.gatheringKey ||
                        session.notes?.match(/virtual_gathering_rsvp:([^\s,]+)/)?.[1] ||
                        (session.notes?.includes('virtual_gathering_rsvp:')
                          ? session.notes.split('virtual_gathering_rsvp:')[1]?.split(',')[0]?.trim()
                          : null);
                      const isCommunityGathering =
                        gatheringKey &&
                        (session.skill === 'virtual_gathering_rsvp' ||
                          session.notes?.includes('virtual_gathering_rsvp:'));
                      const gathering = gatheringKey ? gatherings[gatheringKey] : null;
                      const gatheringRsvpWallets = gatheringKey
                        ? rsvpWallets[gatheringKey] || []
                        : [];
                      const rsvpProfiles = gatheringRsvpWallets
                        .map((wallet) => profiles[wallet.toLowerCase()])
                        .filter(Boolean) as UserProfile[];

                      // Use gathering's videoJoinUrl if available (for community gatherings)
                      const videoJoinUrl =
                        isCommunityGathering && gathering?.videoJoinUrl
                          ? gathering.videoJoinUrl
                          : session.videoJoinUrl;

                      return (
                        <div
                          key={session.key}
                          className="rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/20"
                        >
                          <div className="mb-4 flex items-start justify-between">
                            <div className="flex-1">
                              <div className="mb-2 flex items-center gap-2">
                                <h3 className="text-lg font-semibold">
                                  📅 {formatSessionTitle(session, skillsMap)}
                                </h3>
                                {/* Show "Past" badge if session has started, "Scheduled" if it hasn't */}
                                {isSessionPast(session) ? (
                                  <span className="rounded bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-200">
                                    Past
                                  </span>
                                ) : (
                                  <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-200">
                                    Scheduled
                                  </span>
                                )}
                                {isCommunityGathering && (
                                  <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                                    Community gathering
                                  </span>
                                )}
                                {arkivBuilderMode && session.key && (
                                  <div className="ml-auto flex items-center gap-2">
                                    <ViewOnArkivLink
                                      entityKey={session.key}
                                      txHash={session.txHash}
                                      label="View Session Entity"
                                      className="text-xs"
                                    />
                                    <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                                      {session.key.slice(0, 12)}...
                                    </span>
                                  </div>
                                )}
                              </div>
                              {isCommunityGathering ? (
                                <>
                                  {/* Community gathering display - same as topic page */}
                                  <p className="mb-2 text-gray-700 dark:text-gray-300">
                                    <strong>Date:</strong> {sessionTime.date}
                                  </p>
                                  <p className="mb-2 text-gray-600 dark:text-gray-400">
                                    <strong>Time:</strong> {sessionTime.time}
                                  </p>
                                  {session.duration && (
                                    <p className="mb-2 text-gray-600 dark:text-gray-400">
                                      <strong>Duration:</strong> {session.duration} minutes
                                    </p>
                                  )}
                                  {gathering && gathering.rsvpCount !== undefined && (
                                    <p className="mb-2 text-gray-600 dark:text-gray-400">
                                      <strong>RSVPs:</strong> {gathering.rsvpCount}{' '}
                                      {gathering.rsvpCount === 1 ? 'RSVP' : 'RSVPs'}
                                    </p>
                                  )}
                                  {videoJoinUrl && (
                                    <div className="mt-4">
                                      <a
                                        href={videoJoinUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                                      >
                                        🎥 Join Meeting
                                      </a>
                                    </div>
                                  )}
                                  {/* RSVP'd Profiles List */}
                                  {gatheringRsvpWallets.length > 0 && (
                                    <div className="mt-4 border-t border-green-200 pt-4 dark:border-green-700">
                                      <p className="mb-2 text-xs font-medium text-green-700 dark:text-green-300">
                                        {gatheringRsvpWallets.length}{' '}
                                        {gatheringRsvpWallets.length === 1
                                          ? 'profile has'
                                          : 'profiles have'}{' '}
                                        RSVP'd:
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {rsvpProfiles.map((profile) => (
                                          <Link
                                            key={profile.wallet}
                                            href={`/profiles/${profile.wallet}`}
                                            className="rounded bg-green-100 px-2 py-1 text-xs text-green-800 transition-colors hover:bg-green-200 dark:bg-green-800/50 dark:text-green-200 dark:hover:bg-green-700"
                                          >
                                            {profile.displayName ||
                                              profile.username ||
                                              profile.wallet.slice(0, 8) + '...'}
                                          </Link>
                                        ))}
                                        {/* Show wallets without profiles */}
                                        {gatheringRsvpWallets
                                          .filter((wallet) => !profiles[wallet.toLowerCase()])
                                          .map((wallet) => (
                                            <span
                                              key={wallet}
                                              className="rounded bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-800/50 dark:text-green-200"
                                            >
                                              {wallet.slice(0, 8)}...{wallet.slice(-4)}
                                            </span>
                                          ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  {/* Regular session display */}
                                  <p className="mb-2 text-gray-700 dark:text-gray-300">
                                    <strong>With:</strong>{' '}
                                    {otherProfile?.displayName || shortenWallet(otherWallet)}
                                  </p>
                                  <p className="mb-2 text-gray-600 dark:text-gray-400">
                                    <strong>Date:</strong> {sessionTime.date}
                                  </p>
                                  <p className="mb-2 text-gray-600 dark:text-gray-400">
                                    <strong>Time:</strong> {sessionTime.time}
                                  </p>
                                  {session.duration && (
                                    <p className="mb-2 text-gray-600 dark:text-gray-400">
                                      <strong>Duration:</strong> {session.duration} minutes
                                    </p>
                                  )}
                                  {session.notes && (
                                    <div className="mt-3">
                                      <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Notes:
                                      </p>
                                      <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {session.notes}
                                      </p>
                                    </div>
                                  )}
                                  {session.paymentTxHash && (
                                    <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-2 dark:border-blue-800 dark:bg-blue-900/20">
                                      <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                                        💰 Payment Transaction:
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <code className="font-mono text-xs text-gray-600 dark:text-gray-400">
                                          {session.paymentTxHash.slice(0, 10)}...
                                          {session.paymentTxHash.slice(-8)}
                                        </code>
                                        <a
                                          href={`https://explorer.kaolin.hoodi.arkiv.network/tx/${session.paymentTxHash}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                                        >
                                          View
                                        </a>
                                      </div>
                                      {session.paymentValidated ? (
                                        <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                                          ✓ Validated by{' '}
                                          {session.paymentValidatedBy
                                            ? shortenWallet(session.paymentValidatedBy)
                                            : 'unknown'}
                                        </p>
                                      ) : (
                                        <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                                          ⏳ Payment not yet validated
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  {sessionHasEnded ? (
                                    // Past session: show feedback button or display feedback
                                    <div className="mt-4">
                                      {canGiveFeedback ? (
                                        <button
                                          onClick={() => setFeedbackSession(session)}
                                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                                        >
                                          💬 Leave Feedback
                                        </button>
                                      ) : hasGivenFeedback ? (
                                        (() => {
                                          const userFeedback = existingFeedbacks.find(
                                            (f: any) =>
                                              f.feedbackFrom.toLowerCase() ===
                                              userWallet?.toLowerCase()
                                          );
                                          return userFeedback ? (
                                            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
                                              <div className="mb-2 flex items-center justify-between">
                                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                  ✓ Your Feedback
                                                </p>
                                                {userFeedback.rating && (
                                                  <div className="text-lg">
                                                    {'⭐'.repeat(userFeedback.rating)}
                                                    <span className="ml-1 text-sm text-gray-600 dark:text-gray-400">
                                                      ({userFeedback.rating}/5)
                                                    </span>
                                                  </div>
                                                )}
                                              </div>
                                              {userFeedback.notes && (
                                                <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
                                                  {userFeedback.notes}
                                                </p>
                                              )}
                                              {userFeedback.technicalDxFeedback && (
                                                <div className="mt-3 rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                                                  <p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                                                    Technical DX Feedback:
                                                  </p>
                                                  <p className="text-sm text-gray-700 dark:text-gray-300">
                                                    {userFeedback.technicalDxFeedback}
                                                  </p>
                                                </div>
                                              )}
                                              <div className="mt-2 flex items-center gap-2">
                                                <ViewOnArkivLink
                                                  entityKey={userFeedback.key}
                                                  txHash={userFeedback.txHash}
                                                  label="View Feedback Entity"
                                                  className="text-xs"
                                                />
                                                {arkivBuilderMode && userFeedback.key && (
                                                  <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                                                    {userFeedback.key.slice(0, 12)}...
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          ) : (
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                              ✓ Feedback submitted
                                            </p>
                                          );
                                        })()
                                      ) : null}
                                    </div>
                                  ) : videoJoinUrl ? (
                                    // Upcoming session: show join link
                                    <div className="mt-4">
                                      <a
                                        href={videoJoinUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                                      >
                                        🎥 Join Jitsi Meeting
                                      </a>
                                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Room: {session.videoRoomName || 'N/A'}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                                      {session.status === 'expired' ? (
                                        <span className="text-red-600 dark:text-red-400">
                                          ⏰ Session expired - Jitsi link not available
                                        </span>
                                      ) : (
                                        (() => {
                                          // Check if session is in the past (U4.3: prevent generating for past sessions)
                                          const sessionTime = session.sessionDate
                                            ? new Date(session.sessionDate).getTime()
                                            : 0;
                                          const isPast =
                                            sessionTime > 0 && Date.now() >= sessionTime;

                                          if (isPast && session.status !== 'scheduled') {
                                            return (
                                              <span className="text-gray-600 dark:text-gray-400">
                                                ⏰ Session time has passed - Jitsi link not
                                                available
                                              </span>
                                            );
                                          }

                                          return (
                                            <>
                                              ⏳ Jitsi link will appear once both parties confirm
                                              {session.mentorConfirmed &&
                                                session.learnerConfirmed &&
                                                session.status === 'scheduled' &&
                                                !isPast && (
                                                  <span className="mt-1 block text-orange-600 dark:text-orange-400">
                                                    (Both confirmed - link may be generating...)
                                                  </span>
                                                )}
                                            </>
                                          );
                                        })()
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

        {/* Completed Sessions */}
        {completedSessions.length > 0 && (
          <div className="mb-8">
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `GET /api/sessions?wallet=${userWallet?.toLowerCase() || '...'}`,
                  `Query: type='session', (mentorWallet='${userWallet?.toLowerCase() || '...'}' OR learnerWallet='${userWallet?.toLowerCase() || '...'}')`,
                  `Filtered: status='completed'`,
                  `Returns: Session[] (${completedSessions.length} completed sessions)`,
                  `Each session is a type='session' entity on Arkiv`,
                ]}
                label={`✓ Completed (${completedSessions.length})`}
              >
                <h2 className="mb-4 text-xl font-semibold text-blue-600 dark:text-blue-400">
                  ✓ Completed ({completedSessions.length})
                </h2>
              </ArkivQueryTooltip>
            ) : (
              <h2 className="mb-4 text-xl font-semibold text-blue-600 dark:text-blue-400">
                ✓ Completed ({completedSessions.length})
              </h2>
            )}
            <div className="space-y-4">
              {completedSessions.map((session) => {
                const isMentor = userWallet?.toLowerCase() === session.mentorWallet.toLowerCase();
                const otherWallet = isMentor ? session.learnerWallet : session.mentorWallet;
                const otherProfile = profiles[otherWallet.toLowerCase()];
                const sessionTime = formatSessionDate(session.sessionDate);

                // Check if user can give feedback (using reusable utility)
                const existingFeedbacks = sessionFeedbacks[session.key] || [];
                const canGiveFeedback =
                  userWallet &&
                  canGiveFeedbackForSessionSync(session, userWallet, existingFeedbacks);
                const hasGivenFeedback =
                  userWallet &&
                  existingFeedbacks.some(
                    (f: any) => f.feedbackFrom.toLowerCase() === userWallet.toLowerCase()
                  );

                return (
                  <div
                    key={session.key}
                    className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        📅 {formatSessionTitle(session, skillsMap)}
                      </h3>
                      <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                        Completed
                      </span>
                    </div>
                    <p className="mb-2 text-gray-700 dark:text-gray-300">
                      <strong>With:</strong>{' '}
                      {otherProfile?.displayName || shortenWallet(otherWallet)}
                    </p>
                    <p className="mb-4 text-gray-600 dark:text-gray-400">
                      {sessionTime.date} at {sessionTime.time}
                    </p>
                    {canGiveFeedback ? (
                      <button
                        onClick={() => setFeedbackSession(session)}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                      >
                        💬 Leave Feedback
                      </button>
                    ) : hasGivenFeedback ? (
                      (() => {
                        const userFeedback = existingFeedbacks.find(
                          (f: any) => f.feedbackFrom.toLowerCase() === userWallet?.toLowerCase()
                        );
                        return userFeedback ? (
                          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                ✓ Your Feedback
                              </p>
                              {userFeedback.rating && (
                                <div className="text-lg">
                                  {'⭐'.repeat(userFeedback.rating)}
                                  <span className="ml-1 text-sm text-gray-600 dark:text-gray-400">
                                    ({userFeedback.rating}/5)
                                  </span>
                                </div>
                              )}
                            </div>
                            {userFeedback.notes && (
                              <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
                                {userFeedback.notes}
                              </p>
                            )}
                            {userFeedback.technicalDxFeedback && (
                              <div className="mt-3 rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                                <p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                                  Technical DX Feedback:
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  {userFeedback.technicalDxFeedback}
                                </p>
                              </div>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              <ViewOnArkivLink
                                entityKey={userFeedback.key}
                                txHash={userFeedback.txHash}
                                label="View Feedback Entity"
                                className="text-xs"
                              />
                              {arkivBuilderMode && userFeedback.key && (
                                <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                                  {userFeedback.key.slice(0, 12)}...
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            ✓ Feedback submitted
                          </p>
                        );
                      })()
                    ) : !session.mentorConfirmed || !session.learnerConfirmed ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Waiting for both participants to confirm
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Declined/Cancelled Sessions */}
        {endedSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-red-600 dark:text-red-400">
              ❌ Declined/Cancelled ({endedSessions.length})
            </h2>
            <div className="space-y-4">
              {endedSessions.map((session) => {
                const isMentor = userWallet?.toLowerCase() === session.mentorWallet.toLowerCase();
                const otherWallet = isMentor ? session.learnerWallet : session.mentorWallet;
                const otherProfile = profiles[otherWallet.toLowerCase()];
                const sessionTime = formatSessionDate(session.sessionDate);

                return (
                  <div
                    key={session.key}
                    className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        📅 {formatSessionTitle(session, skillsMap)}
                      </h3>
                      <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-200">
                        {session.status === 'declined' ? 'Declined' : 'Cancelled'}
                      </span>
                    </div>
                    <p className="mb-2 text-gray-700 dark:text-gray-300">
                      <strong>With:</strong>{' '}
                      {otherProfile?.displayName || shortenWallet(otherWallet)}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      {sessionTime.date} at {sessionTime.time}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Archived Sessions (Reconstructed) - Collapsed by default */}
        {archivedSessions.length > 0 && (
          <div className="mb-8">
            <button
              onClick={() => setArchivedSessionsExpanded(!archivedSessionsExpanded)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-gray-50 p-3 text-left transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Archived Sessions ({archivedSessions.length})
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {archivedSessionsExpanded ? '▼' : '▶'}
              </span>
            </button>
            {archivedSessionsExpanded && (
              <div className="mt-3 space-y-4">
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  These sessions were reconstructed from feedback after the original session
                  entities expired. Some details may be incomplete.
                </p>
                {archivedSessions.map((session) => {
                  const isMentor = userWallet?.toLowerCase() === session.mentorWallet.toLowerCase();
                  const otherWallet = isMentor ? session.learnerWallet : session.mentorWallet;
                  const otherProfile = profiles[otherWallet.toLowerCase()];
                  const sessionTime = formatSessionDate(session.sessionDate);

                  return (
                    <div
                      key={session.key}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-6 opacity-75 dark:border-gray-700 dark:bg-gray-800"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-lg font-semibold">
                          📅 {formatSessionTitle(session, skillsMap)}
                        </h3>
                        <span className="rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                          Archived
                        </span>
                        <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                          Completed
                        </span>
                      </div>
                      <p className="mb-2 text-gray-700 dark:text-gray-300">
                        <strong>With:</strong>{' '}
                        {otherProfile?.displayName || shortenWallet(otherWallet)}
                      </p>
                      <p className="mb-2 text-gray-600 dark:text-gray-400">
                        {sessionTime.date} at {sessionTime.time}
                      </p>
                      {session.notes && (
                        <div className="mt-3 rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                          <p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                            Notes:
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {session.notes}
                          </p>
                        </div>
                      )}
                      {arkivBuilderMode && session.key && (
                        <div className="mt-3 flex items-center gap-2">
                          <ViewOnArkivLink
                            entityKey={session.key}
                            txHash={session.txHash}
                            label="View Session Entity"
                            className="text-xs"
                          />
                          <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                            {session.key.slice(0, 12)}...
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!hasAnySessions && (
          <EmptyState
            title="No sessions yet"
            description="Request a meeting from a profile to get started! Browse profiles and connect with mentors or learners."
            icon={
              <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            }
          />
        )}

        {/* Feedback Modal */}
        {feedbackSession && userWallet && (
          <FeedbackModal
            isOpen={!!feedbackSession}
            onClose={() => setFeedbackSession(null)}
            session={feedbackSession}
            userWallet={userWallet}
            onSuccess={() => {
              if (userWallet) {
                // Reload sessions and feedbacks
                loadSessions(userWallet);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
