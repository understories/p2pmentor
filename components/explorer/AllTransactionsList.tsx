/**
 * All Transactions List Component
 *
 * Displays all app-recorded transaction events across all entities.
 * Shows transactions in human-legible format with entity context.
 *
 * NOTE: This shows "app-recorded transaction events" (txhash log),
 * NOT all chain transactions.
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { CURRENT_WALLET } from '@/lib/config';

export interface TransactionHistoryItem {
  txHash: string;
  blockNumber: string | null;
  blockTimestamp: number | null;
  status: 'success' | 'failed' | 'pending' | null;
  explorerTxUrl: string;
  explorerEntityUrl: string | null;
  createdAt: string;
  operation?: 'create' | 'update';
  // Additional context from tx_event entity
  entityType?: 'profile' | 'ask' | 'offer' | 'skill';
  entityKey?: string;
  entityLabel?: string;
  wallet?: string;
  spaceId?: string;
}

interface AllTransactionsListProps {
  spaceId?: string;
  entityType?: 'profile' | 'ask' | 'offer' | 'skill' | 'all';
  status?: 'success' | 'failed' | 'pending' | 'all';
  search?: string;
  onSpaceIdChange?: (spaceId: string) => void;
}

export function AllTransactionsList({
  spaceId: propSpaceId,
  entityType = 'all',
  status = 'all',
  search = '',
  onSpaceIdChange,
}: AllTransactionsListProps) {
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filtered, setFiltered] = useState(false);
  const [spaceId, setSpaceId] = useState<string>(propSpaceId || 'all');

  const fetchTransactions = async (cursor?: string | null, reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: '50',
      });
      if (spaceId && spaceId !== 'all') {
        params.set('spaceId', spaceId);
      }
      if (entityType && entityType !== 'all') {
        params.set('type', entityType);
      }
      if (status && status !== 'all') {
        params.set('status', status);
      }
      if (search) {
        params.set('q', search);
      }
      if (cursor) {
        params.set('cursor', cursor);
      }

      const res = await fetch(`/api/explorer/transactions?${params}`);
      const data = await res.json();

      if (data.ok) {
        if (reset) {
          setTransactions(data.transactions || []);
        } else {
          setTransactions((prev) => [...prev, ...(data.transactions || [])]);
        }
        setNextCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
        setFiltered(data.filtered || false);
      } else {
        setError(data.error || 'Failed to fetch transactions');
      }
    } catch (err) {
      setError('Failed to fetch transactions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Sync with prop if provided
  useEffect(() => {
    if (propSpaceId !== undefined) {
      setSpaceId(propSpaceId);
    }
  }, [propSpaceId]);

  const handleSpaceIdChange = (newSpaceId: string) => {
    setSpaceId(newSpaceId);
    if (onSpaceIdChange) {
      onSpaceIdChange(newSpaceId);
    }
  };

  useEffect(() => {
    fetchTransactions(null, true);
  }, [spaceId, entityType, status, search]);

  const loadMore = () => {
    if (nextCursor && !loading) {
      fetchTransactions(nextCursor, false);
    }
  };

  const formatDate = (timestamp: number | null, createdAt: string) => {
    if (timestamp) {
      const date = new Date(timestamp * 1000);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      // Use relative time for recent transactions
      if (diffHours < 24) {
        if (diffHours < 1) {
          const diffMins = Math.floor(diffMs / (1000 * 60));
          return diffMins < 1 ? 'Just now' : `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        }
        return `${Math.floor(diffHours)} hour${Math.floor(diffHours) > 1 ? 's' : ''} ago`;
      } else if (diffDays < 7) {
        return `${Math.floor(diffDays)} day${Math.floor(diffDays) > 1 ? 's' : ''} ago`;
      }

      // Use absolute date for older transactions
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }

    // Fallback to createdAt if no timestamp
    try {
      return new Date(createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return createdAt;
    }
  };

  const formatTxHash = (txHash: string) => {
    return `${txHash.slice(0, 6)}...${txHash.slice(-4)}`;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add toast notification here if needed
    } catch (err) {
      console.error(`Failed to copy ${label}:`, err);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'success':
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
            Success
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded">
            Failed
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded">
            Pending
          </span>
        );
      default:
        return null;
    }
  };

  const getEntityTypeBadge = (entityType?: string) => {
    if (!entityType) return null;
    const colors = {
      profile: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
      ask: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200',
      offer: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
      skill: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200',
    };
    const color = colors[entityType as keyof typeof colors] || 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${color}`}>
        {entityType}
      </span>
    );
  };

  const getOperationBadge = (operation?: string) => {
    if (!operation) return null;
    return (
      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded">
        {operation === 'create' ? 'Created' : operation === 'update' ? 'Updated' : 'Write'}
      </span>
    );
  };

  const getEntityLink = (tx: TransactionHistoryItem) => {
    if (!tx.entityType || !tx.entityKey) return null;
    if (tx.entityType === 'profile' && tx.wallet) {
      return `/explorer/profile/${tx.wallet}`;
    }
    return `/explorer/${tx.entityType}/${tx.entityKey}`;
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="py-8">
        <LoadingSpinner text="Loading transactions..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8">
        <EmptyState
          icon="⚠️"
          title="Failed to load transactions"
          description={error}
        />
      </div>
    );
  }

  if (transactions.length === 0 && !loading) {
    return (
      <div className="space-y-4">
        {/* SpaceId Filter */}
        <div className="mb-6 flex justify-end">
          <select
            value={spaceId}
            onChange={(e) => handleSpaceIdChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-sm transition-all"
          >
            <option value="all">All Spaces</option>
            <option value="beta-launch">Beta Launch</option>
            <option value="local-dev">Local Dev</option>
            <option value="local-dev-seed">Local Dev Seed</option>
            <option value="nsjan26">nsjan26</option>
          </select>
        </div>
        <div className="py-8">
          <EmptyState
            icon="📋"
            title="No transactions found"
            description={
              search || entityType !== 'all' || status !== 'all' || spaceId !== 'all'
              ? 'No transactions match your filters. Try adjusting your search or filters.'
              : 'No app-recorded transaction events found yet.'
            }
          />
        </div>
      </div>
    );
  }

  // Build Arkiv explorer address URL
  const arkivExplorerAddressUrl = CURRENT_WALLET
    ? `https://explorer.mendoza.hoodi.arkiv.network/address/${CURRENT_WALLET}?tab=txs`
    : null;

  return (
    <div className="space-y-4">
      {/* Header with Arkiv Explorer Link and SpaceId Filter */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        {arkivExplorerAddressUrl && (
          <a
            href={arkivExplorerAddressUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-700 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            🔗 Verify on Arkiv Explorer
          </a>
        )}
        <select
          value={spaceId}
          onChange={(e) => handleSpaceIdChange(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-sm transition-all"
        >
          <option value="all">All Spaces</option>
          <option value="beta-launch">Beta Launch</option>
          <option value="local-dev">Local Dev</option>
          <option value="local-dev-seed">Local Dev Seed</option>
          <option value="nsjan26">nsjan26</option>
        </select>
      </div>
      {/* Filter note if status filtering is applied */}
      {filtered && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
          Status filtering is best-effort within page window. Results may be fewer than requested.
        </div>
      )}

      {/* Transaction Cards - Human-Legible Format (Inspired by Arkiv Explorer) */}
      {transactions.map((tx) => {
        const entityLink = getEntityLink(tx);
        // Arkiv contract address (standard for entity writes)
        const arkivContractAddress = '0x0000000000000000000000000000000000006976';
        
        return (
          <div
            key={tx.txHash}
            className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
          >
            {/* Header: Status, Transaction Hash, Timestamp */}
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Badge */}
                {getStatusBadge(tx.status)}
                {/* Transaction Label */}
                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded">
                  Transaction
                </span>
                {/* Transaction Hash */}
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 dark:text-gray-500">↔</span>
                  <button
                    onClick={() => copyToClipboard(tx.txHash, 'transaction hash')}
                    className="text-sm font-mono text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                    title="Click to copy"
                  >
                    {formatTxHash(tx.txHash)}
                  </button>
                </div>
              </div>
              {/* Timestamp */}
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {formatDate(tx.blockTimestamp, tx.createdAt)}
              </div>
            </div>

            {/* Block Information */}
            {tx.blockNumber && (
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Block {tx.blockNumber}
                {tx.spaceId && (
                  <span className="ml-2">· Space: {tx.spaceId}</span>
                )}
              </div>
            )}

            {/* From/To Addresses */}
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <div className="flex items-center gap-3 flex-wrap">
                {/* From Address */}
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-400 to-blue-400 flex-shrink-0" />
                  <button
                    onClick={() => copyToClipboard(CURRENT_WALLET || '', 'from address')}
                    className="text-sm font-mono text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                    title="Click to copy"
                  >
                    {CURRENT_WALLET ? formatAddress(CURRENT_WALLET) : 'N/A'}
                  </button>
                </div>
                {/* Arrow */}
                <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs">→</span>
                </div>
                {/* To Address (Arkiv Contract) */}
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-400 to-blue-400 flex-shrink-0" />
                  <button
                    onClick={() => copyToClipboard(arkivContractAddress, 'to address')}
                    className="text-sm font-mono text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                    title="Click to copy"
                  >
                    {formatAddress(arkivContractAddress)}
                  </button>
                  <button
                    onClick={() => copyToClipboard(arkivContractAddress, 'to address')}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Copy address"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <div>Value: <span className="font-medium text-gray-900 dark:text-gray-100">0 GLM</span></div>
            </div>

            {/* Entity Context (p2pmentor-native) */}
            {(tx.entityLabel || tx.entityType) && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {getOperationBadge(tx.operation)}
                  {getEntityTypeBadge(tx.entityType)}
                </div>
                {entityLink ? (
                  <Link
                    href={entityLink}
                    className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                  >
                    {tx.operation === 'create' ? 'Created' : tx.operation === 'update' ? 'Updated' : 'Wrote'} {tx.entityType || 'entity'}{tx.entityLabel ? `: ${tx.entityLabel}` : tx.entityKey ? ` (${tx.entityKey.slice(0, 8)}...)` : ''}
                  </Link>
                ) : (
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {tx.operation === 'create' ? 'Created' : tx.operation === 'update' ? 'Updated' : 'Wrote'} {tx.entityType || 'entity'}{tx.entityLabel ? `: ${tx.entityLabel}` : tx.entityKey ? ` (${tx.entityKey.slice(0, 8)}...)` : ''}
                  </span>
                )}
                {tx.wallet && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                    Entity owner: {formatAddress(tx.wallet)}
                  </div>
                )}
              </div>
            )}

            {/* View on Arkiv Link */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <ViewOnArkivLink
                txHash={tx.txHash}
                label="View transaction on Arkiv Explorer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              />
            </div>
          </div>
        );
      })}

      {/* Load More */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}

