/**
 * Topic Detail Page
 * 
 * Displays a dedicated page for a specific skill/topic.
 * Shows all asks, offers, and matches for that skill.
 * 
 * Route: /topic/[slug]
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { BetaBanner } from '@/components/BetaBanner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SkillCluster } from '@/components/network/SkillCluster';
import type { Ask } from '@/lib/arkiv/asks';
import type { Offer } from '@/lib/arkiv/offers';
import type { Skill } from '@/lib/arkiv/skill';
import type { UserProfile } from '@/lib/arkiv/profile';
import { getProfileByWallet } from '@/lib/arkiv/profile';

type Match = {
  ask: Ask;
  offer: Offer;
  askProfile?: UserProfile;
  offerProfile?: UserProfile;
  skillMatch: string;
};

export default function TopicDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  
  const [skill, setSkill] = useState<Skill | null>(null);
  const [asks, setAsks] = useState<Ask[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      loadTopicData();
    }
  }, [slug]);

  const loadTopicData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load skill by slug
      const skillRes = await fetch(`/api/skills?slug=${encodeURIComponent(slug)}&limit=1`);
      const skillData = await skillRes.json();
      
      if (!skillData.ok || !skillData.skills || skillData.skills.length === 0) {
        setError('Topic not found');
        setLoading(false);
        return;
      }

      const skillEntity = skillData.skills[0];
      setSkill(skillEntity);

      // Load asks and offers filtered by skill_id
      const [asksRes, offersRes] = await Promise.all([
        fetch('/api/asks').then(r => r.json()),
        fetch('/api/offers').then(r => r.json()),
      ]);

      // Filter by skill_id
      const skillAsks = (asksRes.ok ? asksRes.asks || [] : []).filter(
        (ask: Ask) => ask.skill_id === skillEntity.key
      );
      const skillOffers = (offersRes.ok ? offersRes.offers || [] : []).filter(
        (offer: Offer) => offer.skill_id === skillEntity.key
      );

      setAsks(skillAsks);
      setOffers(skillOffers);

      // Load profiles for all unique wallets
      const allWallets = new Set<string>();
      skillAsks.forEach((ask: Ask) => allWallets.add(ask.wallet));
      skillOffers.forEach((offer: Offer) => allWallets.add(offer.wallet));

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

      // Compute matches
      const matchesList: Match[] = [];
      skillAsks.forEach((ask: Ask) => {
        skillOffers.forEach((offer: Offer) => {
          // Match if they have the same skill_id
          if (ask.skill_id === offer.skill_id && ask.skill_id === skillEntity.key) {
            matchesList.push({
              ask,
              offer,
              askProfile: profilesMap[ask.wallet],
              offerProfile: profilesMap[offer.wallet],
              skillMatch: skillEntity.name_canonical,
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
    } catch (err: any) {
      console.error('Error loading topic data:', err);
      setError(err.message || 'Failed to load topic');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <BackButton href="/network" />
          </div>
          <LoadingSpinner text="Loading topic..." className="py-12" />
        </div>
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <ThemeToggle />
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <BackButton href="/network" />
          </div>
          <EmptyState
            title="Topic not found"
            description={error || 'The requested topic could not be found.'}
          />
        </div>
      </div>
    );
  }

  const totalCount = asks.length + offers.length + matches.length;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <ThemeToggle />
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <BackButton href="/network" />
        </div>

        <PageHeader
          title={skill.name_canonical}
          description={skill.description || `Explore learning and teaching opportunities for ${skill.name_canonical}`}
        />

        {/* Skill Metadata */}
        <div className="mb-6 p-4 rounded-lg border border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {totalCount === 0 
                  ? 'No activity yet' 
                  : `${totalCount} ${totalCount === 1 ? 'item' : 'items'} (${asks.length} asks, ${offers.length} offers, ${matches.length} matches)`
                }
              </p>
            </div>
            <Link
              href="/network"
              className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              View all topics →
            </Link>
          </div>
        </div>

        {/* Content */}
        {totalCount === 0 ? (
          <EmptyState
            title={`No activity for ${skill.name_canonical} yet`}
            description="Be the first to post an ask or offer for this topic!"
          />
        ) : (
          <SkillCluster
            skill={skill.name_canonical}
            asks={asks}
            offers={offers}
            matches={matches}
            profiles={profiles}
          />
        )}
      </div>
    </div>
  );
}
