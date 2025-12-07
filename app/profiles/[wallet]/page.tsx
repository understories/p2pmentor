/**
 * Individual profile view page
 * 
 * Shows detailed profile information, skills, availability, and user's asks/offers.
 * 
 * Based on sprint spec: Show profile, skills, offers, availability
 * Reference: docs/beta_launch_sprint.md line 331-334
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { RequestMeetingModal } from '@/components/RequestMeetingModal';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import type { UserProfile } from '@/lib/arkiv/profile';
import type { Ask } from '@/lib/arkiv/asks';
import type { Offer } from '@/lib/arkiv/offers';
import type { Session } from '@/lib/arkiv/sessions';
import type { Feedback } from '@/lib/arkiv/feedback';

export default function ProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const wallet = params.wallet as string;
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [asks, setAsks] = useState<Ask[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  useEffect(() => {
    if (wallet) {
      loadProfileData(wallet);
    }
    // Get current user's wallet and profile
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (address) {
        setUserWallet(address);
        getProfileByWallet(address).then(setUserProfile).catch(() => null);
      }
    }
  }, [wallet]);

  const loadProfileData = async (walletAddress: string) => {
    try {
      setLoading(true);
      setError('');

      // Load profile, asks, offers, sessions, and feedback in parallel
      const [profileData, asksRes, offersRes, sessionsRes, feedbackRes] = await Promise.all([
        getProfileByWallet(walletAddress).catch(() => null),
        fetch(`/api/asks?wallet=${encodeURIComponent(walletAddress)}`).then(r => r.json()).catch(() => ({ ok: false, asks: [] })),
        fetch(`/api/offers?wallet=${encodeURIComponent(walletAddress)}`).then(r => r.json()).catch(() => ({ ok: false, offers: [] })),
        fetch(`/api/sessions?wallet=${encodeURIComponent(walletAddress)}`).then(r => r.json()).catch(() => ({ ok: false, sessions: [] })),
        fetch(`/api/feedback?wallet=${encodeURIComponent(walletAddress)}`).then(r => r.json()).catch(() => ({ ok: false, feedbacks: [] })),
      ]);

      setProfile(profileData);
      if (asksRes.ok) {
        setAsks(asksRes.asks || []);
      }
      if (offersRes.ok) {
        setOffers(offersRes.offers || []);
      }
      if (sessionsRes.ok) {
        setSessions(sessionsRes.sessions || []);
      }
      if (feedbackRes.ok) {
        setFeedbacks(feedbackRes.feedbacks || []);
      }
    } catch (err: any) {
      console.error('Error loading profile data:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const shortenWallet = (wallet: string) => {
    if (!wallet || wallet.length < 10) return wallet;
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatTimeRemaining = (createdAt: string, ttlSeconds: number) => {
    const created = new Date(createdAt).getTime();
    const expires = created + (ttlSeconds * 1000);
    const now = Date.now();
    const remaining = expires - now;

    if (remaining <= 0) {
      return 'Expired';
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return '<1m';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <BackButton href="/profiles" />
          </div>
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <BackButton href="/profiles" />
          </div>
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">
              {error || 'Profile not found'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <ThemeToggle />
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <BackButton href="/profiles" />
        </div>

        {/* Profile Header */}
        <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-6">
            {profile.profileImage && (
              <img
                src={profile.profileImage}
                alt={profile.displayName}
                className="w-24 h-24 rounded-full object-cover"
              />
            )}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h1 className="text-3xl font-semibold mb-2">
                    {profile.displayName || 'Anonymous'}
                  </h1>
                  {profile.username && (
                    <p className="text-lg text-gray-600 dark:text-gray-400 mb-3">@{profile.username}</p>
                  )}
                </div>
                {/* Request Meeting Button - only show if viewing someone else's profile */}
                {userWallet && userWallet.toLowerCase() !== wallet.toLowerCase() && (
                  <button
                    onClick={() => {
                      setSelectedOffer(null); // General request, not tied to specific offer
                      setShowMeetingModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Request Meeting
                  </button>
                )}
              </div>
              {profile.bioShort && (
                <p className="text-gray-700 dark:text-gray-300 mb-3">{profile.bioShort}</p>
              )}
              {profile.bioLong && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{profile.bioLong}</p>
              )}
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <p><strong>Wallet:</strong> {shortenWallet(profile.wallet)}</p>
                {profile.timezone && <p><strong>Timezone:</strong> {profile.timezone}</p>}
                {profile.seniority && <p><strong>Level:</strong> {profile.seniority}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Beta Warning */}
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ <strong>Beta Environment:</strong> This is a test environment. All data is on the Mendoza testnet and may be reset.
          </p>
        </div>

        {/* Skills */}
        {profile.skillsArray && profile.skillsArray.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {profile.skillsArray.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-lg"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Availability */}
        {profile.availabilityWindow && (
          <div className="mb-8 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <h2 className="text-2xl font-semibold mb-3">Availability</h2>
            <p className="text-gray-700 dark:text-gray-300">{profile.availabilityWindow}</p>
          </div>
        )}

        {/* Contact Links */}
        {profile.contactLinks && Object.keys(profile.contactLinks).length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Contact</h2>
            <div className="flex flex-wrap gap-4">
              {profile.contactLinks.twitter && (
                <a
                  href={`https://twitter.com/${profile.contactLinks.twitter.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Twitter: {profile.contactLinks.twitter}
                </a>
              )}
              {profile.contactLinks.github && (
                <a
                  href={`https://github.com/${profile.contactLinks.github}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  GitHub: {profile.contactLinks.github}
                </a>
              )}
              {profile.contactLinks.telegram && (
                <a
                  href={`https://t.me/${profile.contactLinks.telegram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Telegram: {profile.contactLinks.telegram}
                </a>
              )}
              {profile.contactLinks.discord && (
                <span className="text-gray-600 dark:text-gray-400">
                  Discord: {profile.contactLinks.discord}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Offers (Teaching) */}
        {offers.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Teaching Offers ({offers.length})</h2>
            <div className="space-y-4">
              {offers.map((offer) => (
                <div
                  key={offer.key}
                  className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {offer.skill}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {formatDate(offer.createdAt)}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                      {offer.status}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 mb-3">{offer.message}</p>
                  {offer.availabilityWindow && (
                    <div className="mb-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                        Availability:
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {offer.availabilityWindow}
                      </p>
                    </div>
                  )}
                  {offer.isPaid && (
                    <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded">
                      <p className="text-sm font-medium text-purple-900 dark:text-purple-200 mb-1">
                        Payment:
                      </p>
                      <p className="text-sm text-purple-800 dark:text-purple-300">
                        <span className="text-green-600 dark:text-green-400 font-medium">💰 Requires payment</span>
                        {offer.cost && (
                          <span className="ml-2 text-purple-700 dark:text-purple-300">
                            ({offer.cost})
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>⏰ {formatTimeRemaining(offer.createdAt, offer.ttlSeconds)} left</span>
                      {offer.txHash && (
                        <a
                          href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${offer.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 dark:text-green-400 hover:underline"
                        >
                          View on Arkiv
                        </a>
                      )}
                    </div>
                    {/* Request Meeting Button for this specific offer */}
                    {userWallet && userWallet.toLowerCase() !== wallet.toLowerCase() && (
                      <button
                        onClick={() => {
                          setSelectedOffer(offer); // Set the specific offer
                          setShowMeetingModal(true);
                        }}
                        className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Request Meeting
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Asks (Learning) */}
        {asks.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Learning Requests ({asks.length})</h2>
            <div className="space-y-4">
              {asks.map((ask) => (
                <div
                  key={ask.key}
                  className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                        {ask.skill}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {formatDate(ask.createdAt)}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                      {ask.status}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 mb-3">{ask.message}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>⏰ {formatTimeRemaining(ask.createdAt, ask.ttlSeconds)} left</span>
                    {ask.txHash && (
                      <a
                        href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${ask.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        View on Arkiv
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State for Asks/Offers */}
        {asks.length === 0 && offers.length === 0 && (
          <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No asks or offers yet.
            </p>
          </div>
        )}

        {/* Session History */}
        {(() => {
          const completedSessions = sessions.filter(s => s.status === 'completed');
          const scheduledSessions = sessions.filter(s => s.status === 'scheduled');
          const allHistorySessions = [...completedSessions, ...scheduledSessions].sort(
            (a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()
          );
          
          // Calculate stats
          const sessionsCompleted = completedSessions.length;
          const sessionsGiven = sessions.filter(s => 
            s.mentorWallet.toLowerCase() === wallet.toLowerCase()
          ).length;
          const sessionsReceived = sessions.filter(s => 
            s.learnerWallet.toLowerCase() === wallet.toLowerCase()
          ).length;

          if (allHistorySessions.length === 0 && sessionsCompleted === 0 && sessionsGiven === 0 && sessionsReceived === 0) {
            return null; // Don't show section if no sessions
          }

          return (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Session History</h2>
              
              {/* Stats */}
              {(sessionsCompleted > 0 || sessionsGiven > 0 || sessionsReceived > 0) && (
                <div className="mb-6 grid grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{sessionsCompleted}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{sessionsGiven}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Given (as Mentor)</p>
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg text-center">
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{sessionsReceived}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Received (as Learner)</p>
                  </div>
                </div>
              )}

              {/* Session List */}
              {allHistorySessions.length > 0 && (
                <div className="space-y-4">
                  {allHistorySessions.map((session) => {
                    const isMentor = session.mentorWallet.toLowerCase() === wallet.toLowerCase();
                    const otherWallet = isMentor ? session.learnerWallet : session.mentorWallet;
                    const sessionDate = new Date(session.sessionDate);
                    const isPast = sessionDate < new Date();

                    return (
                      <div
                        key={session.key}
                        className={`p-6 border rounded-lg ${
                          session.status === 'completed'
                            ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="text-lg font-semibold">{session.skill}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {isMentor ? '👨‍🏫 As Mentor' : '👨‍🎓 As Learner'} with {shortenWallet(otherWallet)}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            session.status === 'completed'
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                          }`}>
                            {session.status === 'completed' ? '✓ Completed' : '📅 Scheduled'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                          <strong>Date:</strong> {sessionDate.toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                          <strong>Time:</strong> {sessionDate.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </p>
                        {session.duration && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                            <strong>Duration:</strong> {session.duration} minutes
                          </p>
                        )}
                        {session.notes && (
                          <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes:</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{session.notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Feedback Section */}
        {(() => {
          // Filter feedback received (feedbackTo matches wallet)
          const receivedFeedback = feedbacks.filter(f => 
            f.feedbackTo.toLowerCase() === wallet.toLowerCase()
          );
          
          if (receivedFeedback.length === 0) {
            return null;
          }

          // Calculate average rating
          const ratings = receivedFeedback
            .map(f => f.rating)
            .filter((r): r is number => r !== undefined && r > 0);
          const avgRating = ratings.length > 0
            ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)
            : null;

          return (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Feedback & Ratings</h2>
              
              {/* Stats */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-center">
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {receivedFeedback.length}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Reviews</p>
                </div>
                {avgRating && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-center">
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {avgRating} ⭐
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Average Rating</p>
                  </div>
                )}
              </div>

              {/* Feedback List */}
              <div className="space-y-4">
                {receivedFeedback.map((feedback) => (
                  <div
                    key={feedback.key}
                    className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          From {shortenWallet(feedback.feedbackFrom)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {formatDate(feedback.createdAt)}
                        </p>
                      </div>
                      {feedback.rating && (
                        <div className="text-lg">
                          {'⭐'.repeat(feedback.rating)}
                          <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
                            ({feedback.rating}/5)
                          </span>
                        </div>
                      )}
                    </div>
                    {feedback.notes && (
                      <p className="text-gray-700 dark:text-gray-300 mb-2">{feedback.notes}</p>
                    )}
                    {feedback.technicalDxFeedback && (
                      <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Technical DX Feedback:
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {feedback.technicalDxFeedback}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Request Meeting Modal */}
        <RequestMeetingModal
          isOpen={showMeetingModal}
          onClose={() => {
            setShowMeetingModal(false);
            setSelectedOffer(null); // Clear selected offer when closing
          }}
          profile={profile}
          userWallet={userWallet}
          userProfile={userProfile}
          offer={selectedOffer} // Pass the specific offer that was clicked, or null for general request
          onSuccess={() => {
            // Optionally reload data or show success message
            console.log('Meeting requested successfully');
            setSelectedOffer(null); // Clear selected offer after success
          }}
        />
      </div>
    </div>
  );
}

