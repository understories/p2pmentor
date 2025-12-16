/**
 * Matches page
 * 
 * Browse skill matches between asks and offers.
 * Design matches asks/offers pages.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { BetaGate } from '@/components/auth/BetaGate';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { RequestMeetingModal } from '@/components/RequestMeetingModal';
import { askColors, askEmojis, offerColors, offerEmojis } from '@/lib/colors';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import type { UserProfile } from '@/lib/arkiv/profile';
import type { Ask } from '@/lib/arkiv/asks';
import type { Offer } from '@/lib/arkiv/offers';
import type { Skill } from '@/lib/arkiv/skill';

type Match = {
  ask: Ask;
  offer: Offer;
  askProfile?: UserProfile;
  offerProfile?: UserProfile;
  skillMatch: string;
  skillId?: string;
};

export default function MatchesPage() {
  const router = useRouter();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [userMatches, setUserMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [skills, setSkills] = useState<Record<string, Skill>>({});
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [selectedAsk, setSelectedAsk] = useState<Ask | null>(null);
  const [selectedAskProfile, setSelectedAskProfile] = useState<UserProfile | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [meetingMode, setMeetingMode] = useState<'request' | 'offer' | 'peer'>('request');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const arkivBuilderMode = useArkivBuilderMode();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (!address) {
        router.push('/auth');
        return;
      }
      setWalletAddress(address);
      loadData();
    }
  }, [router]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load asks, offers, and skills in parallel
      const [asksRes, offersRes, skillsRes] = await Promise.all([
        fetch('/api/asks').then(r => r.json()),
        fetch('/api/offers').then(r => r.json()),
        fetch('/api/skills?status=active&limit=200').then(r => r.json()),
      ]);

      const asks: Ask[] = asksRes.ok ? (asksRes.asks || []) : [];
      const offers: Offer[] = offersRes.ok ? (offersRes.offers || []) : [];

      // Build skills map
      if (skillsRes.ok && skillsRes.skills) {
        const skillsMap: Record<string, Skill> = {};
        skillsRes.skills.forEach((skill: Skill) => {
          skillsMap[skill.key] = skill;
        });
        setSkills(skillsMap);
      }

      // Load profiles for all unique wallets
      const allWallets = new Set<string>();
      asks.forEach((ask: Ask) => allWallets.add(ask.wallet));
      offers.forEach((offer: Offer) => allWallets.add(offer.wallet));

      const profilePromises = Array.from(allWallets).map(async (wallet) => {
        try {
          const profile = await getProfileByWallet(wallet);
          return { wallet, profile };
        } catch {
          return { wallet, profile: null };
        }
      });

      const profileResults = await Promise.all(profilePromises);
      const profilesMap: Record<string, UserProfile> = {};
      profileResults.forEach(({ wallet, profile }) => {
        if (profile) {
          profilesMap[wallet.toLowerCase()] = profile;
        }
      });
      setProfiles(profilesMap);

      // Load user profile if wallet is available
      if (walletAddress) {
        try {
          const userProf = await getProfileByWallet(walletAddress);
          setUserProfile(userProf);
        } catch {
          // User profile not required
        }
      }

      // Compute matches
      const matchesList: Match[] = [];
      asks.forEach((ask) => {
        offers.forEach((offer) => {
          // Match based on skill_id (preferred) or skill string (legacy)
          let isMatch = false;
          let skillMatchLabel = '';
          let skillId: string | undefined;

          if (ask.skill_id && offer.skill_id) {
            // Both have skill_id: exact match
            if (ask.skill_id === offer.skill_id) {
              isMatch = true;
              skillId = ask.skill_id;
              skillMatchLabel = skills[ask.skill_id]?.name_canonical || ask.skill_label || ask.skill;
            }
          } else if (ask.skill_id || offer.skill_id) {
            // One has skill_id, one doesn't: try to match by skill string
            const askSkill = (ask.skill || '').toLowerCase();
            const offerSkill = (offer.skill || '').toLowerCase();
            if (askSkill && offerSkill && (askSkill === offerSkill || askSkill.includes(offerSkill) || offerSkill.includes(askSkill))) {
              isMatch = true;
              skillId = ask.skill_id || offer.skill_id;
              skillMatchLabel = ask.skill || offer.skill;
            }
          } else {
            // Both use legacy skill string: case-insensitive, partial match
            const askSkill = (ask.skill || '').toLowerCase();
            const offerSkill = (offer.skill || '').toLowerCase();
            if (askSkill && offerSkill && (askSkill === offerSkill || askSkill.includes(offerSkill) || offerSkill.includes(askSkill))) {
              isMatch = true;
              skillMatchLabel = ask.skill;
            }
          }

          if (isMatch) {
            matchesList.push({
              ask,
              offer,
              askProfile: profilesMap[ask.wallet.toLowerCase()],
              offerProfile: profilesMap[offer.wallet.toLowerCase()],
              skillMatch: skillMatchLabel,
              skillId,
            });
          }
        });
      });

      // Sort by creation date (newest first)
      matchesList.sort((a, b) => {
        const aTime = new Date(a.ask.createdAt).getTime();
        const bTime = new Date(b.ask.createdAt).getTime();
        return bTime - aTime;
      });

      setMatches(matchesList);

      // Compute user matches (matches involving user's asks or offers)
      if (walletAddress) {
        const userMatchesList = matchesList.filter(match => {
          const isUserAsk = match.ask.wallet.toLowerCase() === walletAddress.toLowerCase();
          const isUserOffer = match.offer.wallet.toLowerCase() === walletAddress.toLowerCase();
          return isUserAsk || isUserOffer;
        });
        setUserMatches(userMatchesList);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
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

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return '<1m';
    }
  };

  const isExpired = (createdAt: string, ttlSeconds: number): boolean => {
    const created = new Date(createdAt).getTime();
    const expires = created + (ttlSeconds * 1000);
    return Date.now() >= expires;
  };

  const shortenWallet = (wallet: string) => {
    if (!wallet || wallet.length < 10) return wallet;
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  const handleRequestMeeting = (match: Match, type: 'ask' | 'offer') => {
    if (type === 'ask') {
      // User wants to request meeting with the asker (they're offering to help)
      setSelectedAsk(match.ask);
      setSelectedAskProfile(match.askProfile || null);
      setSelectedOffer(match.offer);
      setSelectedProfile(match.offerProfile || null);
      setMeetingMode('offer'); // User is offering to help
    } else {
      // User wants to request meeting with the offerer (they're requesting help)
      setSelectedAsk(null);
      setSelectedAskProfile(null);
      setSelectedOffer(match.offer);
      setSelectedProfile(match.offerProfile || null);
      setMeetingMode('request'); // User is requesting help
    }
    setShowMeetingModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <BackButton href="/network" />
          </div>
          {arkivBuilderMode ? (
            <ArkivQueryTooltip
              query={[
                `loadData()`,
                `Queries:`,
                `1. GET /api/asks`,
                `   → type='ask', status='active'`,
                `2. GET /api/offers`,
                `   → type='offer', status='active'`,
                `3. GET /api/skills?status=active&limit=200`,
                `   → type='skill', status='active'`,
                `4. getProfileByWallet(...) for each unique wallet`,
                `   → type='user_profile', wallet='...'`,
                `Returns: Match[] (computed from matching asks and offers by skill)`
              ]}
              label="Loading Matches"
            >
              <LoadingSpinner text="Loading matches..." className="py-12" />
            </ArkivQueryTooltip>
          ) : (
            <LoadingSpinner text="Loading matches..." className="py-12" />
          )}
        </div>
      </div>
    );
  }

  // Show user matches if available, otherwise show all matches
  const displayMatches = userMatches.length > 0 ? userMatches : matches;

  return (
    <BetaGate>
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <BackButton href="/network" />
          </div>

          <div className="flex items-center justify-between mb-6">
            <div className="flex-1">
              <PageHeader
                title={userMatches.length > 0 ? "Your Matches" : "Matches"}
                description="Skill matches between learning requests and teaching offers."
              />
              {displayMatches.length > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {displayMatches.length} {displayMatches.length === 1 ? 'match' : 'matches'}
                  {userMatches.length > 0 && matches.length > userMatches.length && (
                    <span className="ml-2 text-gray-500">
                      ({matches.length} total)
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Link
                href="/asks"
                className={`px-4 py-2 text-sm font-medium ${askColors.buttonOutline} rounded-lg transition-colors`}
              >
                Asks &gt;
              </Link>
              <Link
                href="/offers"
                className={`px-4 py-2 text-sm font-medium ${offerColors.buttonOutline} rounded-lg transition-colors`}
              >
                Offers &gt;
              </Link>
            </div>
          </div>

          {displayMatches.length === 0 ? (
            <EmptyState
              title="No matches found"
              description={
                userMatches.length === 0 && walletAddress
                  ? "You don't have any matches yet. Create an ask or offer to find matches!"
                  : "No matches found between asks and offers yet."
              }
            />
          ) : (
            <div className="space-y-6">
              {displayMatches.map((match, index) => {
                const askExpired = isExpired(match.ask.createdAt, match.ask.ttlSeconds || 86400);
                const offerExpired = isExpired(match.offer.createdAt, match.offer.ttlSeconds || 86400);
                const isUserAsk = walletAddress && match.ask.wallet.toLowerCase() === walletAddress.toLowerCase();
                const isUserOffer = walletAddress && match.offer.wallet.toLowerCase() === walletAddress.toLowerCase();

                return (
                  <div
                    key={`${match.ask.key}-${match.offer.key}-${index}`}
                    className="p-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow"
                  >
                    {/* Match Header */}
                    <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">✨</span>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Match: {match.skillMatch}
                          </h3>
                        </div>
                        {arkivBuilderMode && match.skillId && (
                          <div className="flex items-center gap-2">
                            <ViewOnArkivLink entityKey={match.skillId} className="text-xs" />
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                              {match.skillId.slice(0, 12)}...
                            </span>
                          </div>
                        )}
                        {!arkivBuilderMode && match.skillId && (
                          <ViewOnArkivLink entityKey={match.skillId} className="text-xs" />
                        )}
                      </div>
                    </div>

                    {/* Ask and Offer Side by Side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Ask Card */}
                      <div className={`p-4 rounded-lg border ${askExpired ? 'border-gray-300 dark:border-gray-600 opacity-60' : askColors.border} ${askColors.card}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span>{askEmojis.default}</span>
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">Ask</h4>
                            {isUserAsk && (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                You
                              </span>
                            )}
                          </div>
                          {askExpired && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">Expired</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                          {match.ask.message}
                        </p>
                        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
                          <span>
                            {match.askProfile?.displayName || shortenWallet(match.ask.wallet)}
                          </span>
                          <span>
                            {formatTimeRemaining(match.ask.createdAt, match.ask.ttlSeconds || 86400)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          {arkivBuilderMode && match.ask.key && (
                            <div className="flex items-center gap-2">
                              <ViewOnArkivLink entityKey={match.ask.key} txHash={match.ask.txHash} className="text-xs" />
                              <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                {match.ask.key.slice(0, 12)}...
                              </span>
                            </div>
                          )}
                          {!arkivBuilderMode && (
                            <ViewOnArkivLink entityKey={match.ask.key} className="text-xs" />
                          )}
                          {!isUserAsk && !askExpired && walletAddress && (
                            arkivBuilderMode ? (
                              <ArkivQueryTooltip
                                query={[
                                  `Opens RequestMeetingModal to create session`,
                                  `POST /api/sessions { action: 'createSession', ... }`,
                                  `Creates: type='session' entity`,
                                  `Attributes: mentorWallet='${walletAddress?.toLowerCase().slice(0, 8) || '...'}...', learnerWallet='${match.ask.wallet.toLowerCase().slice(0, 8)}...', skill`,
                                  `Payload: Full session data`,
                                  `TTL: sessionDate + duration + 1 hour buffer`
                                ]}
                                label="Request Meeting"
                              >
                                <button
                                  onClick={() => handleRequestMeeting(match, 'ask')}
                                  className={`text-xs px-3 py-1 rounded ${askColors.button} transition-colors`}
                                >
                                  Request Meeting
                                </button>
                              </ArkivQueryTooltip>
                            ) : (
                              <button
                                onClick={() => handleRequestMeeting(match, 'ask')}
                                className={`text-xs px-3 py-1 rounded ${askColors.button} transition-colors`}
                              >
                                Request Meeting
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      {/* Offer Card */}
                      <div className={`p-4 rounded-lg border ${offerExpired ? 'border-gray-300 dark:border-gray-600 opacity-60' : offerColors.border} ${offerColors.card}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span>{offerEmojis.default}</span>
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">Offer</h4>
                            {isUserOffer && (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                You
                              </span>
                            )}
                          </div>
                          {offerExpired && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">Expired</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                          {match.offer.message}
                        </p>
                        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
                          <span>
                            {match.offerProfile?.displayName || shortenWallet(match.offer.wallet)}
                          </span>
                          <span>
                            {formatTimeRemaining(match.offer.createdAt, match.offer.ttlSeconds || 86400)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          {arkivBuilderMode && match.offer.key && (
                            <div className="flex items-center gap-2">
                              <ViewOnArkivLink entityKey={match.offer.key} txHash={match.offer.txHash} className="text-xs" />
                              <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                {match.offer.key.slice(0, 12)}...
                              </span>
                            </div>
                          )}
                          {!arkivBuilderMode && (
                            <ViewOnArkivLink entityKey={match.offer.key} className="text-xs" />
                          )}
                          {!isUserOffer && !offerExpired && walletAddress && (
                            arkivBuilderMode ? (
                              <ArkivQueryTooltip
                                query={[
                                  `Opens RequestMeetingModal to create session`,
                                  `POST /api/sessions { action: 'createSession', ... }`,
                                  `Creates: type='session' entity`,
                                  `Attributes: mentorWallet='${match.offer.wallet.toLowerCase().slice(0, 8)}...', learnerWallet='${walletAddress?.toLowerCase().slice(0, 8) || '...'}...', skill`,
                                  `Payload: Full session data`,
                                  `TTL: sessionDate + duration + 1 hour buffer`
                                ]}
                                label="Request Meeting"
                              >
                                <button
                                  onClick={() => handleRequestMeeting(match, 'offer')}
                                  className={`text-xs px-3 py-1 rounded ${offerColors.button} transition-colors`}
                                >
                                  Request Meeting
                                </button>
                              </ArkivQueryTooltip>
                            ) : (
                              <button
                                onClick={() => handleRequestMeeting(match, 'offer')}
                                className={`text-xs px-3 py-1 rounded ${offerColors.button} transition-colors`}
                              >
                                Request Meeting
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showMeetingModal && (
            <RequestMeetingModal
              isOpen={showMeetingModal}
              onClose={() => {
                setShowMeetingModal(false);
                setSelectedAsk(null);
                setSelectedAskProfile(null);
                setSelectedOffer(null);
                setSelectedProfile(null);
              }}
              profile={selectedProfile}
              userWallet={walletAddress}
              userProfile={userProfile}
              ask={selectedAsk}
              offer={selectedOffer}
              mode={meetingMode}
              onSuccess={() => {
                setShowMeetingModal(false);
                setSelectedAsk(null);
                setSelectedAskProfile(null);
                setSelectedOffer(null);
                setSelectedProfile(null);
                // Reload matches after successful session creation
                loadData();
              }}
            />
          )}
        </div>
      </div>
    </BetaGate>
  );
}

