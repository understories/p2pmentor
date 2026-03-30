/**
 * Transaction List Component
 *
 * Displays a list of transactions in human-legible format.
 */

'use client';

import React from 'react';
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
}

interface TransactionListProps {
  type: string;
  id: string;
}

export function TransactionList({ type, id }: TransactionListProps) {
  const [transactions, setTransactions] = React.useState<TransactionHistoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = `/api/explorer/${type}/${encodeURIComponent(id)}/transactions`;
        const res = await fetch(endpoint);
        const data = await res.json();

        if (data.ok) {
          setTransactions(data.transactions || []);
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

    fetchTransactions();
  }, [type, id]);

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

  if (loading) {
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

  if (transactions.length === 0) {
    return (
      <div className="py-8">
        <EmptyState
          icon="📋"
          title="No transactions found"
          description="This entity doesn't have any transaction history yet."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {transactions.map((tx, index) => (
        <div
          key={tx.txHash}
          className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2">
                {getStatusBadge(tx.status)}
                {tx.operation && (
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                    {tx.operation === 'create' ? 'Created' : 'Updated'}
                  </span>
                )}
              </div>
              <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                {formatDate(tx.blockTimestamp, tx.createdAt)}
                {tx.blockNumber && <span className="ml-2">· Block {tx.blockNumber}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-gray-500 dark:text-gray-500">
                  {formatTxHash(tx.txHash)}
                </span>
                <ViewOnArkivLink txHash={tx.txHash} label="View on Arkiv" className="text-xs" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
