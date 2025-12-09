/**
 * Admin Feedback View
 * 
 * Displays app feedback from users (for builders/admin).
 * Separate from session feedback (peer-to-peer).
 * 
 * Reference: refs/docs/sprint2.md Section 4.1
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AppFeedback {
  id: string;
  key: string;
  wallet: string;
  page: string;
  message: string;
  rating: number | null;
  feedbackType: 'feedback' | 'issue';
  createdAt: string;
  txHash: string | null;
  resolved?: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}

export default function AdminFeedbackPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState<AppFeedback[]>([]);
  const [filterPage, setFilterPage] = useState('');
  const [filterSince, setFilterSince] = useState('');
  const [respondingTo, setRespondingTo] = useState<AppFeedback | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [resolvingFeedback, setResolvingFeedback] = useState<string | null>(null);

  useEffect(() => {
    // Check authentication
    if (typeof window !== 'undefined') {
      const isAuth = sessionStorage.getItem('admin_authenticated') === 'true';
      if (!isAuth) {
        router.push('/admin/login');
        return;
      }
      setAuthenticated(true);
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (authenticated) {
      loadFeedback();
    }
  }, [authenticated, filterSince, filterPage]);

  const loadFeedback = async () => {
    try {
      setLoading(true);
      const variables: Record<string, any> = {
        limit: 100,
      };

      if (filterSince) {
        variables.since = filterSince;
      }

      // Use REST API instead of GraphQL (GraphQL resolvers have compatibility issue)
      const params = new URLSearchParams();
      if (filterPage) params.set('page', filterPage);
      if (filterSince) params.set('since', filterSince);
      params.set('limit', String(variables.limit || 100));

      const res = await fetch(`/api/app-feedback?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch app feedback');
      }
      const data = await res.json();
      const feedbacks: AppFeedback[] = (data.feedbacks || []).map((f: any) => ({
        id: `app_feedback:${f.key}`,
        key: f.key,
        wallet: f.wallet,
        page: f.page,
        message: f.message,
        rating: f.rating || null,
        feedbackType: f.feedbackType || 'feedback',
        createdAt: f.createdAt,
        txHash: f.txHash || null,
        resolved: f.resolved || false,
        resolvedAt: f.resolvedAt,
        resolvedBy: f.resolvedBy,
      }));
      setFeedbacks(feedbacks);
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('admin_authenticated');
    }
    router.push('/admin/login');
  };

  const handleRespond = (feedback: AppFeedback) => {
    setRespondingTo(feedback);
    setResponseMessage('');
  };

  const handleSubmitResponse = async () => {
    if (!respondingTo || !responseMessage.trim()) {
      return;
    }

    setSubmittingResponse(true);
    try {
      // Get admin wallet from localStorage or use a default
      const adminWallet = typeof window !== 'undefined'
        ? localStorage.getItem('wallet_address') || 'admin'
        : 'admin';

      const res = await fetch('/api/admin/response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackKey: respondingTo.key,
          wallet: respondingTo.wallet,
          message: responseMessage.trim(),
          adminWallet,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit response');
      }

      // Close modal and refresh feedback list
      setRespondingTo(null);
      setResponseMessage('');
      loadFeedback();
    } catch (err: any) {
      console.error('Error submitting response:', err);
      alert(err.message || 'Failed to submit response');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleResolveFeedback = async (feedback: AppFeedback) => {
    if (feedback.resolved) {
      alert('This issue is already resolved');
      return;
    }

    if (!confirm(`Mark this ${feedback.feedbackType} as resolved?`)) {
      return;
    }

    setResolvingFeedback(feedback.key);
    try {
      const adminWallet = typeof window !== 'undefined'
        ? localStorage.getItem('wallet_address') || 'admin'
        : 'admin';

      const res = await fetch('/api/app-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolveFeedback',
          feedbackKey: feedback.key,
          resolvedByWallet: adminWallet,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resolve feedback');
      }

      alert('Issue marked as resolved!');
      loadFeedback();
    } catch (err: any) {
      console.error('Error resolving feedback:', err);
      alert(err.message || 'Failed to resolve feedback');
    } finally {
      setResolvingFeedback(null);
    }
  };

  if (loading && !authenticated) {
    return (
      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-8">
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
        </div>
      </main>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-8">
      <ThemeToggle />
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
              App Feedback
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              User feedback about the app (for builders/admin)
            </p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/admin"
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Page</label>
            <input
              type="text"
              value={filterPage}
              onChange={(e) => setFilterPage(e.target.value)}
              placeholder="e.g., /network, /me"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Since Date</label>
            <input
              type="date"
              value={filterSince}
              onChange={(e) => setFilterSince(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterPage('');
                setFilterSince('');
              }}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Feedback Table */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
          {feedbacks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">Date</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Type</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Wallet</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Page</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Rating</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Message</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Transaction</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbacks.map((feedback) => (
                    <tr key={feedback.id} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2 text-sm">
                        {new Date(feedback.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          feedback.feedbackType === 'issue'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {feedback.feedbackType === 'issue' ? '🐛 Issue' : '💬 Feedback'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm font-mono text-xs">
                        <a
                          href={`https://explorer.mendoza.hoodi.arkiv.network/address/${feedback.wallet}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                          title={feedback.wallet}
                        >
                          {feedback.wallet.slice(0, 10)}...{feedback.wallet.slice(-4)}
                        </a>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {feedback.page}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {feedback.rating ? (
                          <span className="text-yellow-500">
                            {'★'.repeat(feedback.rating)}{'☆'.repeat(5 - feedback.rating)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm max-w-md">
                        <div className="truncate" title={feedback.message}>
                          {feedback.message}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {feedback.resolved ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            ✓ Resolved
                            {feedback.resolvedAt && (
                              <span className="ml-1 text-xs opacity-75">
                                {new Date(feedback.resolvedAt).toLocaleDateString()}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                            ⏳ Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {feedback.txHash ? (
                          <a
                            href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${feedback.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs"
                            title={feedback.txHash}
                          >
                            {feedback.txHash.slice(0, 8)}...{feedback.txHash.slice(-6)}
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <div className="flex gap-2">
                          {feedback.feedbackType === 'issue' && !feedback.resolved && (
                            <button
                              onClick={() => handleResolveFeedback(feedback)}
                              disabled={resolvingFeedback === feedback.key}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors disabled:opacity-50"
                            >
                              {resolvingFeedback === feedback.key ? 'Resolving...' : 'Mark Resolved'}
                            </button>
                          )}
                          <button
                            onClick={() => handleRespond(feedback)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                          >
                            Respond
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-gray-600 dark:text-gray-400">
              {loading ? 'Loading feedback...' : 'No feedback found.'}
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {feedbacks.length} feedback entries
        </div>
      </div>

      {/* Response Modal */}
      {respondingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Respond to Feedback
              </h2>
              <button
                onClick={() => {
                  setRespondingTo(null);
                  setResponseMessage('');
                }}
                disabled={submittingResponse}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                <strong>Original Feedback:</strong>
              </p>
              <p className="text-gray-900 dark:text-gray-100">{respondingTo.message}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                From: {respondingTo.wallet.slice(0, 10)}...{respondingTo.wallet.slice(-4)} |
                Page: {respondingTo.page} |
                {respondingTo.feedbackType === 'issue' ? ' 🐛 Issue' : ' 💬 Feedback'}
              </p>
            </div>

            <div className="mb-4">
              <label htmlFor="response" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Response <span className="text-red-500">*</span>
              </label>
              <textarea
                id="response"
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Type your response to the user here..."
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setRespondingTo(null);
                  setResponseMessage('');
                }}
                disabled={submittingResponse}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitResponse}
                disabled={submittingResponse || !responseMessage.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingResponse ? 'Submitting...' : 'Send Response'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

