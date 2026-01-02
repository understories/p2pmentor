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
}

export function AllTransactionsList({
  spaceId,
  entityType = 'all',
  status = 'all',
  search = '',
}: AllTransactionsListProps) {
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filtered, setFiltered] = useState(false);

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

  if (transactions.length === 0) {
    return (
      <div className="py-8">
        <EmptyState
          icon="📋"
          title="No transactions found"
          description={
            search || entityType !== 'all' || status !== 'all'
              ? 'No transactions match your filters. Try adjusting your search or filters.'
              : 'No app-recorded transaction events found yet.'
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter note if status filtering is applied */}
      {filtered && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
          Status filtering is best-effort within page window. Results may be fewer than requested.
        </div>
      )}

      {/* Transaction Cards */}
      {transactions.map((tx) => {
        const entityLink = getEntityLink(tx);
        return (
          <div
            key={tx.txHash}
            className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Badges */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {getStatusBadge(tx.status)}
                  {getOperationBadge(tx.operation)}
                  {getEntityTypeBadge(tx.entityType)}
                </div>

                {/* Entity Context */}
                {(tx.entityLabel || tx.entityType) && (
                  <div className="mb-2">
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
                  </div>
                )}

                {/* Date and Block */}
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {formatDate(tx.blockTimestamp, tx.createdAt)}
                  {tx.blockNumber && (
                    <span className="ml-2">· Block {tx.blockNumber}</span>
                  )}
                  {tx.spaceId && (
                    <span className="ml-2">· Space: {tx.spaceId}</span>
                  )}
                </div>

                {/* Transaction Hash and Links */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-500">
                    {formatTxHash(tx.txHash)}
                  </span>
                  <ViewOnArkivLink
                    txHash={tx.txHash}
                    label="View on Arkiv"
                    className="text-xs"
                  />
                  {tx.wallet && (
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      · Wallet: {tx.wallet.slice(0, 6)}...{tx.wallet.slice(-4)}
                    </span>
                  )}
                </div>
              </div>
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

