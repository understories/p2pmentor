/**
 * Admin Dashboard
 * 
 * Main admin dashboard showing performance metrics, feedback, and usage stats.
 * Requires authentication via /admin/login.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

interface PerfSummary {
  graphql?: {
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    avgPayloadBytes?: number;
    avgHttpRequests?: number;
    samples: number;
  };
  arkiv?: {
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    avgPayloadBytes?: number;
    avgHttpRequests?: number;
    samples: number;
  };
}

interface PageLoadResult {
  page: string;
  durationMs: number;
  status: number;
  error?: string;
}

interface PageLoadSummary {
  total: number;
  successful: number;
  failed: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
}

interface AppFeedback {
  key: string;
  wallet: string;
  page: string;
  message: string;
  rating?: number;
  feedbackType: 'feedback' | 'issue';
  createdAt: string;
  txHash?: string;
}

interface PerfSnapshot {
  key: string;
  timestamp: string;
  operation: string;
  method: 'arkiv' | 'graphql' | 'both';
  graphql?: {
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    avgPayloadBytes?: number;
    avgHttpRequests?: number;
    samples: number;
  };
  arkiv?: {
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    avgPayloadBytes?: number;
    avgHttpRequests?: number;
    samples: number;
  };
  pageLoadTimes?: {
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    total: number;
    successful: number;
  };
  txHash?: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [perfSummary, setPerfSummary] = useState<PerfSummary | null>(null);
  const [perfSamples, setPerfSamples] = useState<any[]>([]);
  const [pageLoadTimes, setPageLoadTimes] = useState<PageLoadResult[]>([]);
  const [pageLoadSummary, setPageLoadSummary] = useState<PageLoadSummary | null>(null);
  const [recentFeedback, setRecentFeedback] = useState<AppFeedback[]>([]);
  const [testMethod, setTestMethod] = useState<'arkiv' | 'graphql' | 'both'>('both');
  const [snapshots, setSnapshots] = useState<PerfSnapshot[]>([]);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [testingPerformance, setTestingPerformance] = useState(false);
  const [performanceExpanded, setPerformanceExpanded] = useState(true);
  const [lastSnapshotCheck, setLastSnapshotCheck] = useState<{ shouldCreate: boolean; hoursAgo?: number } | null>(null);

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
      // Load test method preference from localStorage
      const savedMethod = localStorage.getItem('admin_test_method');
      if (savedMethod && ['arkiv', 'graphql', 'both'].includes(savedMethod)) {
        setTestMethod(savedMethod as 'arkiv' | 'graphql' | 'both');
      }

      // Fetch performance summary
      fetch('/api/admin/perf-samples?summary=true&summaryOperation=buildNetworkGraphData')
        .then(res => res.json())
        .then(data => setPerfSummary(data))
        .catch(err => console.error('Failed to fetch perf summary:', err));

      // Fetch recent samples (from Arkiv entities if available)
      fetch('/api/admin/perf-samples?limit=20')
        .then(res => res.json())
        .then(data => {
          setPerfSamples(data.samples || []);
          if (data.note) {
            console.log('[Admin]', data.note);
          }
        })
        .catch(err => console.error('Failed to fetch perf samples:', err));

      // Fetch page load times
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      fetch(`/api/admin/page-load-times?baseUrl=${encodeURIComponent(baseUrl)}`)
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            setPageLoadTimes(data.results || []);
            setPageLoadSummary(data.summary || null);
          }
        })
        .catch(err => console.error('Failed to fetch page load times:', err));

      // Fetch recent feedback
      fetch('/api/app-feedback?limit=5')
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            setRecentFeedback(data.feedbacks || []);
          }
        })
        .catch(err => console.error('Failed to fetch feedback:', err));

      // Check if auto-snapshot should be created
      fetch('/api/admin/perf-snapshots?checkAuto=true&operation=buildNetworkGraphData')
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            setLastSnapshotCheck({
              shouldCreate: data.shouldCreateSnapshot,
              hoursAgo: data.lastSnapshot?.hoursAgo,
            });
            
            // Auto-create snapshot if > 12 hours since last one
            if (data.shouldCreateSnapshot) {
              // Use 'both' method for auto-snapshots to capture comprehensive data
              fetch(`/api/admin/perf-snapshots?operation=buildNetworkGraphData&method=both`)
                .then(snapRes => snapRes.json())
                .then(snapData => {
                  if (snapData.ok) {
                    console.log('[Admin] Auto-created performance snapshot');
                    // Refresh snapshots list
                    return fetch('/api/admin/perf-snapshots?operation=buildNetworkGraphData&limit=10');
                  }
                })
                .then(snapshotsRes => snapshotsRes?.json())
                .then(snapshotsData => {
                  if (snapshotsData?.ok) {
                    setSnapshots(snapshotsData.snapshots || []);
                  }
                  // Update check status
                  return fetch('/api/admin/perf-snapshots?checkAuto=true&operation=buildNetworkGraphData');
                })
                .then(checkRes => checkRes?.json())
                .then(checkData => {
                  if (checkData?.ok) {
                    setLastSnapshotCheck({
                      shouldCreate: checkData.shouldCreateSnapshot,
                      hoursAgo: checkData.lastSnapshot?.hoursAgo,
                    });
                  }
                })
                .catch(err => console.error('Failed to auto-create snapshot:', err));
            }
          }
        })
        .catch(err => console.error('Failed to check snapshot status:', err));

      // Fetch historical snapshots
      fetch('/api/admin/perf-snapshots?operation=buildNetworkGraphData&limit=10')
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            setSnapshots(data.snapshots || []);
          }
        })
        .catch(err => console.error('Failed to fetch snapshots:', err));
    }
  }, [authenticated]);

  const handleCreateSnapshot = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (creatingSnapshot) {
      console.log('[Admin] Snapshot creation already in progress');
      return;
    }
    
    setCreatingSnapshot(true);
    console.log('[Admin] Creating snapshot with method:', testMethod);
    
    try {
      // Check if snapshot was created recently (idempotency)
      const res = await fetch(`/api/admin/perf-snapshots?operation=buildNetworkGraphData&method=${testMethod}`, {
        method: 'POST',
      });
      console.log('[Admin] Snapshot creation response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      
      const data = await res.json();
      console.log('[Admin] Snapshot creation data:', data);
      
      if (data.ok) {
        // Success - refresh data
        // Refresh snapshots
        const snapshotsRes = await fetch('/api/admin/perf-snapshots?operation=buildNetworkGraphData&limit=10');
        const snapshotsData = await snapshotsRes.json();
        console.log('[Admin] Snapshots data:', snapshotsData);
        if (snapshotsData.ok) {
          setSnapshots(snapshotsData.snapshots || []);
        }
        // Refresh snapshot check
        const checkRes = await fetch('/api/admin/perf-snapshots?checkAuto=true&operation=buildNetworkGraphData');
        const checkData = await checkRes.json();
        if (checkData.ok) {
          setLastSnapshotCheck({
            shouldCreate: checkData.shouldCreateSnapshot,
            hoursAgo: checkData.lastSnapshot?.hoursAgo,
          });
        }
        alert(`Snapshot created successfully! Transaction: ${data.snapshot?.txHash?.slice(0, 10)}...`);
      } else if (res.status === 429) {
        // Too many requests - idempotency check
        alert(`Snapshot created too recently. ${data.message || 'Please wait 5 minutes between snapshots.'}`);
      } else {
        alert(`Failed to create snapshot: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('[Admin] Error creating snapshot:', err);
      alert(`Failed to create snapshot: ${err.message || 'Unknown error'}`);
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('admin_authenticated');
    }
    router.push('/admin/login');
  };

  if (loading) {
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
        {/* Security Warning Banner */}
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-amber-600 dark:text-amber-400 text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Internal Access Only — Not Production-Ready Authentication
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                This admin panel uses simple password authentication. Do not expose publicly. 
                Proper authentication (passkey/wallet allowlist) required before public release.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
              Admin Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Performance metrics, feedback, and usage statistics
            </p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/"
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Home
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Performance Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
                Performance
              </h2>
              <button
                onClick={() => {
                  const newState = !performanceExpanded;
                  setPerformanceExpanded(newState);
                  localStorage.setItem('admin_performance_expanded', String(newState));
                }}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                title={performanceExpanded ? 'Hide performance section' : 'Show performance section'}
              >
                {performanceExpanded ? '▼ Hide' : '▶ Show'}
              </button>
            </div>
            {performanceExpanded && (
              <div className="flex items-center gap-4">
                {/* Test Method Toggle */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Test Method:</span>
                  <button
                    onClick={() => {
                      const newMethod = testMethod === 'arkiv' ? 'graphql' : testMethod === 'graphql' ? 'both' : 'arkiv';
                      setTestMethod(newMethod);
                      localStorage.setItem('admin_test_method', newMethod);
                    }}
                    className="px-3 py-1 text-xs font-medium rounded transition-colors bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    {testMethod === 'arkiv' ? 'Arkiv' : testMethod === 'graphql' ? 'GraphQL' : 'Both'}
                  </button>
                </div>
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (testingPerformance) {
                      console.log('[Admin] Test already in progress');
                      return;
                    }
                    
                    setTestingPerformance(true);
                    console.log('[Admin] Starting performance test with method:', testMethod);
                    
                    try {
                      const res = await fetch(`/api/admin/perf-samples?seed=true&method=${testMethod}`);
                      console.log('[Admin] Performance test response status:', res.status);
                      
                      if (!res.ok) {
                        const errorText = await res.text();
                        throw new Error(`HTTP ${res.status}: ${errorText}`);
                      }
                      
                      const data = await res.json();
                      console.log('[Admin] Performance test data:', data);
                      
                      if (data.success) {
                        // Refresh performance data after test
                        const summaryRes = await fetch('/api/admin/perf-samples?summary=true&summaryOperation=buildNetworkGraphData');
                        const summaryData = await summaryRes.json();
                        console.log('[Admin] Summary data:', summaryData);
                        if (summaryData) {
                          setPerfSummary(summaryData);
                        }
                        // Also refresh samples list
                        const samplesRes = await fetch('/api/admin/perf-samples?limit=10');
                        const samplesData = await samplesRes.json();
                        console.log('[Admin] Samples data:', samplesData);
                        if (samplesData.samples) {
                          setPerfSamples(samplesData.samples);
                        }
                        alert(`Performance test completed! ${data.entitiesCreated} entities created. Check Mendoza explorer to verify.`);
                      } else {
                        alert(`Test failed: ${data.error || 'Unknown error'}`);
                      }
                    } catch (err: any) {
                      console.error('[Admin] Error running performance test:', err);
                      alert(`Failed to run performance test: ${err.message || 'Unknown error'}`);
                    } finally {
                      setTestingPerformance(false);
                    }
                  }}
                  disabled={testingPerformance}
                  className={`px-4 py-2 text-white rounded-lg text-sm transition-colors ${
                    testingPerformance 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  title={`Test query performance using ${testMethod === 'both' ? 'both Arkiv and GraphQL' : testMethod === 'graphql' ? 'GraphQL' : 'Arkiv JSON-RPC'} methods. Results will appear in the dashboard.`}
                >
                  {testingPerformance ? 'Testing...' : 'Test Query Performance'}
                </button>
                <button
                  onClick={(e) => handleCreateSnapshot(e)}
                  disabled={creatingSnapshot}
                  className={`px-4 py-2 text-white rounded-lg text-sm transition-colors ${
                    creatingSnapshot 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                  title="Create a snapshot of current performance data for historical comparison"
                >
                  {creatingSnapshot ? 'Creating...' : 'Create Snapshot'}
                </button>
                {lastSnapshotCheck && lastSnapshotCheck.shouldCreate && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 rounded">
                    Auto-snapshot due (last: {lastSnapshotCheck.hoursAgo?.toFixed(1)}h ago)
                  </span>
                )}
              </div>
            )}
          </div>
          
          {performanceExpanded && (
            <>

          {/* Query Performance Comparison */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-gray-50">
              Query Performance (JSON-RPC vs GraphQL)
            </h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            {perfSummary ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {perfSummary.graphql && (
                  <div>
                    <h3 className="font-medium mb-2 text-gray-900 dark:text-gray-50">GraphQL</h3>
                    <div className="space-y-1 text-sm">
                      <div>Avg Duration: {perfSummary.graphql.avgDurationMs.toFixed(2)}ms</div>
                      <div>Avg Payload: {perfSummary.graphql.avgPayloadBytes ? (perfSummary.graphql.avgPayloadBytes / 1024).toFixed(2) : 'N/A'} KB</div>
                      <div>HTTP Requests: {perfSummary.graphql.avgHttpRequests?.toFixed(1) || '1'}</div>
                      <div>Samples: {perfSummary.graphql.samples}</div>
                    </div>
                  </div>
                )}
                {perfSummary.arkiv && (
                  <div>
                    <h3 className="font-medium mb-2 text-gray-900 dark:text-gray-50">JSON-RPC</h3>
                    <div className="space-y-1 text-sm">
                      <div>Avg Duration: {perfSummary.arkiv.avgDurationMs.toFixed(2)}ms</div>
                      <div>Avg Payload: {perfSummary.arkiv.avgPayloadBytes ? (perfSummary.arkiv.avgPayloadBytes / 1024).toFixed(2) : 'N/A'} KB</div>
                      <div>HTTP Requests: {perfSummary.arkiv.avgHttpRequests?.toFixed(1) || 'N/A'}</div>
                      <div>Samples: {perfSummary.arkiv.samples}</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">No performance data yet. Metrics will appear as requests are made.</p>
            )}
            </div>
          </div>

          {/* Page Load Times */}
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-gray-50">
              Page Load Times
            </h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
              {pageLoadSummary ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600 dark:text-gray-400">Avg Load Time</div>
                      <div className="font-semibold text-gray-900 dark:text-gray-50">{pageLoadSummary.avgDurationMs}ms</div>
                    </div>
                    <div>
                      <div className="text-gray-600 dark:text-gray-400">Fastest</div>
                      <div className="font-semibold text-gray-900 dark:text-gray-50">{pageLoadSummary.minDurationMs}ms</div>
                    </div>
                    <div>
                      <div className="text-gray-600 dark:text-gray-400">Slowest</div>
                      <div className="font-semibold text-gray-900 dark:text-gray-50">{pageLoadSummary.maxDurationMs}ms</div>
                    </div>
                    <div>
                      <div className="text-gray-600 dark:text-gray-400">Success Rate</div>
                      <div className="font-semibold text-gray-900 dark:text-gray-50">
                        {pageLoadSummary.successful}/{pageLoadSummary.total}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {pageLoadTimes.map((result, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                        <span className="text-gray-700 dark:text-gray-300">{result.page}</span>
                        <div className="flex items-center gap-4">
                          <span className={result.status === 200 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {result.status === 200 ? `${result.durationMs}ms` : 'Failed'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400">Loading page load times...</p>
              )}
            </div>
          </div>
            </>
          )}
        </section>

        {/* Feedback Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
              Recent Feedback
            </h2>
            <Link
              href="/admin/feedback"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              View All Feedback
            </Link>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            {recentFeedback.length > 0 ? (
              <div className="space-y-4">
                {recentFeedback.map((feedback) => (
                  <div key={feedback.key} className="border-b border-gray-200 dark:border-gray-700 last:border-0 pb-4 last:pb-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-50">
                            {feedback.page}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            feedback.feedbackType === 'issue' 
                              ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                              : 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                          }`}>
                            {feedback.feedbackType}
                          </span>
                          {feedback.rating && (
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {Array.from({ length: feedback.rating }, (_, i) => (
                                <span key={i}>★</span>
                              ))}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                          {feedback.message}
                        </p>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 ml-4">
                        {new Date(feedback.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">No feedback yet.</p>
            )}
          </div>
        </section>

        {/* Recent Performance Samples */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-50">
            Recent Performance Samples
          </h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
            {perfSamples.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">Source</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Operation</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Duration (ms)</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Payload (KB)</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">HTTP Req</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Verify</th>
                  </tr>
                </thead>
                <tbody>
                  {perfSamples.slice(0, 10).map((sample, idx) => (
                    <tr key={idx} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2 text-sm">{sample.source}</td>
                      <td className="px-4 py-2 text-sm">{sample.operation}</td>
                      <td className="px-4 py-2 text-sm">{sample.durationMs}</td>
                      <td className="px-4 py-2 text-sm">{sample.payloadBytes ? (sample.payloadBytes / 1024).toFixed(2) : 'N/A'}</td>
                      <td className="px-4 py-2 text-sm">{sample.httpRequests || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm">
                        {sample.txHash ? (
                          <a
                            href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${sample.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                            title="Verify on-chain"
                          >
                            🔗
                          </a>
                        ) : (
                          <span className="text-gray-400" title="Not stored on-chain">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-gray-600 dark:text-gray-400">
                No performance samples yet. Metrics will appear as requests are made.
              </div>
            )}
          </div>
        </section>

        {/* Historical Performance Snapshots */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-50">
            Historical Performance Data
          </h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            {snapshots.length > 0 ? (
              <div className="space-y-4">
                {snapshots.map((snapshot, idx) => (
                  <div key={snapshot.key} className="border-b border-gray-200 dark:border-gray-700 last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-50">
                          {new Date(snapshot.timestamp).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Method: {snapshot.method} • Operation: {snapshot.operation}
                          {snapshot.arkivMetadata?.blockHeight ? (
                            <span className="ml-2 text-gray-500 dark:text-gray-500">
                              • Block: {snapshot.arkivMetadata.blockHeight}
                            </span>
                          ) : null}
                          {(!snapshot.arkiv && !snapshot.graphql) && (
                            <span className="ml-2 text-amber-600 dark:text-amber-400">(No performance data captured)</span>
                          )}
                          {snapshot.method === 'both' && (!snapshot.arkiv || !snapshot.graphql) && (
                            <span className="ml-2 text-amber-600 dark:text-amber-400">
                              ({snapshot.arkiv ? 'Only Arkiv' : snapshot.graphql ? 'Only GraphQL' : 'No data'} captured)
                            </span>
                          )}
                        </div>
                      </div>
                      {snapshot.txHash && (
                        <a
                          href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${snapshot.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                        >
                          🔗 Verify
                        </a>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {snapshot.arkiv && (
                        <div className="bg-white dark:bg-gray-700 rounded p-3">
                          <div className="font-medium mb-2 text-gray-900 dark:text-gray-50">JSON-RPC</div>
                          <div className="space-y-1 text-xs">
                            <div>Avg: {snapshot.arkiv.avgDurationMs.toFixed(0)}ms</div>
                            <div>Range: {snapshot.arkiv.minDurationMs}ms - {snapshot.arkiv.maxDurationMs}ms</div>
                            <div>Samples: {snapshot.arkiv.samples}</div>
                          </div>
                        </div>
                      )}
                      {snapshot.graphql && (
                        <div className="bg-white dark:bg-gray-700 rounded p-3">
                          <div className="font-medium mb-2 text-gray-900 dark:text-gray-50">GraphQL</div>
                          <div className="space-y-1 text-xs">
                            <div>Avg: {snapshot.graphql.avgDurationMs.toFixed(0)}ms</div>
                            <div>Range: {snapshot.graphql.minDurationMs}ms - {snapshot.graphql.maxDurationMs}ms</div>
                            <div>Samples: {snapshot.graphql.samples}</div>
                          </div>
                        </div>
                      )}
                    </div>
                    {snapshot.pageLoadTimes && (
                      <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                        Page Load: Avg {snapshot.pageLoadTimes.avgDurationMs}ms ({snapshot.pageLoadTimes.successful}/{snapshot.pageLoadTimes.total} successful)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">No snapshots yet. Create one to start tracking performance over time.</p>
            )}
          </div>
        </section>

        {/* Quick Links */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-50">
            Quick Links
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              href="/admin/feedback"
              className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <h3 className="font-medium mb-1">Feedback</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">View user feedback</p>
            </Link>
            <Link
              href="/network"
              className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <h3 className="font-medium mb-1">Network View</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">View network graph</p>
            </Link>
            <Link
              href="/network/compare"
              className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <h3 className="font-medium mb-1">GraphQL Comparison</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Compare JSON-RPC vs GraphQL</p>
            </Link>
            <a
              href="/api/admin/perf-samples"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <h3 className="font-medium mb-1">Perf API</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">View raw performance data</p>
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

