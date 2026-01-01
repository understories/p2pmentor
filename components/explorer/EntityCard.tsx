/**
 * Entity Card Component
 * 
 * Displays a single entity with provenance information.
 */

'use client';

import Link from 'next/link';
import type { PublicEntity } from '@/lib/explorer/types';

interface EntityCardProps {
  entity: PublicEntity & { provenance?: any };
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
    if (!entity.provenance) return null;
    const { blockNumber, blockTimestamp, explorerTxUrl } = entity.provenance;
    const parts: string[] = ['Verified on-chain'];
    if (blockNumber) {
      parts.push(`Block ${blockNumber}`);
    }
    if (blockTimestamp) {
      const date = new Date(blockTimestamp * 1000);
      parts.push(formatDate(date.toISOString()));
    }
    return { text: parts.join(' · '), url: explorerTxUrl };
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

  return (
    <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getTypeBadgeClass(entity.type)}`}>
              {entity.type}
            </span>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate">
              {entity.title || entity.key}
            </h3>
          </div>
          {entity.summary && (
            <p className="text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
              {entity.summary}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
            {entity.wallet && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {entity.wallet.slice(0, 10)}...
              </span>
            )}
            {entity.createdAt && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(entity.createdAt)}
              </span>
            )}
          </div>
          {provenance && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              {provenance.url ? (
                <a
                  href={provenance.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {provenance.text}
                </a>
              ) : (
                <span className="text-sm text-gray-600 dark:text-gray-400">{provenance.text}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          <Link
            href={`/explorer/${entity.type}/${entity.type === 'profile' ? entity.wallet : entity.key}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors shadow-sm hover:shadow-md"
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

