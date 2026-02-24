/**
 * Entity Card Component
 *
 * Displays a single entity with provenance information.
 */

'use client';

import Link from 'next/link';
import { getArkivExplorerEntityUrl } from '@/lib/arkiv/explorer';
import type { PublicEntity } from '@/lib/explorer/types';

interface EntityCardProps {
  entity: PublicEntity & { provenance?: any; versionCount?: number };
}

export function EntityCard({ entity }: EntityCardProps) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown date';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatProvenance = () => {
    // If we have provenance with txHash, use that
    if (entity.provenance) {
      const { blockNumber, blockTimestamp, explorerTxUrl } = entity.provenance;
      const parts: string[] = ['View on Arkiv'];
      if (blockNumber) {
        parts.push(`Block ${blockNumber}`);
      }
      if (blockTimestamp) {
        const date = new Date(blockTimestamp * 1000);
        parts.push(formatDate(date.toISOString()));
      }
      return { text: parts.join(' · '), url: explorerTxUrl };
    }
    // Fallback: if we have entity key but no provenance, link to entity on Arkiv
    if (entity.key) {
      return { text: 'View on Arkiv', url: getArkivExplorerEntityUrl(entity.key) };
    }
    return null;
  };

  const provenance = formatProvenance();

  // Type-specific badge colors
  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'profile':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800';
      case 'ask':
      case 'lite_ask':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800';
      case 'offer':
      case 'lite_offer':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800';
      case 'skill':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800';
      case 'meta_learning_artifact':
      case 'learner_quest_progress':
        return 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700';
    }
  };

  const getTypeBadgeLabel = (type: string) => {
    switch (type) {
      case 'lite_ask':
        return 'Ask';
      case 'lite_offer':
        return 'Offer';
      case 'meta_learning_artifact':
        return 'Quest Artifact';
      case 'learner_quest_progress':
        return 'Quest Progress';
      default:
        return type;
    }
  };

  // Get entity-specific human-readable content
  const getEntityContent = (): {
    primary: string;
    secondary: string | null;
    meta: string | null;
  } => {
    if (entity.type === 'profile' && 'displayName' in entity) {
      const profile = entity as any;
      return {
        primary: profile.displayName || entity.wallet || 'Unknown Profile',
        secondary: entity.summary || profile.bioShort || profile.bio || null,
        meta: entity.wallet
          ? `Wallet: ${entity.wallet.slice(0, 6)}...${entity.wallet.slice(-4)}`
          : null,
      };
    }
    if (entity.type === 'skill' && 'name_canonical' in entity) {
      const skill = entity as any;
      return {
        primary: skill.name_canonical || entity.title || 'Unknown Skill',
        secondary: entity.summary || skill.description || null,
        meta: null,
      };
    }
    if (entity.type === 'ask' && 'message' in entity) {
      const ask = entity as any;
      return {
        primary: entity.title || `Ask: ${ask.skill || 'Unknown'}`,
        secondary: entity.summary || ask.message || null,
        meta: entity.wallet
          ? `From: ${entity.wallet.slice(0, 6)}...${entity.wallet.slice(-4)}`
          : null,
      };
    }
    if (entity.type === 'offer' && 'message' in entity) {
      const offer = entity as any;
      return {
        primary: entity.title || `Offer: ${offer.skill || 'Unknown'}`,
        secondary: entity.summary || offer.message || null,
        meta: entity.wallet
          ? `From: ${entity.wallet.slice(0, 6)}...${entity.wallet.slice(-4)}`
          : null,
      };
    }
    if (entity.type === 'lite_ask') {
      const liteAsk = entity as any;
      return {
        primary: entity.title || `Ask: ${liteAsk.skill || 'Unknown'}`,
        secondary: entity.summary || liteAsk.description || null,
        meta: liteAsk.name
          ? `From: ${liteAsk.name}${liteAsk.discordHandle ? ` (${liteAsk.discordHandle})` : ''}`
          : null,
      };
    }
    if (entity.type === 'lite_offer') {
      const liteOffer = entity as any;
      return {
        primary: entity.title || `Offer: ${liteOffer.skill || 'Unknown'}`,
        secondary: entity.summary || liteOffer.description || null,
        meta: liteOffer.name
          ? `From: ${liteOffer.name}${liteOffer.discordHandle ? ` (${liteOffer.discordHandle})` : ''}`
          : null,
      };
    }
    if (entity.type === 'meta_learning_artifact') {
      const artifact = entity as any;
      const stepLabel = artifact.stepId ? artifact.stepId.replace(/_/g, ' ') : 'unknown step';
      return {
        primary: entity.title || `Quest Artifact: ${stepLabel}`,
        secondary:
          entity.summary || (artifact.artifactType ? `Type: ${artifact.artifactType}` : null),
        meta: entity.wallet
          ? `From: ${entity.wallet.slice(0, 6)}...${entity.wallet.slice(-4)}`
          : null,
      };
    }
    if (entity.type === 'learner_quest_progress') {
      const progress = entity as any;
      return {
        primary: entity.title || `Quest Progress: ${progress.questId || 'unknown'}`,
        secondary:
          entity.summary || (progress.questionId ? `Question: ${progress.questionId}` : null),
        meta: entity.wallet
          ? `From: ${entity.wallet.slice(0, 6)}...${entity.wallet.slice(-4)}`
          : null,
      };
    }
    return {
      primary: entity.title || entity.key || 'Unknown Entity',
      secondary: entity.summary || null,
      meta: null,
    };
  };

  const content = getEntityContent();
  const humanDate = entity.createdAt ? formatDate(entity.createdAt) : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Type badge and version badge */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${getTypeBadgeClass(entity.type)}`}
            >
              {getTypeBadgeLabel(entity.type)}
            </span>
            {/* Version badge for profiles with multiple versions */}
            {entity.type === 'profile' &&
              entity.versionCount &&
              entity.versionCount > 1 &&
              entity.wallet && (
                <Link
                  href={`/profiles/${entity.wallet}/versions`}
                  className="group relative inline-flex items-center gap-1.5 rounded border border-purple-200 bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 transition-colors hover:bg-purple-200 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-200 dark:hover:bg-purple-900/50"
                  title="View version history"
                >
                  {/* DNA/Helix Icon - Double helix representation */}
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      d="M10 2a1 1 0 011 1v.5a1 1 0 001 1h.5a1 1 0 011 1v.5a1 1 0 001 1h.5a1 1 0 011 1v.5a1 1 0 001 1h.5a1 1 0 011 1v1a1 1 0 01-1 1h-.5a1 1 0 00-1 1v.5a1 1 0 01-1 1h-.5a1 1 0 00-1 1v.5a1 1 0 01-1 1h-.5a1 1 0 00-1 1v.5a1 1 0 01-1 1H9a1 1 0 01-1-1v-.5a1 1 0 00-1-1h-.5a1 1 0 01-1-1v-.5a1 1 0 00-1-1h-.5a1 1 0 01-1-1v-.5a1 1 0 00-1-1h-.5a1 1 0 01-1-1v-1a1 1 0 011-1h.5a1 1 0 001-1v-.5a1 1 0 011-1h.5a1 1 0 001-1v-.5a1 1 0 011-1h.5a1 1 0 001-1V3a1 1 0 011-1h0z"
                      opacity="0.3"
                    />
                    <path d="M10 2a1 1 0 00-1 1v.5a1 1 0 01-1 1h-.5a1 1 0 00-1 1v.5a1 1 0 01-1 1h-.5a1 1 0 00-1 1v.5a1 1 0 01-1 1h-.5a1 1 0 00-1 1v1a1 1 0 001 1h.5a1 1 0 011 1v.5a1 1 0 001 1h.5a1 1 0 011 1v.5a1 1 0 001 1h.5a1 1 0 011 1v.5a1 1 0 001 1H11a1 1 0 001-1v-.5a1 1 0 011-1h.5a1 1 0 001-1v-.5a1 1 0 011-1h.5a1 1 0 001-1v-.5a1 1 0 011-1h.5a1 1 0 001-1v-1a1 1 0 00-1-1h-.5a1 1 0 01-1-1v-.5a1 1 0 00-1-1h-.5a1 1 0 01-1-1v-.5a1 1 0 00-1-1h-.5a1 1 0 01-1-1V3a1 1 0 00-1-1h0z" />
                  </svg>
                  <span>{entity.versionCount} versions</span>
                  {/* Educational Tooltip */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-96 max-w-2xl -translate-x-1/2 whitespace-normal rounded-lg bg-gray-900 px-4 py-3 text-sm text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 dark:bg-gray-800">
                    <div className="mb-2 font-semibold">Profile version history</div>
                    <p className="leading-relaxed text-gray-300 dark:text-gray-400">
                      Blockchains are immutable at the transaction level, but application data is
                      mutable at the state level. This profile has {entity.versionCount} versions
                      preserved on-chain. The explorer shows the current canonical version, but all
                      historical versions are accessible.
                    </p>
                    <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                  </div>
                </Link>
              )}
            {/* Canonical badge for profiles with single version */}
            {entity.type === 'profile' && (!entity.versionCount || entity.versionCount === 1) && (
              <span className="rounded border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
                Canonical
              </span>
            )}
          </div>

          {/* Primary human-readable content - LARGE and PROMINENT */}
          <h3 className="mb-2 break-words text-2xl font-bold text-gray-900 dark:text-gray-100">
            {content.primary}
          </h3>

          {/* Secondary human-readable content */}
          {content.secondary && (
            <p className="mb-3 line-clamp-2 text-base text-gray-700 dark:text-gray-300">
              {content.secondary}
            </p>
          )}

          {/* Human-readable metadata */}
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
            {humanDate && (
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {humanDate}
              </span>
            )}
            {content.meta && (
              <span className="text-gray-600 dark:text-gray-400">{content.meta}</span>
            )}
            {(entity as any).spaceId && (
              <span className="text-gray-600 dark:text-gray-400">
                Space: {(entity as any).spaceId}
              </span>
            )}
          </div>

          {/* Blockchain provenance - SMALL and SECONDARY at bottom */}
          {provenance && (
            <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
              {provenance.url ? (
                <a
                  href={provenance.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-gray-700 hover:underline dark:text-gray-500 dark:hover:text-gray-400"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-xs">{provenance.text}</span>
                </a>
              ) : (
                <span className="text-xs text-gray-500 dark:text-gray-500">{provenance.text}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          <Link
            href={`/explorer/${entity.type}/${entity.type === 'profile' ? entity.wallet : entity.key}`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            View Details
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
