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
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800';
      case 'offer':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800';
      case 'skill':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700';
    }
  };

  // Get entity-specific human-readable content
  const getEntityContent = (): { primary: string; secondary: string | null; meta: string | null } => {
    if (entity.type === 'profile' && 'displayName' in entity) {
      const profile = entity as any;
      return {
        primary: profile.displayName || entity.wallet || 'Unknown Profile',
        secondary: entity.summary || profile.bioShort || profile.bio || null,
        meta: entity.wallet ? `Wallet: ${entity.wallet.slice(0, 6)}...${entity.wallet.slice(-4)}` : null,
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
        meta: entity.wallet ? `From: ${entity.wallet.slice(0, 6)}...${entity.wallet.slice(-4)}` : null,
      };
    }
    if (entity.type === 'offer' && 'message' in entity) {
      const offer = entity as any;
      return {
        primary: entity.title || `Offer: ${offer.skill || 'Unknown'}`,
        secondary: entity.summary || offer.message || null,
        meta: entity.wallet ? `From: ${entity.wallet.slice(0, 6)}...${entity.wallet.slice(-4)}` : null,
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
    <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Type badge and version badge */}
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getTypeBadgeClass(entity.type)}`}>
              {entity.type}
            </span>
            {/* Version badge for profiles with multiple versions */}
            {entity.type === 'profile' && entity.versionCount && entity.versionCount > 1 && entity.wallet && (
              <Link
                href={`/profiles/${entity.wallet}/versions`}
                className="group relative inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                title="View version history"
              >
                {/* DNA/Helix Icon - Double helix representation */}
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v.5a1 1 0 001 1h.5a1 1 0 011 1v.5a1 1 0 001 1h.5a1 1 0 011 1v.5a1 1 0 001 1h.5a1 1 0 011 1v1a1 1 0 01-1 1h-.5a1 1 0 00-1 1v.5a1 1 0 01-1 1h-.5a1 1 0 00-1 1v.5a1 1 0 01-1 1h-.5a1 1 0 00-1 1v.5a1 1 0 01-1 1H9a1 1 0 01-1-1v-.5a1 1 0 00-1-1h-.5a1 1 0 01-1-1v-.5a1 1 0 00-1-1h-.5a1 1 0 01-1-1v-.5a1 1 0 00-1-1h-.5a1 1 0 01-1-1v-1a1 1 0 011-1h.5a1 1 0 001-1v-.5a1 1 0 011-1h.5a1 1 0 001-1v-.5a1 1 0 011-1h.5a1 1 0 001-1V3a1 1 0 011-1h0z" opacity="0.3"/>
                  <path d="M10 2a1 1 0 00-1 1v.5a1 1 0 01-1 1h-.5a1 1 0 00-1 1v.5a1 1 0 01-1 1h-.5a1 1 0 00-1 1v.5a1 1 0 01-1 1h-.5a1 1 0 00-1 1v1a1 1 0 001 1h.5a1 1 0 011 1v.5a1 1 0 001 1h.5a1 1 0 011 1v.5a1 1 0 001 1h.5a1 1 0 011 1v.5a1 1 0 001 1H11a1 1 0 001-1v-.5a1 1 0 011-1h.5a1 1 0 001-1v-.5a1 1 0 011-1h.5a1 1 0 001-1v-.5a1 1 0 011-1h.5a1 1 0 001-1v-1a1 1 0 00-1-1h-.5a1 1 0 01-1-1v-.5a1 1 0 00-1-1h-.5a1 1 0 01-1-1v-.5a1 1 0 00-1-1h-.5a1 1 0 01-1-1V3a1 1 0 00-1-1h0z"/>
                </svg>
                <span>{entity.versionCount} versions</span>
                {/* Educational Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-3 bg-gray-900 dark:bg-gray-800 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-normal max-w-2xl w-96">
                  <div className="font-semibold mb-2">Profile version history</div>
                  <p className="text-gray-300 dark:text-gray-400 leading-relaxed">
                    Blockchains are immutable at the transaction level, but application data is mutable at the state level. This profile has {entity.versionCount} versions preserved on-chain. The explorer shows the current canonical version, but all historical versions are accessible.
                  </p>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                </div>
              </Link>
            )}
            {/* Canonical badge for profiles with single version */}
            {entity.type === 'profile' && (!entity.versionCount || entity.versionCount === 1) && (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800">
                Canonical
              </span>
            )}
          </div>

          {/* Primary human-readable content - LARGE and PROMINENT */}
          <h3 className="font-bold text-2xl text-gray-900 dark:text-gray-100 mb-2 break-words">
            {content.primary}
          </h3>

          {/* Secondary human-readable content */}
          {content.secondary && (
            <p className="text-gray-700 dark:text-gray-300 mb-3 line-clamp-2 text-base">
              {content.secondary}
            </p>
          )}

          {/* Human-readable metadata */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400 mb-3">
            {humanDate && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {humanDate}
              </span>
            )}
            {content.meta && (
              <span className="text-gray-600 dark:text-gray-400">
                {content.meta}
              </span>
            )}
            {(entity as any).spaceId && (
              <span className="text-gray-600 dark:text-gray-400">
                Space: {(entity as any).spaceId}
              </span>
            )}
          </div>

          {/* Blockchain provenance - SMALL and SECONDARY at bottom */}
          {provenance && (
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
              {provenance.url ? (
                <a
                  href={provenance.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-400 hover:underline transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            View Details
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

