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
    pages?: Record<string, number>; // Page -> count
  };
  arkiv?: {
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    avgPayloadBytes?: number;
    avgHttpRequests?: number;
    samples: number;
    pages?: Record<string, number>; // Page -> count
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
  arkivMetadata?: {
    blockHeight?: number;
    chainId?: number;
    timestamp: string;
  };
  graphql?: {
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    avgPayloadBytes?: number;
    avgHttpRequests?: number;
    samples: number;
    pages?: Record<string, number>;
  };
  arkiv?: {
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    avgPayloadBytes?: number;
    avgHttpRequests?: number;
    samples: number;
    pages?: Record<string, number>;
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

interface GraphQLFlags {
  network: boolean;
  me: boolean;
  profile: boolean;
  asks: boolean;
  offers: boolean;
}

interface GraphQLFlagsResponse {
  ok: boolean;
  flags: GraphQLFlags;
  summary: {
    enabled: number;
    total: number;
    percentage: number;
  };
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
  const [performanceExpanded, setPerformanceExpanded] = useState(false); // Default closed - engineering focused
  const [feedbackExpanded, setFeedbackExpanded] = useState(true); // Default open - customer focused
  const [lastSnapshotCheck, setLastSnapshotCheck] = useState<{ shouldCreate: boolean; hoursAgo?: number } | null>(null);
  const [graphqlFlags, setGraphqlFlags] = useState<GraphQLFlagsResponse | null>(null);
  const [graphqlMigrationExpanded, setGraphqlMigrationExpanded] = useState(false); // Default collapsed
  const [queryPerformanceExpanded, setQueryPerformanceExpanded] = useState(false); // Default collapsed
  const [pageLoadTimesExpanded, setPageLoadTimesExpanded] = useState(false); // Default collapsed
  const [recentSamplesExpanded, setRecentSamplesExpanded] = useState(false); // Default collapsed
  const [snapshotsExpanded, setSnapshotsExpanded] = useState(false); // Default collapsed

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
      // Load preferences from localStorage
      const savedMethod = localStorage.getItem('admin_test_method');
      if (savedMethod && ['arkiv', 'graphql', 'both'].includes(savedMethod)) {
        setTestMethod(savedMethod as 'arkiv' | 'graphql' | 'both');
      }
      
      // Load section expansion states
      const savedPerfExpanded = localStorage.getItem('admin_performance_expanded');
      if (savedPerfExpanded !== null) {
        setPerformanceExpanded(savedPerfExpanded === 'true');
      }
      
      const savedFeedbackExpanded = localStorage.getItem('admin_feedback_expanded');
      if (savedFeedbackExpanded !== null) {
        setFeedbackExpanded(savedFeedbackExpanded === 'true');
      }
      
      const savedGraphqlMigrationExpanded = localStorage.getItem('admin_graphql_migration_expanded');
      if (savedGraphqlMigrationExpanded !== null) {
        setGraphqlMigrationExpanded(savedGraphqlMigrationExpanded === 'true');
      }
      
      const savedQueryPerformanceExpanded = localStorage.getItem('admin_query_performance_expanded');
      if (savedQueryPerformanceExpanded !== null) {
        setQueryPerformanceExpanded(savedQueryPerformanceExpanded === 'true');
      }
      
      const savedPageLoadTimesExpanded = localStorage.getItem('admin_page_load_times_expanded');
      if (savedPageLoadTimesExpanded !== null) {
        setPageLoadTimesExpanded(savedPageLoadTimesExpanded === 'true');
      }
      
      const savedRecentSamplesExpanded = localStorage.getItem('admin_recent_samples_expanded');
      if (savedRecentSamplesExpanded !== null) {
        setRecentSamplesExpanded(savedRecentSamplesExpanded === 'true');
      }
      
      const savedSnapshotsExpanded = localStorage.getItem('admin_snapshots_expanded');
      if (savedSnapshotsExpanded !== null) {
        setSnapshotsExpanded(savedSnapshotsExpanded === 'true');
      }

      // Fetch performance summary - get all operations aggregated by route for page-level view
      fetch('/api/admin/perf-samples?summary=true')
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
                    // Refresh snapshots list (fetch all snapshots, no operation filter)
                    return fetch('/api/admin/perf-snapshots?limit=20');
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

      // Fetch historical snapshots (no operation filter to show all snapshots)
      fetch('/api/admin/perf-snapshots?limit=20')
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            setSnapshots(data.snapshots || []);
          }
        })
        .catch(err => console.error('Failed to fetch snapshots:', err));

      // Fetch GraphQL feature flags
      fetch('/api/admin/graphql-flags')
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            setGraphqlFlags(data);
          }
        })
        .catch(err => console.error('Failed to fetch GraphQL flags:', err));
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
        // Note: Transaction may be pending, so we show success but note it may take a moment to appear
        // The handleTransactionWithTimeout wrapper handles receipt timeouts gracefully
        const txHash = data.snapshot?.txHash;
        if (txHash) {
          // Wait a bit longer for entity to be indexed (same pattern as other entity creation)
          await new Promise(resolve => setTimeout(resolve, 3000));
          // Fetch all snapshots (no operation filter) to show complete history
          const snapshotsRes = await fetch('/api/admin/perf-snapshots?limit=20');
          const snapshotsData = await snapshotsRes.json();
          console.log('[Admin] Snapshots data after creation:', snapshotsData);
          if (snapshotsData.ok) {
            setSnapshots(snapshotsData.snapshots || []);
            console.log('[Admin] Updated snapshots list, count:', snapshotsData.snapshots?.length || 0);
          }
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
        // Refresh performance summary to show updated data
        fetch('/api/admin/perf-samples?summary=true')
          .then(res => res.json())
          .then(summaryData => setPerfSummary(summaryData))
          .catch(err => console.error('Failed to refresh perf summary:', err));
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

        {/* Performance Section - Engineering Focused, Default Closed */}
        <section className="mb-8 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚙️</span>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                  Performance Metrics
                </h2>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                Engineering Dashboard
              </span>
              <button
                onClick={() => {
                  const newState = !performanceExpanded;
                  setPerformanceExpanded(newState);
                  localStorage.setItem('admin_performance_expanded', String(newState));
                }}
                className="ml-2 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 transition-colors"
                title={performanceExpanded ? 'Collapse performance section' : 'Expand performance section'}
              >
                {performanceExpanded ? '▼ Collapse' : '▶ Expand'}
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
            <div className="p-6 space-y-6">
          {/* GraphQL Migration Status - Collapsible Subsection */}
          <div className="border border-emerald-200 dark:border-emerald-800 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
            <div className="flex items-center justify-between p-4 border-b border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2">
                <span className="text-lg">🚀</span>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                  GraphQL Migration Status
                </h3>
              </div>
              <button
                onClick={() => {
                  const newState = !graphqlMigrationExpanded;
                  setGraphqlMigrationExpanded(newState);
                  localStorage.setItem('admin_graphql_migration_expanded', String(newState));
                }}
                className="px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 bg-white dark:bg-emerald-900/30 rounded border border-emerald-300 dark:border-emerald-700 transition-colors"
                title={graphqlMigrationExpanded ? 'Collapse migration status' : 'Expand migration status'}
              >
                {graphqlMigrationExpanded ? '▼ Collapse' : '▶ Expand'}
              </button>
            </div>
            {graphqlMigrationExpanded && (
              <div className="p-6">
                {graphqlFlags ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Migration Progress</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                          {graphqlFlags.summary.enabled} / {graphqlFlags.summary.total} pages
                        </div>
                        <div className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                          {graphqlFlags.summary.percentage}% migrated
                        </div>
                      </div>
                      <div className="w-32 h-32 relative">
                        <svg className="transform -rotate-90 w-32 h-32">
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="none"
                            className="text-gray-200 dark:text-gray-700"
                          />
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="none"
                            strokeDasharray={`${2 * Math.PI * 56}`}
                            strokeDashoffset={`${2 * Math.PI * 56 * (1 - graphqlFlags.summary.percentage / 100)}`}
                            className="text-emerald-600 dark:text-emerald-400"
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold text-gray-900 dark:text-gray-50">
                            {graphqlFlags.summary.percentage}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      {Object.entries(graphqlFlags.flags).map(([page, enabled]) => (
                        <div
                          key={page}
                          className={`p-4 rounded-lg border-2 ${
                            enabled
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700'
                              : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900 dark:text-gray-50 capitalize">
                              {page === 'me' ? '/me' : `/${page}`}
                            </span>
                            {enabled ? (
                              <span className="text-emerald-600 dark:text-emerald-400 text-lg">✓</span>
                            ) : (
                              <span className="text-gray-400 text-lg">○</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {enabled ? (
                              <span className="text-emerald-700 dark:text-emerald-300 font-medium">Using GraphQL</span>
                            ) : (
                              <span className="text-gray-500 dark:text-gray-400">Using JSON-RPC</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800">
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        <strong>Note:</strong> This shows configured feature flags. Actual usage is tracked in Performance Metrics below.
                        {perfSummary && (
                          <div className="mt-2 space-y-1">
                            {perfSummary.graphql?.pages && Object.keys(perfSummary.graphql.pages).length > 0 && (
                              <div>
                                <span className="font-medium">Pages with GraphQL queries:</span>{' '}
                                {Object.keys(perfSummary.graphql.pages).join(', ') || 'None'}
                              </div>
                            )}
                            {perfSummary.arkiv?.pages && Object.keys(perfSummary.arkiv.pages).length > 0 && (
                              <div>
                                <span className="font-medium">Pages with JSON-RPC queries:</span>{' '}
                                {Object.keys(perfSummary.arkiv.pages).join(', ') || 'None'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-600 dark:text-gray-400">Loading GraphQL migration status...</div>
                )}
              </div>
            )}
          </div>

          {/* Query Performance Comparison */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">
                Query Performance (JSON-RPC vs GraphQL)
              </h3>
              <button
                onClick={() => {
                  const newState = !queryPerformanceExpanded;
                  setQueryPerformanceExpanded(newState);
                  localStorage.setItem('admin_query_performance_expanded', String(newState));
                }}
                className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 transition-colors"
                title={queryPerformanceExpanded ? 'Collapse query performance' : 'Expand query performance'}
              >
                {queryPerformanceExpanded ? '▼ Collapse' : '▶ Expand'}
              </button>
            </div>
            {queryPerformanceExpanded && (
            <div className="p-6">
            {perfSummary ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {perfSummary.graphql && (
                    <div>
                      <h3 className="font-medium mb-2 text-gray-900 dark:text-gray-50">
                        GraphQL <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(n={perfSummary.graphql.samples})</span>
                      </h3>
                      <div className="space-y-1 text-sm">
                        <div>Avg Duration: {perfSummary.graphql.avgDurationMs.toFixed(2)}ms</div>
                        <div>Avg Payload: {perfSummary.graphql.avgPayloadBytes ? (perfSummary.graphql.avgPayloadBytes / 1024).toFixed(2) : 'N/A'} KB</div>
                        <div>HTTP Requests: {perfSummary.graphql.avgHttpRequests?.toFixed(1) || '1'}</div>
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Pages Using GraphQL:</div>
                          {perfSummary.graphql.pages && Object.keys(perfSummary.graphql.pages).length > 0 ? (
                            <div className="space-y-1">
                              {Object.entries(perfSummary.graphql.pages).map(([page, count]) => (
                                <div key={page} className="flex justify-between text-xs">
                                  <span className="text-gray-700 dark:text-gray-300">{page || '(no route)'}</span>
                                  <span className="text-gray-500 dark:text-gray-400">{count} queries</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 dark:text-gray-400">No page-level data</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {perfSummary.arkiv && (
                    <div>
                      <h3 className="font-medium mb-2 text-gray-900 dark:text-gray-50">
                        JSON-RPC <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(n={perfSummary.arkiv.samples})</span>
                      </h3>
                      <div className="space-y-1 text-sm">
                        <div>Avg Duration: {perfSummary.arkiv.avgDurationMs.toFixed(2)}ms</div>
                        <div>Avg Payload: {perfSummary.arkiv.avgPayloadBytes ? (perfSummary.arkiv.avgPayloadBytes / 1024).toFixed(2) : 'N/A'} KB</div>
                        <div>HTTP Requests: {perfSummary.arkiv.avgHttpRequests?.toFixed(1) || 'N/A'}</div>
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Pages Using JSON-RPC:</div>
                          {perfSummary.arkiv.pages && Object.keys(perfSummary.arkiv.pages).length > 0 ? (
                            <div className="space-y-1">
                              {Object.entries(perfSummary.arkiv.pages).map(([page, count]) => (
                                <div key={page} className="flex justify-between text-xs">
                                  <span className="text-gray-700 dark:text-gray-300">{page || '(no route)'}</span>
                                  <span className="text-gray-500 dark:text-gray-400">{count} queries</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 dark:text-gray-400">No page-level data</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">No performance data yet. Metrics will appear as requests are made.</p>
            )}
            </div>
            )}
          </div>

          {/* Page Load Times */}
          <div className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">
                Page Load Times
              </h3>
              <button
                onClick={() => {
                  const newState = !pageLoadTimesExpanded;
                  setPageLoadTimesExpanded(newState);
                  localStorage.setItem('admin_page_load_times_expanded', String(newState));
                }}
                className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 transition-colors"
                title={pageLoadTimesExpanded ? 'Collapse page load times' : 'Expand page load times'}
              >
                {pageLoadTimesExpanded ? '▼ Collapse' : '▶ Expand'}
              </button>
            </div>
            {pageLoadTimesExpanded && (
            <div className="p-6">
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
                      <div key={idx} className="py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700 dark:text-gray-300 font-medium">{result.page}</span>
                          <div className="flex items-center gap-4">
                            <span className={result.status === 200 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                              {result.status === 200 ? `${result.durationMs}ms` : 'Failed'}
                            </span>
                          </div>
                        </div>
                        {/* Show which method this page uses (if we have that data) */}
                        {perfSummary && (() => {
                          // Normalize route for matching: profile pages use /profiles/[wallet] in summary
                          const normalizedRoute = result.page.startsWith('/profiles/') && result.page !== '/profiles'
                            ? '/profiles/[wallet]'
                            : result.page;
                          
                          const graphqlCount = perfSummary.graphql?.pages?.[normalizedRoute] || perfSummary.graphql?.pages?.[result.page];
                          const arkivCount = perfSummary.arkiv?.pages?.[normalizedRoute] || perfSummary.arkiv?.pages?.[result.page];
                          
                          return (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex gap-4">
                              {graphqlCount && (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  GraphQL: {graphqlCount} queries
                                </span>
                              )}
                              {arkivCount && (
                                <span className="text-blue-600 dark:text-blue-400">
                                  JSON-RPC: {arkivCount} queries
                                </span>
                              )}
                              {(!graphqlCount && !arkivCount) && (
                                <span>No query data for this page</span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400">Loading page load times...</p>
              )}
            </div>
            )}
          </div>

          {/* Recent Performance Samples */}
          <div className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">
                Recent Performance Samples
              </h3>
              <button
                onClick={() => {
                  const newState = !recentSamplesExpanded;
                  setRecentSamplesExpanded(newState);
                  localStorage.setItem('admin_recent_samples_expanded', String(newState));
                }}
                className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 transition-colors"
                title={recentSamplesExpanded ? 'Collapse recent samples' : 'Expand recent samples'}
              >
                {recentSamplesExpanded ? '▼ Collapse' : '▶ Expand'}
              </button>
            </div>
            {recentSamplesExpanded && (
            <div className="p-6">
            <div className="bg-white dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
              {perfSamples.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Source</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Operation</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Duration (ms)</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Payload (KB)</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">HTTP Req</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Verify</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfSamples.slice(0, 10).map((sample, idx) => (
                      <tr key={idx} className="border-t border-gray-200 dark:border-gray-700">
                        <td className="px-4 py-2 text-sm font-mono text-xs">{sample.source}</td>
                        <td className="px-4 py-2 text-sm font-mono text-xs">{sample.operation}</td>
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
                <div className="p-6 text-gray-600 dark:text-gray-400 text-sm">
                  No performance samples yet. Metrics will appear as requests are made.
                </div>
              )}
            </div>
            </div>
            )}
          </div>

          {/* Historical Performance Snapshots */}
          <div className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">
                Historical Performance Snapshots
              </h3>
              <button
                onClick={() => {
                  const newState = !snapshotsExpanded;
                  setSnapshotsExpanded(newState);
                  localStorage.setItem('admin_snapshots_expanded', String(newState));
                }}
                className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 transition-colors"
                title={snapshotsExpanded ? 'Collapse snapshots' : 'Expand snapshots'}
              >
                {snapshotsExpanded ? '▼ Collapse' : '▶ Expand'}
              </button>
            </div>
            {snapshotsExpanded && (
            <div className="p-6">
            <div className="bg-white dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
              {snapshots.length > 0 ? (
                <div className="space-y-4">
                  {snapshots.map((snapshot, idx) => (
                    <div key={snapshot.key} className="border-b border-gray-200 dark:border-gray-700 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-50">
                            {new Date(snapshot.timestamp).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                            Method: {snapshot.method} • Operation: {snapshot.operation}
                            {snapshot.arkivMetadata?.blockHeight !== undefined && (
                              <span className="ml-2 text-gray-500 dark:text-gray-500">
                                • Block: {snapshot.arkivMetadata.blockHeight}
                              </span>
                            )}
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
                          <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                            <div className="font-medium mb-2 text-gray-900 dark:text-gray-50">
                              JSON-RPC <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(n={snapshot.arkiv.samples})</span>
                            </div>
                            <div className="space-y-1 text-xs">
                              <div>Avg: {snapshot.arkiv.avgDurationMs.toFixed(0)}ms</div>
                              <div>Range: {snapshot.arkiv.minDurationMs}ms - {snapshot.arkiv.maxDurationMs}ms</div>
                              <div>Samples: {snapshot.arkiv.samples}</div>
                              {snapshot.arkiv.pages && Object.keys(snapshot.arkiv.pages).length > 0 && (
                                <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-600">
                                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Pages:</div>
                                  {Object.entries(snapshot.arkiv.pages).map(([page, count]) => (
                                    <div key={page} className="flex justify-between text-xs">
                                      <span className="text-gray-700 dark:text-gray-300">{page}</span>
                                      <span className="text-gray-500 dark:text-gray-400">{count} queries</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {snapshot.graphql && (
                          <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                            <div className="font-medium mb-2 text-gray-900 dark:text-gray-50">
                              GraphQL <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(n={snapshot.graphql.samples})</span>
                            </div>
                            <div className="space-y-1 text-xs">
                              <div>Avg: {snapshot.graphql.avgDurationMs.toFixed(0)}ms</div>
                              <div>Range: {snapshot.graphql.minDurationMs}ms - {snapshot.graphql.maxDurationMs}ms</div>
                              <div>Samples: {snapshot.graphql.samples}</div>
                              {snapshot.graphql.pages && Object.keys(snapshot.graphql.pages).length > 0 && (
                                <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-600">
                                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Pages:</div>
                                  {Object.entries(snapshot.graphql.pages).map(([page, count]) => (
                                    <div key={page} className="flex justify-between text-xs">
                                      <span className="text-gray-700 dark:text-gray-300">{page}</span>
                                      <span className="text-gray-500 dark:text-gray-400">{count} queries</span>
                                    </div>
                                  ))}
                                </div>
                              )}
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
                <p className="text-gray-600 dark:text-gray-400 text-sm">No snapshots yet. Create one to start tracking performance over time.</p>
              )}
            </div>
            </div>
            )}
          </div>
            </div>
          )}
        </section>

        {/* Feedback Section - Customer Focused, Default Open */}
        <section className="mb-8 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between p-4 border-b border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                  User Feedback
                </h2>
              </div>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                Customer Support
              </span>
              <button
                onClick={() => {
                  const newState = !feedbackExpanded;
                  setFeedbackExpanded(newState);
                  localStorage.setItem('admin_feedback_expanded', String(newState));
                }}
                className="ml-2 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-white dark:bg-blue-900/30 rounded border border-blue-300 dark:border-blue-700 transition-colors"
                title={feedbackExpanded ? 'Collapse feedback section' : 'Expand feedback section'}
              >
                {feedbackExpanded ? '▼ Collapse' : '▶ Expand'}
              </button>
            </div>
            {feedbackExpanded && (
              <Link
                href="/admin/feedback"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                View All Feedback
              </Link>
            )}
          </div>
          {feedbackExpanded && (
            <div className="p-6">
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
          )}
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

