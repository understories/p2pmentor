/**
 * User Issues Page
 *
 * Displays issues reported by the user with their resolution status.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';

interface UserIssue {
  key: string;
  page: string;
  message: string;
  createdAt: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  hasResponse?: boolean;
  responseAt?: string;
  txHash?: string;
}

export default function UserIssuesPage() {
  const router = useRouter();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [issues, setIssues] = useState<UserIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (!address) {
        router.push('/auth');
        return;
      }
      setWalletAddress(address);
      loadIssues(address);
    }
  }, [router]);

  const loadIssues = async (wallet: string) => {
    try {
      setLoading(true);
      setError('');

      const res = await fetch(
        `/api/app-feedback?wallet=${encodeURIComponent(wallet)}&feedbackType=issue`
      );
      if (!res.ok) {
        throw new Error('Failed to fetch issues');
      }

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to load issues');
      }

      const issuesList: UserIssue[] = (data.feedbacks || []).map((f: any) => ({
        key: f.key,
        page: f.page,
        message: f.message,
        createdAt: f.createdAt,
        resolved: f.resolved || false,
        resolvedAt: f.resolvedAt,
        resolvedBy: f.resolvedBy,
        hasResponse: f.hasResponse || false,
        responseAt: f.responseAt,
        txHash: f.txHash,
      }));

      setIssues(issuesList);
    } catch (err: any) {
      console.error('Error loading issues:', err);
      setError(err.message || 'Failed to load issues');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (!walletAddress) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-gray-900 dark:text-gray-100">
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <BackButton href="/me" />
          </div>
          <PageHeader title="My Issues" />
          <LoadingSpinner text="Loading issues..." className="py-12" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <BackButton href="/me" />
          </div>
          <PageHeader title="My Issues" />
          <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>

        <PageHeader
          title="My Issues"
          description="View and track the status of issues you've reported"
        />

        {issues.length === 0 ? (
          <EmptyState
            title="No issues reported"
            description="Issues you report will appear here with their resolution status."
            icon={
              <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
          />
        ) : (
          <div className="space-y-4">
            {issues.map((issue) => (
              <div
                key={issue.key}
                className={`rounded-lg border p-6 ${
                  issue.resolved
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10'
                    : issue.hasResponse
                      ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/10'
                      : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/10'
                }`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {issue.page}
                      </span>
                      {issue.resolved ? (
                        <span className="inline-flex items-center rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          ✓ Resolved
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                          ⏳ Pending
                        </span>
                      )}
                      {issue.hasResponse && (
                        <span className="inline-flex items-center rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          ✓ Responded
                        </span>
                      )}
                    </div>
                    <p className="mb-2 text-gray-700 dark:text-gray-300">{issue.message}</p>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Reported: {formatDate(issue.createdAt)}
                      {issue.hasResponse && issue.responseAt && (
                        <span className="ml-4">Responded: {formatDate(issue.responseAt)}</span>
                      )}
                      {issue.resolved && issue.resolvedAt && (
                        <span className="ml-4">Resolved: {formatDate(issue.resolvedAt)}</span>
                      )}
                    </div>
                  </div>
                </div>
                {issue.txHash && (
                  <div className="mt-2 text-xs">
                    <a
                      href={`https://explorer.kaolin.hoodi.arkiv.network/tx/${issue.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View transaction: {issue.txHash.slice(0, 10)}...{issue.txHash.slice(-6)}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
