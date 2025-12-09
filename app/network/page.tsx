/**
 * Network graph page
 * 
 * View network, match asks ↔ offers ↔ skills, and filter.
 * Beta-ready simplified version focused on functionality.
 * 
 * Reference: refs/mentor-graph/pages/network.tsx (simplified)
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { BetaBanner } from '@/components/BetaBanner';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { Ask } from '@/lib/arkiv/asks';
import type { Offer } from '@/lib/arkiv/offers';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { formatAvailabilityForDisplay } from '@/lib/arkiv/availability';
import { askColors, askEmojis, offerColors, offerEmojis } from '@/lib/colors';
import type { UserProfile } from '@/lib/arkiv/profile';

type Match = {
  ask: Ask;
  offer: Offer;
  askProfile?: UserProfile;
  offerProfile?: UserProfile;
  skillMatch: string;
};

export default function NetworkPage() {
  const router = useRouter();
  const [asks, setAsks] = useState<Ask[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillFilter, setSkillFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'asks' | 'offers' | 'matches'>('all');
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [userAsks, setUserAsks] = useState<Ask[]>([]);
  const [userOffers, setUserOffers] = useState<Offer[]>([]);

  useEffect(() => {
    // Get user wallet
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      setUserWallet(address);
    }
    loadNetwork();
  }, []);

  useEffect(() => {
    // Load user's asks and offers for match detection
    if (userWallet) {
      Promise.all([
        fetch(`/api/asks?wallet=${encodeURIComponent(userWallet)}`).then(r => r.json()).catch(() => ({ ok: false, asks: [] })),
        fetch(`/api/offers?wallet=${encodeURIComponent(userWallet)}`).then(r => r.json()).catch(() => ({ ok: false, offers: [] })),
      ]).then(([asksRes, offersRes]) => {
        if (asksRes.ok) setUserAsks(asksRes.asks || []);
        if (offersRes.ok) setUserOffers(offersRes.offers || []);
      });
    }
  }, [userWallet]);

  useEffect(() => {
    if (asks.length > 0 && offers.length > 0) {
      computeMatches();
    }
  }, [asks, offers, profiles]);

  const loadNetwork = async () => {
    try {
      setLoading(true);
      const [asksRes, offersRes] = await Promise.all([
        fetch('/api/asks').then(r => r.json()),
        fetch('/api/offers').then(r => r.json()),
      ]);

      if (asksRes.ok) {
        setAsks(asksRes.asks || []);
      }
      if (offersRes.ok) {
        setOffers(offersRes.offers || []);
      }

      // Load profiles for all unique wallets
      const allWallets = new Set<string>();
      (asksRes.asks || []).forEach((ask: Ask) => allWallets.add(ask.wallet));
      (offersRes.offers || []).forEach((offer: Offer) => allWallets.add(offer.wallet));

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
          profilesMap[wallet] = profile;
        }
      });
      setProfiles(profilesMap);
    } catch (err) {
      console.error('Error loading network:', err);
    } finally {
      setLoading(false);
    }
  };

  const computeMatches = () => {
    const matchesList: Match[] = [];

    asks.forEach((ask) => {
      offers.forEach((offer) => {
        // Match based on skill (case-insensitive, partial match)
        const askSkill = ask.skill.toLowerCase();
        const offerSkill = offer.skill.toLowerCase();

        if (askSkill === offerSkill || askSkill.includes(offerSkill) || offerSkill.includes(askSkill)) {
          matchesList.push({
            ask,
            offer,
            askProfile: profiles[ask.wallet],
            offerProfile: profiles[offer.wallet],
            skillMatch: ask.skill, // Use ask skill as the match identifier
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
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
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

  const isExpired = (createdAt: string, ttlSeconds: number): boolean => {
    const created = new Date(createdAt).getTime();
    const expires = created + (ttlSeconds * 1000);
    return Date.now() >= expires;
  };

  const getDisplayStatus = (status: string, createdAt: string, ttlSeconds: number): string => {
    return isExpired(createdAt, ttlSeconds) ? 'closed' : status;
  };

  const shortenWallet = (wallet: string) => {
    if (!wallet || wallet.length < 10) return wallet;
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  // Filter data based on filters
  const filteredAsks = asks.filter((ask) => {
    if (skillFilter && !ask.skill.toLowerCase().includes(skillFilter.toLowerCase())) {
      return false;
    }
    return true;
  });

  const filteredOffers = offers.filter((offer) => {
    if (skillFilter && !offer.skill.toLowerCase().includes(skillFilter.toLowerCase())) {
      return false;
    }
    return true;
  });

  const filteredMatches = matches.filter((match) => {
    if (skillFilter && !match.skillMatch.toLowerCase().includes(skillFilter.toLowerCase())) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <BackButton href="/me" />
          </div>
          <LoadingSpinner text="Loading network..." className="py-12" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <ThemeToggle />
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>

        <PageHeader
          title="Network"
          description="Browse asks, offers, and see matches based on skills."
        />

        <BetaBanner />

        {/* Quick Actions */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/asks"
            className={`p-4 ${askColors.card} border ${askColors.border} ${askColors.cardHover} rounded-lg transition-colors`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-sm font-semibold ${askColors.text} mb-1`}>
                  {askEmojis.default} Create Ask
                </h3>
                <p className={`text-xs ${askColors.textMuted}`}>
                  Post what you want to learn
                </p>
              </div>
              <span className={askColors.text}>→</span>
            </div>
          </Link>
          <Link
            href="/offers"
            className={`p-4 ${offerColors.card} border ${offerColors.border} ${offerColors.cardHover} rounded-lg transition-colors`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-sm font-semibold ${offerColors.text} mb-1`}>
                  {offerEmojis.default} Create Offer
                </h3>
                <p className={`text-xs ${offerColors.textMuted}`}>
                  Post what you can teach
                </p>
              </div>
              <span className={offerColors.text}>→</span>
            </div>
          </Link>
        </div>

        {/* Forest View Entry Point */}
        <div className="mb-6 space-y-3">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-1">
                  🌲 Try Forest View (experimental)
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Visualize the network as an interactive graph. Desktop only.
                </p>
              </div>
              <Link
                href="/network/forest"
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline"
              >
                Enter Forest →
              </Link>
            </div>
          </div>
          
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                  🔄 GraphQL API Comparison
                </h3>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Compare Arkiv JSON-RPC vs GraphQL API - See the tool in action!
                </p>
              </div>
              <Link
                href="/network/compare"
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline"
              >
                Compare →
              </Link>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="skillFilter" className="block text-sm font-medium mb-1">
                Filter by Skill
              </label>
              <input
                id="skillFilter"
                type="text"
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                placeholder="e.g., React, TypeScript"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="min-w-[150px]">
              <label htmlFor="typeFilter" className="block text-sm font-medium mb-1">
                View
              </label>
              <select
                id="typeFilter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="matches">Matches</option>
                <option value="asks">Asks Only</option>
                <option value="offers">Offers Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-4 ${askColors.card} border ${askColors.border} rounded-lg`}>
            <div className={`text-2xl font-bold ${askColors.text}`}>{asks.length}</div>
            <div className={`text-sm ${askColors.textMuted}`}>Asks</div>
          </div>
          <div className={`p-4 ${offerColors.card} border ${offerColors.border} rounded-lg`}>
            <div className={`text-2xl font-bold ${offerColors.text}`}>{offers.length}</div>
            <div className={`text-sm ${offerColors.textMuted}`}>Offers</div>
          </div>
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-200">{matches.length}</div>
            <div className="text-sm text-purple-700 dark:text-purple-300">Matches</div>
          </div>
        </div>

        {/* Matches View */}
        {(typeFilter === 'all' || typeFilter === 'matches') && filteredMatches.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Matches ({filteredMatches.length})</h2>
            <div className="space-y-4">
              {filteredMatches.map((match, idx) => (
                <div
                  key={`${match.ask.key}-${match.offer.key}`}
                  className="p-6 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg"
                >
                  <div className="mb-3">
                    <span className="px-3 py-1 text-sm font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 rounded">
                      {match.skillMatch}
                    </span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Ask */}
                    <div className="p-4 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Learning</div>
                      <Link
                        href={`/profiles/${match.ask.wallet}`}
                        className="font-semibold text-blue-600 dark:text-blue-400 mb-2 hover:underline block"
                      >
                        {match.askProfile?.displayName || shortenWallet(match.ask.wallet)}
                      </Link>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{match.ask.message}</p>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(match.ask.createdAt)} • {formatTimeRemaining(match.ask.createdAt, match.ask.ttlSeconds)} left
                      </div>
                    </div>
                    {/* Offer */}
                    <div className="p-4 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Teaching</div>
                      <Link
                        href={`/profiles/${match.offer.wallet}`}
                        className={`font-semibold ${offerColors.text} mb-2 hover:underline block`}
                      >
                        {match.offerProfile?.displayName || shortenWallet(match.offer.wallet)}
                      </Link>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{match.offer.message}</p>
                      {match.offer.availabilityWindow && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                          Available: {formatAvailabilityForDisplay(match.offer.availabilityWindow)}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(match.offer.createdAt)} • {formatTimeRemaining(match.offer.createdAt, match.offer.ttlSeconds)} left
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Asks View */}
        {(typeFilter === 'all' || typeFilter === 'asks') && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Asks ({filteredAsks.length})</h2>
            {filteredAsks.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p>No asks found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAsks.map((ask) => (
                  <div
                    key={ask.key}
                    className={`p-6 ${askColors.card} border ${askColors.border} rounded-lg`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`text-lg font-semibold ${askColors.text}`}>
                          {ask.skill}
                        </h3>
                          {userWallet && userOffers.some(o => {
                            const askSkill = ask.skill.toLowerCase();
                            const offerSkill = o.skill.toLowerCase();
                            return askSkill === offerSkill || askSkill.includes(offerSkill) || offerSkill.includes(askSkill);
                          }) && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                              Matches your offer
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          <Link
                            href={`/profiles/${ask.wallet}`}
                            className={`hover:underline ${askColors.link}`}
                          >
                            {profiles[ask.wallet]?.displayName || shortenWallet(ask.wallet)}
                          </Link>
                          {' • '}
                          {formatDate(ask.createdAt)}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium ${askColors.badge} rounded`}>
                        {getDisplayStatus(ask.status, ask.createdAt, ask.ttlSeconds)}
                      </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-3">{ask.message}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>⏰ {(() => {
                        const timeRemaining = formatTimeRemaining(ask.createdAt, ask.ttlSeconds);
                        return timeRemaining === 'Expired' ? timeRemaining : `${timeRemaining} left`;
                      })()}</span>
                      {ask.txHash && (
                        <a
                          href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${ask.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${askColors.link} hover:underline`}
                        >
                          View on Arkiv
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Offers View */}
        {(typeFilter === 'all' || typeFilter === 'offers') && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Offers ({filteredOffers.length})</h2>
            {filteredOffers.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <EmptyState
                  title="No offers found"
                  description={skillFilter ? `No offers match "${skillFilter}". Try a different skill or clear the filter.` : 'No one has posted any teaching offers yet. Be the first to offer your expertise!'}
                  icon={
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  }
                />
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOffers.map((offer) => (
                  <div
                    key={offer.key}
                    className={`p-6 ${offerColors.card} border ${offerColors.border} rounded-lg`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`text-lg font-semibold ${offerColors.text}`}>
                          {offer.skill}
                        </h3>
                          {userWallet && userAsks.some(a => {
                            const askSkill = a.skill.toLowerCase();
                            const offerSkill = offer.skill.toLowerCase();
                            return askSkill === offerSkill || askSkill.includes(offerSkill) || offerSkill.includes(askSkill);
                          }) && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                              Matches your ask
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          <Link
                            href={`/profiles/${offer.wallet}`}
                            className={`hover:underline ${offerColors.link}`}
                          >
                            {profiles[offer.wallet]?.displayName || shortenWallet(offer.wallet)}
                          </Link>
                          {' • '}
                          {formatDate(offer.createdAt)}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium ${offerColors.badge} rounded`}>
                        {getDisplayStatus(offer.status, offer.createdAt, offer.ttlSeconds)}
                      </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-3">{offer.message}</p>
                    {offer.availabilityWindow && (
                      <div className="mb-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                          Availability:
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {formatAvailabilityForDisplay(offer.availabilityWindow)}
                        </p>
                      </div>
                    )}
                    {offer.isPaid && (
                      <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded">
                        <p className="text-sm font-medium text-purple-900 dark:text-purple-200 mb-1">
                          Payment:
                        </p>
                        <p className="text-sm text-purple-800 dark:text-purple-300">
                          <span className={`${offerColors.text} font-medium`}>💰 Requires payment</span>
                          {offer.cost && (
                            <span className="ml-2 text-purple-700 dark:text-purple-300">
                              ({offer.cost})
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>⏰ {(() => {
                        const timeRemaining = formatTimeRemaining(offer.createdAt, offer.ttlSeconds);
                        return timeRemaining === 'Expired' ? timeRemaining : `${timeRemaining} left`;
                      })()}</span>
                      {offer.txHash && (
                        <a
                          href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${offer.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${offerColors.link} hover:underline`}
                        >
                          View on Arkiv
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
