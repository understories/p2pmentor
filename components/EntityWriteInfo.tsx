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

export function EntityWriteInfo({ entityKey, txHash, entityType, className = '' }: EntityWriteInfoProps) {
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
    <div className={`mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {entityType ? `${entityType} Entity` : 'Entity'} Created
      </div>
      
      <div className="space-y-2 text-xs">
        {/* Entity Key */}
        <div className="flex items-center gap-2">
          <span className="text-gray-600 dark:text-gray-400 font-medium min-w-[80px]">Entity Key:</span>
          <code className="flex-1 font-mono text-gray-800 dark:text-gray-200 break-all">
            {entityKey}
          </code>
          <button
            onClick={() => copyToClipboard(entityKey, setCopiedKey)}
            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
            title="Copy entity key"
          >
            {copiedKey ? '✓' : '📋'}
          </button>
        </div>

        {/* Transaction Hash */}
        <div className="flex items-center gap-2">
          <span className="text-gray-600 dark:text-gray-400 font-medium min-w-[80px]">Tx Hash:</span>
          <code className="flex-1 font-mono text-gray-800 dark:text-gray-200 break-all">
            {txHash}
          </code>
          <button
            onClick={() => copyToClipboard(txHash, setCopiedHash)}
            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
            title="Copy transaction hash"
          >
            {copiedHash ? '✓' : '📋'}
          </button>
        </div>

        {/* Explorer Link */}
        <div className="flex items-center gap-2 pt-1 border-t border-gray-200 dark:border-gray-700">
          <ViewOnArkivLink
            entityKey={entityKey}
            txHash={txHash}
            label="View on Arkiv Explorer"
            className="text-xs"
          />
          <span className="text-gray-500 dark:text-gray-400 text-xs italic">
            (may take time to appear)
          </span>
        </div>
      </div>
    </div>
  );
}

