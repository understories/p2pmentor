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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-200">
            Success
          </span>
        );
      case 'failed':
        return (
          <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-200">
            Failed
          </span>
        );
      case 'pending':
        return (
          <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
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
    const color =
      colors[entityType as keyof typeof colors] ||
      'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
    return <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>{entityType}</span>;
  };

  const getOperationBadge = (operation?: string) => {
    if (!operation) return null;
    return (
      <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
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
        <EmptyState icon="⚠️" title="Failed to load transactions" description={error} />
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
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 transition-all focus:border-blue-500 focus:shadow-sm focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="all">All Spaces</option>
            <option value="beta-launch">Beta Launch</option>
            <option value="local-dev">Local Dev</option>
            <option value="local-dev-seed">Local Dev Seed</option>
            <option value="nsfeb26">nsfeb26</option>
            <option value="nsjan26">nsjan26</option>
          </select>
        </div>
        <div className="py-8">
          <EmptyState
            icon="🔧"
            title="Human-legible transactions currently being implemented"
            description={
              search || entityType !== 'all' || status !== 'all' || spaceId !== 'all'
                ? 'No transactions match your filters. Try adjusting your search or filters. See raw blockchain data by clicking "View on Arkiv Explorer" above.'
                : 'Human-legible transactions currently being implemented. See raw blockchain data by clicking "View on Arkiv Explorer" above.'
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {arkivExplorerAddressUrl && (
          <a
            href={arkivExplorerAddressUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-800 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 dark:hover:text-blue-300"
          >
            🔗 Verify on Arkiv Explorer
          </a>
        )}
        <select
          value={spaceId}
          onChange={(e) => handleSpaceIdChange(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 transition-all focus:border-blue-500 focus:shadow-sm focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="all">All Spaces</option>
          <option value="beta-launch">Beta Launch</option>
          <option value="local-dev">Local Dev</option>
          <option value="local-dev-seed">Local Dev Seed</option>
          <option value="nsfeb26">nsfeb26</option>
          <option value="nsjan26">nsjan26</option>
        </select>
      </div>
      {/* Filter note if status filtering is applied */}
      {filtered && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
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
            className="rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
          >
            {/* Header: Status, Transaction Hash, Timestamp */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Badge */}
                {getStatusBadge(tx.status)}
                {/* Transaction Label */}
                <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-200">
                  Transaction
                </span>
                {/* Transaction Hash */}
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 dark:text-gray-500">↔</span>
                  <button
                    onClick={() => copyToClipboard(tx.txHash, 'transaction hash')}
                    className="font-mono text-sm text-gray-900 hover:text-blue-600 hover:underline dark:text-gray-100 dark:hover:text-blue-400"
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
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Block {tx.blockNumber}
                {tx.spaceId && <span className="ml-2">· Space: {tx.spaceId}</span>}
              </div>
            )}

            {/* From/To Addresses */}
            <div className="mb-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
              <div className="flex flex-wrap items-center gap-3">
                {/* From Address */}
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 flex-shrink-0 rounded-full bg-gradient-to-br from-red-400 to-blue-400" />
                  <button
                    onClick={() => copyToClipboard(CURRENT_WALLET || '', 'from address')}
                    className="font-mono text-sm text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
                    title="Click to copy"
                  >
                    {CURRENT_WALLET ? formatAddress(CURRENT_WALLET) : 'N/A'}
                  </button>
                </div>
                {/* Arrow */}
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-orange-500">
                  <span className="text-xs text-white">→</span>
                </div>
                {/* To Address (Arkiv Contract) */}
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 flex-shrink-0 rounded-full bg-gradient-to-br from-red-400 to-blue-400" />
                  <button
                    onClick={() => copyToClipboard(arkivContractAddress, 'to address')}
                    className="font-mono text-sm text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
                    title="Click to copy"
                  >
                    {formatAddress(arkivContractAddress)}
                  </button>
                  <button
                    onClick={() => copyToClipboard(arkivContractAddress, 'to address')}
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    title="Copy address"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="mb-4 space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <div>
                Value: <span className="font-medium text-gray-900 dark:text-gray-100">0 GLM</span>
              </div>
            </div>

            {/* Entity Context (p2pmentor-native) */}
            {(tx.entityLabel || tx.entityType) && (
              <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {getOperationBadge(tx.operation)}
                  {getEntityTypeBadge(tx.entityType)}
                </div>
                {entityLink ? (
                  <Link
                    href={entityLink}
                    className="font-semibold text-gray-900 hover:text-blue-600 hover:underline dark:text-gray-100 dark:hover:text-blue-400"
                  >
                    {tx.operation === 'create'
                      ? 'Created'
                      : tx.operation === 'update'
                        ? 'Updated'
                        : 'Wrote'}{' '}
                    {tx.entityType || 'entity'}
                    {tx.entityLabel
                      ? `: ${tx.entityLabel}`
                      : tx.entityKey
                        ? ` (${tx.entityKey.slice(0, 8)}...)`
                        : ''}
                  </Link>
                ) : (
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {tx.operation === 'create'
                      ? 'Created'
                      : tx.operation === 'update'
                        ? 'Updated'
                        : 'Wrote'}{' '}
                    {tx.entityType || 'entity'}
                    {tx.entityLabel
                      ? `: ${tx.entityLabel}`
                      : tx.entityKey
                        ? ` (${tx.entityKey.slice(0, 8)}...)`
                        : ''}
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
            <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
              <ViewOnArkivLink
                txHash={tx.txHash}
                label="View transaction on Arkiv Explorer"
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
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
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
