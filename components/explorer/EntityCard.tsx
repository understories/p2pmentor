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

  return (
    <div className="p-4 border rounded-lg dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
              {entity.type}
            </span>
            <h3 className="font-semibold text-lg">{entity.title || entity.key}</h3>
          </div>
          {entity.summary && (
            <p className="text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
              {entity.summary}
            </p>
          )}
          <div className="text-sm text-gray-500 dark:text-gray-500">
            {entity.wallet && (
              <span className="mr-4">Wallet: {entity.wallet.slice(0, 10)}...</span>
            )}
            {entity.createdAt && (
              <span>Created: {formatDate(entity.createdAt)}</span>
            )}
          </div>
          {provenance && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {provenance.url ? (
                <a
                  href={provenance.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {provenance.text}
                </a>
              ) : (
                <span>{provenance.text}</span>
              )}
            </div>
          )}
        </div>
        <div className="ml-4">
          <Link
            href={`/explorer/${entity.type}/${entity.type === 'profile' ? entity.wallet : entity.key}`}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
}

