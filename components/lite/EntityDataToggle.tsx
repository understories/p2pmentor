/**
 * Entity Data Toggle Component
 *
 * Toggleable component that displays transaction and entity data for lite asks/offers.
 * Shows entity key, transaction hash, and "View on Arkiv" links for both.
 *
 * Part of lite version implementation - always visible (not builder-mode only).
 */

'use client';

import { useState } from 'react';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { getArkivExplorerTxUrl, getArkivExplorerEntityUrl } from '@/lib/arkiv/explorer';

interface EntityDataToggleProps {
  entityKey: string;
  txHash: string | undefined;
  className?: string;
}

export function EntityDataToggle({ entityKey, txHash, className = '' }: EntityDataToggleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  const copyToClipboard = async (text: string, setCopied: (value: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={className}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center gap-1 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        title="Toggle transaction and entity data"
        aria-label="Toggle transaction and entity data"
      >
        <span>🔗</span>
      </button>

      {isExpanded && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-900">
          <div className="space-y-2">
            {/* Entity Key */}
            <div className="flex items-center gap-2">
              <span className="min-w-[80px] font-medium text-gray-600 dark:text-gray-400">
                Entity Key:
              </span>
              <code className="flex-1 break-all font-mono text-gray-800 dark:text-gray-200">
                {entityKey}
              </code>
              <button
                onClick={() => copyToClipboard(entityKey, setCopiedKey)}
                className="rounded bg-gray-200 px-2 py-1 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                title="Copy entity key"
              >
                {copiedKey ? '✓' : '📋'}
              </button>
            </div>

            {/* Transaction Hash */}
            {txHash && txHash !== 'undefined' && (
              <div className="flex items-center gap-2">
                <span className="min-w-[80px] font-medium text-gray-600 dark:text-gray-400">
                  Tx Hash:
                </span>
                <code className="flex-1 break-all font-mono text-gray-800 dark:text-gray-200">
                  {txHash}
                </code>
                <button
                  onClick={() => copyToClipboard(txHash, setCopiedHash)}
                  className="rounded bg-gray-200 px-2 py-1 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                  title="Copy transaction hash"
                >
                  {copiedHash ? '✓' : '📋'}
                </button>
              </div>
            )}

            {/* Explorer Links */}
            <div className="flex items-center gap-3 border-t border-gray-200 pt-2 dark:border-gray-700">
              <ViewOnArkivLink
                entityKey={entityKey}
                label="View Entity"
                className="text-xs"
                icon="🔗"
              />
              {txHash && txHash !== 'undefined' && (
                <a
                  href={getArkivExplorerTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-green-600 hover:underline dark:text-green-400"
                  title="View transaction on Arkiv Explorer"
                >
                  <span>🔗</span>
                  <span>View Transaction</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
