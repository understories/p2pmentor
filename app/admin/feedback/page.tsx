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
  const [filterPage, setFilterPage] = useState('');
  const [filterSince, setFilterSince] = useState('');
  const [respondingTo, setRespondingTo] = useState<AppFeedback | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [resolvingFeedback, setResolvingFeedback] = useState<string | null>(null);
  const [viewingResponse, setViewingResponse] = useState<{ message: string; createdAt: string; adminWallet: string } | null>(null);
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [creatingGitHubIssue, setCreatingGitHubIssue] = useState<string | null>(null);
  const [githubIssueLinks, setGithubIssueLinks] = useState<Record<string, { issueNumber: number; issueUrl: string }>>({});
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
        resolved: f.resolved || false,
        resolvedAt: f.resolvedAt,
        resolvedBy: f.resolvedBy,
        hasResponse: f.hasResponse || false,
        responseAt: f.responseAt,
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

  const handleRespond = async (feedback: AppFeedback) => {
    // If there's already a response, fetch and display it
    if (feedback.hasResponse) {
      setLoadingResponse(true);
      try {
        const res = await fetch(`/api/admin/response?feedbackKey=${encodeURIComponent(feedback.key)}`);
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
      const adminWallet = typeof window !== 'undefined'
        ? localStorage.getItem('wallet_address') || 'admin'
        : 'admin';

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
        alert('Request timed out. The response may have been submitted. Please refresh the page to check.');
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
      setGithubIssueLinks(prev => ({
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
      const adminWallet = typeof window !== 'undefined'
        ? localStorage.getItem('wallet_address') || 'admin'
        : 'admin';

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

      console.log('[confirmResolveFeedback] Arkiv resolution successful. Resolution key:', data.key, 'txHash:', data.txHash);

      // Also close GitHub issue if it exists
      const issueLink = githubIssueLinks[resolvingIssue.key];
      console.log('[confirmResolveFeedback] Checking for GitHub issue link:', issueLink);
      
      if (issueLink) {
        console.log('[confirmResolveFeedback] Found GitHub issue link. Issue #:', issueLink.issueNumber);
        try {
          const githubController = new AbortController();
          const githubTimeoutId = setTimeout(() => githubController.abort(), 30000); // 30 second timeout for GitHub

          const githubPayload = {
            issueNumber: issueLink.issueNumber,
            resolutionNote: resolutionNote.trim() || undefined,
            resolutionKey: data.key,
            txHash: data.txHash,
          };
          console.log('[confirmResolveFeedback] Calling /api/github/close-issue with payload:', githubPayload);

          const githubRes = await fetch('/api/github/close-issue', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(githubPayload),
            signal: githubController.signal,
          });

          clearTimeout(githubTimeoutId);

          console.log('[confirmResolveFeedback] GitHub close-issue response status:', githubRes.status);
          const githubData = await githubRes.json();
          console.log('[confirmResolveFeedback] GitHub close-issue response data:', githubData);
          
          if (!githubRes.ok) {
            console.error('[confirmResolveFeedback] Failed to close GitHub issue:', githubData.error);
            // Continue anyway - Arkiv resolution is more important
          } else {
            console.log('[confirmResolveFeedback] GitHub issue closed successfully!');
          }
        } catch (githubErr: any) {
          console.error('[confirmResolveFeedback] Error closing GitHub issue:', githubErr);
          if (githubErr.name === 'AbortError') {
            console.warn('[confirmResolveFeedback] GitHub close-issue request timed out, but Arkiv resolution succeeded');
          } else {
            console.warn('[confirmResolveFeedback] Error closing GitHub issue:', githubErr);
          }
          // Continue anyway - Arkiv resolution succeeded
        }
      } else {
        console.log('[confirmResolveFeedback] No GitHub issue link found for this feedback - resolution completed on Arkiv only');
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
        alert('Request timed out. The issue may have been resolved. Please refresh the page to check.');
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
      <main className="min-h-screen text-gray-900 dark:text-gray-100 p-8">
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
    <main className="min-h-screen text-gray-900 dark:text-gray-100 p-8">
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
                      <td className="px-4 py-2 text-sm" title={feedback.page}>
                        {formatPagePath(feedback.page)}
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
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
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
                          )
                        ) : (
                          // Feedback: Show responded or waiting response
                          feedback.hasResponse ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              ✓ Responded
                              {feedback.responseAt && (
                                <span className="ml-1 text-xs opacity-75">
                                  {new Date(feedback.responseAt).toLocaleDateString()}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                              📬 Waiting Response
                            </span>
                          )
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
                        <div className="flex flex-col gap-2">
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
                              className={`px-3 py-1 text-white text-xs rounded transition-colors ${
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
                              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors text-center"
                            >
                              View Issue #{githubIssueLinks[feedback.key].issueNumber}
                            </a>
                          ) : (
                            // Only show "Add to GitHub" for issues, not feedback
                            feedback.feedbackType === 'issue' && (
                              <button
                                onClick={() => handleCreateGitHubIssue(feedback)}
                                disabled={creatingGitHubIssue === feedback.key}
                                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors disabled:opacity-50"
                              >
                                {creatingGitHubIssue === feedback.key ? 'Creating...' : 'Add to GitHub'}
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
            <div className="p-6 text-gray-600 dark:text-gray-400">
              {loading ? 'Loading feedback...' : 'No feedback found.'}
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {feedbacks.length} feedback entries
        </div>
      </div>

      {/* Resolution Modal */}
      {resolvingIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
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
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will mark the issue as resolved on Arkiv using the immutable entity update pattern.
              {githubIssueLinks[resolvingIssue.key] ? (
                <span className="block mt-2 text-xs text-gray-500 dark:text-gray-400">
                  The linked GitHub issue will also be closed with a resolution comment.
                </span>
              ) : (
                <span className="block mt-2 text-xs text-gray-500 dark:text-gray-400">
                  (No GitHub issue linked - resolution will only be recorded on Arkiv)
                </span>
              )}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Resolution Note (optional)
              </label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Describe how this issue was resolved..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm resize-none"
                rows={4}
              />
              {githubIssueLinks[resolvingIssue.key] ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  This note will be added as a comment to the GitHub issue.
                </p>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  This note will be stored in the Arkiv resolution entity.
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setResolvingIssue(null);
                  setResolutionNote('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
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
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
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

            {loadingResponse ? (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading response...</p>
              </div>
            ) : viewingResponse ? (
              <>
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <strong>Replying to:</strong>
                  </p>
                  <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap mb-2">{respondingTo.message}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>From: {respondingTo.wallet.slice(0, 10)}...{respondingTo.wallet.slice(-4)}</span>
                    <span>•</span>
                    <span>Page: {respondingTo.page}</span>
                    <span>•</span>
                    <span>{respondingTo.feedbackType === 'issue' ? '🐛 Issue' : '💬 Feedback'}</span>
                    {respondingTo.rating && (
                      <>
                        <span>•</span>
                        <span className="text-yellow-500">
                          {'★'.repeat(respondingTo.rating)}{'☆'.repeat(5 - respondingTo.rating)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <strong>Admin Response:</strong>
                  </p>
                  <div className="max-h-96 overflow-y-auto">
                    <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{viewingResponse.message}</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Responded: {new Date(viewingResponse.createdAt).toLocaleString()} |
                    By: {viewingResponse.adminWallet.slice(0, 10)}...{viewingResponse.adminWallet.slice(-4)}
                  </p>
                </div>
              </>
            ) : (
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
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                {viewingResponse ? 'Close' : 'Cancel'}
              </button>
              {!viewingResponse && (
                <button
                  onClick={handleSubmitResponse}
                  disabled={submittingResponse || !responseMessage.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

