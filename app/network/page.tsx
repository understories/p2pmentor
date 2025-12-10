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
import { CanopySection } from '@/components/network/CanopySection';
import { ForestPulseStats } from '@/components/network/ForestPulseStats';
import { QuickActions } from '@/components/network/QuickActions';
import { LeafChipFilter } from '@/components/network/LeafChipFilter';
import { SkillCluster } from '@/components/network/SkillCluster';
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

  useEffect(() => {
    // Get user wallet
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      setUserWallet(address);
      
      // Check for skill_id or skill in URL params
      const urlParams = new URLSearchParams(window.location.search);
      const skillId = urlParams.get('skill_id');
      const skillSlug = urlParams.get('skill');
      
      if (skillId) {
        setSkillIdFilter(skillId);
      } else if (skillSlug) {
        // Try to resolve skill slug to skill_id
        fetch(`/api/skills?slug=${encodeURIComponent(skillSlug)}&limit=1`)
          .then(r => r.json())
          .then(data => {
            if (data.ok && data.skills && data.skills.length > 0) {
              setSkillIdFilter(data.skills[0].key);
            } else {
              // Fallback to string filter
              setSkillFilter(skillSlug);
            }
          })
          .catch(() => {
            setSkillFilter(skillSlug);
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

  const loadNetwork = async () => {
    try {
      setLoading(true);
      const [asksRes, offersRes, skillsRes] = await Promise.all([
        fetch('/api/asks').then(r => r.json()),
        fetch('/api/offers').then(r => r.json()),
        fetch('/api/skills?status=active&limit=200').then(r => r.json()),
      ]);

      if (asksRes.ok) {
        setAsks(asksRes.asks || []);
      }
      if (offersRes.ok) {
        setOffers(offersRes.offers || []);
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
        skillKey,
        ...data,
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
          description="A living map of learning + teaching connections"
        />
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 -mt-4">
          Explore skills, find matches, and connect with mentors and learners
        </p>

        {/* Section A: The Canopy */}
        <CanopySection
          skills={topSkills.map(s => ({ skill: s.skill, count: s.count }))}
          onSkillClick={(skill) => {
            // Find the skillKey for this skill name
            const skillEntry = topSkills.find(s => s.skill === skill);
            if (skillEntry?.skillKey && skills[skillEntry.skillKey]) {
              // If it's a skill_id, navigate to topic page
              const skillEntity = skills[skillEntry.skillKey];
              router.push(`/topic/${skillEntity.slug}`);
            } else {
              // Legacy: use string filter
              setSelectedCanopySkill(skill);
              setSkillFilter(skill);
              setSkillIdFilter(null);
            }
          }}
          selectedSkill={selectedCanopySkill}
        />

        {/* Section B: Forest Pulse Stats */}
        <ForestPulseStats
          asksCount={asks.length}
          offersCount={offers.length}
          matchesCount={matches.length}
          onStatClick={(type) => {
            setTypeFilter(type === 'asks' ? 'asks' : type === 'offers' ? 'offers' : 'matches');
          }}
        />

        {/* Section C: Quick Actions */}
        <QuickActions />

        {/* Section E: Leaf Chip Filter */}
        <LeafChipFilter
          value={skillFilter}
          onChange={(value) => {
            setSkillFilter(value);
            if (!value) {
              setSelectedCanopySkill(undefined);
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

        {/* Section D: Skill Clusters with Sprouts */}
        {sortedSkills.length > 0 ? (
          <div className="space-y-8">
            {sortedSkills.map(({ skill, skillKey, asks: skillAsks, offers: skillOffers, matches: skillMatches }) => {
              // Apply type filter to skill cluster
              const displayAsks = (typeFilter === 'all' || typeFilter === 'asks') ? skillAsks : [];
              const displayOffers = (typeFilter === 'all' || typeFilter === 'offers') ? skillOffers : [];
              const displayMatches = (typeFilter === 'all' || typeFilter === 'matches') ? skillMatches : [];
              
              if (displayAsks.length === 0 && displayOffers.length === 0 && displayMatches.length === 0) {
                return null;
              }

              // If this is a skill entity, wrap in link to topic page
              const skillEntity = skills[skillKey];
              const clusterContent = (
                <SkillCluster
                  key={skillKey}
                  skill={skill}
                  asks={displayAsks}
                  offers={displayOffers}
                  matches={displayMatches}
                  profiles={profiles}
                />
              );

              if (skillEntity) {
                return (
                  <Link key={skillKey} href={`/topic/${skillEntity.slug}`} className="block">
                    {clusterContent}
                  </Link>
                );
              }

              return clusterContent;
            })}
          </div>
        ) : (
          <EmptyState
            title="No skills found"
            description={skillIdFilter || activeSkillFilter ? `No skills match the filter. Try a different filter.` : 'No asks or offers found in the network yet.'}
          />
        )}
      </div>
    </div>
  );
}
