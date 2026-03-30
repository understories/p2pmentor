/**
 * Entity Write Info Component
 *
 * Displays entity_key and txHash immediately after a write operation in builder mode.
 * Includes copy buttons for easy debugging and verification.
 *
 * Part of U1.x.1: Explorer Independence + Engineering Hooks
 */

'use client';

import { useState } from 'react';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ViewOnArkivLink } from './ViewOnArkivLink';

interface EntityWriteInfoProps {
  entityKey: string;
  txHash: string;
  entityType?: string;
  className?: string;
}

export function EntityWriteInfo({
  entityKey,
  txHash,
  entityType,
  className = '',
}: EntityWriteInfoProps) {
  const arkivBuilderMode = useArkivBuilderMode();
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  if (!arkivBuilderMode) {
    return null;
  }

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
    <div
      className={`mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900 ${className}`}
    >
      <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
        {entityType ? `${entityType} Entity` : 'Entity'} Created
      </div>

      <div className="space-y-2 text-xs">
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
            className="rounded bg-gray-200 px-2 py-1 text-xs transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Copy entity key"
          >
            {copiedKey ? '✓' : '📋'}
          </button>
        </div>

        {/* Transaction Hash */}
        <div className="flex items-center gap-2">
          <span className="min-w-[80px] font-medium text-gray-600 dark:text-gray-400">
            Tx Hash:
          </span>
          <code className="flex-1 break-all font-mono text-gray-800 dark:text-gray-200">
            {txHash}
          </code>
          <button
            onClick={() => copyToClipboard(txHash, setCopiedHash)}
            className="rounded bg-gray-200 px-2 py-1 text-xs transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Copy transaction hash"
          >
            {copiedHash ? '✓' : '📋'}
          </button>
        </div>

        {/* Explorer Link */}
        <div className="flex items-center gap-2 border-t border-gray-200 pt-1 dark:border-gray-700">
          <ViewOnArkivLink
            entityKey={entityKey}
            txHash={txHash}
            label="View on Arkiv Explorer"
            className="text-xs"
          />
          <span className="text-xs italic text-gray-500 dark:text-gray-400">
            (may take time to appear)
          </span>
        </div>
      </div>
    </div>
  );
}
