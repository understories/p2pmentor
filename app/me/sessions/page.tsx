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
import { BetaBanner } from '@/components/BetaBanner';
import { Alert } from '@/components/Alert';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FeedbackModal } from '@/components/FeedbackModal';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { formatSessionTitle } from '@/lib/sessions/display';
import type { Session } from '@/lib/arkiv/sessions';
import type { UserProfile } from '@/lib/arkiv/profile';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState<string | null>(null);
  const [paymentTxHashInput, setPaymentTxHashInput] = useState<Record<string, string>>({});
  const [validatingPayment, setValidatingPayment] = useState<string | null>(null);
  const [feedbackSession, setFeedbackSession] = useState<Session | null>(null);
  const [sessionFeedbacks, setSessionFeedbacks] = useState<Record<string, any[]>>({});

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

      // Fetch sessions
      const sessionsRes = await fetch(`/api/sessions?wallet=${encodeURIComponent(wallet)}`);
      if (!sessionsRes.ok) {
        throw new Error('Failed to fetch sessions');
      }
      const sessionsData = await sessionsRes.json();
      const sessionsList = sessionsData.sessions || [];
      setSessions(sessionsList);

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
          <LoadingSpinner text="Loading sessions..." className="py-12" />
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

  // Group sessions by status
  const pendingSessions = sessions.filter(s => s.status === 'pending');
  const scheduledSessions = sessions.filter(s => s.status === 'scheduled');
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const cancelledSessions = sessions.filter(s => s.status === 'cancelled');

  // Find upcoming session (next scheduled session)
  const now = Date.now();
  const upcomingSession = scheduledSessions
    .filter(s => {
      const sessionTime = new Date(s.sessionDate).getTime();
      return sessionTime > now;
    })
    .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime())[0];

  const hasAnySessions = pendingSessions.length > 0 || scheduledSessions.length > 0 || completedSessions.length > 0;

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
      <ThemeToggle />
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>
        
        <PageHeader
          title="Sessions"
          description="Manage your mentorship sessions: pending requests, scheduled meetings, and completed sessions."
        />
        
        <BetaBanner />

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
          const hoursUntil = Math.floor((sessionDateTime - now) / (1000 * 60 * 60));
          const minutesUntil = Math.floor(((sessionDateTime - now) % (1000 * 60 * 60)) / (1000 * 60));

          return (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200">
                  📅 Next Session
                </h3>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {hoursUntil > 0 ? `In ${hoursUntil}h ${minutesUntil}m` : `In ${minutesUntil}m`}
                </span>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-300 mb-1">
                <strong>{formatSessionTitle(upcomingSession)}</strong> with {otherProfile?.displayName || shortenWallet(otherWallet)}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                {sessionTime.date} at {sessionTime.time}
              </p>
              {upcomingSession.videoJoinUrl && (
                <a
                  href={upcomingSession.videoJoinUrl}
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
            <h2 className="text-xl font-semibold mb-4 text-orange-600 dark:text-orange-400">
              ⏳ Pending ({pendingSessions.length})
            </h2>
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
                          <h3 className="text-lg font-semibold">📅 {formatSessionTitle(session)}</h3>
                          <span className="px-2 py-1 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 rounded">
                            Pending
                          </span>
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
                        <button
                          onClick={() => handleSubmitPayment(session)}
                          disabled={submittingPayment === session.key || !paymentTxHashInput[session.key]?.trim()}
                          className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submittingPayment === session.key ? 'Submitting...' : '💰 Submit Payment'}
                        </button>
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
                            <button
                              onClick={() => handleValidatePayment(session)}
                              disabled={validatingPayment === session.key}
                              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {validatingPayment === session.key ? 'Validating...' : '💰 Validate Payment'}
                            </button>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                              Validate the payment transaction before confirming
                            </p>
                          </div>
                        )}
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleConfirm(session)}
                            disabled={confirming === session.key || Boolean(session.paymentTxHash && !session.paymentValidated && isMentor)}
                            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={session.paymentTxHash && !session.paymentValidated && isMentor ? 'Please validate payment first' : ''}
                          >
                            {confirming === session.key ? 'Confirming...' : '✓ Confirm'}
                          </button>
                          <button
                            onClick={() => handleReject(session)}
                            disabled={rejecting === session.key}
                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {rejecting === session.key ? 'Rejecting...' : '✗ Reject'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Scheduled Sessions */}
        {scheduledSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-green-600 dark:text-green-400">
              ✅ Scheduled ({scheduledSessions.length})
            </h2>
            <div className="space-y-4">
              {scheduledSessions.map((session) => {
                const isMentor = userWallet?.toLowerCase() === session.mentorWallet.toLowerCase();
                const otherWallet = isMentor ? session.learnerWallet : session.mentorWallet;
                const otherProfile = profiles[otherWallet.toLowerCase()];
                const sessionTime = formatSessionDate(session.sessionDate);

                return (
                  <div
                    key={session.key}
                    className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold">📅 {formatSessionTitle(session)}</h3>
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                            Scheduled
                          </span>
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
                        {session.videoJoinUrl ? (
                          <div className="mt-4">
                            <a
                              href={session.videoJoinUrl}
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
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed Sessions */}
        {completedSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-blue-600 dark:text-blue-400">
              ✓ Completed ({completedSessions.length})
            </h2>
            <div className="space-y-4">
              {completedSessions.map((session) => {
                const isMentor = userWallet?.toLowerCase() === session.mentorWallet.toLowerCase();
                const otherWallet = isMentor ? session.learnerWallet : session.mentorWallet;
                const otherProfile = profiles[otherWallet.toLowerCase()];
                const sessionTime = formatSessionDate(session.sessionDate);

                // Check if user can give feedback
                const isConfirmed = session.mentorConfirmed && session.learnerConfirmed;
                const isValidStatus = session.status === 'completed' || session.status === 'scheduled';
                const existingFeedbacks = sessionFeedbacks[session.key] || [];
                const hasGivenFeedback = userWallet && existingFeedbacks.some(
                  (f: any) => f.feedbackFrom.toLowerCase() === userWallet.toLowerCase()
                );
                const canGiveFeedback = userWallet && isConfirmed && isValidStatus && !hasGivenFeedback;

                return (
                  <div
                    key={session.key}
                    className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">📅 {session.skill}</h3>
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
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        ✓ Feedback submitted
                      </p>
                    ) : !isConfirmed ? (
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

        {/* Cancelled Sessions */}
        {cancelledSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">
              ❌ Cancelled ({cancelledSessions.length})
            </h2>
            <div className="space-y-4">
              {cancelledSessions.map((session) => {
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
                      <h3 className="text-lg font-semibold">📅 {session.skill}</h3>
                      <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded">
                        Cancelled
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
                loadSessions(userWallet);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
