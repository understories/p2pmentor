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
  const [validatingPayment, setValidatingPayment] = useState<string | null>(null);

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
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <BackButton href="/me" />
          </div>
          <h1 className="text-3xl font-semibold mb-6">Sessions</h1>
          <p>Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (error && !userWallet) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <BackButton href="/me" />
          </div>
          <h1 className="text-3xl font-semibold mb-6">Sessions</h1>
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  // Group sessions by status
  const pendingSessions = sessions.filter(s => s.status === 'pending');
  const scheduledSessions = sessions.filter(s => s.status === 'scheduled');
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const cancelledSessions = sessions.filter(s => s.status === 'cancelled');

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>
        <h1 className="text-3xl font-semibold mb-6">Sessions</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Pending Sessions */}
        {pendingSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-orange-600 dark:text-orange-400">
              ⏳ Pending ({pendingSessions.length})
            </h2>
            <div className="space-y-4">
              {pendingSessions.map((session) => {
                const isMentor = userWallet?.toLowerCase() === session.mentorWallet.toLowerCase();
                const isLearner = userWallet?.toLowerCase() === session.learnerWallet.toLowerCase();
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
                          <h3 className="text-lg font-semibold">📅 {session.skill}</h3>
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

                    {canConfirm && !userConfirmed && (
                      <div className="mt-4 pt-4 border-t border-orange-200 dark:border-orange-800">
                        {/* Payment validation button (if payment exists and not validated) */}
                        {session.paymentTxHash && !session.paymentValidated && (
                          <div className="mb-3">
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
                            disabled={confirming === session.key || (session.paymentTxHash && !session.paymentValidated)}
                            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={session.paymentTxHash && !session.paymentValidated ? 'Please validate payment first' : ''}
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
                          <h3 className="text-lg font-semibold">📅 {session.skill}</h3>
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
            <h2 className="text-xl font-semibold mb-4 text-gray-600 dark:text-gray-400">
              ✓ Completed ({completedSessions.length})
            </h2>
            <div className="space-y-4">
              {completedSessions.map((session) => {
                const isMentor = userWallet?.toLowerCase() === session.mentorWallet.toLowerCase();
                const otherWallet = isMentor ? session.learnerWallet : session.mentorWallet;
                const otherProfile = profiles[otherWallet.toLowerCase()];
                const sessionTime = formatSessionDate(session.sessionDate);

                return (
                  <div
                    key={session.key}
                    className="p-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">📅 {session.skill}</h3>
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded">
                        Completed
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

        {sessions.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">No sessions yet</p>
            <p className="text-sm">Request a meeting from a profile to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
