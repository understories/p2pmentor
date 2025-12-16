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
import { CanopySection } from '@/components/network/CanopySection';
import { ForestPulseStats } from '@/components/network/ForestPulseStats';
import { QuickActions } from '@/components/network/QuickActions';
import { LeafChipFilter } from '@/components/network/LeafChipFilter';
import { SkillCluster } from '@/components/network/SkillCluster';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import type { Ask } from '@/lib/arkiv/asks';
import type { Offer } from '@/lib/arkiv/offers';
import type { Skill } from '@/lib/arkiv/skill';
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
  const [skillIdFilter, setSkillIdFilter] = useState<string | null>(null);
  const [selectedCanopySkill, setSelectedCanopySkill] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<'all' | 'asks' | 'offers' | 'matches'>('all');
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [skills, setSkills] = useState<Record<string, Skill>>({});
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [userAsks, setUserAsks] = useState<Ask[]>([]);
  const [userOffers, setUserOffers] = useState<Offer[]>([]);
  const [showContent, setShowContent] = useState(false); // Hide content by default
  const arkivBuilderMode = useArkivBuilderMode();

  useEffect(() => {
    // Get user wallet
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      setUserWallet(address);
      
      // Check onboarding access (requires level 3 for network)
      if (address) {
        import('@/lib/onboarding/access').then(({ checkOnboardingRoute }) => {
          checkOnboardingRoute(address, 3, '/onboarding').then((hasAccess) => {
            // If access granted, continue loading
            if (hasAccess) {
              // Check for returnTo param from onboarding redirect
              const urlParams = new URLSearchParams(window.location.search);
              const returnTo = urlParams.get('returnTo');
              if (returnTo) {
                // Clean up URL
                window.history.replaceState({}, '', returnTo);
              }
            }
            // If no access, checkOnboardingRoute will redirect
          }).catch(() => {
            // On error, allow access (don't block on calculation failure)
          });
        });
      } else {
        // No wallet - redirect to auth
        router.push('/auth');
      }
      
      // Check for skill_id or skill in URL params
      const urlParams = new URLSearchParams(window.location.search);
      const skillId = urlParams.get('skill_id');
      const skillSlug = urlParams.get('skill');
      
      if (skillId) {
        setSkillIdFilter(skillId);
        setShowContent(true); // Show content when skill is selected from URL
      } else if (skillSlug) {
        // Try to resolve skill slug to skill_id
        fetch(`/api/skills?slug=${encodeURIComponent(skillSlug)}&limit=1`)
          .then(r => r.json())
          .then(data => {
            if (data.ok && data.skills && data.skills.length > 0) {
              setSkillIdFilter(data.skills[0].key);
              setShowContent(true); // Show content when skill is selected from URL
            } else {
              // Fallback to string filter
              setSkillFilter(skillSlug);
              setShowContent(true); // Show content when skill is selected from URL
            }
          })
          .catch(() => {
            setSkillFilter(skillSlug);
            setShowContent(true); // Show content when skill is selected from URL
          });
      }
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

  // Show content automatically when a skill filter is set, or when data is loaded
  useEffect(() => {
    if (skillIdFilter || skillFilter) {
      setShowContent(true);
    } else if (asks.length > 0 || offers.length > 0 || matches.length > 0) {
      // Show all content by default when there's data and no filter
      setShowContent(true);
    }
  }, [skillIdFilter, skillFilter, asks.length, offers.length, matches.length]);

  const loadNetwork = async () => {
    try {
      setLoading(true);
      const [asksRes, offersRes, skillsRes] = await Promise.all([
        fetch('/api/asks').then(r => r.json()),
        fetch('/api/offers').then(r => r.json()),
        fetch('/api/skills?status=active&limit=200').then(r => r.json()),
      ]);

      console.log('[Network] Data loaded:', {
        asksCount: asksRes.ok ? (asksRes.asks || []).length : 0,
        offersCount: offersRes.ok ? (offersRes.offers || []).length : 0,
        skillsCount: skillsRes.ok ? (skillsRes.skills || []).length : 0,
        asksOk: asksRes.ok,
        offersOk: offersRes.ok,
        skillsOk: skillsRes.ok,
      });

      if (asksRes.ok) {
        setAsks(asksRes.asks || []);
      } else {
        console.error('[Network] Failed to load asks:', asksRes);
      }
      if (offersRes.ok) {
        setOffers(offersRes.offers || []);
      } else {
        console.error('[Network] Failed to load offers:', offersRes);
      }

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
        // Match based on skill_id (preferred) or skill string (legacy)
        let isMatch = false;
        let skillMatchLabel = '';

        if (ask.skill_id && offer.skill_id) {
          // Both have skill_id: exact match
          if (ask.skill_id === offer.skill_id) {
            isMatch = true;
            skillMatchLabel = skills[ask.skill_id]?.name_canonical || ask.skill_label || ask.skill;
          }
        } else if (ask.skill_id || offer.skill_id) {
          // One has skill_id, one doesn't: try to match by skill string
          const askSkill = (ask.skill || '').toLowerCase();
          const offerSkill = (offer.skill || '').toLowerCase();
          if (askSkill && offerSkill && (askSkill === offerSkill || askSkill.includes(offerSkill) || offerSkill.includes(askSkill))) {
            isMatch = true;
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
            askProfile: profiles[ask.wallet],
            offerProfile: profiles[offer.wallet],
            skillMatch: skillMatchLabel,
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

  // Compute user matches (matches involving user's asks or offers)
  const userMatches = matches.filter(match => {
    if (!userWallet) return false;
    const isUserAsk = match.ask.wallet.toLowerCase() === userWallet.toLowerCase();
    const isUserOffer = match.offer.wallet.toLowerCase() === userWallet.toLowerCase();
    return isUserAsk || isUserOffer;
  });

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

  // Filter data based on filters (prioritize skill_id filter)
  const activeSkillFilter = selectedCanopySkill || skillFilter;
  
  const filteredAsks = asks.filter((ask) => {
    // If skill_id filter is set, use it
    if (skillIdFilter) {
      return ask.skill_id === skillIdFilter;
    }
    // Otherwise use string filter (legacy)
    if (activeSkillFilter) {
      const askSkill = (ask.skill || '').toLowerCase();
      return askSkill.includes(activeSkillFilter.toLowerCase());
    }
    return true;
  });

  const filteredOffers = offers.filter((offer) => {
    // If skill_id filter is set, use it
    if (skillIdFilter) {
      return offer.skill_id === skillIdFilter;
    }
    // Otherwise use string filter (legacy)
    if (activeSkillFilter) {
      const offerSkill = (offer.skill || '').toLowerCase();
      return offerSkill.includes(activeSkillFilter.toLowerCase());
    }
    return true;
  });

  const filteredMatches = matches.filter((match) => {
    // If skill_id filter is set, check if match involves that skill_id
    if (skillIdFilter) {
      return (match.ask.skill_id === skillIdFilter || match.offer.skill_id === skillIdFilter);
    }
    // Otherwise use string filter (legacy)
    if (activeSkillFilter) {
      const matchSkill = (match.skillMatch || '').toLowerCase();
      return matchSkill.includes(activeSkillFilter.toLowerCase());
    }
    return true;
  });

  // Extract top skills for Canopy section (use skill_id when available)
  const skillCounts = new Map<string, number>();
  asks.forEach(a => {
    const skillKey = a.skill_id || a.skill;
    const count = skillCounts.get(skillKey) || 0;
    skillCounts.set(skillKey, count + 1);
  });
  offers.forEach(o => {
    const skillKey = o.skill_id || o.skill;
    const count = skillCounts.get(skillKey) || 0;
    skillCounts.set(skillKey, count + 1);
  });
  const topSkills = Array.from(skillCounts.entries())
    .map(([skillKey, count]) => {
      // Get skill name from entity if available
      const skill = skills[skillKey];
      const skillName = skill ? skill.name_canonical : skillKey;
      return { skill: skillName, skillKey, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Group asks/offers/matches by skill (use skill_id when available)
  const skillsMap = new Map<string, { asks: Ask[]; offers: Offer[]; matches: Match[]; skillKey: string }>();
  
  filteredAsks.forEach(ask => {
    const skillKey = ask.skill_id || ask.skill;
    if (!skillsMap.has(skillKey)) {
      skillsMap.set(skillKey, { asks: [], offers: [], matches: [], skillKey });
    }
    skillsMap.get(skillKey)!.asks.push(ask);
  });
  
  filteredOffers.forEach(offer => {
    const skillKey = offer.skill_id || offer.skill;
    if (!skillsMap.has(skillKey)) {
      skillsMap.set(skillKey, { asks: [], offers: [], matches: [], skillKey });
    }
    skillsMap.get(skillKey)!.offers.push(offer);
  });
  
  filteredMatches.forEach(match => {
    // Use skill_id from ask/offer if available, otherwise use skillMatch string
    const skillKey = match.ask.skill_id || match.offer.skill_id || match.skillMatch;
    if (!skillsMap.has(skillKey)) {
      skillsMap.set(skillKey, { asks: [], offers: [], matches: [], skillKey });
    }
    skillsMap.get(skillKey)!.matches.push(match);
  });

  // Sort skills by total activity (matches + asks + offers)
  const sortedSkills = Array.from(skillsMap.entries())
    .map(([skillKey, data]) => {
      // Get skill name from entity if available
      const skill = skills[skillKey];
      const skillName = skill ? skill.name_canonical : skillKey;
      return {
        skill: skillName,
        skillKey: skillKey, // Explicitly set skillKey
        asks: data.asks,
        offers: data.offers,
        matches: data.matches,
        totalCount: data.matches.length + data.asks.length + data.offers.length,
      };
    })
    .sort((a, b) => b.totalCount - a.totalCount);

  if (loading) {
    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <BackButton href="/me" />
          </div>
          {arkivBuilderMode ? (
            <ArkivQueryTooltip
              query={[
                `loadNetwork()`,
                `Queries:`,
                `1. GET /api/asks`,
                `   → type='ask', status='active'`,
                `2. GET /api/offers`,
                `   → type='offer', status='active'`,
                `3. GET /api/skills?status=active&limit=200`,
                `   → type='skill', status='active'`,
                `4. getProfileByWallet(...) for each unique wallet`,
                `   → type='user_profile', wallet='...'`,
                `Returns: Computed network graph data (asks, offers, matches, skills, profiles)`
              ]}
              label="Loading Network"
            >
              <LoadingSpinner text="Loading network..." className="py-12" />
            </ArkivQueryTooltip>
          ) : (
            <LoadingSpinner text="Loading network..." className="py-12" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>

        <PageHeader
          title="Network"
          description="A living map of learning + teaching connections"
        />

        {/* Public Garden Board Link, Browse Profiles, Learner Communities, and Learner Quests */}
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/garden/public-board"
            className="relative inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            title="Public Garden Board"
          >
            <span className="text-lg">💌</span>
          </Link>
          <Link
            href="/profiles"
            className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:underline transition-colors"
          >
            Browse Profiles
          </Link>
          <Link
            href="/skills/explore"
            className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:underline transition-colors"
          >
            Learner Communities
          </Link>
          <Link
            href="/learner-quests"
            className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:underline transition-colors"
          >
            Learner Quests
          </Link>
        </div>

        {/* Top Section: Asks, Offers, Your Matches with Action Buttons */}
        <ForestPulseStats
          asksCount={asks.length}
          offersCount={offers.length}
          matchesCount={userMatches.length}
          matchesLabel="Your Matches"
          onStatClick={(type) => {
            if (type === 'asks') {
              router.push('/asks');
            } else if (type === 'offers') {
              router.push('/offers');
            } else if (type === 'matches') {
              router.push('/matches');
            }
          }}
        />

        <QuickActions />

        {/* Skill Canopy Section */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Skill Canopy</h2>
          <CanopySection
            skills={topSkills.map(s => ({ skill: s.skill, count: s.count }))}
            onSkillClick={(skill) => {
              // Find the skillKey for this skill name
              const skillEntry = topSkills.find(s => s.skill === skill);
              if (skillEntry?.skillKey && skills[skillEntry.skillKey]) {
                // If it's a skill_id, set filter and show content
                const skillEntity = skills[skillEntry.skillKey];
                setSkillIdFilter(skillEntity.key);
                setSelectedCanopySkill(skill);
                setSkillFilter('');
                setShowContent(true);
              } else {
                // Legacy: use string filter
                setSelectedCanopySkill(skill);
                setSkillFilter(skill);
                setSkillIdFilter(null);
                setShowContent(true);
              }
            }}
            selectedSkill={selectedCanopySkill}
          />
        </div>

        {/* Filter by Skill */}
        <LeafChipFilter
          value={skillFilter}
          onChange={async (value) => {
            setSkillFilter(value);
            if (!value) {
              setSelectedCanopySkill(undefined);
              setSkillIdFilter(null);
              setShowContent(false);
            } else {
              setShowContent(true);
              // Verify skill exists on Arkiv (query by slug or name)
              try {
                const skillRes = await fetch(`/api/skills?slug=${encodeURIComponent(value.toLowerCase().trim())}&limit=1`);
                const skillData = await skillRes.json();
                if (skillData.ok && skillData.skills && skillData.skills.length > 0) {
                  // Found skill entity - use skill_id filter
                  setSkillIdFilter(skillData.skills[0].key);
                  setSkillFilter(''); // Clear string filter when using skill_id
                } else {
                  // No skill entity found - use string filter (legacy)
                  setSkillIdFilter(null);
                }
              } catch (err) {
                console.warn('[NetworkPage] Failed to verify skill on Arkiv, using string filter:', err);
                setSkillIdFilter(null);
              }
            }
          }}
        />

        {/* Type Filter (simplified, optional) */}
        {typeFilter !== 'all' && (
          <div className="mb-4">
            <button
              onClick={() => setTypeFilter('all')}
              className="text-sm text-gray-600 dark:text-gray-400 hover:underline"
            >
              ← Show all
            </button>
          </div>
        )}

        {/* Section D: Skill Clusters with Sprouts - Only show when content should be visible */}
        {showContent && sortedSkills.length > 0 ? (
          <div className="space-y-8">
            {sortedSkills.map(({ skill, skillKey, asks: skillAsks, offers: skillOffers, matches: skillMatches }) => {
              // Apply type filter to skill cluster
              const displayAsks = (typeFilter === 'all' || typeFilter === 'asks') ? skillAsks : [];
              const displayOffers = (typeFilter === 'all' || typeFilter === 'offers') ? skillOffers : [];
              const displayMatches = (typeFilter === 'all' || typeFilter === 'matches') ? skillMatches : [];
              
              if (displayAsks.length === 0 && displayOffers.length === 0 && displayMatches.length === 0) {
                return null;
              }

              // Display skill cluster directly (no navigation wrapper)
              // Users can click individual asks/offers/matches for details
              return (
                <SkillCluster
                  key={skillKey}
                  skill={skill}
                  asks={displayAsks}
                  offers={displayOffers}
                  matches={displayMatches}
                  profiles={profiles}
                />
              );
            })}
          </div>
        ) : showContent ? (
          <EmptyState
            title="No skills found"
            description={skillIdFilter || activeSkillFilter ? `No skills match the filter. Try a different filter.` : 'No asks or offers found in the network yet.'}
          />
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">Select a skill from the canopy above to explore asks, offers, and matches</p>
            <p className="text-sm">Or use the filter to search for a specific skill</p>
          </div>
        )}
      </div>
    </div>
  );
}
