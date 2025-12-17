/**
 * Asks page
 * 
 * Browse and create "I am learning" asks.
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
import { useGraphqlForAsks } from '@/lib/graph/featureFlags';
import { fetchAsks } from '@/lib/graph/asksQueries';
import { SPACE_ID } from '@/lib/config';
import { RequestMeetingModal } from '@/components/RequestMeetingModal';
import { SkillSelector } from '@/components/SkillSelector';
import { askColors, askEmojis, offerColors } from '@/lib/colors';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import type { UserProfile } from '@/lib/arkiv/profile';
import type { Ask } from '@/lib/arkiv/asks';

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

export default function AsksPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [asks, setAsks] = useState<Ask[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [newAsk, setNewAsk] = useState({ 
    skill: '', // Legacy: kept for backward compatibility
    skill_id: '', // New: Skill entity ID (preferred for beta)
    message: '',
    ttlHours: '24', // Default 24 hours (more reasonable)
    customTtlHours: '', // For custom input
  });
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [selectedAsk, setSelectedAsk] = useState<Ask | null>(null);
  const [selectedAskProfile, setSelectedAskProfile] = useState<UserProfile | null>(null);
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
      
      // Check onboarding access (requires level 2 for asks)
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

  // Handle scroll to ask when hash is present in URL
  useEffect(() => {
    if (!loading && asks.length > 0) {
      const hash = window.location.hash;
      if (hash) {
        const askKey = hash.substring(1); // Remove the #
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          const element = document.getElementById(askKey);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight the element briefly
            element.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50');
            setTimeout(() => {
              element.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50');
            }, 2000);
          }
        }, 100);
      }
    }
  }, [loading, asks]);

  const loadData = async (wallet: string) => {
    try {
      setLoading(true);
      
      const useGraphQL = await useGraphqlForAsks();
      
      if (useGraphQL) {
        // Try GraphQL first
        try {
          const [profileData, graphqlAsks] = await Promise.all([
            getProfileByWallet(wallet).catch(() => null),
            fetchAsks({ includeExpired: false, limit: 100 }),
          ]);
          
          // Only use GraphQL results if we got valid data
          if (graphqlAsks && Array.isArray(graphqlAsks) && graphqlAsks.length >= 0) {
            setProfile(profileData);
            const mappedAsks = graphqlAsks.map(ask => ({
              id: ask.id,
              key: ask.key,
              wallet: ask.wallet,
              skill: ask.skill,
              message: ask.message || '',
              status: ask.status,
              createdAt: ask.createdAt,
              expiresAt: ask.expiresAt ? Number(ask.expiresAt) : null,
              ttlSeconds: ask.ttlSeconds,
              txHash: ask.txHash || undefined,
              // GraphQL may not include spaceId - will be set correctly when using API route
              // For GraphQL results, we need to fetch from API or add spaceId to GraphQL query
              spaceId: (ask as any).spaceId || SPACE_ID, // Use actual spaceId if available, fallback to SPACE_ID from config
            })) as Ask[];
            // Sort by newest first (invert order)
            const sortedAsks = mappedAsks.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            setAsks(sortedAsks);
            
            // Load profiles for all unique wallet addresses
            const uniqueWallets = new Set<string>();
            sortedAsks.forEach((ask: Ask) => {
              uniqueWallets.add(ask.wallet.toLowerCase());
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
          console.warn('[AsksPage] GraphQL query failed, falling back to JSON-RPC:', graphqlError);
          // Fall through to JSON-RPC fallback
        }
      }
      
      // Fallback to JSON-RPC (either GraphQL disabled or GraphQL failed)
      const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      
      const [profileData, asksRes] = await Promise.all([
        getProfileByWallet(wallet).catch(() => null),
        fetch(`/api/asks${arkivBuilderMode ? '?builderMode=true&spaceIds=beta-launch,local-dev,local-dev-seed' : ''}`).then(r => r.json()),
      ]);
      
      const durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
      const payloadBytes = JSON.stringify(asksRes).length;
      
      // Record performance sample (async, don't block)
      import('@/lib/metrics/perf').then(({ recordPerfSample }) => {
        recordPerfSample({
          source: 'arkiv',
          operation: 'listAsks',
          route: '/asks',
          durationMs: Math.round(durationMs),
          payloadBytes,
          httpRequests: 1, // Single API call
          createdAt: new Date().toISOString(),
        });
      }).catch(() => {
        // Silently fail if metrics module not available
      });
      
      setProfile(profileData);
      if (asksRes.ok) {
        // Sort by newest first (invert order)
        const sortedAsks = (asksRes.asks || []).sort((a: Ask, b: Ask) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setAsks(sortedAsks);
        
        // Load profiles for all unique wallet addresses
        const uniqueWallets = new Set<string>();
        sortedAsks.forEach((ask: Ask) => {
          uniqueWallets.add(ask.wallet.toLowerCase());
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

  const handleCreateAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    // Require skill_id for beta (new Skill entity system)
    if (!newAsk.skill_id || !newAsk.message.trim() || !walletAddress) {
      setError('Please select a skill and enter a message');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // Convert hours to seconds for expiresIn
      const ttlValue = newAsk.ttlHours === 'custom' ? newAsk.customTtlHours : newAsk.ttlHours;
      const ttlHours = parseFloat(ttlValue);
      const expiresIn = isNaN(ttlHours) || ttlHours <= 0 ? 86400 : Math.floor(ttlHours * 3600); // Default to 24 hours if invalid

      const res = await fetch('/api/asks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createAsk',
          wallet: walletAddress,
          skill: newAsk.skill.trim(), // Legacy: kept for backward compatibility
          skill_id: newAsk.skill_id, // New: preferred for beta
          skill_label: newAsk.skill.trim(), // Derived from Skill entity
          message: newAsk.message.trim(),
          expiresIn: expiresIn,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        // Track action completion
        const { trackActionCompletion } = await import('@/lib/metrics/actionCompletion');
        trackActionCompletion('ask_created');

        if (data.pending) {
          setSuccess('Ask submitted! Transaction is being processed. Please refresh in a moment.');
          setNewAsk({ skill: '', skill_id: '', message: '', ttlHours: '24', customTtlHours: '' });
          setShowAdvancedOptions(false);
          setShowCreateForm(false);
          // Reload asks after a delay using the same method as initial load (GraphQL if enabled)
          setTimeout(async () => {
            await loadData(walletAddress!);
          }, 2000);
        } else {
          setSuccess(`Ask created successfully! "${newAsk.skill || 'Your ask'}" is now live and visible to mentors. View it in Network →`);
          setNewAsk({ skill: '', skill_id: '', message: '', ttlHours: '24', customTtlHours: '' });
          setShowAdvancedOptions(false);
          setShowCreateForm(false);
          // Reload asks using the same method as initial load (GraphQL if enabled)
          await loadData(walletAddress!);
        }
      } else {
        setError(data.error || 'Failed to create ask');
      }
    } catch (err: any) {
      console.error('Error creating ask:', err);
      setError(err.message || 'Failed to create ask');
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

  // Helper function to render ask card
  const renderAskCard = (ask: Ask) => {
    // Find similar asks (same skill, different wallet)
    const similarAsks = asks.filter(
      (a) =>
        a.key !== ask.key &&
        a.skill.toLowerCase() === ask.skill.toLowerCase() &&
        a.wallet.toLowerCase() !== ask.wallet.toLowerCase()
    ).slice(0, 3); // Limit to 3 similar asks

    const askProfile = profileMap[ask.wallet.toLowerCase()];
    const displayName = askProfile?.displayName || `${ask.wallet.slice(0, 6)}...${ask.wallet.slice(-4)}`;
    const isMyAsk = walletAddress && ask.wallet.toLowerCase() === walletAddress.toLowerCase();

    return (
      <div key={ask.key} id={ask.key}>
        <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-all duration-300">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                {ask.skill}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {formatDate(ask.createdAt)}
              </p>
            </div>
            <span className={`px-2 py-1 text-xs font-medium ${askColors.badge} rounded`}>
              {getDisplayStatus(ask.status, ask.createdAt, ask.ttlSeconds)}
            </span>
          </div>
          <p className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
            {ask.message}
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
            {askProfile ? (
              <Link
                href={`/profiles/${ask.wallet}`}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline font-medium"
              >
                {displayName}
              </Link>
            ) : (
              <span className="font-mono text-xs">{displayName}</span>
            )}
            <CountdownTimer createdAt={ask.createdAt} ttlSeconds={ask.ttlSeconds} />
            {arkivBuilderMode && ask.key && (
              <div className="flex items-center gap-2">
                <ViewOnArkivLink entityKey={ask.key} txHash={ask.txHash} className="text-xs" />
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                  {ask.key.slice(0, 12)}...
                </span>
              </div>
            )}
            {!arkivBuilderMode && (
              <ViewOnArkivLink entityKey={ask.key} />
            )}
          </div>
          {/* Offer to Help Button - only show if not own ask */}
          {!isMyAsk && (
            <div className="mt-4">
              {arkivBuilderMode ? (
                <ArkivQueryTooltip
                  query={[
                    `Opens RequestMeetingModal to create session`,
                    `POST /api/sessions { action: 'createSession', ... }`,
                    `Creates: type='session' entity`,
                    `Attributes: mentorWallet='${walletAddress?.toLowerCase().slice(0, 8) || '...'}...', learnerWallet='${ask.wallet.toLowerCase().slice(0, 8)}...', skill`,
                    `Payload: Full session data`,
                    `TTL: sessionDate + duration + 1 hour buffer`
                  ]}
                  label="Offer to Help"
                >
                  <button
                    onClick={async () => {
                      // Load profile for the ask's wallet
                      const askProfile = await getProfileByWallet(ask.wallet).catch(() => null);
                      setSelectedAskProfile(askProfile);
                      setSelectedAsk(ask);
                      setShowMeetingModal(true);
                    }}
                    className={`px-4 py-2 ${offerColors.button} rounded-lg font-medium transition-colors`}
                  >
                    Offer to Help
                  </button>
                </ArkivQueryTooltip>
              ) : (
                <button
                  onClick={async () => {
                    // Load profile for the ask's wallet
                    const askProfile = await getProfileByWallet(ask.wallet).catch(() => null);
                    setSelectedAskProfile(askProfile);
                    setSelectedAsk(ask);
                    setShowMeetingModal(true);
                  }}
                  className={`px-4 py-2 ${offerColors.button} rounded-lg font-medium transition-colors`}
                >
                  Offer to Help
                </button>
              )}
            </div>
          )}
        </div>

        {/* Similar Asks Section */}
        {similarAsks.length > 0 && (
          <div className="mt-3 ml-6 pl-4 border-l-2 border-blue-200 dark:border-blue-800">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              {askEmojis.default} Others learning {ask.skill}:
            </p>
            <div className="space-y-2">
              {similarAsks.map((similarAsk) => {
                const similarProfile = profileMap[similarAsk.wallet.toLowerCase()];
                const similarDisplayName = similarProfile?.displayName || `${similarAsk.wallet.slice(0, 6)}...${similarAsk.wallet.slice(-4)}`;
                return (
                  <Link
                    key={similarAsk.key}
                    href={`/asks#${similarAsk.key}`}
                    className="block p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <span className="font-medium text-blue-700 dark:text-blue-300">
                      {similarAsk.message.substring(0, 60)}
                      {similarAsk.message.length > 60 ? '...' : ''}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      by {similarProfile ? (
                        <Link
                          href={`/profiles/${similarAsk.wallet}`}
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
                `2. fetchAsks({ includeExpired: false, limit: 100 }) (GraphQL) OR`,
                `   GET /api/asks (JSON-RPC)`,
                `   → type='ask', status='active'`,
                `Returns: Ask[] (all active asks)`
              ]}
              label="Loading Asks"
            >
              <LoadingSpinner text="Loading asks..." className="py-12" />
            </ArkivQueryTooltip>
          ) : (
            <LoadingSpinner text="Loading asks..." className="py-12" />
          )}
        </div>
      </div>
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
          title="Asks"
          description="Browse what others are learning, or post your own learning request."
        />
            {asks.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {asks.length} active {asks.length === 1 ? 'ask' : 'asks'}
              </p>
            )}
          </div>
          <Link
            href="/offers"
            className={`px-4 py-2 text-sm font-medium ${offerColors.buttonOutline} rounded-lg transition-colors`}
          >
            Offers &gt;
          </Link>
        </div>

        {/* Create Ask Button */}
        {!showCreateForm && (
          <div className="mb-6">
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `Clicking opens form to create ask entity`,
                  `POST /api/asks { action: 'createAsk', ... }`,
                  `Creates: type='ask' entity`,
                  `Attributes: wallet, skill, skill_id, message, status='active'`,
                  `Payload: Full ask data`,
                  `TTL: expiresIn (default 24 hours = 86400 seconds)`
                ]}
                label="Create Ask"
              >
                <button
                  onClick={() => setShowCreateForm(true)}
                  className={`px-4 py-2 ${askColors.button} rounded-lg font-medium transition-colors flex items-center gap-2`}
                >
                  {askEmojis.default} Create Ask
                </button>
              </ArkivQueryTooltip>
            ) : (
              <button
                onClick={() => setShowCreateForm(true)}
                className={`px-4 py-2 ${askColors.button} rounded-lg font-medium transition-colors flex items-center gap-2`}
              >
                {askEmojis.default} Create Ask
              </button>
            )}
          </div>
        )}

        {/* Create Ask Form */}
        {showCreateForm && (
          <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Create New Ask</h2>
            <form onSubmit={handleCreateAsk} className="space-y-4">
              <div>
                <label htmlFor="skill" className="block text-sm font-medium mb-2">
                  Skill you want to learn *
                </label>
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `SkillSelector Component`,
                      `Queries: GET /api/skills?status=active&limit=100`,
                      `→ type='skill', status='active'`,
                      `Returns: Skill[] (all active skills)`,
                      ``,
                      `On Selection:`,
                      `→ Stores: skill_id='${newAsk.skill_id || '...'}', skill='${newAsk.skill || '...'}'`,
                      `→ skill_id: Skill entity key (preferred for beta)`,
                      `→ skill: Skill name (legacy, backward compatibility)`,
                      ``,
                      `In Ask Entity:`,
                      `→ Attributes: skill_id='${newAsk.skill_id || '...'}', skill='${newAsk.skill || '...'}'`,
                      `→ Enables filtering: type='ask', skill_id='...'`
                    ]}
                    label="Skill Selector"
                  >
                    <div>
                      <SkillSelector
                        value={newAsk.skill_id}
                        onChange={(skillId, skillName) => setNewAsk({ ...newAsk, skill_id: skillId, skill: skillName })}
                        placeholder="Search for a skill..."
                        allowCreate={true}
                        required
                      />
                    </div>
                  </ArkivQueryTooltip>
                ) : (
                  <SkillSelector
                    value={newAsk.skill_id}
                    onChange={(skillId, skillName) => setNewAsk({ ...newAsk, skill_id: skillId, skill: skillName })}
                    placeholder="Search for a skill..."
                    allowCreate={true}
                    required
                  />
                )}
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  value={newAsk.message}
                  onChange={(e) => setNewAsk({ ...newAsk, message: e.target.value })}
                  placeholder="Describe what you want to learn..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

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
                </label>
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `TTL/Expiration Selection`,
                      `Current Selection: ${newAsk.ttlHours === 'custom' ? `${newAsk.customTtlHours || '...'} hours` : `${newAsk.ttlHours || '24'} hours`}`,
                      `Conversion: hours → seconds (${newAsk.ttlHours === 'custom' ? (parseFloat(newAsk.customTtlHours || '24') * 3600) : (parseFloat(newAsk.ttlHours || '24') * 3600)} seconds)`,
                      ``,
                      `In Ask Entity:`,
                      `→ Attribute: ttlSeconds='${newAsk.ttlHours === 'custom' ? Math.floor(parseFloat(newAsk.customTtlHours || '24') * 3600) : Math.floor(parseFloat(newAsk.ttlHours || '24') * 3600)}'`,
                      `→ Arkiv expiresIn: ${newAsk.ttlHours === 'custom' ? Math.floor(parseFloat(newAsk.customTtlHours || '24') * 3600) : Math.floor(parseFloat(newAsk.ttlHours || '24') * 3600)} seconds`,
                      ``,
                      `Client-Side Filtering:`,
                      `→ Checks: createdAt + ttlSeconds < now`,
                      `→ Expired asks filtered out (unless includeExpired: true)`,
                      ``,
                      `Arkiv-Level Expiration:`,
                      `→ Hard deletion after expiresIn seconds`,
                      `→ Used for network cleanup`
                    ]}
                    label="TTL Selection"
                  >
                    <div className="flex gap-2">
                      <select
                        id="ttlHours"
                        value={newAsk.ttlHours === 'custom' ? 'custom' : newAsk.ttlHours}
                        onChange={(e) => setNewAsk({ ...newAsk, ttlHours: e.target.value })}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="0.5">30 minutes</option>
                        <option value="1">1 hour</option>
                        <option value="2">2 hours</option>
                        <option value="6">6 hours</option>
                        <option value="12">12 hours</option>
                        <option value="24">24 hours (1 day) - Recommended</option>
                        <option value="48">48 hours (2 days)</option>
                        <option value="168">1 week</option>
                        <option value="custom">Custom (hours)</option>
                      </select>
                      {newAsk.ttlHours === 'custom' && (
                        <input
                          type="number"
                          min="0.5"
                          max="8760"
                          step="0.5"
                          placeholder="Hours"
                          value={newAsk.customTtlHours}
                          onChange={(e) => {
                            setNewAsk({ ...newAsk, customTtlHours: e.target.value });
                          }}
                          className="w-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      )}
                    </div>
                  </ArkivQueryTooltip>
                ) : (
                  <div className="flex gap-2">
                    <select
                      id="ttlHours"
                      value={newAsk.ttlHours === 'custom' ? 'custom' : newAsk.ttlHours}
                      onChange={(e) => setNewAsk({ ...newAsk, ttlHours: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="0.5">30 minutes</option>
                      <option value="1">1 hour</option>
                      <option value="2">2 hours</option>
                      <option value="6">6 hours</option>
                      <option value="12">12 hours</option>
                      <option value="24">24 hours (1 day) - Recommended</option>
                      <option value="48">48 hours (2 days)</option>
                      <option value="168">1 week</option>
                      <option value="custom">Custom (hours)</option>
                    </select>
                    {newAsk.ttlHours === 'custom' && (
                      <input
                        type="number"
                        min="0.5"
                        max="8760"
                        step="0.5"
                        placeholder="Hours"
                        value={newAsk.customTtlHours}
                        onChange={(e) => {
                          setNewAsk({ ...newAsk, customTtlHours: e.target.value });
                        }}
                        className="w-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    )}
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      How long should this ask remain active? Default: 24 hours
                </p>
              </div>
                </div>
              )}

              <div className="flex gap-3">
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `POST /api/asks { action: 'createAsk', ... }`,
                      `Creates: type='ask' entity`,
                      `Attributes: wallet='${walletAddress?.toLowerCase().slice(0, 8) || '...'}...', skill, skill_id, message, status='active'`,
                      `Payload: Full ask data`,
                      `TTL: expiresIn (default 24 hours = 86400 seconds)`,
                      `Note: Creates ask_txhash entity for transaction tracking`
                    ]}
                    label="Create Ask"
                  >
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Creating...' : 'Create Ask'}
                    </button>
                  </ArkivQueryTooltip>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Creating...' : 'Create Ask'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewAsk({ skill: '', skill_id: '', message: '', ttlHours: '24', customTtlHours: '' });
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

        {/* Asks List */}
        <div className="space-y-4">
          {asks.length === 0 ? (
            <EmptyState
              title="No asks yet"
              description="Be the first to share what you're learning! Create an ask to connect with mentors who can help."
              icon={<span className="text-4xl">{askEmojis.default}</span>}
              action={
                !showCreateForm && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className={`px-4 py-2 ${askColors.button} rounded-lg font-medium transition-colors flex items-center gap-2`}
                  >
                    {askEmojis.default} Create Your First Ask
                  </button>
                )
              }
            />
          ) : (() => {
            // Separate asks into "My Asks" and "Other Asks"
            const myAsks = asks.filter((ask) => 
              walletAddress && ask.wallet.toLowerCase() === walletAddress.toLowerCase()
            );
            const otherAsks = asks.filter((ask) => 
              !walletAddress || ask.wallet.toLowerCase() !== walletAddress.toLowerCase()
            );
            
            return (
              <>
                {/* My Asks Section */}
                {myAsks.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      My Asks ({myAsks.length})
                    </h2>
                    <div className="space-y-4">
                      {myAsks.map((ask) => renderAskCard(ask))}
                    </div>
                  </div>
                )}
                
                {/* Other Asks Section */}
                {otherAsks.length > 0 && (
                  <div>
                    {myAsks.length > 0 && (
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Other Asks ({otherAsks.length})
                      </h2>
                    )}
                    <div className="space-y-4">
                      {otherAsks.map((ask) => renderAskCard(ask))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Request Meeting Modal (for Offer to Help) */}
        <RequestMeetingModal
          isOpen={showMeetingModal}
          onClose={() => {
            setShowMeetingModal(false);
            setSelectedAsk(null);
            setSelectedAskProfile(null);
          }}
          profile={selectedAskProfile}
          userWallet={walletAddress}
          userProfile={userProfile}
          ask={selectedAsk}
          mode="offer"
          onSuccess={() => {
            console.log('Help offered successfully');
            setSelectedAsk(null);
            setSelectedAskProfile(null);
          }}
        />
      </div>
    </div>
    </BetaGate>
  );
}
