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
  hasResponse?: boolean;
  responseAt?: string;
}

export default function AdminFeedbackPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState<AppFeedback[]>([]);
  const [allFeedbacks, setAllFeedbacks] = useState<AppFeedback[]>([]);
  const [filterPage, setFilterPage] = useState('');
  const [filterSince, setFilterSince] = useState('');
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'pending' | 'resolved' | 'responded' | 'waiting'
  >('all');
  const [filterType, setFilterType] = useState<'all' | 'feedback' | 'issue'>('all');
  const [filterRating, setFilterRating] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [respondingTo, setRespondingTo] = useState<AppFeedback | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [resolvingFeedback, setResolvingFeedback] = useState<string | null>(null);
  const [viewingResponse, setViewingResponse] = useState<{
    message: string;
    createdAt: string;
    adminWallet: string;
  } | null>(null);
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [creatingGitHubIssue, setCreatingGitHubIssue] = useState<string | null>(null);
  const [githubIssueLinks, setGithubIssueLinks] = useState<
    Record<string, { issueNumber: number; issueUrl: string }>
  >({});
  const [resolvingIssue, setResolvingIssue] = useState<AppFeedback | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

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
      loadGitHubIssueLinks();
    }
  }, [authenticated, filterSince, filterPage]);

  // Apply client-side filters
  useEffect(() => {
    let filtered = [...allFeedbacks];

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter((f) => {
        if (filterStatus === 'pending') {
          // Pending: issues that are not resolved
          return f.feedbackType === 'issue' && !f.resolved;
        }
        if (filterStatus === 'resolved') {
          // Resolved: any feedback/issue that has been resolved
          return f.resolved === true;
        }
        if (filterStatus === 'responded') {
          // Responded: any feedback that has an admin response
          return f.hasResponse === true;
        }
        if (filterStatus === 'waiting') {
          // Waiting: any feedback without an admin response
          return !f.hasResponse;
        }
        return true;
      });
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter((f) => f.feedbackType === filterType);
    }

    // Rating filter
    if (filterRating !== 'all') {
      filtered = filtered.filter((f) => f.rating === parseInt(filterRating));
    }

    setFeedbacks(filtered);
  }, [allFeedbacks, filterStatus, filterType, filterRating]);

  // Truncate profile paths since wallet is already shown in Wallet column
  const formatPagePath = (page: string): string => {
    // Match /profiles/0x... pattern
    const profileMatch = page.match(/^\/profiles\/(0x[a-fA-F0-9]+)/);
    if (profileMatch) {
      return '/profiles/0x****...';
    }
    return page;
  };

  const loadGitHubIssueLinks = async () => {
    try {
      const res = await fetch('/api/github/issue-links');
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.links) {
          const linksMap: Record<string, { issueNumber: number; issueUrl: string }> = {};
          data.links.forEach((link: any) => {
            linksMap[link.feedbackKey] = {
              issueNumber: link.issueNumber,
              issueUrl: link.issueUrl,
            };
          });
          setGithubIssueLinks(linksMap);
        }
      }
    } catch (err) {
      console.error('Error loading GitHub issue links:', err);
    }
  };

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
        resolved: f.resolved === true, // Explicit boolean check
        resolvedAt: f.resolvedAt,
        resolvedBy: f.resolvedBy,
        hasResponse: f.hasResponse === true, // Explicit boolean check
        responseAt: f.responseAt,
      }));
      setAllFeedbacks(feedbacks); // Set allFeedbacks for client-side filtering
      // Initial display (will be filtered by useEffect)
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

  const handleRespond = async (feedback: AppFeedback) => {
    // If there's already a response, fetch and display it
    if (feedback.hasResponse) {
      setLoadingResponse(true);
      try {
        const res = await fetch(
          `/api/admin/response?feedbackKey=${encodeURIComponent(feedback.key)}`
        );
        const data = await res.json();
        if (data.ok && data.responses && data.responses.length > 0) {
          // Get the most recent response
          const latestResponse = data.responses[0];
          setViewingResponse({
            message: latestResponse.message,
            createdAt: latestResponse.createdAt,
            adminWallet: latestResponse.adminWallet,
          });
          setRespondingTo(feedback);
        } else {
          // Response not found, allow creating new one
          setViewingResponse(null);
          setRespondingTo(feedback);
          setResponseMessage('');
        }
      } catch (err) {
        console.error('Error loading response:', err);
        // On error, allow creating new response
        setViewingResponse(null);
        setRespondingTo(feedback);
        setResponseMessage('');
      } finally {
        setLoadingResponse(false);
      }
    } else {
      // No response yet, open form to create one
      setViewingResponse(null);
      setRespondingTo(feedback);
      setResponseMessage('');
    }
  };

  const handleSubmitResponse = async () => {
    if (!respondingTo || !responseMessage.trim()) {
      return;
    }

    setSubmittingResponse(true);
    try {
      // Get admin wallet from localStorage or use a default
      const adminWallet =
        typeof window !== 'undefined' ? localStorage.getItem('wallet_address') || 'admin' : 'admin';

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const res = await fetch('/api/admin/response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackKey: respondingTo.key,
          wallet: respondingTo.wallet,
          message: responseMessage.trim(),
          adminWallet,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit response');
      }

      // Close modal and refresh feedback list
      setRespondingTo(null);
      setResponseMessage('');
      setViewingResponse(null);
      loadFeedback();
    } catch (err: any) {
      console.error('Error submitting response:', err);
      if (err.name === 'AbortError') {
        alert(
          'Request timed out. The response may have been submitted. Please refresh the page to check.'
        );
      } else {
        alert(err.message || 'Failed to submit response');
      }
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleCreateGitHubIssue = async (feedback: AppFeedback) => {
    if (!confirm('Create a GitHub issue from this feedback?')) {
      return;
    }

    setCreatingGitHubIssue(feedback.key);
    try {
      const res = await fetch('/api/github/create-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackKey: feedback.key,
          page: feedback.page,
          message: feedback.message,
          rating: feedback.rating,
          feedbackType: feedback.feedbackType,
          wallet: feedback.wallet,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create GitHub issue');
      }

      // Update local state
      setGithubIssueLinks((prev) => ({
        ...prev,
        [feedback.key]: {
          issueNumber: data.issueNumber,
          issueUrl: data.issueUrl,
        },
      }));

      alert(`GitHub issue #${data.issueNumber} created!`);
    } catch (err: any) {
      console.error('Error creating GitHub issue:', err);
      alert(err.message || 'Failed to create GitHub issue');
    } finally {
      setCreatingGitHubIssue(null);
    }
  };

  const handleResolveFeedback = async (feedback: AppFeedback) => {
    console.log('[handleResolveFeedback] Called for feedback:', feedback.key);
    if (feedback.resolved) {
      console.log('[handleResolveFeedback] Feedback already resolved');
      alert('This issue is already resolved');
      return;
    }

    console.log('[handleResolveFeedback] Opening resolution modal');
    // Open resolution modal
    setResolvingIssue(feedback);
    setResolutionNote('');
  };

  const confirmResolveFeedback = async () => {
    if (!resolvingIssue) {
      console.log('[confirmResolveFeedback] No resolvingIssue set');
      return;
    }

    console.log('[confirmResolveFeedback] Starting resolution for issue:', resolvingIssue.key);
    setResolvingFeedback(resolvingIssue.key);
    try {
      const adminWallet =
        typeof window !== 'undefined' ? localStorage.getItem('wallet_address') || 'admin' : 'admin';

      console.log('[confirmResolveFeedback] Admin wallet:', adminWallet);

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      // Resolve on Arkiv
      console.log('[confirmResolveFeedback] Calling /api/app-feedback to resolve on Arkiv...');
      const res = await fetch('/api/app-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolveFeedback',
          feedbackKey: resolvingIssue.key,
          resolvedByWallet: adminWallet,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('[confirmResolveFeedback] Arkiv resolution response status:', res.status);
      const data = await res.json();
      console.log('[confirmResolveFeedback] Arkiv resolution response data:', data);

      if (!res.ok) {
        throw new Error(data.error || 'Failed to resolve feedback');
      }

      console.log(
        '[confirmResolveFeedback] Arkiv resolution successful. Resolution key:',
        data.key,
        'txHash:',
        data.txHash
      );

      // Also close GitHub issue if it exists
      const issueLink = githubIssueLinks[resolvingIssue.key];
      console.log('[confirmResolveFeedback] Checking for GitHub issue link:', issueLink);

      if (issueLink) {
        console.log(
          '[confirmResolveFeedback] Found GitHub issue link. Issue #:',
          issueLink.issueNumber
        );
        try {
          const githubController = new AbortController();
          const githubTimeoutId = setTimeout(() => githubController.abort(), 30000); // 30 second timeout for GitHub

          const githubPayload = {
            issueNumber: issueLink.issueNumber,
            resolutionNote: resolutionNote.trim() || undefined,
            resolutionKey: data.key,
            txHash: data.txHash,
          };
          console.log(
            '[confirmResolveFeedback] Calling /api/github/close-issue with payload:',
            githubPayload
          );

          const githubRes = await fetch('/api/github/close-issue', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(githubPayload),
            signal: githubController.signal,
          });

          clearTimeout(githubTimeoutId);

          console.log(
            '[confirmResolveFeedback] GitHub close-issue response status:',
            githubRes.status
          );
          const githubData = await githubRes.json();
          console.log('[confirmResolveFeedback] GitHub close-issue response data:', githubData);

          if (!githubRes.ok) {
            console.error(
              '[confirmResolveFeedback] Failed to close GitHub issue:',
              githubData.error
            );
            // Continue anyway - Arkiv resolution is more important
          } else {
            console.log('[confirmResolveFeedback] GitHub issue closed successfully!');
          }
        } catch (githubErr: any) {
          console.error('[confirmResolveFeedback] Error closing GitHub issue:', githubErr);
          if (githubErr.name === 'AbortError') {
            console.warn(
              '[confirmResolveFeedback] GitHub close-issue request timed out, but Arkiv resolution succeeded'
            );
          } else {
            console.warn('[confirmResolveFeedback] Error closing GitHub issue:', githubErr);
          }
          // Continue anyway - Arkiv resolution succeeded
        }
      } else {
        console.log(
          '[confirmResolveFeedback] No GitHub issue link found for this feedback - resolution completed on Arkiv only'
        );
      }

      // Success message - Arkiv resolution is always the primary action
      const successMessage = issueLink
        ? 'Issue marked as resolved on Arkiv and GitHub issue closed!'
        : 'Issue marked as resolved on Arkiv!';

      console.log('[confirmResolveFeedback] ✅ Resolution completed successfully:', successMessage);
      alert(successMessage);
      setResolvingIssue(null);
      setResolutionNote('');
      loadFeedback();
    } catch (err: any) {
      console.error('[confirmResolveFeedback] Error resolving feedback:', err);
      if (err.name === 'AbortError') {
        alert(
          'Request timed out. The issue may have been resolved. Please refresh the page to check.'
        );
      } else {
        alert(err.message || 'Failed to resolve feedback');
      }
    } finally {
      setResolvingFeedback(null);
      console.log('[confirmResolveFeedback] Resolution process completed');
    }
  };

  if (loading && !authenticated) {
    return (
      <main className="min-h-screen p-8 text-gray-900 dark:text-gray-100">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400"></div>
        </div>
      </main>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden text-gray-900 dark:text-gray-100">
      <div className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col overflow-hidden p-6">
        <div className="mb-6 flex flex-shrink-0 items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">App Feedback</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              User feedback about the app (for builders/admin)
            </p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/admin"
              className="px-4 py-2 text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            >
              Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 grid flex-shrink-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Page
            </label>
            <input
              type="text"
              value={filterPage}
              onChange={(e) => setFilterPage(e.target.value)}
              placeholder="e.g., /network, /me"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Since Date
            </label>
            <input
              type="date"
              value={filterSince}
              onChange={(e) => setFilterSince(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="responded">Responded</option>
              <option value="waiting">Waiting Response</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="all">All</option>
              <option value="issue">Issue</option>
              <option value="feedback">Feedback</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Rating
            </label>
            <select
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value as any)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="all">All</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterPage('');
                setFilterSince('');
                setFilterStatus('all');
                setFilterType('all');
                setFilterRating('all');
              }}
              className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Feedback Table */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-800">
          {feedbacks.length > 0 ? (
            <div className="flex-1 overflow-auto">
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
                        <span
                          className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${
                            feedback.feedbackType === 'issue'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}
                        >
                          {feedback.feedbackType === 'issue' ? '🐛 Issue' : '💬 Feedback'}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-sm text-xs">
                        <a
                          href={`https://explorer.kaolin.hoodi.arkiv.network/address/${feedback.wallet}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline dark:text-blue-400"
                          title={feedback.wallet}
                        >
                          {feedback.wallet.slice(0, 10)}...{feedback.wallet.slice(-4)}
                        </a>
                      </td>
                      <td className="px-4 py-2 text-sm" title={feedback.page}>
                        {formatPagePath(feedback.page)}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {feedback.rating ? (
                          <span className="text-yellow-500">
                            {'★'.repeat(feedback.rating)}
                            {'☆'.repeat(5 - feedback.rating)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="max-w-md px-4 py-2 text-sm">
                        <div className="space-y-1">
                          <div className={expandedMessages.has(feedback.id) ? '' : 'truncate'}>
                            {feedback.message}
                          </div>
                          {feedback.message.length > 80 && (
                            <button
                              onClick={() => {
                                const newExpanded = new Set(expandedMessages);
                                if (newExpanded.has(feedback.id)) {
                                  newExpanded.delete(feedback.id);
                                } else {
                                  newExpanded.add(feedback.id);
                                }
                                setExpandedMessages(newExpanded);
                              }}
                              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {expandedMessages.has(feedback.id) ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {feedback.feedbackType === 'issue' ? (
                          // Issues: Show resolved or pending
                          feedback.resolved ? (
                            <span className="inline-flex items-center rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              ✓ Resolved
                              {feedback.resolvedAt && (
                                <span className="ml-1 text-xs opacity-75">
                                  {new Date(feedback.resolvedAt).toLocaleDateString()}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                              ⏳ Pending
                            </span>
                          )
                        ) : // Feedback: Show responded or waiting response
                        feedback.hasResponse ? (
                          <span className="inline-flex items-center rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            ✓ Responded
                            {feedback.responseAt && (
                              <span className="ml-1 text-xs opacity-75">
                                {new Date(feedback.responseAt).toLocaleDateString()}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                            📬 Waiting Response
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {feedback.txHash ? (
                          <a
                            href={`https://explorer.kaolin.hoodi.arkiv.network/tx/${feedback.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                            title={feedback.txHash}
                          >
                            {feedback.txHash.slice(0, 8)}...{feedback.txHash.slice(-6)}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            {feedback.feedbackType === 'issue' && !feedback.resolved && (
                              <button
                                onClick={() => handleResolveFeedback(feedback)}
                                disabled={resolvingFeedback === feedback.key}
                                className="rounded bg-green-600 px-3 py-1 text-xs text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                              >
                                {resolvingFeedback === feedback.key
                                  ? 'Resolving...'
                                  : 'Mark Resolved'}
                              </button>
                            )}
                            <button
                              onClick={() => handleRespond(feedback)}
                              className={`rounded px-3 py-1 text-xs text-white transition-colors ${
                                feedback.hasResponse
                                  ? 'bg-gray-500 hover:bg-gray-600'
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              {feedback.hasResponse ? 'View Response' : 'Respond'}
                            </button>
                          </div>
                          {githubIssueLinks[feedback.key] ? (
                            <a
                              href={githubIssueLinks[feedback.key].issueUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded bg-gray-600 px-3 py-1 text-center text-xs text-white transition-colors hover:bg-gray-700"
                            >
                              View Issue #{githubIssueLinks[feedback.key].issueNumber}
                            </a>
                          ) : (
                            // Only show "Add to GitHub" for issues, not feedback
                            feedback.feedbackType === 'issue' && (
                              <button
                                onClick={() => handleCreateGitHubIssue(feedback)}
                                disabled={creatingGitHubIssue === feedback.key}
                                className="rounded bg-purple-600 px-3 py-1 text-xs text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                              >
                                {creatingGitHubIssue === feedback.key
                                  ? 'Creating...'
                                  : 'Add to GitHub'}
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400">
              {loading ? 'Loading feedback...' : 'No feedback found.'}
            </div>
          )}
        </div>

        <div className="mt-4 flex-shrink-0 text-sm text-gray-600 dark:text-gray-400">
          Showing {feedbacks.length} of {allFeedbacks.length} feedback entries
        </div>
      </div>

      {/* Resolution Modal */}
      {resolvingIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Resolve Issue
              </h3>
              <button
                onClick={() => {
                  setResolvingIssue(null);
                  setResolutionNote('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              This will mark the issue as resolved on Arkiv using the immutable entity update
              pattern.
              {githubIssueLinks[resolvingIssue.key] ? (
                <span className="mt-2 block text-xs text-gray-500 dark:text-gray-400">
                  The linked GitHub issue will also be closed with a resolution comment.
                </span>
              ) : (
                <span className="mt-2 block text-xs text-gray-500 dark:text-gray-400">
                  (No GitHub issue linked - resolution will only be recorded on Arkiv)
                </span>
              )}
            </p>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Resolution Note (optional)
              </label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Describe how this issue was resolved..."
                className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                rows={4}
              />
              {githubIssueLinks[resolvingIssue.key] ? (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  This note will be added as a comment to the GitHub issue.
                </p>
              ) : (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  This note will be stored in the Arkiv resolution entity.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setResolvingIssue(null);
                  setResolutionNote('');
                }}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log('[Button Click] Mark Resolved button clicked in modal');
                  console.log('[Button Click] resolvingIssue:', resolvingIssue);
                  confirmResolveFeedback();
                }}
                disabled={resolvingFeedback === resolvingIssue.key}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {resolvingFeedback === resolvingIssue.key ? 'Resolving...' : 'Mark Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Response Modal */}
      {respondingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {viewingResponse ? 'View Response' : 'Respond to Feedback'}
              </h2>
              <button
                onClick={() => {
                  setRespondingTo(null);
                  setResponseMessage('');
                  setViewingResponse(null);
                }}
                disabled={submittingResponse || loadingResponse}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50 dark:hover:text-gray-300"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                <strong>Original Feedback:</strong>
              </p>
              <div className="max-h-64 overflow-y-auto">
                <p className="whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                  {respondingTo.message}
                </p>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                From: {respondingTo.wallet.slice(0, 10)}...{respondingTo.wallet.slice(-4)} | Page:{' '}
                {respondingTo.page} |
                {respondingTo.feedbackType === 'issue' ? ' 🐛 Issue' : ' 💬 Feedback'}
              </p>
            </div>

            {loadingResponse ? (
              <div className="mb-4 rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-700">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-600 dark:border-t-blue-400"></div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading response...</p>
              </div>
            ) : viewingResponse ? (
              <>
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700">
                  <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                    <strong>Replying to:</strong>
                  </p>
                  <div className="mb-2 max-h-64 overflow-y-auto">
                    <p className="whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                      {respondingTo.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      From: {respondingTo.wallet.slice(0, 10)}...{respondingTo.wallet.slice(-4)}
                    </span>
                    <span>•</span>
                    <span>Page: {respondingTo.page}</span>
                    <span>•</span>
                    <span>
                      {respondingTo.feedbackType === 'issue' ? '🐛 Issue' : '💬 Feedback'}
                    </span>
                    {respondingTo.rating && (
                      <>
                        <span>•</span>
                        <span className="text-yellow-500">
                          {'★'.repeat(respondingTo.rating)}
                          {'☆'.repeat(5 - respondingTo.rating)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                  <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                    <strong>Admin Response:</strong>
                  </p>
                  <div className="max-h-96 overflow-y-auto">
                    <p className="whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                      {viewingResponse.message}
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Responded: {new Date(viewingResponse.createdAt).toLocaleString()} | By:{' '}
                    {viewingResponse.adminWallet.slice(0, 10)}...
                    {viewingResponse.adminWallet.slice(-4)}
                  </p>
                </div>
              </>
            ) : (
              <div className="mb-4">
                <label
                  htmlFor="response"
                  className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Your Response <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="response"
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  rows={6}
                  className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Type your response to the user here..."
                  required
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setRespondingTo(null);
                  setResponseMessage('');
                  setViewingResponse(null);
                }}
                disabled={submittingResponse || loadingResponse}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                {viewingResponse ? 'Close' : 'Cancel'}
              </button>
              {!viewingResponse && (
                <button
                  onClick={handleSubmitResponse}
                  disabled={submittingResponse || !responseMessage.trim()}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submittingResponse ? 'Submitting...' : 'Send Response'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
