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
import { graphRequest } from '@/lib/graph/client';

interface AppFeedback {
  id: string;
  key: string;
  wallet: string;
  page: string;
  message: string;
  rating: number | null;
  createdAt: string;
  txHash: string | null;
}

export default function AdminFeedbackPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState<AppFeedback[]>([]);
  const [filterPage, setFilterPage] = useState('');
  const [filterSince, setFilterSince] = useState('');

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
  }, [authenticated, filterSince]);

  const loadFeedback = async () => {
    try {
      setLoading(true);
      const variables: Record<string, any> = {
        limit: 100,
      };

      if (filterSince) {
        variables.since = filterSince;
      }

      const query = `
        query AppFeedback($limit: Int, $since: String, $page: String) {
          appFeedback(limit: $limit, since: $since, page: $page) {
            id
            key
            wallet
            page
            message
            rating
            createdAt
            txHash
          }
        }
      `;

      if (filterPage) {
        variables.page = filterPage;
      }

      const data = await graphRequest<{ appFeedback: AppFeedback[] }>(
        query,
        variables,
        { operationName: 'AppFeedback' }
      );

      const feedbacks: AppFeedback[] = data.appFeedback || [];
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
                    <th className="px-4 py-2 text-left text-sm font-medium">Wallet</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Page</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Rating</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbacks.map((feedback) => (
                    <tr key={feedback.id} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2 text-sm">
                        {new Date(feedback.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-sm font-mono text-xs">
                        {feedback.wallet.slice(0, 10)}...
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
    </main>
  );
}

