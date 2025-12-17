/**
 * Skill Cluster Component
 * 
 * Displays a skill section with matching asks, offers, and matches.
 * Each skill has a glowing constellation label with connecting line visual.
 * Cards styled as sprout outlines (asks) vs filled (offers).
 * Part of Network page "Canopy Map" transformation.
 */

'use client';

import Link from 'next/link';
import { useTheme } from '@/lib/theme';
import { EmojiIdentitySeed } from '@/components/profile/EmojiIdentitySeed';
import { askColors, askEmojis, offerColors, offerEmojis } from '@/lib/colors';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import type { Ask } from '@/lib/arkiv/asks';
import type { Offer } from '@/lib/arkiv/offers';
import type { UserProfile } from '@/lib/arkiv/profile';

interface Match {
  ask: Ask;
  offer: Offer;
  askProfile?: UserProfile;
  offerProfile?: UserProfile;
  skillMatch: string;
}

interface SkillClusterProps {
  skill: string;
  asks: Ask[];
  offers: Offer[];
  matches: Match[];
  profiles: Record<string, UserProfile>;
  onAskClick?: (ask: Ask) => void;
  onOfferClick?: (offer: Offer) => void;
  onMatchClick?: (match: Match) => void;
  arkivBuilderMode?: boolean;
}

export function SkillCluster({
  skill,
  asks,
  offers,
  matches,
  profiles,
  onAskClick,
  onOfferClick,
  onMatchClick,
  arkivBuilderMode = false,
}: SkillClusterProps) {
  const { theme } = useTheme();
  const totalCount = asks.length + offers.length + matches.length;

  if (totalCount === 0) {
    return null;
  }

  const shortenWallet = (wallet: string) => {
    if (!wallet || wallet.length < 10) return wallet;
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Get unique wallets for this skill (for Mini Seed Grove)
  const uniqueWallets = new Set<string>();
  asks.forEach(a => uniqueWallets.add(a.wallet));
  offers.forEach(o => uniqueWallets.add(o.wallet));
  const skillProfiles = Array.from(uniqueWallets)
    .slice(0, 5) // Show max 5 seeds
    .map(w => profiles[w])
    .filter(Boolean) as UserProfile[];

  return (
    <div className="mb-8 overflow-visible">
      {/* Skill Header with Constellation Label */}
      <div className="relative mb-4">
        {/* Connecting line visual */}
        <div
          className="absolute left-0 top-1/2 w-8 h-px"
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(to right, rgba(34, 197, 94, 0.4), transparent)'
              : 'linear-gradient(to right, rgba(34, 197, 94, 0.3), transparent)',
          }}
        />
        <div className="flex items-center gap-3 pl-10">
          <h3
            className="text-xl font-bold flex items-center gap-2"
            style={{
              color: theme === 'dark' ? 'rgba(200, 255, 200, 0.9)' : 'rgba(22, 163, 74, 0.9)',
              textShadow: theme === 'dark' ? '0 0 8px rgba(34, 197, 94, 0.3)' : 'none',
            }}
          >
            <span>✦</span>
            {skill}
            <span className="text-sm font-normal opacity-75">({totalCount})</span>
          </h3>
          
          {/* Mini Seed Grove */}
          {skillProfiles.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              {skillProfiles.map((profile, idx) => (
                <div
                  key={profile.wallet}
                  className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400/20 to-blue-500/20 dark:from-green-400/10 dark:to-blue-500/10 flex items-center justify-center border border-green-300/30 dark:border-green-500/20"
                  style={{
                    marginLeft: idx > 0 ? '-4px' : '0',
                    zIndex: skillProfiles.length - idx,
                  }}
                >
                  <EmojiIdentitySeed profile={profile} size="sm" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-3 pl-10 overflow-visible">
        {/* Matches */}
        {matches.map((match) => {
          const matchCard = (
            <div
              key={`${match.ask.key}-${match.offer.key}`}
              className="p-4 rounded-xl border-2 transition-all duration-200 hover:scale-[1.02] cursor-pointer"
              onClick={() => onMatchClick?.(match)}
              style={{
                backgroundColor: theme === 'dark'
                  ? 'rgba(255, 200, 100, 0.1)'
                  : 'rgba(255, 200, 100, 0.05)',
                borderColor: theme === 'dark'
                  ? 'rgba(255, 200, 100, 0.4)'
                  : 'rgba(255, 200, 100, 0.3)',
                boxShadow: theme === 'dark'
                  ? '0 0 12px rgba(255, 200, 100, 0.2)'
                  : '0 2px 8px rgba(255, 200, 100, 0.15)',
              }}
            >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">✨</span>
              <span className="text-xs font-medium opacity-50 text-gray-500 dark:text-gray-400">Match made at: {formatDate(match.ask.createdAt)}</span>
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{askEmojis.default}</span>
                  <Link
                    href={`/profiles/${match.ask.wallet}`}
                    className="font-medium hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {match.askProfile?.displayName || shortenWallet(match.ask.wallet)}
                  </Link>
                  {match.ask.txHash && (
                    <a
                      href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${match.ask.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-xs opacity-60 hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                      title="View on Arkiv explorer"
                    >
                      🔗
                    </a>
                  )}
                </div>
                <p className="text-xs opacity-75">{match.ask.message}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{offerEmojis.default}</span>
                  <Link
                    href={`/profiles/${match.offer.wallet}`}
                    className="font-medium hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {match.offerProfile?.displayName || shortenWallet(match.offer.wallet)}
                  </Link>
                  {match.offer.txHash && (
                    <a
                      href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${match.offer.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-xs opacity-60 hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                      title="View on Arkiv explorer"
                    >
                      🔗
                    </a>
                  )}
                </div>
                <p className="text-xs opacity-75">{match.offer.message}</p>
              </div>
              {arkivBuilderMode && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  {match.ask.key && (
                    <ViewOnArkivLink entityKey={match.ask.key} txHash={match.ask.txHash} label="Ask Entity" className="text-xs" />
                  )}
                  {match.offer.key && (
                    <ViewOnArkivLink entityKey={match.offer.key} txHash={match.offer.txHash} label="Offer Entity" className="text-xs" />
                  )}
                </div>
              )}
            </div>
          </div>
          );

          if (arkivBuilderMode) {
            return (
              <ArkivQueryTooltip
                key={`${match.ask.key}-${match.offer.key}`}
                query={[
                  `Match: ${match.skillMatch}`,
                  `Ask: type='ask', key='${match.ask.key?.slice(0, 12)}...', skill_id='${match.ask.skill_id || match.ask.skill}'`,
                  `Offer: type='offer', key='${match.offer.key?.slice(0, 12)}...', skill_id='${match.offer.skill_id || match.offer.skill}'`,
                  `Match condition: ask.skill_id === offer.skill_id OR skill strings match`
                ]}
                label="Skill Match"
              >
                {matchCard}
              </ArkivQueryTooltip>
            );
          }

          return matchCard;
        })}

        {/* Asks (Sprout Outlines) */}
        {asks.map((ask) => {
          const profile = profiles[ask.wallet];
          const askCard = (
            <div
              key={ask.key}
              className="p-4 rounded-xl border transition-all duration-200 hover:scale-[1.02] cursor-pointer"
              onClick={() => onAskClick?.(ask)}
              style={{
                backgroundColor: theme === 'dark'
                  ? 'rgba(34, 197, 94, 0.05)'
                  : 'rgba(34, 197, 94, 0.03)',
                borderColor: theme === 'dark'
                  ? 'rgba(34, 197, 94, 0.2)'
                  : 'rgba(34, 197, 94, 0.15)',
                borderStyle: 'solid',
                boxShadow: theme === 'dark'
                  ? '0 0 8px rgba(34, 197, 94, 0.1)'
                  : '0 2px 4px rgba(34, 197, 94, 0.08)',
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400/20 to-blue-500/20 dark:from-green-400/10 dark:to-blue-500/10 flex items-center justify-center border border-green-300/30 dark:border-green-500/20">
                    <EmojiIdentitySeed profile={profile} size="sm" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{askEmojis.default}</span>
                    <Link
                      href={`/profiles/${ask.wallet}`}
                      className="font-medium hover:underline text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {profile?.displayName || shortenWallet(ask.wallet)}
                    </Link>
                    <span className="text-xs opacity-50">• {formatDate(ask.createdAt)}</span>
                    {ask.txHash && (
                      <a
                        href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${ask.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs opacity-60 hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                        title="View on Arkiv explorer"
                      >
                        🔗
                      </a>
                    )}
                  </div>
                  <p className="text-sm">{ask.message}</p>
                  {arkivBuilderMode && ask.key && (
                    <div className="mt-2">
                      <ViewOnArkivLink entityKey={ask.key} txHash={ask.txHash} label="View Ask Entity" className="text-xs" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );

          if (arkivBuilderMode) {
            return (
              <ArkivQueryTooltip
                key={ask.key}
                query={[
                  `type='ask' entity`,
                  `key='${ask.key?.slice(0, 12)}...'`,
                  `wallet='${ask.wallet.slice(0, 8)}...'`,
                  `skill_id='${ask.skill_id || ask.skill}'`,
                  `status='${ask.status}'`,
                  `TTL: ${ask.ttlSeconds || 3600}s (${Math.round((ask.ttlSeconds || 3600) / 3600)} hours)`
                ]}
                label="Ask"
              >
                {askCard}
              </ArkivQueryTooltip>
            );
          }

          return askCard;
        })}

        {/* Offers (Filled Sprouts) */}
        {offers.map((offer) => {
          const profile = profiles[offer.wallet];
          const offerCard = (
            <div
              key={offer.key}
              className="p-4 rounded-xl border transition-all duration-200 hover:scale-[1.02] cursor-pointer"
              onClick={() => onOfferClick?.(offer)}
              style={{
                backgroundColor: theme === 'dark'
                  ? 'rgba(34, 197, 94, 0.12)'
                  : 'rgba(34, 197, 94, 0.08)',
                borderColor: theme === 'dark'
                  ? 'rgba(34, 197, 94, 0.3)'
                  : 'rgba(34, 197, 94, 0.25)',
                borderStyle: 'solid',
                boxShadow: theme === 'dark'
                  ? '0 0 10px rgba(34, 197, 94, 0.2)'
                  : '0 2px 6px rgba(34, 197, 94, 0.15)',
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400/20 to-blue-500/20 dark:from-green-400/10 dark:to-blue-500/10 flex items-center justify-center border border-green-300/30 dark:border-green-500/20">
                    <EmojiIdentitySeed profile={profile} size="sm" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{offerEmojis.default}</span>
                    <Link
                      href={`/profiles/${offer.wallet}`}
                      className="font-medium hover:underline text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {profile?.displayName || shortenWallet(offer.wallet)}
                    </Link>
                    <span className="text-xs opacity-50">• {formatDate(offer.createdAt)}</span>
                    {offer.txHash && (
                      <a
                        href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${offer.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs opacity-60 hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                        title="View on Arkiv explorer"
                      >
                        🔗
                      </a>
                    )}
                  </div>
                  <p className="text-sm">{offer.message}</p>
                  {arkivBuilderMode && offer.key && (
                    <div className="mt-2">
                      <ViewOnArkivLink entityKey={offer.key} txHash={offer.txHash} label="View Offer Entity" className="text-xs" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );

          if (arkivBuilderMode) {
            return (
              <ArkivQueryTooltip
                key={offer.key}
                query={[
                  `type='offer' entity`,
                  `key='${offer.key?.slice(0, 12)}...'`,
                  `wallet='${offer.wallet.slice(0, 8)}...'`,
                  `skill_id='${offer.skill_id || offer.skill}'`,
                  `status='${offer.status}'`,
                  `TTL: ${offer.ttlSeconds || 3600}s (${Math.round((offer.ttlSeconds || 3600) / 3600)} hours)`
                ]}
                label="Offer"
              >
                {offerCard}
              </ArkivQueryTooltip>
            );
          }

          return offerCard;
        })}
      </div>
    </div>
  );
}
