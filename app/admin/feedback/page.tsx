/**
 * Admin Feedback View
 * 
 * ⚠️ NOTE: This currently shows SESSION feedback (peer-to-peer).
 * 
 * TODO: Create separate APP feedback system for user feedback to builders/admin.
 * Session feedback should remain separate - this is for peer reviews.
 * 
 * Reference: refs/docs/sprint2.md Section 4.1
 * See: refs/docs/feedback_system_analysis.md for separation requirements
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { graphRequest } from '@/lib/graph/client';

interface Feedback {
  id: string;
  key: string;
  sessionKey: string;
  mentorWallet: string;
  learnerWallet: string;
  feedbackFrom: string;
  feedbackTo: string;
  rating: number | null;
  notes: string | null;
  technicalDxFeedback: string | null;
  createdAt: string;
  txHash: string | null;
}

export default function AdminFeedbackPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
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
        query Feedback($limit: Int, $since: String) {
          feedback(limit: $limit, since: $since) {
            id
            key
            sessionKey
            mentorWallet
            learnerWallet
            feedbackFrom
            feedbackTo
            rating
            notes
            technicalDxFeedback
            createdAt
            txHash
          }
        }
      `;

      const data = await graphRequest<{ feedback: Feedback[] }>(
        query,
        variables,
        { operationName: 'Feedback' }
      );

      const feedbacks: Feedback[] = data.feedback || [];
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
              Session Feedback
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Peer-to-peer feedback from sessions (for reference)
            </p>
            <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ Note: This shows session feedback. App feedback system (for builders/admin) needs to be implemented separately.
            </div>
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
              onClick={() => setFilterSince('')}
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
                    <th className="px-4 py-2 text-left text-sm font-medium">From</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">To</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Rating</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Notes</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Session</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbacks.map((feedback) => (
                    <tr key={feedback.id} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2 text-sm">
                        {new Date(feedback.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-sm font-mono text-xs">
                        {feedback.feedbackFrom.slice(0, 10)}...
                      </td>
                      <td className="px-4 py-2 text-sm font-mono text-xs">
                        {feedback.feedbackTo.slice(0, 10)}...
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
                      <td className="px-4 py-2 text-sm max-w-xs truncate">
                        {feedback.notes || feedback.technicalDxFeedback || '—'}
                      </td>
                      <td className="px-4 py-2 text-sm font-mono text-xs">
                        {feedback.sessionKey.slice(0, 10)}...
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

