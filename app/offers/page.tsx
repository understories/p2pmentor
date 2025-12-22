/**
 * Offers page
 * 
 * Browse and create "I am teaching" offers.
 * Design inspired by hidden-garden-ui-ux-upgrades.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { BetaGate } from '@/components/auth/BetaGate';
import { PageHeader } from '@/components/PageHeader';
import { Alert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { useGraphqlForOffers } from '@/lib/graph/featureFlags';
import { fetchOffers } from '@/lib/graph/offersQueries';
import { SPACE_ID } from '@/lib/config';
import { formatAvailabilityForDisplay, type WeeklyAvailability } from '@/lib/arkiv/availability';
import { WeeklyAvailabilityEditor } from '@/components/availability/WeeklyAvailabilityEditor';
import { RequestMeetingModal } from '@/components/RequestMeetingModal';
import { SkillSelector } from '@/components/SkillSelector';
import { offerColors, offerEmojis, askColors } from '@/lib/colors';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { buildBuilderModeParams } from '@/lib/utils/builderMode';
import type { UserProfile } from '@/lib/arkiv/profile';
import type { Offer } from '@/lib/arkiv/offers';

// Component for live countdown timer
function CountdownTimer({ createdAt, ttlSeconds }: { createdAt: string; ttlSeconds: number }) {
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const created = new Date(createdAt).getTime();
      const expires = created + (ttlSeconds * 1000);
      const now = Date.now();
      const remaining = expires - now;

      if (remaining <= 0) {
        setTimeRemaining('Expired');
        return;
      }

      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTimer(); // Initial update
    const interval = setInterval(updateTimer, 1000); // Update every second

    return () => clearInterval(interval);
  }, [createdAt, ttlSeconds]);

  const isExpired = timeRemaining === 'Expired';
  return (
    <span className="text-orange-600 dark:text-orange-400 font-medium">
      ⏰ {timeRemaining}{isExpired ? '' : ' left'}
    </span>
  );
}

export default function OffersPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [newOffer, setNewOffer] = useState({ 
    skill: '', // Legacy: kept for backward compatibility
    skill_id: '', // New: Skill entity ID (preferred for beta)
    message: '', 
    availabilityWindow: '',
    availabilityKey: '', // Reference to Availability entity
    availabilityType: 'structured' as 'saved' | 'structured', // Type of availability input (removed 'custom' legacy text option)
    structuredAvailability: null as WeeklyAvailability | null, // Structured availability object
    isPaid: false,
    cost: '',
    paymentAddress: '',
    ttlHours: '168', // Default 1 week (more reasonable for offers)
    customTtlHours: '', // For custom input
  });
  const [savedAvailabilities, setSavedAvailabilities] = useState<Array<{ key: string; displayText: string }>>([]);
  const [loadingAvailabilities, setLoadingAvailabilities] = useState(false);
  const [skillJustCreated, setSkillJustCreated] = useState<string | null>(null); // Track newly created skill
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [selectedOfferProfile, setSelectedOfferProfile] = useState<UserProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const router = useRouter();
  const arkivBuilderMode = useArkivBuilderMode();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (!address) {
        router.push('/auth');
        return;
      }
      setWalletAddress(address);
      
      // Check onboarding access (requires level 2 for offers)
      import('@/lib/onboarding/access').then(({ checkOnboardingRoute }) => {
        checkOnboardingRoute(address, 2, '/onboarding').catch(() => {
          // On error, allow access (don't block on calculation failure)
        });
      });
      loadData(address);
      // Load user profile for RequestMeetingModal
      getProfileByWallet(address).then(setUserProfile).catch(() => null);
      
      // Check for ?create=true param to auto-show form
      const params = new URLSearchParams(window.location.search);
      if (params.get('create') === 'true') {
        setShowCreateForm(true);
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [router]);

  const loadAvailabilities = async (wallet: string) => {
    try {
      setLoadingAvailabilities(true);
      const res = await fetch(`/api/availability?wallet=${encodeURIComponent(wallet)}`);
      const data = await res.json();
      if (data.ok && data.availabilities) {
        // Format availabilities for dropdown
        const formatted = data.availabilities.map((avail: any) => {
          return {
            key: avail.key,
            displayText: formatAvailabilityForDisplay(avail.timeBlocks),
          };
        });
        setSavedAvailabilities(formatted);
      }
    } catch (err) {
      console.error('Error loading availabilities:', err);
    } finally {
      setLoadingAvailabilities(false);
    }
  };

  const loadData = async (wallet: string) => {
    try {
      setLoading(true);
      
      // Load availabilities in parallel
      loadAvailabilities(wallet);

      const useGraphQL = await useGraphqlForOffers();
      
      if (useGraphQL) {
        // Try GraphQL first
        try {
          const [profileData, graphqlOffers] = await Promise.all([
            getProfileByWallet(wallet).catch(() => null),
            fetchOffers({ includeExpired: false, limit: 100 }),
          ]);
          
          // Only use GraphQL results if we got valid data
          if (graphqlOffers && Array.isArray(graphqlOffers) && graphqlOffers.length >= 0) {
            setProfile(profileData);
            const mappedOffers = graphqlOffers.map(offer => ({
              id: offer.id,
              key: offer.key,
              wallet: offer.wallet,
              skill: offer.skill,
              message: offer.message || '',
              availabilityWindow: offer.availabilityWindow || '',
              isPaid: offer.isPaid,
              cost: offer.cost || undefined,
              paymentAddress: offer.paymentAddress || undefined,
              status: offer.status,
              createdAt: offer.createdAt,
              expiresAt: offer.expiresAt ? Number(offer.expiresAt) : null,
              ttlSeconds: offer.ttlSeconds,
              txHash: offer.txHash || undefined,
              // GraphQL may not include spaceId - will be set correctly when using API route
              // For GraphQL results, we need to fetch from API or add spaceId to GraphQL query
              spaceId: (offer as any).spaceId || SPACE_ID, // Use actual spaceId if available, fallback to SPACE_ID from config
            })) as Offer[];
            // Sort by newest first (invert order)
            const sortedOffers = mappedOffers.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            setOffers(sortedOffers);
            
            // Load profiles for all unique wallet addresses
            const uniqueWallets = new Set<string>();
            sortedOffers.forEach((offer: Offer) => {
              uniqueWallets.add(offer.wallet.toLowerCase());
            });
            
            const profilePromises = Array.from(uniqueWallets).map(async (w) => {
              try {
                const profile = await getProfileByWallet(w);
                return { wallet: w, profile };
              } catch (e) {
                return { wallet: w, profile: null };
              }
            });
            
            const profileResults = await Promise.all(profilePromises);
            const newProfileMap: Record<string, UserProfile> = {};
            profileResults.forEach((result) => {
              if (result.profile) {
                newProfileMap[result.wallet] = result.profile;
              }
            });
            setProfileMap(newProfileMap);
            
            return; // Success, exit early
          }
        } catch (graphqlError) {
          console.warn('[OffersPage] GraphQL query failed, falling back to JSON-RPC:', graphqlError);
          // Fall through to JSON-RPC fallback
        }
      }
      
      // Fallback to JSON-RPC (either GraphQL disabled or GraphQL failed)
      const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        
        const builderParams = buildBuilderModeParams(arkivBuilderMode);
        const [profileData, offersRes] = await Promise.all([
          getProfileByWallet(wallet).catch(() => null),
          fetch(`/api/offers${builderParams}`).then(r => r.json()),
        ]);
        
        const durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
        const payloadBytes = JSON.stringify(offersRes).length;
        
        // Record performance sample (async, don't block)
        import('@/lib/metrics/perf').then(({ recordPerfSample }) => {
          recordPerfSample({
            source: 'arkiv',
            operation: 'listOffers',
            route: '/offers',
            durationMs: Math.round(durationMs),
            payloadBytes,
            httpRequests: 1, // Single API call
            createdAt: new Date().toISOString(),
          });
        }).catch(() => {
          // Silently fail if metrics module not available
        });
        
      setProfile(profileData);
      if (offersRes.ok) {
        // Sort by newest first (invert order)
        const sortedOffers = (offersRes.offers || []).sort((a: Offer, b: Offer) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setOffers(sortedOffers);
        
        // Load profiles for all unique wallet addresses
        const uniqueWallets = new Set<string>();
        sortedOffers.forEach((offer: Offer) => {
          uniqueWallets.add(offer.wallet.toLowerCase());
        });
        
        const profilePromises = Array.from(uniqueWallets).map(async (w) => {
          try {
            const profile = await getProfileByWallet(w);
            return { wallet: w, profile };
          } catch (e) {
            return { wallet: w, profile: null };
          }
        });
        
        const profileResults = await Promise.all(profilePromises);
        const newProfileMap: Record<string, UserProfile> = {};
        profileResults.forEach((result) => {
          if (result.profile) {
            newProfileMap[result.wallet] = result.profile;
          }
        });
        setProfileMap(newProfileMap);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    // Require skill_id for beta (new Skill entity system)
    if (!newOffer.skill_id || !newOffer.message.trim() || !walletAddress) {
      setError('Please select a skill and enter a message');
      return;
    }

    // Prevent submission if skill was just created and is still being indexed
    if (skillJustCreated) {
      setError('Please wait for the skill to be saved before submitting your offer');
      return;
    }

    // Validate availability based on type
    if (newOffer.availabilityType === 'saved') {
      if (!newOffer.availabilityKey.trim()) {
        setError('Please select a saved availability');
        return;
      }
    } else if (newOffer.availabilityType === 'structured') {
      if (!newOffer.structuredAvailability) {
        setError('Please configure your structured availability');
        return;
      }
    }
    
    // Validate payment fields if paid
    if (newOffer.isPaid) {
      if (!newOffer.cost.trim()) {
        setError('Cost is required for paid offers');
        return;
      }
      if (!newOffer.paymentAddress.trim()) {
        setError('Payment address is required for paid offers');
        return;
      }
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // Convert hours to seconds for expiresIn
      const ttlValue = newOffer.ttlHours === 'custom' ? newOffer.customTtlHours : newOffer.ttlHours;
      const ttlHours = parseFloat(ttlValue);
      const expiresIn = isNaN(ttlHours) || ttlHours <= 0 ? 604800 : Math.floor(ttlHours * 3600); // Default to 1 week if invalid

      // Prepare availabilityWindow based on type
      let availabilityWindowValue: string | WeeklyAvailability = '';
      if (newOffer.availabilityType === 'saved') {
        availabilityWindowValue = ''; // Will use availabilityKey
      } else if (newOffer.availabilityType === 'structured') {
        availabilityWindowValue = newOffer.structuredAvailability!; // Send WeeklyAvailability object
      }

      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createOffer',
          wallet: walletAddress,
          skill: newOffer.skill.trim(), // Legacy: kept for backward compatibility
          skill_id: newOffer.skill_id, // New: preferred for beta
          skill_label: newOffer.skill.trim(), // Derived from Skill entity
          message: newOffer.message.trim(),
          availabilityWindow: availabilityWindowValue,
          availabilityKey: newOffer.availabilityType === 'saved' ? newOffer.availabilityKey : undefined,
          isPaid: newOffer.isPaid,
          cost: newOffer.isPaid ? newOffer.cost.trim() : undefined,
          paymentAddress: newOffer.isPaid ? newOffer.paymentAddress.trim() : undefined,
          expiresIn: expiresIn,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        // Track action completion
        const { trackActionCompletion } = await import('@/lib/metrics/actionCompletion');
        trackActionCompletion('offer_created');

        if (data.pending) {
          setSuccess('Offer submitted! Transaction is being processed. Please refresh in a moment.');
          setNewOffer({ skill: '', skill_id: '', message: '', availabilityWindow: '', availabilityKey: '', availabilityType: 'structured', structuredAvailability: null, isPaid: false, cost: '', paymentAddress: '', ttlHours: '168', customTtlHours: '' });
          setShowAdvancedOptions(false);
          setShowCreateForm(false);
          // Reload offers after a delay using the same method as initial load (GraphQL if enabled)
          setTimeout(async () => {
            await loadData(walletAddress!);
          }, 2000);
        } else {
          setSuccess(`Offer created successfully! "${newOffer.skill}" is now live and visible to learners. View it in Network →`);
          setNewOffer({ skill: '', skill_id: '', message: '', availabilityWindow: '', availabilityKey: '', availabilityType: 'structured', structuredAvailability: null, isPaid: false, cost: '', paymentAddress: '', ttlHours: '168', customTtlHours: '' });
          setShowAdvancedOptions(false);
          setShowCreateForm(false);
          // Reload offers using the same method as initial load (GraphQL if enabled)
          await loadData(walletAddress!);
        }
      } else {
        setError(data.error || 'Failed to create offer');
      }
    } catch (err: any) {
      console.error('Error creating offer:', err);
      setError(err.message || 'Failed to create offer');
    } finally {
      setSubmitting(false);
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
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
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

  // Helper function to render offer card
  const renderOfferCard = (offer: Offer) => {
    // Find similar offers (same skill, different wallet)
    const similarOffers = offers.filter(
      (o) =>
        o.key !== offer.key &&
        o.skill.toLowerCase() === offer.skill.toLowerCase() &&
        o.wallet.toLowerCase() !== offer.wallet.toLowerCase()
    ).slice(0, 3); // Limit to 3 similar offers

    const offerProfile = profileMap[offer.wallet.toLowerCase()];
    const displayName = offerProfile?.displayName || `${offer.wallet.slice(0, 6)}...${offer.wallet.slice(-4)}`;
    const isMyOffer = walletAddress && offer.wallet.toLowerCase() === walletAddress.toLowerCase();

    return (
      <div key={offer.key}>
        <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                {offer.skill}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {formatDate(offer.createdAt)}
              </p>
            </div>
            <span className={`px-2 py-1 text-xs font-medium ${offerColors.badge} rounded`}>
              {getDisplayStatus(offer.status, offer.createdAt, offer.ttlSeconds)}
            </span>
          </div>
          <p className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
            {offer.message}
          </p>
          {offer.availabilityWindow && (
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                Availability:
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                {formatAvailabilityForDisplay(offer.availabilityWindow)}
              </p>
            </div>
          )}
          <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded">
            <p className="text-sm font-medium text-purple-900 dark:text-purple-200 mb-1">
              Payment:
            </p>
            <p className="text-sm text-purple-800 dark:text-purple-300">
              {offer.isPaid ? (
                <>
                  <span className={`${offerColors.text} font-medium`}>💰 Requires payment</span>
                  {offer.cost && (
                    <span className="ml-2 text-purple-700 dark:text-purple-300">
                      ({offer.cost})
                    </span>
                  )}
                  {offer.paymentAddress && (
                    <div className="mt-2 text-xs font-mono text-purple-600 dark:text-purple-400 break-all">
                      Payment: {offer.paymentAddress}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-blue-600 dark:text-blue-400 font-medium">🆓 Free</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
            {offerProfile ? (
              <Link
                href={`/profiles/${offer.wallet}`}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline font-medium"
              >
                {displayName}
              </Link>
            ) : (
              <span className="font-mono text-xs">{displayName}</span>
            )}
            <CountdownTimer createdAt={offer.createdAt} ttlSeconds={offer.ttlSeconds} />
            {arkivBuilderMode && offer.key && (
              <div className="flex items-center gap-2">
                <ViewOnArkivLink entityKey={offer.key} txHash={offer.txHash} className="text-xs" />
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                  {offer.key.slice(0, 12)}...
                </span>
              </div>
            )}
            {!arkivBuilderMode && (
              <ViewOnArkivLink entityKey={offer.key} />
            )}
          </div>
          {/* Request Meeting Button - only show if not own offer */}
          {!isMyOffer && (
            <div className="mt-4">
              {arkivBuilderMode ? (
                <ArkivQueryTooltip
                  query={[
                    `Opens RequestMeetingModal to create session`,
                    `POST /api/sessions { action: 'createSession', ... }`,
                    `Creates: type='session' entity`,
                    `Attributes: mentorWallet='${offer.wallet.toLowerCase().slice(0, 8)}...', learnerWallet='${walletAddress?.toLowerCase().slice(0, 8) || '...'}...', skill`,
                    `Payload: Full session data`,
                    `TTL: sessionDate + duration + 1 hour buffer`
                  ]}
                  label="Request Meeting"
                >
                  <button
                    onClick={async () => {
                      // Load profile for the offer's wallet
                      const offerProfile = await getProfileByWallet(offer.wallet).catch(() => null);
                      if (offerProfile) {
                        setSelectedOffer(offer);
                        setSelectedOfferProfile(offerProfile);
                        // Use setTimeout to ensure state is updated before opening modal
                        setTimeout(() => setShowMeetingModal(true), 0);
                      } else {
                        setError('Could not load profile for this offer');
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Request Meeting
                  </button>
                </ArkivQueryTooltip>
              ) : (
                <button
                  onClick={async () => {
                    // Load profile for the offer's wallet
                    const offerProfile = await getProfileByWallet(offer.wallet).catch(() => null);
                    if (offerProfile) {
                      setSelectedOffer(offer);
                      setSelectedOfferProfile(offerProfile);
                      // Use setTimeout to ensure state is updated before opening modal
                      setTimeout(() => setShowMeetingModal(true), 0);
                    } else {
                      setError('Could not load profile for this offer');
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Request Meeting
                </button>
              )}
            </div>
          )}
        </div>

        {/* Similar Offers Section */}
        {similarOffers.length > 0 && (
          <div className="mt-3 ml-6 pl-4 border-l-2 border-green-200 dark:border-green-800">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              {offerEmojis.default} Others teaching {offer.skill}:
            </p>
            <div className="space-y-2">
              {similarOffers.map((similarOffer) => {
                const similarProfile = profileMap[similarOffer.wallet.toLowerCase()];
                const similarDisplayName = similarProfile?.displayName || `${similarOffer.wallet.slice(0, 6)}...${similarOffer.wallet.slice(-4)}`;
                return (
                  <Link
                    key={similarOffer.key}
                    href={`/offers#${similarOffer.key}`}
                    className="block p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                  >
                    <span className="font-medium text-green-700 dark:text-green-300">
                      {similarOffer.message.substring(0, 60)}
                      {similarOffer.message.length > 60 ? '...' : ''}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      by {similarProfile ? (
                        <Link
                          href={`/profiles/${similarOffer.wallet}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {similarDisplayName}
                        </Link>
                      ) : (
                        similarDisplayName
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <BetaGate>
        <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <BackButton href="/network" />
            </div>
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `loadData("${walletAddress?.toLowerCase() || '...'}")`,
                  `Queries:`,
                  `1. getProfileByWallet("${walletAddress?.toLowerCase() || '...'}")`,
                  `   → type='user_profile', wallet='${walletAddress?.toLowerCase() || '...'}'`,
                  `2. GET /api/availability?wallet=${walletAddress?.toLowerCase() || '...'}`,
                  `   → type='availability', wallet='${walletAddress?.toLowerCase() || '...'}'`,
                  `3. fetchOffers({ includeExpired: false, limit: 100 }) (GraphQL) OR`,
                  `   GET /api/offers (JSON-RPC)`,
                  `   → type='offer', status='active'`,
                  `Returns: Offer[] (all active offers)`
                ]}
                label="Loading Offers"
              >
                <LoadingSpinner text="Loading offers..." className="py-12" />
              </ArkivQueryTooltip>
            ) : (
              <LoadingSpinner text="Loading offers..." className="py-12" />
            )}
          </div>
        </div>
      </BetaGate>
    );
  }

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
              title="Offers"
              description="Browse what others are teaching, or post your own teaching offer."
            />
            {offers.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {offers.length} active {offers.length === 1 ? 'offer' : 'offers'}
              </p>
            )}
          </div>
          <Link
            href="/asks"
            className={`px-4 py-2 text-sm font-medium ${askColors.buttonOutline} rounded-lg transition-colors`}
          >
            Asks &gt;
          </Link>
        </div>

        {/* Create Offer Button */}
        {!showCreateForm && (
          <div className="mb-6">
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `Clicking opens form to create offer entity`,
                  `POST /api/offers { action: 'createOffer', ... }`,
                  `Creates: type='offer' entity`,
                  `Attributes: wallet, skill, skill_id, message, availabilityWindow, availabilityKey (optional), isPaid, cost, paymentAddress`,
                  `Payload: Full offer data`,
                  `TTL: expiresIn (default 1 week = 604800 seconds)`
                ]}
                label="Create Offer"
              >
                <button
                  onClick={() => setShowCreateForm(true)}
                  className={`px-4 py-2 ${offerColors.button} rounded-lg font-medium transition-colors flex items-center gap-2`}
                >
                  {offerEmojis.default} Create Offer
                </button>
              </ArkivQueryTooltip>
            ) : (
              <button
                onClick={() => setShowCreateForm(true)}
                className={`px-4 py-2 ${offerColors.button} rounded-lg font-medium transition-colors flex items-center gap-2`}
              >
                {offerEmojis.default} Create Offer
              </button>
            )}
          </div>
        )}

        {/* Create Offer Form */}
        {showCreateForm && (
          <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Create New Offer</h2>
            <form onSubmit={handleCreateOffer} className="space-y-4">
              <div>
                <label htmlFor="skill" className="block text-sm font-medium mb-2">
                  Skill you can teach *
                </label>
                <SkillSelector
                  value={newOffer.skill_id}
                  onChange={(skillId, skillName) => setNewOffer({ ...newOffer, skill_id: skillId, skill: skillName })}
                  placeholder="Search for a skill..."
                  allowCreate={true}
                  required
                  onSkillCreated={async (skillName, skillId, pending, txHash, isNewSkill) => {
                    if (isNewSkill && pending) {
                      // Skill was created but is pending - show feedback and wait
                      setSkillJustCreated(skillName);
                      // Wait for skill to be indexed (similar to SkillsStep delay)
                      await new Promise(resolve => setTimeout(resolve, 2000));
                      setSkillJustCreated(null);
                    }
                  }}
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  value={newOffer.message}
                  onChange={(e) => setNewOffer({ ...newOffer, message: e.target.value })}
                  placeholder="Describe what you can teach..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Skill creation feedback */}
              {skillJustCreated && (
                <div className="p-4 bg-green-50/90 dark:bg-green-900/30 backdrop-blur-md rounded-lg border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm">
                  <span className="animate-pulse">✨</span> Skill added. Now submit your offer!
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Availability *
                </label>
                <div className="mb-3">
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="availabilityType"
                        checked={newOffer.availabilityType === 'saved'}
                        onChange={() => setNewOffer({ ...newOffer, availabilityType: 'saved', structuredAvailability: null })}
                        className="mr-2"
                      />
                      <span>Use saved availability</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="availabilityType"
                        checked={newOffer.availabilityType === 'structured'}
                        onChange={() => setNewOffer({ ...newOffer, availabilityType: 'structured', availabilityKey: '' })}
                        className="mr-2"
                      />
                      <span>Create structured availability</span>
                    </label>
                  </div>
                </div>
                {newOffer.availabilityType === 'saved' ? (
                  <div>
                    {loadingAvailabilities ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400">Loading availabilities...</div>
                    ) : savedAvailabilities.length === 0 ? (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          No saved availability blocks found. <Link href="/me/availability" className="underline">Create one here</Link> or create structured availability below.
                        </p>
                      </div>
                    ) : (
                      <select
                        id="availabilityKey"
                        value={newOffer.availabilityKey}
                        onChange={(e) => setNewOffer({ ...newOffer, availabilityKey: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required={newOffer.availabilityType === 'saved'}
                      >
                        <option value="">Select saved availability...</option>
                        {savedAvailabilities.map((avail) => (
                          <option key={avail.key} value={avail.key}>
                            {avail.displayText}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : (
                  <div>
                    <WeeklyAvailabilityEditor
                      value={newOffer.structuredAvailability}
                      onChange={(availability) => setNewOffer({ ...newOffer, structuredAvailability: availability })}
                      className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-300 dark:border-gray-600"
                    />
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Payment Type *
                </label>
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `Payment Type Selection`,
                      `Stored as: attribute='isPaid' on offer entity`,
                      `Values: 'true' | 'false' (string)`,
                      `Determines if cost and paymentAddress are required`
                    ]}
                    label="Payment Type"
                  >
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="paymentType"
                          checked={!newOffer.isPaid}
                          onChange={() => setNewOffer({ ...newOffer, isPaid: false, cost: '', paymentAddress: '' })}
                          className="mr-2"
                        />
                        <span>Free</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="paymentType"
                          checked={newOffer.isPaid}
                          onChange={() => setNewOffer({ ...newOffer, isPaid: true })}
                          className="mr-2"
                        />
                        <span>Paid</span>
                      </label>
                    </div>
                  </ArkivQueryTooltip>
                ) : (
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="paymentType"
                        checked={!newOffer.isPaid}
                        onChange={() => setNewOffer({ ...newOffer, isPaid: false, cost: '', paymentAddress: '' })}
                        className="mr-2"
                      />
                      <span>Free</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="paymentType"
                        checked={newOffer.isPaid}
                        onChange={() => setNewOffer({ ...newOffer, isPaid: true })}
                        className="mr-2"
                      />
                      <span>Paid</span>
                    </label>
                  </div>
                )}
              </div>
              
              {newOffer.isPaid && (
                <>
                  <div>
                    {arkivBuilderMode ? (
                      <ArkivQueryTooltip
                        query={[
                          `Cost Input (Paid Offers)`,
                          `Stored as: attribute='cost' on offer entity`,
                          `Required when: isPaid='true'`,
                          `Format: Free text (e.g., "0.1 ETH", "$50", "100 USDC")`,
                          `Also stored in payload for retrieval`
                        ]}
                        label="Cost"
                      >
                        <div>
                          <label htmlFor="cost" className="block text-sm font-medium mb-2">
                            Cost *
                          </label>
                          <input
                            id="cost"
                            type="text"
                            value={newOffer.cost}
                            onChange={(e) => setNewOffer({ ...newOffer, cost: e.target.value })}
                            placeholder="e.g., 0.1 ETH, $50, 100 USDC"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required={newOffer.isPaid}
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            The cost for this mentorship session
                          </p>
                        </div>
                      </ArkivQueryTooltip>
                    ) : (
                      <div>
                        <label htmlFor="cost" className="block text-sm font-medium mb-2">
                          Cost *
                        </label>
                        <input
                          id="cost"
                          type="text"
                          value={newOffer.cost}
                          onChange={(e) => setNewOffer({ ...newOffer, cost: e.target.value })}
                          placeholder="e.g., 0.1 ETH, $50, 100 USDC"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required={newOffer.isPaid}
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          The cost for this mentorship session
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    {arkivBuilderMode ? (
                      <ArkivQueryTooltip
                        query={[
                          `Payment Address Input (Paid Offers)`,
                          `Stored as: attribute='paymentAddress' on offer entity`,
                          `Required when: isPaid='true'`,
                          `Format: Ethereum wallet address (0x...)`,
                          `Also stored in payload for retrieval`,
                          `Visible to requesters on offer cards`
                        ]}
                        label="Payment Address"
                      >
                        <div>
                          <label htmlFor="paymentAddress" className="block text-sm font-medium mb-2">
                            Payment Address *
                          </label>
                          <input
                            id="paymentAddress"
                            type="text"
                            value={newOffer.paymentAddress}
                            onChange={(e) => setNewOffer({ ...newOffer, paymentAddress: e.target.value })}
                            placeholder="0x..."
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                            required={newOffer.isPaid}
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Wallet address where you'll receive payment for this offer
                          </p>
                        </div>
                      </ArkivQueryTooltip>
                    ) : (
                      <div>
                        <label htmlFor="paymentAddress" className="block text-sm font-medium mb-2">
                          Payment Address *
                        </label>
                        <input
                          id="paymentAddress"
                          type="text"
                          value={newOffer.paymentAddress}
                          onChange={(e) => setNewOffer({ ...newOffer, paymentAddress: e.target.value })}
                          placeholder="0x..."
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                          required={newOffer.isPaid}
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Wallet address where you'll receive payment for this offer
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Expiration Date Display */}
              {(() => {
                const ttlValue = newOffer.ttlHours === 'custom' ? newOffer.customTtlHours : newOffer.ttlHours;
                const ttlHoursNum = parseFloat(ttlValue) || 168;
                const expirationDate = new Date(Date.now() + ttlHoursNum * 3600 * 1000);
                const formattedDate = expirationDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                });
                return (
                  <div className="pt-2 pb-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Expires:</span> {formattedDate}
                  </div>
                );
              })()}

              {/* Advanced Options Toggle */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Advanced Options
                </button>
              </div>

              {/* Advanced Options (Collapsed by Default) */}
              {showAdvancedOptions && (
                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label htmlFor="ttlHours" className="block text-sm font-medium mb-2">
                      Expiration Duration (optional)
                      {arkivBuilderMode ? (
                        <ArkivQueryTooltip
                          query={[
                            `TTL (Time To Live)`,
                            `TLDR: Arkiv entities have an expiration date. After this time, the entity is automatically deleted from the network.`,
                            ``,
                            `Current Selection: ${newOffer.ttlHours === 'custom' ? `${newOffer.customTtlHours || '...'} hours` : `${newOffer.ttlHours || '168'} hours`}`,
                            `Conversion: hours → seconds (${newOffer.ttlHours === 'custom' ? (parseFloat(newOffer.customTtlHours || '168') * 3600) : (parseFloat(newOffer.ttlHours || '168') * 3600)} seconds)`,
                            ``,
                            `In Offer Entity:`,
                            `→ Attribute: ttlSeconds='${newOffer.ttlHours === 'custom' ? Math.floor(parseFloat(newOffer.customTtlHours || '168') * 3600) : Math.floor(parseFloat(newOffer.ttlHours || '168') * 3600)}'`,
                            `→ Arkiv expiresIn: ${newOffer.ttlHours === 'custom' ? Math.floor(parseFloat(newOffer.customTtlHours || '168') * 3600) : Math.floor(parseFloat(newOffer.ttlHours || '168') * 3600)} seconds`,
                            ``,
                            `Client-Side Filtering:`,
                            `→ Checks: createdAt + ttlSeconds < now`,
                            `→ Expired offers filtered out (unless includeExpired: true)`,
                            ``,
                            `Arkiv-Level Expiration:`,
                            `→ Hard deletion after expiresIn seconds`,
                            `→ Used for network cleanup`
                          ]}
                          label="TTL Info"
                        >
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 cursor-help">ℹ️</span>
                        </ArkivQueryTooltip>
                      ) : (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400" title="TTL (Time To Live): Arkiv entities have an expiration date. After this time, the entity is automatically deleted from the network.">ℹ️</span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <select
                        id="ttlHours"
                        value={newOffer.ttlHours === 'custom' ? 'custom' : newOffer.ttlHours}
                        onChange={(e) => setNewOffer({ ...newOffer, ttlHours: e.target.value })}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="1">1 hour</option>
                        <option value="2">2 hours</option>
                        <option value="6">6 hours</option>
                        <option value="12">12 hours</option>
                        <option value="24">24 hours (1 day)</option>
                        <option value="48">48 hours (2 days)</option>
                        <option value="168">1 week - Recommended</option>
                        <option value="720">1 month (30 days)</option>
                        <option value="custom">Custom (hours)</option>
                      </select>
                      {newOffer.ttlHours === 'custom' && (
                        <input
                          type="number"
                          min="1"
                          max="8760"
                          step="1"
                          placeholder="Hours"
                          value={newOffer.customTtlHours}
                          onChange={(e) => {
                            setNewOffer({ ...newOffer, customTtlHours: e.target.value });
                          }}
                          className="w-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      How long should this offer remain active? Default: 1 week
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `POST /api/offers { action: 'createOffer', ... }`,
                      `Creates: type='offer' entity`,
                      `Attributes: wallet='${walletAddress?.toLowerCase().slice(0, 8) || '...'}...', skill, skill_id, message, availabilityWindow, availabilityKey (optional), isPaid, cost, paymentAddress`,
                      `Payload: Full offer data`,
                      `TTL: expiresIn (default 1 week = 604800 seconds)`,
                      `Note: Creates offer_txhash entity for transaction tracking`
                    ]}
                    label="Create Offer"
                  >
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Creating...' : 'Create Offer'}
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Creating...' : 'Create Offer'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewOffer({ skill: '', skill_id: '', message: '', availabilityWindow: '', availabilityKey: '', availabilityType: 'structured', structuredAvailability: null, isPaid: false, cost: '', paymentAddress: '', ttlHours: '168', customTtlHours: '' });
                    setShowAdvancedOptions(false);
                    setError('');
                    setSuccess('');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
            {error && (
              <Alert type="error" message={error} onClose={() => setError('')} className="mt-4" />
            )}
            {success && (
              <Alert type="success" message={success} onClose={() => setSuccess('')} className="mt-4" />
            )}
          </div>
        )}

        {/* Offers List */}
        <div className="space-y-4">
          {offers.length === 0 ? (
            <EmptyState
              title="No offers yet"
              description="Be the first to share what you can teach! Create an offer to connect with learners who need your expertise."
              icon={<span className="text-4xl">{offerEmojis.default}</span>}
              action={
                !showCreateForm && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className={`px-4 py-2 ${offerColors.button} rounded-lg font-medium transition-colors flex items-center gap-2`}
                  >
                    {offerEmojis.default} Create Your First Offer
                  </button>
                )
              }
            />
          ) : (
            offers.map((offer) => {
              // Find similar offers (same skill, different wallet)
              const similarOffers = offers.filter(
                (o) =>
                  o.key !== offer.key &&
                  o.skill.toLowerCase() === offer.skill.toLowerCase() &&
                  o.wallet.toLowerCase() !== offer.wallet.toLowerCase()
              ).slice(0, 3); // Limit to 3 similar offers

              return (
                <div key={offer.key}>
                  <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      {offer.skill}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {formatDate(offer.createdAt)}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium ${offerColors.badge} rounded`}>
                    {getDisplayStatus(offer.status, offer.createdAt, offer.ttlSeconds)}
                  </span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                  {offer.message}
                </p>
                {offer.availabilityWindow && (
                  <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                      Availability:
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      {formatAvailabilityForDisplay(offer.availabilityWindow)}
                    </p>
                  </div>
                )}
                <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded">
                  <p className="text-sm font-medium text-purple-900 dark:text-purple-200 mb-1">
                    Payment:
                  </p>
                  <p className="text-sm text-purple-800 dark:text-purple-300">
                    {offer.isPaid ? (
                      <>
                        <span className={`${offerColors.text} font-medium`}>💰 Requires payment</span>
                        {offer.cost && (
                          <span className="ml-2 text-purple-700 dark:text-purple-300">
                            ({offer.cost})
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-blue-600 dark:text-blue-400 font-medium">🆓 Free</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                  <span className="font-mono text-xs">{offer.wallet.slice(0, 6)}...{offer.wallet.slice(-4)}</span>
                  <CountdownTimer createdAt={offer.createdAt} ttlSeconds={offer.ttlSeconds} />
                  {arkivBuilderMode && offer.key && (
                    <div className="flex items-center gap-2">
                      <ViewOnArkivLink entityKey={offer.key} txHash={offer.txHash} className="text-xs" />
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                        {offer.key.slice(0, 12)}...
                      </span>
                    </div>
                  )}
                  {!arkivBuilderMode && (
                    <ViewOnArkivLink entityKey={offer.key} />
                  )}
                </div>
                {/* Request Meeting Button - only show if not own offer */}
                {walletAddress && walletAddress.toLowerCase() !== offer.wallet.toLowerCase() && (
                  <div className="mt-4">
                    {arkivBuilderMode ? (
                      <ArkivQueryTooltip
                        query={[
                          `Opens RequestMeetingModal to create session`,
                          `POST /api/sessions { action: 'createSession', ... }`,
                          `Creates: type='session' entity`,
                          `Attributes: mentorWallet='${offer.wallet.toLowerCase().slice(0, 8)}...', learnerWallet='${walletAddress?.toLowerCase().slice(0, 8) || '...'}...', skill`,
                          `Payload: Full session data`,
                          `TTL: sessionDate + duration + 1 hour buffer`
                        ]}
                        label="Request Meeting"
                      >
                        <button
                          onClick={async () => {
                            // Load profile for the offer's wallet
                            const offerProfile = await getProfileByWallet(offer.wallet).catch(() => null);
                            if (offerProfile) {
                              setSelectedOffer(offer);
                              setSelectedOfferProfile(offerProfile);
                              // Use setTimeout to ensure state is updated before opening modal
                              setTimeout(() => setShowMeetingModal(true), 0);
                            } else {
                              setError('Could not load profile for this offer');
                            }
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                          Request Meeting
                        </button>
                      </ArkivQueryTooltip>
                    ) : (
                      <button
                        onClick={async () => {
                          // Load profile for the offer's wallet
                          const offerProfile = await getProfileByWallet(offer.wallet).catch(() => null);
                          if (offerProfile) {
                            setSelectedOffer(offer);
                            setSelectedOfferProfile(offerProfile);
                            // Use setTimeout to ensure state is updated before opening modal
                            setTimeout(() => setShowMeetingModal(true), 0);
                          } else {
                            setError('Could not load profile for this offer');
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Request Meeting
                      </button>
                    )}
                  </div>
                )}
                  </div>

                  {/* Similar Offers Section */}
                  {similarOffers.length > 0 && (
                    <div className="mt-3 ml-6 pl-4 border-l-2 border-green-200 dark:border-green-800">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                        {offerEmojis.default} Others teaching {offer.skill}:
                      </p>
                      <div className="space-y-2">
                        {similarOffers.map((similarOffer) => (
                          <Link
                            key={similarOffer.key}
                            href={`/offers#${similarOffer.key}`}
                            className="block p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                          >
                            <span className="font-medium text-green-700 dark:text-green-300">
                              {similarOffer.message.substring(0, 60)}
                              {similarOffer.message.length > 60 ? '...' : ''}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                              by {similarOffer.wallet.slice(0, 6)}...{similarOffer.wallet.slice(-4)}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Request Meeting Modal */}
        <RequestMeetingModal
          isOpen={showMeetingModal}
          onClose={() => {
            setShowMeetingModal(false);
            setSelectedOffer(null);
            setSelectedOfferProfile(null);
          }}
          profile={selectedOfferProfile}
          userWallet={walletAddress}
          userProfile={userProfile}
          offer={selectedOffer}
          onSuccess={() => {
            console.log('Meeting requested successfully');
            setSelectedOffer(null);
            setSelectedOfferProfile(null);
          }}
        />
      </div>
    </div>
    </BetaGate>
  );
}
