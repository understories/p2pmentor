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

function formatSessionDate(sessionDate: string): { date: string; time: string; isPast: boolean; isToday: boolean } {
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
    day: 'numeric' 
  });
  
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
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
      skills.forEach(skill => {
        skillsMap[skill.key] = skill;
      });
      setSkillsMap(skillsMap);

      // Fetch sessions
      const sessionsParams = `?wallet=${encodeURIComponent(wallet)}`;
      const sessionsRes = await fetch(`/api/sessions${appendBuilderModeParams(arkivBuilderMode, sessionsParams)}`);
      if (!sessionsRes.ok) {
        throw new Error('Failed to fetch sessions');
      }
      const sessionsData = await sessionsRes.json();
      const sessionsList = sessionsData.sessions || [];
      setSessions(sessionsList);

      // Load feedbacks for all sessions
      const feedbackPromises = sessionsList.map(async (session: Session) => {
        try {
          const feedbackRes = await fetch(`/api/feedback?sessionKey=${encodeURIComponent(session.key)}`);
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
      const communitySessions = sessionsList.filter((s: Session) =>
        s.gatheringKey || s.skill === 'virtual_gathering_rsvp' || s.notes?.includes('virtual_gathering_rsvp:')
      );

      if (communitySessions.length > 0) {
        const gatheringKeys = new Set<string>();
        communitySessions.forEach((s: Session) => {
          const gatheringKey = s.gatheringKey ||
            (s.notes?.match(/virtual_gathering_rsvp:([^\s,]+)/)?.[1]) ||
            (s.notes?.includes('virtual_gathering_rsvp:') ? s.notes.split('virtual_gathering_rsvp:')[1]?.split(',')[0]?.trim() : null);
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
              fetch(`/api/virtual-gatherings?gatheringKey=${encodeURIComponent(gatheringKey)}`).then(r => r.json()).catch(() => ({ ok: false, rsvpWallets: [] })),
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
        Object.values(rsvpWalletsMap).forEach(wallets => {
          wallets.forEach(wallet => allRsvpWallets.add(wallet));
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
        throw new Error(data.error || 'Failed to confirm session');
      }

      alert('Session confirmed!');
      // Reload sessions
      if (userWallet) {
        loadSessions(userWallet);
      }
    } catch (err: any) {
      console.error('Error confirming session:', err);
      alert(`Error: ${err.message || 'Failed to confirm session'}`);
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
      setPaymentTxHashInput(prev => {
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
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
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
                `   → type='user_profile', wallet='...'`
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
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
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
    return sessionList.filter(s => !isCommunitySession(s));
  };

  // Filter sessions by time (upcoming vs past)
  const filterSessionsByTime = (sessionList: Session[]): Session[] => {
    if (timeFilter === 'all') return sessionList;
    const now = Date.now();
    if (timeFilter === 'upcoming') {
      return sessionList.filter(s => {
        const sessionTime = new Date(s.sessionDate).getTime();
        return sessionTime > now;
      });
    }
    // past: filter sessions that have ended
    return sessionList.filter(s => {
      const sessionTime = new Date(s.sessionDate).getTime();
      const duration = (s.duration || 60) * 60 * 1000; // Convert minutes to milliseconds
      const buffer = 60 * 60 * 1000; // 1 hour buffer
      const sessionEnd = sessionTime + duration + buffer;
      return now >= sessionEnd || s.status === 'completed' || s.status === 'declined' || s.status === 'cancelled';
    });
  };

  // Filter sessions by status (pending vs confirmed)
  const filterSessionsByStatus = (sessionList: Session[]): Session[] => {
    if (statusFilter === 'all') return sessionList;
    if (statusFilter === 'pending') {
      return sessionList.filter(s => s.status === 'pending' || !s.mentorConfirmed || !s.learnerConfirmed);
    }
    // confirmed: both mentor and learner confirmed, and status is scheduled or completed
    return sessionList.filter(s => s.mentorConfirmed && s.learnerConfirmed && (s.status === 'scheduled' || s.status === 'completed'));
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
  const allSessionsFiltered = applyAllFilters(sessions);
  const pendingSessions = allSessionsFiltered.filter(s => s.status === 'pending');
  const scheduledSessions = allSessionsFiltered.filter(s => s.status === 'scheduled');
  const completedSessions = allSessionsFiltered.filter(s => s.status === 'completed');
  const declinedSessions = allSessionsFiltered.filter(s => s.status === 'declined');
  const cancelledSessions = allSessionsFiltered.filter(s => s.status === 'cancelled');
  // Show declined and cancelled together in UI (they're semantically different but both represent ended sessions)
  const endedSessions = [...declinedSessions, ...cancelledSessions];

  // Find upcoming session (next scheduled session) - use original sessions before filtering
  const now = Date.now();
  const allScheduledSessions = sessions.filter(s => s.status === 'scheduled');
  const upcomingSession = allScheduledSessions
    .filter(s => {
      const sessionTime = new Date(s.sessionDate).getTime();
      return sessionTime > now;
    })
    .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime())[0];

  const hasAnySessions = pendingSessions.length > 0 || scheduledSessions.length > 0 || completedSessions.length > 0 || endedSessions.length > 0;

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
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
                      `Returns: All sessions regardless of gatheringKey`
                    ]}
                    label="All"
                  >
                    <button
                      onClick={() => setSessionTypeFilter('all')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        sessionTypeFilter === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      All
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    onClick={() => setSessionTypeFilter('all')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      sessionTypeFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
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
                      `Returns: Sessions without gatheringKey (P2P only)`
                    ]}
                    label="P2P"
                  >
                    <button
                      onClick={() => setSessionTypeFilter('p2p')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        sessionTypeFilter === 'p2p'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      P2P
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    onClick={() => setSessionTypeFilter('p2p')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      sessionTypeFilter === 'p2p'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
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
                      `Returns: Sessions with gatheringKey (community only)`
                    ]}
                    label="Community"
                  >
                    <button
                      onClick={() => setSessionTypeFilter('community')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        sessionTypeFilter === 'community'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      Community
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    onClick={() => setSessionTypeFilter('community')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      sessionTypeFilter === 'community'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
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
                      `Returns: All sessions regardless of sessionDate`
                    ]}
                    label="All"
                  >
                    <button
                      onClick={() => setTimeFilter('all')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        timeFilter === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      All
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    onClick={() => setTimeFilter('all')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      timeFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
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
                      `Returns: Sessions scheduled in the future`
                    ]}
                    label="Upcoming"
                  >
                    <button
                      onClick={() => setTimeFilter('upcoming')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        timeFilter === 'upcoming'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      Upcoming
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    onClick={() => setTimeFilter('upcoming')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      timeFilter === 'upcoming'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
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
                      `Returns: Sessions that have ended or are completed/declined/cancelled`
                    ]}
                    label="Past"
                  >
                    <button
                      onClick={() => setTimeFilter('past')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        timeFilter === 'past'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      Past
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    onClick={() => setTimeFilter('past')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      timeFilter === 'past'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
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
                      `Returns: All sessions regardless of status`
                    ]}
                    label="All"
                  >
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        statusFilter === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      All
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      statusFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
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
                      `Returns: Sessions awaiting confirmation from mentor or learner`
                    ]}
                    label="Pending"
                  >
                    <button
                      onClick={() => {
                        setStatusFilter('pending');
                        setPendingExpanded(true);
                      }}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        statusFilter === 'pending'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
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
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      statusFilter === 'pending'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
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
                      `Returns: Sessions confirmed by both parties (scheduled or completed)`
                    ]}
                    label="Confirmed"
                  >
                    <button
                      onClick={() => {
                        setStatusFilter('confirmed');
                        setScheduledExpanded(true);
                      }}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        statusFilter === 'confirmed'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
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
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      statusFilter === 'confirmed'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
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

        {/* Upcoming Session Highlight */}
        {upcomingSession && (() => {
          const isMentor = userWallet?.toLowerCase() === upcomingSession.mentorWallet.toLowerCase();
          const otherWallet = isMentor ? upcomingSession.learnerWallet : upcomingSession.mentorWallet;
          const otherProfile = profiles[otherWallet.toLowerCase()];
          const sessionTime = formatSessionDate(upcomingSession.sessionDate);
          const sessionDateTime = new Date(upcomingSession.sessionDate).getTime();
          const remaining = sessionDateTime - now;
          const daysUntil = Math.floor(remaining / (1000 * 60 * 60 * 24));
          const hoursUntil = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutesUntil = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

          // Check if this is a community gathering session
          const gatheringKey = upcomingSession.gatheringKey ||
            (upcomingSession.notes?.match(/virtual_gathering_rsvp:([^\s,]+)/)?.[1]) ||
            (upcomingSession.notes?.includes('virtual_gathering_rsvp:') ? upcomingSession.notes.split('virtual_gathering_rsvp:')[1]?.split(',')[0]?.trim() : null);
          const isCommunityGathering = gatheringKey && (upcomingSession.skill === 'virtual_gathering_rsvp' || upcomingSession.notes?.includes('virtual_gathering_rsvp:'));
          const gathering = gatheringKey ? gatherings[gatheringKey] : null;

          // Use gathering's videoJoinUrl if available (for community gatherings)
          const videoJoinUrl = isCommunityGathering && gathering?.videoJoinUrl
            ? gathering.videoJoinUrl
            : upcomingSession.videoJoinUrl;

          return (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
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
              <p className="text-sm text-blue-800 dark:text-blue-300 mb-1">
                <strong>{formatSessionTitle(upcomingSession, skillsMap)}</strong>
                {!isCommunityGathering && ` with ${otherProfile?.displayName || shortenWallet(otherWallet)}`}
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
                  className="mt-2 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
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
            <div className="flex items-center justify-between mb-4">
              {arkivBuilderMode ? (
                <ArkivQueryTooltip
                  query={[
                    `GET /api/sessions?wallet=${userWallet?.toLowerCase() || '...'}`,
                    `Query: type='session', (mentorWallet='${userWallet?.toLowerCase() || '...'}' OR learnerWallet='${userWallet?.toLowerCase() || '...'}')`,
                    `Filtered: status='pending'`,
                    `Returns: Session[] (${pendingSessions.length} pending sessions)`,
                    `Each session is a type='session' entity on Arkiv`
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
                className="px-3 py-1 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 transition-colors"
                title={pendingExpanded ? 'Collapse pending sessions' : 'Expand pending sessions'}
              >
                {pendingExpanded ? '▼ Collapse' : '▶ Expand'}
              </button>
            </div>
            {pendingExpanded && (
            <div className="space-y-4">
              {pendingSessions.map((session) => {
                const isMentor = Boolean(userWallet && userWallet.toLowerCase() === session.mentorWallet.toLowerCase());
                const isLearner = Boolean(userWallet && userWallet.toLowerCase() === session.learnerWallet.toLowerCase());
                const canConfirm = isMentor || isLearner;
                const userConfirmed = isMentor ? session.mentorConfirmed : (isLearner ? session.learnerConfirmed : false);
                const otherConfirmed = isMentor ? session.learnerConfirmed : (isLearner ? session.mentorConfirmed : false);
                
                const otherWallet = isMentor ? session.learnerWallet : session.mentorWallet;
                const otherProfile = profiles[otherWallet.toLowerCase()];
                const sessionTime = formatSessionDate(session.sessionDate);

                return (
                  <div
                    key={session.key}
                    className="p-6 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold">📅 {formatSessionTitle(session, skillsMap)}</h3>
                          <span className="px-2 py-1 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 rounded">
                            Pending
                          </span>
                          {arkivBuilderMode && session.key && (
                            <div className="flex items-center gap-2 ml-auto">
                              <ViewOnArkivLink
                                entityKey={session.key}
                                txHash={session.txHash}
                                label="View Session Entity"
                                className="text-xs"
                              />
                              <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                {session.key.slice(0, 12)}...
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 mb-2">
                          <strong>With:</strong>{' '}
                          {otherProfile?.displayName || shortenWallet(otherWallet)}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 mb-2">
                          <strong>Date:</strong> {sessionTime.date}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 mb-2">
                          <strong>Time:</strong> {sessionTime.time}
                        </p>
                        {session.duration && (
                          <p className="text-gray-600 dark:text-gray-400 mb-2">
                            <strong>Duration:</strong> {session.duration} minutes
                          </p>
                        )}
                        {session.notes && (
                          <div className="mt-3">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes:</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{session.notes}</p>
                          </div>
                        )}
                        {session.paymentTxHash && (
                          <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              💰 Payment Transaction:
                            </p>
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono text-gray-600 dark:text-gray-400">
                                {session.paymentTxHash.slice(0, 10)}...{session.paymentTxHash.slice(-8)}
                              </code>
                              <a
                                href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${session.paymentTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                View
                              </a>
                            </div>
                            {session.paymentValidated ? (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                ✓ Validated by {session.paymentValidatedBy ? shortenWallet(session.paymentValidatedBy) : 'unknown'}
                              </p>
                            ) : (
                              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                ⏳ Payment not yet validated
                              </p>
                            )}
                          </div>
                        )}
                        <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                          {userConfirmed ? (
                            <span className="text-green-600 dark:text-green-400">✓ You confirmed</span>
                          ) : otherConfirmed ? (
                            <span className="text-orange-600 dark:text-orange-400">⏳ Waiting for you</span>
                          ) : (
                            <span>⏳ Awaiting confirmation</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Payment Flow Progress Indicator */}
                    {session.requiresPayment && (
                      <div className="mt-4 pt-4 border-t border-orange-200 dark:border-orange-800">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3">Payment Progress:</p>
                        <div className="flex items-center gap-2 mb-3">
                          {/* Step 1: Mentor Confirms */}
                          <div className={`flex items-center gap-2 ${session.mentorConfirmed ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${session.mentorConfirmed ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                              {session.mentorConfirmed ? '✓' : '1'}
                            </span>
                            <span className="text-xs">Mentor confirms</span>
                          </div>
                          <div className={`flex-1 h-0.5 ${session.mentorConfirmed ? 'bg-green-300 dark:bg-green-700' : 'bg-gray-200 dark:bg-gray-700'}`} />
                          {/* Step 2: Learner Submits Payment */}
                          <div className={`flex items-center gap-2 ${session.paymentTxHash ? 'text-green-600 dark:text-green-400' : (session.mentorConfirmed ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500')}`}>
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${session.paymentTxHash ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : (session.mentorConfirmed ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400')}`}>
                              {session.paymentTxHash ? '✓' : '2'}
                            </span>
                            <span className="text-xs">Payment submitted</span>
                          </div>
                          <div className={`flex-1 h-0.5 ${session.paymentValidated ? 'bg-green-300 dark:bg-green-700' : (session.paymentTxHash ? 'bg-blue-300 dark:bg-blue-700' : 'bg-gray-200 dark:bg-gray-700')}`} />
                          {/* Step 3: Mentor Validates Payment */}
                          <div className={`flex items-center gap-2 ${session.paymentValidated ? 'text-green-600 dark:text-green-400' : (session.paymentTxHash ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500')}`}>
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${session.paymentValidated ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : (session.paymentTxHash ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400')}`}>
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
                      <div className="mt-4 pt-4 border-t border-orange-200 dark:border-orange-800">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Session confirmed! Please submit your payment (Step 2 of 3):
                        </p>
                        <div className="mb-3">
                          <input
                            type="text"
                            value={paymentTxHashInput[session.key] || ''}
                            onChange={(e) => setPaymentTxHashInput(prev => ({
                              ...prev,
                              [session.key]: e.target.value
                            }))}
                            placeholder="Enter payment transaction hash (0x...)"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
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
                              `Note: Learner submits payment transaction hash for mentor validation`
                            ]}
                            label="Submit Payment"
                          >
                            <button
                              onClick={() => handleSubmitPayment(session)}
                              disabled={submittingPayment === session.key || !paymentTxHashInput[session.key]?.trim()}
                              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {submittingPayment === session.key ? 'Submitting...' : '💰 Submit Payment'}
                            </button>
                          </ArkivQueryTooltip>
                        ) : (
                          <button
                            onClick={() => handleSubmitPayment(session)}
                            disabled={submittingPayment === session.key || !paymentTxHashInput[session.key]?.trim()}
                            className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {submittingPayment === session.key ? 'Submitting...' : '💰 Submit Payment'}
                          </button>
                        )}
                      </div>
                    )}

                    {canConfirm && !userConfirmed && (
                      <div className="mt-4 pt-4 border-t border-orange-200 dark:border-orange-800">
                        {/* Payment validation button (if payment exists and not validated) */}
                        {session.paymentTxHash && !session.paymentValidated && isMentor && (
                          <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                                  `Note: Mentor validates payment transaction hash submitted by learner`
                                ]}
                                label="Validate Payment"
                              >
                                <button
                                  onClick={() => handleValidatePayment(session)}
                                  disabled={validatingPayment === session.key}
                                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {validatingPayment === session.key ? 'Validating...' : '💰 Validate Payment'}
                                </button>
                              </ArkivQueryTooltip>
                            ) : (
                              <button
                                onClick={() => handleValidatePayment(session)}
                                disabled={validatingPayment === session.key}
                                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {validatingPayment === session.key ? 'Validating...' : '💰 Validate Payment'}
                              </button>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
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
                                `Note: When both parties confirm, creates session_jitsi entity`
                              ]}
                              label="Confirm Session"
                            >
                              <button
                                onClick={() => handleConfirm(session)}
                                disabled={confirming === session.key || Boolean(session.paymentTxHash && !session.paymentValidated && isMentor)}
                                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                                title={session.paymentTxHash && !session.paymentValidated && isMentor ? 'Please validate payment first' : ''}
                              >
                                {confirming === session.key ? 'Confirming...' : '✓ Confirm'}
                              </button>
                            </ArkivQueryTooltip>
                          ) : (
                            <button
                              onClick={() => handleConfirm(session)}
                              disabled={confirming === session.key || Boolean(session.paymentTxHash && !session.paymentValidated && isMentor)}
                              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                              title={session.paymentTxHash && !session.paymentValidated && isMentor ? 'Please validate payment first' : ''}
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
                                `Note: Sets session status to 'declined' (rejecting pending request)`
                              ]}
                              label="Reject Session"
                            >
                              <button
                                onClick={() => handleReject(session)}
                                disabled={rejecting === session.key}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {rejecting === session.key ? 'Rejecting...' : '✗ Reject'}
                              </button>
                            </ArkivQueryTooltip>
                          ) : (
                            <button
                              onClick={() => handleReject(session)}
                              disabled={rejecting === session.key}
                              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        {scheduledSessions.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {arkivBuilderMode ? (
                <ArkivQueryTooltip
                  query={[
                    `GET /api/sessions?wallet=${userWallet?.toLowerCase() || '...'}`,
                    `Query: type='session', (mentorWallet='${userWallet?.toLowerCase() || '...'}' OR learnerWallet='${userWallet?.toLowerCase() || '...'}')`,
                    `Filtered: status='scheduled'`,
                    `Returns: Session[] (${scheduledSessions.length} scheduled sessions)`,
                    `Each session is a type='session' entity on Arkiv`
                  ]}
                  label={`✅ Scheduled (${scheduledSessions.length})`}
                >
                  <h2 className="text-xl font-semibold text-green-600 dark:text-green-400">
                    ✅ Scheduled ({scheduledSessions.length})
                  </h2>
                </ArkivQueryTooltip>
              ) : (
                <h2 className="text-xl font-semibold text-green-600 dark:text-green-400">
                  ✅ Scheduled ({scheduledSessions.length})
                </h2>
              )}
              <button
                onClick={() => setScheduledExpanded(!scheduledExpanded)}
                className="px-3 py-1 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 transition-colors"
                title={scheduledExpanded ? 'Collapse scheduled sessions' : 'Expand scheduled sessions'}
              >
                {scheduledExpanded ? '▼ Collapse' : '▶ Expand'}
              </button>
            </div>
            {scheduledExpanded && (
            <div className="space-y-4">
              {scheduledSessions.map((session) => {
                const isMentor = userWallet?.toLowerCase() === session.mentorWallet.toLowerCase();
                const otherWallet = isMentor ? session.learnerWallet : session.mentorWallet;
                const otherProfile = profiles[otherWallet.toLowerCase()];
                const sessionTime = formatSessionDate(session.sessionDate);
                const sessionHasEnded = hasSessionEnded(session);

                // Check if user can give feedback for past scheduled sessions
                const existingFeedbacks = sessionFeedbacks[session.key] || [];
                const canGiveFeedback = userWallet && sessionHasEnded && canGiveFeedbackForSessionSync(
                  session,
                  userWallet,
                  existingFeedbacks
                );
                const hasGivenFeedback = userWallet && existingFeedbacks.some(
                  (f: any) => f.feedbackFrom.toLowerCase() === userWallet.toLowerCase()
                );

                // Check if this is a community gathering session
                const gatheringKey = session.gatheringKey ||
                  (session.notes?.match(/virtual_gathering_rsvp:([^\s,]+)/)?.[1]) ||
                  (session.notes?.includes('virtual_gathering_rsvp:') ? session.notes.split('virtual_gathering_rsvp:')[1]?.split(',')[0]?.trim() : null);
                const isCommunityGathering = gatheringKey && (session.skill === 'virtual_gathering_rsvp' || session.notes?.includes('virtual_gathering_rsvp:'));
                const gathering = gatheringKey ? gatherings[gatheringKey] : null;
                const gatheringRsvpWallets = gatheringKey ? (rsvpWallets[gatheringKey] || []) : [];
                const rsvpProfiles = gatheringRsvpWallets
                  .map(wallet => profiles[wallet.toLowerCase()])
                  .filter(Boolean) as UserProfile[];

                // Use gathering's videoJoinUrl if available (for community gatherings)
                const videoJoinUrl = isCommunityGathering && gathering?.videoJoinUrl
                  ? gathering.videoJoinUrl
                  : session.videoJoinUrl;

                return (
                  <div
                    key={session.key}
                    className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold">📅 {formatSessionTitle(session, skillsMap)}</h3>
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                            Scheduled
                          </span>
                          {isCommunityGathering && (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded">
                              Community gathering
                            </span>
                          )}
                          {arkivBuilderMode && session.key && (
                            <div className="flex items-center gap-2 ml-auto">
                              <ViewOnArkivLink
                                entityKey={session.key}
                                txHash={session.txHash}
                                label="View Session Entity"
                                className="text-xs"
                              />
                              <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                {session.key.slice(0, 12)}...
                              </span>
                            </div>
                          )}
                        </div>
                        {isCommunityGathering ? (
                          <>
                            {/* Community gathering display - same as topic page */}
                            <p className="text-gray-700 dark:text-gray-300 mb-2">
                              <strong>Date:</strong> {sessionTime.date}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 mb-2">
                              <strong>Time:</strong> {sessionTime.time}
                            </p>
                            {session.duration && (
                              <p className="text-gray-600 dark:text-gray-400 mb-2">
                                <strong>Duration:</strong> {session.duration} minutes
                              </p>
                            )}
                            {gathering && gathering.rsvpCount !== undefined && (
                              <p className="text-gray-600 dark:text-gray-400 mb-2">
                                <strong>RSVPs:</strong> {gathering.rsvpCount} {gathering.rsvpCount === 1 ? 'RSVP' : 'RSVPs'}
                              </p>
                            )}
                            {videoJoinUrl && (
                              <div className="mt-4">
                                <a
                                  href={videoJoinUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                                >
                                  🎥 Join Meeting
                                </a>
                              </div>
                            )}
                            {/* RSVP'd Profiles List */}
                            {gatheringRsvpWallets.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-700">
                                <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-2">
                                  {gatheringRsvpWallets.length} {gatheringRsvpWallets.length === 1 ? 'profile has' : 'profiles have'} RSVP'd:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {rsvpProfiles.map((profile) => (
                                    <Link
                                      key={profile.wallet}
                                      href={`/profiles/${profile.wallet}`}
                                      className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-800/50 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-700 transition-colors"
                                    >
                                      {profile.displayName || profile.username || profile.wallet.slice(0, 8) + '...'}
                                    </Link>
                                  ))}
                                  {/* Show wallets without profiles */}
                                  {gatheringRsvpWallets
                                    .filter(wallet => !profiles[wallet.toLowerCase()])
                                    .map((wallet) => (
                                      <span
                                        key={wallet}
                                        className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-800/50 text-green-800 dark:text-green-200"
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
                            <p className="text-gray-700 dark:text-gray-300 mb-2">
                              <strong>With:</strong>{' '}
                              {otherProfile?.displayName || shortenWallet(otherWallet)}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 mb-2">
                              <strong>Date:</strong> {sessionTime.date}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 mb-2">
                              <strong>Time:</strong> {sessionTime.time}
                            </p>
                            {session.duration && (
                              <p className="text-gray-600 dark:text-gray-400 mb-2">
                                <strong>Duration:</strong> {session.duration} minutes
                              </p>
                            )}
                            {session.notes && (
                              <div className="mt-3">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes:</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{session.notes}</p>
                              </div>
                            )}
                            {session.paymentTxHash && (
                              <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  💰 Payment Transaction:
                                </p>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs font-mono text-gray-600 dark:text-gray-400">
                                    {session.paymentTxHash.slice(0, 10)}...{session.paymentTxHash.slice(-8)}
                                  </code>
                                  <a
                                    href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${session.paymentTxHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    View
                                  </a>
                                </div>
                                {session.paymentValidated ? (
                                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                    ✓ Validated by {session.paymentValidatedBy ? shortenWallet(session.paymentValidatedBy) : 'unknown'}
                                  </p>
                                ) : (
                                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
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
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
                                  >
                                    💬 Leave Feedback
                                  </button>
                                ) : hasGivenFeedback ? (
                                  (() => {
                                    const userFeedback = existingFeedbacks.find(
                                      (f: any) => f.feedbackFrom.toLowerCase() === userWallet?.toLowerCase()
                                    );
                                    return userFeedback ? (
                                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            ✓ Your Feedback
                                          </p>
                                          {userFeedback.rating && (
                                            <div className="text-lg">
                                              {'⭐'.repeat(userFeedback.rating)}
                                              <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
                                                ({userFeedback.rating}/5)
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        {userFeedback.notes && (
                                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                                            {userFeedback.notes}
                                          </p>
                                        )}
                                        {userFeedback.technicalDxFeedback && (
                                          <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                              Technical DX Feedback:
                                            </p>
                                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                              {userFeedback.technicalDxFeedback}
                                            </p>
                                          </div>
                                        )}
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
                                  className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                                >
                                  🎥 Join Jitsi Meeting
                                </a>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  Room: {session.videoRoomName || 'N/A'}
                                </p>
                              </div>
                            ) : (
                              <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                                ⏳ Jitsi link will appear once both parties confirm
                                {session.mentorConfirmed && session.learnerConfirmed && (
                                  <span className="block mt-1 text-orange-600 dark:text-orange-400">
                                    (Both confirmed - link may be generating...)
                                  </span>
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
        )}

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
                  `Each session is a type='session' entity on Arkiv`
                ]}
                label={`✓ Completed (${completedSessions.length})`}
              >
                <h2 className="text-xl font-semibold mb-4 text-blue-600 dark:text-blue-400">
                  ✓ Completed ({completedSessions.length})
                </h2>
              </ArkivQueryTooltip>
            ) : (
              <h2 className="text-xl font-semibold mb-4 text-blue-600 dark:text-blue-400">
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
                const canGiveFeedback = userWallet && canGiveFeedbackForSessionSync(
                  session,
                  userWallet,
                  existingFeedbacks
                );
                const hasGivenFeedback = userWallet && existingFeedbacks.some(
                  (f: any) => f.feedbackFrom.toLowerCase() === userWallet.toLowerCase()
                );

                return (
                  <div
                    key={session.key}
                    className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">📅 {formatSessionTitle(session, skillsMap)}</h3>
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded">
                        Completed
                      </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-2">
                      <strong>With:</strong> {otherProfile?.displayName || shortenWallet(otherWallet)}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {sessionTime.date} at {sessionTime.time}
                    </p>
                    {canGiveFeedback ? (
                      <button
                        onClick={() => setFeedbackSession(session)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
                      >
                        💬 Leave Feedback
                      </button>
                    ) : hasGivenFeedback ? (
                      (() => {
                        const userFeedback = existingFeedbacks.find(
                          (f: any) => f.feedbackFrom.toLowerCase() === userWallet?.toLowerCase()
                        );
                        return userFeedback ? (
                          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                ✓ Your Feedback
                              </p>
                              {userFeedback.rating && (
                                <div className="text-lg">
                                  {'⭐'.repeat(userFeedback.rating)}
                                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
                                    ({userFeedback.rating}/5)
                                  </span>
                                </div>
                              )}
                            </div>
                            {userFeedback.notes && (
                              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                                {userFeedback.notes}
                              </p>
                            )}
                            {userFeedback.technicalDxFeedback && (
                              <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                  Technical DX Feedback:
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  {userFeedback.technicalDxFeedback}
                                </p>
                              </div>
                            )}
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
            <h2 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">
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
                    className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">📅 {formatSessionTitle(session, skillsMap)}</h3>
                      <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded">
                        {session.status === 'declined' ? 'Declined' : 'Cancelled'}
                      </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-2">
                      <strong>With:</strong> {otherProfile?.displayName || shortenWallet(otherWallet)}
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

        {!hasAnySessions && (
          <EmptyState
            title="No sessions yet"
            description="Request a meeting from a profile to get started! Browse profiles and connect with mentors or learners."
            icon={
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
