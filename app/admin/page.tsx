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
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';

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
  const arkivBuilderMode = useArkivBuilderMode();
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
  const [clientPerfExpanded, setClientPerfExpanded] = useState(false); // Default collapsed - engineering
  const [retentionExpanded, setRetentionExpanded] = useState(false); // Default collapsed - engineering
  const [aggregatesExpanded, setAggregatesExpanded] = useState(false); // Default collapsed - engineering
  const [clientPerfData, setClientPerfData] = useState<any[]>([]);
  const [clientPerfLoading, setClientPerfLoading] = useState(false);
  const [retentionData, setRetentionData] = useState<any[]>([]);
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [loadingExampleWallet, setLoadingExampleWallet] = useState(false);
  const [aggregatesData, setAggregatesData] = useState<any[]>([]);
  const [aggregatesLoading, setAggregatesLoading] = useState(false);
  const [staticClientExpanded, setStaticClientExpanded] = useState(false);
  const [betaCodeUsageExpanded, setBetaCodeUsageExpanded] = useState(false);
  const [betaCodeUsageData, setBetaCodeUsageData] = useState<any>(null);
  const [betaCodeUsageLoading, setBetaCodeUsageLoading] = useState(false);
  const [navigationMetricsExpanded, setNavigationMetricsExpanded] = useState(false);
  const [navigationMetricsData, setNavigationMetricsData] = useState<any[]>([]);
  const [navigationMetricsLoading, setNavigationMetricsLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [buildStatus, setBuildStatus] = useState<{ lastBuild?: string; fileCount?: number; entityCounts?: any } | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | 'all'>('beta-launch');

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

      // Load spaceId preference
      const savedSpaceId = localStorage.getItem('admin_space_id');
      if (savedSpaceId && (savedSpaceId === 'all' || ['beta-launch', 'local-dev', 'local-dev-seed'].includes(savedSpaceId))) {
        setSelectedSpaceId(savedSpaceId as string | 'all');
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

      const savedStaticClientExpanded = localStorage.getItem('admin_static_client_expanded');
      if (savedStaticClientExpanded !== null) {
        setStaticClientExpanded(savedStaticClientExpanded === 'true');
      }

      const savedBetaCodeUsageExpanded = localStorage.getItem('admin_beta_code_usage_expanded');
      if (savedBetaCodeUsageExpanded !== null) {
        setBetaCodeUsageExpanded(savedBetaCodeUsageExpanded === 'true');
      }

      const savedNavigationMetricsExpanded = localStorage.getItem('admin_navigation_metrics_expanded');
      if (savedNavigationMetricsExpanded !== null) {
        setNavigationMetricsExpanded(savedNavigationMetricsExpanded === 'true');
      }
    }
  }, [authenticated]);

  // Helper function to build spaceId query params
  const buildSpaceIdParams = () => {
    return selectedSpaceId === 'all'
      ? '&spaceIds=beta-launch,local-dev,local-dev-seed'
      : `&spaceId=${selectedSpaceId}`;
  };

  // Reload data when spaceId changes
  useEffect(() => {
    if (!authenticated) return;

    const spaceIdParams = buildSpaceIdParams();

    // Fetch performance summary - get all operations aggregated by route for page-level view
    fetch(`/api/admin/perf-samples?summary=true${spaceIdParams}`)
        .then(res => res.json())
        .then(data => setPerfSummary(data))
        .catch(err => console.error('Failed to fetch perf summary:', err));

      // Fetch recent samples (from Arkiv entities if available)
      fetch(`/api/admin/perf-samples?limit=20${spaceIdParams}`)
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
      fetch(`/api/app-feedback?limit=5${spaceIdParams}`)
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            setRecentFeedback(data.feedbacks || []);
          }
        })
        .catch(err => console.error('Failed to fetch feedback:', err));

      // Check if auto-snapshot should be created
      fetch(`/api/admin/perf-snapshots?checkAuto=true&operation=buildNetworkGraphData${spaceIdParams}`)
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
              fetch(`/api/admin/perf-snapshots?operation=buildNetworkGraphData&method=both${spaceIdParams}`)
                .then(snapRes => snapRes.json())
                .then(snapData => {
                  if (snapData.ok) {
                    console.log('[Admin] Auto-created performance snapshot');
                    // Refresh snapshots list (fetch all snapshots, no operation filter)
                    return fetch(`/api/admin/perf-snapshots?limit=20${spaceIdParams}`);
                  }
                })
                .then(snapshotsRes => snapshotsRes?.json())
                .then(snapshotsData => {
                  if (snapshotsData?.ok) {
                    setSnapshots(snapshotsData.snapshots || []);
                  }
                  // Update check status
                  return fetch(`/api/admin/perf-snapshots?checkAuto=true&operation=buildNetworkGraphData${spaceIdParams}`);
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
      fetch(`/api/admin/perf-snapshots?limit=20${spaceIdParams}`)
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

      // Fetch static client build status
      fetch('/api/admin/rebuild-static')
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            setBuildStatus(data);
          }
        })
        .catch(err => console.error('Failed to fetch build status:', err));

      // Refresh beta code usage if section is expanded
      if (betaCodeUsageExpanded) {
        setBetaCodeUsageLoading(true);
        fetch(`/api/admin/beta-code-usage${spaceIdParams}`)
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return res.json();
          })
          .then(data => {
            if (data.ok) {
              setBetaCodeUsageData(data);
            } else {
              console.error('Beta code usage API error:', data.error);
              setBetaCodeUsageData({
                error: data.error || 'Failed to fetch beta code usage',
                summary: { totalCodes: 0, totalUsage: 0, totalLimit: 0, totalWallets: 0, codesAtLimit: 0, codesAvailable: 0, utilizationRate: 0 },
                codes: []
              });
            }
          })
          .catch(err => {
            console.error('Failed to fetch beta code usage:', err);
            setBetaCodeUsageData({
              error: err.message || 'Failed to fetch beta code usage',
              summary: { totalCodes: 0, totalUsage: 0, totalLimit: 0, totalWallets: 0, codesAtLimit: 0, codesAvailable: 0, utilizationRate: 0 },
              codes: []
            });
          })
          .finally(() => setBetaCodeUsageLoading(false));
      }
  }, [authenticated, selectedSpaceId, betaCodeUsageExpanded]);

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

  const handleExampleWalletLogin = async () => {
    try {
      setLoadingExampleWallet(true);
      const res = await fetch('/api/wallet');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 503) {
          alert('Example wallet not available. Please set ARKIV_PRIVATE_KEY in your .env file.');
          return;
        }
        throw new Error(errorData.error || 'Failed to fetch example wallet');
      }
      const data = await res.json();
      if (!data.address) {
        throw new Error('No example wallet available');
      }
      // Store profile wallet address in localStorage for session persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet_address', data.address);
      }
      // Redirect to dashboard
      window.location.href = '/me';
    } catch (err: any) {
      console.error('Failed to load example wallet:', err);
      alert(err.message || 'Failed to load example wallet');
    } finally {
      setLoadingExampleWallet(false);
    }
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
    <main className="min-h-screen text-gray-900 dark:text-gray-100 p-8">
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
          <div className="flex items-center gap-4">
            {/* SpaceId Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="spaceId" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Space:
              </label>
              <select
                id="spaceId"
                value={selectedSpaceId}
                onChange={(e) => {
                  const newSpaceId = e.target.value as string | 'all';
                  setSelectedSpaceId(newSpaceId);
                  localStorage.setItem('admin_space_id', newSpaceId);
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="beta-launch">Beta Launch</option>
                <option value="local-dev">Local Dev</option>
                <option value="local-dev-seed">Seed Data</option>
                <option value="all">All Spaces</option>
              </select>
            </div>
            <button
              onClick={handleExampleWalletLogin}
              disabled={loadingExampleWallet}
              className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Log in with default wallet (admin only)"
            >
              {loadingExampleWallet ? 'Loading...' : 'Default Wallet'}
            </button>
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
                <ArkivQueryTooltip
                  query={[
                    `GET /api/admin/perf-samples?seed=true&method=${testMethod}`,
                    'Creates: type="perf_sample" entities',
                    'Attributes: operation, method, timestamp, spaceId',
                    'Payload: durationMs, payloadBytes, httpRequests, page',
                    'TTL: 90 days (7776000 seconds)',
                    'Creates parallel: perf_sample_txhash entities'
                  ]}
                  label="Test Query Performance Action"
                >
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
                </ArkivQueryTooltip>
                <ArkivQueryTooltip
                  query={[
                    'POST /api/admin/perf-snapshots',
                    'Creates: type="perf_snapshot" entity',
                    'Attributes: operation, method, timestamp, spaceId',
                    'Payload: graphql metrics, arkiv metrics, pageLoadTimes',
                    'TTL: 1 year (31536000 seconds)',
                    'Creates parallel: perf_snapshot_txhash entity'
                  ]}
                  label="Create Snapshot Action"
                >
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
                </ArkivQueryTooltip>
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
              <ArkivQueryTooltip
                query={[
                  'GET /api/admin/perf-samples?summary=true',
                  'Query: listPerfSamples({ summary: true })',
                  'Returns: PerfSummary with aggregated metrics',
                  'Entity Type: perf_sample',
                  'TTL: 90 days'
                ]}
                label="Performance Summary Data"
              >
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
              </ArkivQueryTooltip>
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
            <ArkivQueryTooltip
              query={[
                'GET /api/admin/perf-samples?limit=20',
                'Query: listPerfSamples({ limit: 20 })',
                'Returns: PerfSample[]',
                'Entity Type: perf_sample',
                'TTL: 90 days'
              ]}
              label="Recent Performance Samples Query"
            >
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
                              <ViewOnArkivLink
                                txHash={sample.txHash}
                                entityKey={sample.key}
                                label=""
                                icon=""
                                className="text-xs"
                              />
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
            </ArkivQueryTooltip>
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
                <ArkivQueryTooltip
                  query={[
                    'GET /api/admin/perf-snapshots?limit=20',
                    'Query: listPerfSnapshots({ limit: 20 })',
                    'Returns: PerfSnapshot[]',
                    'Entity Type: perf_snapshot',
                    'TTL: 1 year'
                  ]}
                  label="Performance Snapshots Query"
                >
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
                          <ViewOnArkivLink
                            txHash={snapshot.txHash}
                            entityKey={snapshot.key}
                            label="View on Arkiv"
                          />
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
                </ArkivQueryTooltip>
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

        {/* Beta Metrics Section - Engineering Focused, Default Closed */}
        <section className="mb-8 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                  Beta Metrics
                </h2>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                Engineering Dashboard
              </span>
            </div>
          </div>

          {/* Client Performance Metrics */}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">
                Client Performance (Web Vitals)
              </h3>
              <button
                onClick={() => {
                  const newState = !clientPerfExpanded;
                  setClientPerfExpanded(newState);
                  localStorage.setItem('admin_client_perf_expanded', String(newState));
                  // Fetch data when expanded
                  if (newState && clientPerfData.length === 0 && !clientPerfLoading) {
                    setClientPerfLoading(true);
                    fetch('/api/client-perf?limit=50')
                      .then(res => res.json())
                      .then(data => {
                        if (data.ok) {
                          setClientPerfData(data.metrics || []);
                        }
                      })
                      .catch(err => console.error('Failed to fetch client perf:', err))
                      .finally(() => setClientPerfLoading(false));
                  }
                }}
                className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 transition-colors"
              >
                {clientPerfExpanded ? '▼ Collapse' : '▶ Expand'}
              </button>
            </div>
            {clientPerfExpanded && (
              <div className="p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Privacy-preserving client-side performance metrics (TTFB, FCP, LCP, FID, CLS, TTI).
                  All metrics stored as Arkiv entities for transparency.
                </p>
                {clientPerfLoading ? (
                  <ArkivQueryTooltip
                    query={[
                      'GET /api/client-perf?limit=50',
                      'Query: listClientPerfMetrics({ limit: 50 })',
                      'Returns: ClientPerfMetric[]',
                      'Entity Type: client_perf_metric',
                      'TTL: 90 days'
                    ]}
                    label="Client Performance Query"
                  >
                    <div className="text-center py-4">
                      <div className="inline-block w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Loading metrics...</p>
                    </div>
                  </ArkivQueryTooltip>
                ) : clientPerfData.length > 0 ? (
                  <div className="space-y-4">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Total Samples</div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">{clientPerfData.length}</div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Avg TTFB</div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                          {(() => {
                            const withTtfb = clientPerfData.filter(m => m.ttfb);
                            return withTtfb.length > 0
                              ? `${Math.round(withTtfb.reduce((sum, m) => sum + (m.ttfb || 0), 0) / withTtfb.length)}ms`
                              : '-';
                          })()}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Avg LCP</div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                          {(() => {
                            const withLcp = clientPerfData.filter(m => m.lcp);
                            return withLcp.length > 0
                              ? `${Math.round(withLcp.reduce((sum, m) => sum + (m.lcp || 0), 0) / withLcp.length)}ms`
                              : '-';
                          })()}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Avg FCP</div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                          {(() => {
                            const withFcp = clientPerfData.filter(m => m.fcp);
                            return withFcp.length > 0
                              ? `${Math.round(withFcp.reduce((sum, m) => sum + (m.fcp || 0), 0) / withFcp.length)}ms`
                              : '-';
                          })()}
                        </div>
                      </div>
                    </div>
                    {/* Data Table */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm border border-gray-200 dark:border-gray-700">
                        <thead className="bg-gray-100 dark:bg-gray-800">
                          <tr>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Page</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">TTFB (ms)</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">FCP (ms)</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">LCP (ms)</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">FID (ms)</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">CLS</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientPerfData.slice(0, 20).map((metric, idx) => (
                            <tr key={metric.key || idx} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="px-3 py-2 font-mono text-xs">{metric.page || '-'}</td>
                              <td className="px-3 py-2">{metric.ttfb || '-'}</td>
                              <td className="px-3 py-2">{metric.fcp || '-'}</td>
                              <td className="px-3 py-2">{metric.lcp || '-'}</td>
                              <td className="px-3 py-2">{metric.fid || '-'}</td>
                              <td className="px-3 py-2">{metric.cls !== undefined ? metric.cls.toFixed(3) : '-'}</td>
                              <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                                {new Date(metric.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* JSON Data (Machine Readable) */}
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
                        View Raw JSON Data (Machine Readable)
                      </summary>
                      <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto border border-gray-200 dark:border-gray-700">
                        {JSON.stringify(clientPerfData, null, 2)}
                      </pre>
                    </details>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400">No client performance metrics available yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Beta Code Usage */}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">
                Beta Code Usage
              </h3>
              <button
                onClick={() => {
                  const newState = !betaCodeUsageExpanded;
                  setBetaCodeUsageExpanded(newState);
                  localStorage.setItem('admin_beta_code_usage_expanded', String(newState));
                  // Fetch data when expanded
                  if (newState && !betaCodeUsageLoading) {
                    setBetaCodeUsageLoading(true);
                    const spaceIdParams = buildSpaceIdParams();
                    fetch(`/api/admin/beta-code-usage${spaceIdParams}`)
                      .then(res => {
                        if (!res.ok) {
                          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                        }
                        return res.json();
                      })
                      .then(data => {
                        if (data.ok) {
                          setBetaCodeUsageData(data);
                        } else {
                          console.error('Beta code usage API error:', data.error);
                          setBetaCodeUsageData({
                            error: data.error || 'Failed to fetch beta code usage',
                            summary: { totalCodes: 0, totalUsage: 0, totalLimit: 0, totalWallets: 0, codesAtLimit: 0, codesAvailable: 0, utilizationRate: 0 },
                            codes: []
                          });
                        }
                      })
                      .catch(err => {
                        console.error('Failed to fetch beta code usage:', err);
                        setBetaCodeUsageData({
                          error: err.message || 'Failed to fetch beta code usage',
                          summary: { totalCodes: 0, totalUsage: 0, totalLimit: 0, totalWallets: 0, codesAtLimit: 0, codesAvailable: 0, utilizationRate: 0 },
                          codes: []
                        });
                      })
                      .finally(() => setBetaCodeUsageLoading(false));
                  }
                }}
                className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 transition-colors"
              >
                {betaCodeUsageExpanded ? '▼ Collapse' : '▶ Expand'}
              </button>
            </div>
            {betaCodeUsageExpanded && (
              <div className="p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Track beta code usage and limits. All data stored as Arkiv entities for transparency.
                </p>
                {betaCodeUsageLoading ? (
                  <div className="text-center py-4">
                    <div className="inline-block w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Loading beta code usage...</p>
                  </div>
                ) : betaCodeUsageData ? (
                  <div className="space-y-4">
                    {/* Error Message */}
                    {betaCodeUsageData.error && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mb-4">
                        <p className="text-sm text-red-700 dark:text-red-400">
                          <strong>Error:</strong> {betaCodeUsageData.error}
                        </p>
                      </div>
                    )}

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Total Codes</div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">{betaCodeUsageData.summary?.totalCodes || 0}</div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Total Usage</div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                          {betaCodeUsageData.summary?.totalUsage || 0} / {betaCodeUsageData.summary?.totalLimit || 0}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {betaCodeUsageData.summary?.utilizationRate?.toFixed(1) || '0.0'}% utilized
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Unique Wallets</div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">{betaCodeUsageData.summary?.totalWallets || 0}</div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Available</div>
                        <div className="text-lg font-semibold text-green-600 dark:text-green-400">{betaCodeUsageData.summary?.codesAvailable || 0}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {betaCodeUsageData.summary?.codesAtLimit || 0} at limit
                        </div>
                      </div>
                    </div>

                    {/* Codes Table */}
                    {betaCodeUsageData.codes && betaCodeUsageData.codes.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm border border-gray-200 dark:border-gray-700">
                          <thead className="bg-gray-100 dark:bg-gray-800">
                            <tr>
                              <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Code</th>
                              <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Usage</th>
                              <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Limit</th>
                              <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Status</th>
                              <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Wallets</th>
                              <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Created</th>
                              <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Verify</th>
                            </tr>
                          </thead>
                          <tbody>
                            {betaCodeUsageData.codes.map((code: any, idx: number) => {
                              const usagePercent = code.limit > 0 ? (code.usageCount / code.limit) * 100 : 0;
                              const isAtLimit = code.usageCount >= code.limit;
                              return (
                                <tr key={code.key || idx} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                  <td className="px-3 py-2 font-mono text-xs font-medium">{code.code}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className={isAtLimit ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                                        {code.usageCount}
                                      </span>
                                      <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full ${
                                            isAtLimit
                                              ? 'bg-red-500'
                                              : usagePercent > 80
                                              ? 'bg-amber-500'
                                              : 'bg-green-500'
                                          }`}
                                          style={{ width: `${Math.min(usagePercent, 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">{code.limit}</td>
                                  <td className="px-3 py-2">
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      isAtLimit
                                        ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                        : usagePercent > 80
                                        ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                                        : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                    }`}>
                                      {isAtLimit ? 'At Limit' : usagePercent > 80 ? 'Near Limit' : 'Available'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">
                                      {code.walletCount || 0} wallet{code.walletCount !== 1 ? 's' : ''}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(code.createdAt).toLocaleDateString()}
                                  </td>
                                  <td className="px-3 py-2">
                                    {code.txHash ? (
                                      <a
                                        href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${code.txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                                        title="Verify on-chain"
                                      >
                                        🔗
                                      </a>
                                    ) : (
                                      <span className="text-gray-400 text-xs">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-gray-400">No beta codes found.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400">No beta code usage data available.</p>
                )}
              </div>
            )}
          </div>

          {/* Retention Metrics */}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">
                Retention Cohorts
              </h3>
              <button
                onClick={() => {
                  const newState = !retentionExpanded;
                  setRetentionExpanded(newState);
                  localStorage.setItem('admin_retention_expanded', String(newState));
                  // Fetch data when expanded
                  if (newState && retentionData.length === 0 && !retentionLoading) {
                    setRetentionLoading(true);
                    const spaceIdParams = buildSpaceIdParams();
                    fetch(`/api/admin/retention-cohorts?limit=20&period=weekly${spaceIdParams}`)
                      .then(res => res.json())
                      .then(data => {
                        if (data.ok) {
                          setRetentionData(data.cohorts || []);
                        }
                      })
                      .catch(err => console.error('Failed to fetch retention:', err))
                      .finally(() => setRetentionLoading(false));
                  }
                }}
                className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 transition-colors"
              >
                {retentionExpanded ? '▼ Collapse' : '▶ Expand'}
              </button>
            </div>
            {retentionExpanded && (
              <div className="p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Privacy-preserving retention analysis using one-way hashed wallets.
                  Weekly cohorts computed via Vercel Cron.
                </p>
                {retentionLoading ? (
                  <ArkivQueryTooltip
                    query={[
                      'GET /api/admin/retention-cohorts?limit=20&period=weekly',
                      'Query: listRetentionCohorts({ limit: 20, period: "weekly" })',
                      'Returns: RetentionCohort[]',
                      'Entity Type: retention_cohort',
                      'TTL: Permanent (no expiration)'
                    ]}
                    label="Retention Cohorts Query"
                  >
                    <div className="text-center py-4">
                      <div className="inline-block w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Loading retention data...</p>
                    </div>
                  </ArkivQueryTooltip>
                ) : retentionData.length > 0 ? (
                  <div className="space-y-4">
                    {/* Cohort Table */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm border border-gray-200 dark:border-gray-700">
                        <thead className="bg-gray-100 dark:bg-gray-800">
                          <tr>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Cohort Date</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Day 0</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Day 1</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Day 7</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Day 14</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Day 30</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Retention Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {retentionData.map((cohort, idx) => {
                            const day0 = cohort.day0 || 0;
                            const day7 = cohort.day7 || 0;
                            const retention7d = day0 > 0 ? ((day7 / day0) * 100).toFixed(1) : '0.0';
                            return (
                              <tr key={cohort.key || idx} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="px-3 py-2 font-mono text-xs">{cohort.cohortDate || '-'}</td>
                                <td className="px-3 py-2">{day0}</td>
                                <td className="px-3 py-2">{cohort.day1 || '-'}</td>
                                <td className="px-3 py-2">{cohort.day7 || '-'}</td>
                                <td className="px-3 py-2">{cohort.day14 || '-'}</td>
                                <td className="px-3 py-2">{cohort.day30 || '-'}</td>
                                <td className="px-3 py-2 font-semibold">{retention7d}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* JSON Data */}
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
                        View Raw JSON Data (Machine Readable)
                      </summary>
                      <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto border border-gray-200 dark:border-gray-700">
                        {JSON.stringify(retentionData, null, 2)}
                      </pre>
                    </details>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400">No retention cohorts available yet. Cohorts are computed weekly.</p>
                )}
              </div>
            )}
          </div>

          {/* Metric Aggregates */}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">
                Daily Aggregates (Percentiles)
              </h3>
              <button
                onClick={() => {
                  const newState = !aggregatesExpanded;
                  setAggregatesExpanded(newState);
                  localStorage.setItem('admin_aggregates_expanded', String(newState));
                  // Fetch data when expanded
                  if (newState && aggregatesData.length === 0 && !aggregatesLoading) {
                    setAggregatesLoading(true);
                    // Get recent aggregates (last 7 days)
                    const spaceIdParams = buildSpaceIdParams();
                    fetch(`/api/admin/metric-aggregates?limit=50&period=daily${spaceIdParams}`)
                      .then(res => res.json())
                      .then(data => {
                        if (data.ok) {
                          setAggregatesData(data.aggregates || []);
                        }
                      })
                      .catch(err => console.error('Failed to fetch aggregates:', err))
                      .finally(() => setAggregatesLoading(false));
                  }
                }}
                className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 transition-colors"
              >
                {aggregatesExpanded ? '▼ Collapse' : '▶ Expand'}
              </button>
            </div>
            {aggregatesExpanded && (
              <div className="p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Pre-computed daily aggregates with percentiles (p50/p90/p95/p99), error rates, and fallback rates.
                  Computed daily via Vercel Cron.
                </p>
                {aggregatesLoading ? (
                  <ArkivQueryTooltip
                    query={[
                      'GET /api/admin/metric-aggregates?limit=50&period=daily',
                      'Query: listMetricAggregates({ limit: 50, period: "daily" })',
                      'Returns: MetricAggregate[]',
                      'Entity Type: metric_aggregate',
                      'TTL: Permanent (no expiration)'
                    ]}
                    label="Metric Aggregates Query"
                  >
                    <div className="text-center py-4">
                      <div className="inline-block w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Loading aggregates...</p>
                    </div>
                  </ArkivQueryTooltip>
                ) : aggregatesData.length > 0 ? (
                  <div className="space-y-4">
                    {/* Aggregates Table */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm border border-gray-200 dark:border-gray-700">
                        <thead className="bg-gray-100 dark:bg-gray-800">
                          <tr>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Date</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Operation</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Source</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">p50</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">p90</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">p95</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">p99</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Avg</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Samples</th>
                            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Error Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aggregatesData.map((agg, idx) => (
                            <tr key={agg.key || idx} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="px-3 py-2 font-mono text-xs">{agg.date || '-'}</td>
                              <td className="px-3 py-2 text-xs">{agg.operation || '-'}</td>
                              <td className="px-3 py-2 text-xs">{agg.source || '-'}</td>
                              <td className="px-3 py-2">{agg.percentiles?.p50 ? `${Math.round(agg.percentiles.p50)}ms` : '-'}</td>
                              <td className="px-3 py-2">{agg.percentiles?.p90 ? `${Math.round(agg.percentiles.p90)}ms` : '-'}</td>
                              <td className="px-3 py-2">{agg.percentiles?.p95 ? `${Math.round(agg.percentiles.p95)}ms` : '-'}</td>
                              <td className="px-3 py-2">{agg.percentiles?.p99 ? `${Math.round(agg.percentiles.p99)}ms` : '-'}</td>
                              <td className="px-3 py-2">{agg.percentiles?.avg ? `${Math.round(agg.percentiles.avg)}ms` : '-'}</td>
                              <td className="px-3 py-2">{agg.percentiles?.sampleCount || '-'}</td>
                              <td className="px-3 py-2">{agg.errorRate !== undefined ? `${(agg.errorRate * 100).toFixed(1)}%` : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* JSON Data */}
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
                        View Raw JSON Data (Machine Readable)
                      </summary>
                      <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto border border-gray-200 dark:border-gray-700">
                        {JSON.stringify(aggregatesData, null, 2)}
                      </pre>
                    </details>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400">No daily aggregates available yet. Aggregates are computed daily.</p>
                )}
              </div>
            )}
          </div>

          {/* Navigation Metrics */}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">
                Navigation Metrics
              </h3>
              <button
                onClick={() => {
                  const newState = !navigationMetricsExpanded;
                  setNavigationMetricsExpanded(newState);
                  localStorage.setItem('admin_navigation_metrics_expanded', String(newState));
                  // Fetch data when expanded
                  if (newState && navigationMetricsData.length === 0 && !navigationMetricsLoading) {
                    setNavigationMetricsLoading(true);
                    const spaceIdParams = buildSpaceIdParams();
                    fetch(`/api/admin/navigation-metrics?limit=100${spaceIdParams}`)
                      .then(res => res.json())
                      .then(data => {
                        if (data.ok) {
                          setNavigationMetricsData(data.metrics || []);
                        }
                      })
                      .catch(err => console.error('Failed to fetch navigation metrics:', err))
                      .finally(() => setNavigationMetricsLoading(false));
                  }
                }}
                className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 transition-colors"
              >
                {navigationMetricsExpanded ? '▼ Collapse' : '▶ Expand'}
              </button>
            </div>
            {navigationMetricsExpanded && (
              <div className="p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Privacy-preserving aggregated navigation and click tracking. Data aggregated locally before submission (no individual tracking).
                  Expires after 90 days.
                </p>
                {navigationMetricsLoading ? (
                  <ArkivQueryTooltip
                    query={[
                      'GET /api/admin/navigation-metrics?limit=100',
                      'Query: listNavigationMetrics({ limit: 100 })',
                      'Returns: NavigationMetric[]',
                      'Entity Type: navigation_metric',
                      'TTL: 90 days'
                    ]}
                    label="Navigation Metrics Query"
                  >
                    <div className="text-center py-4">
                      <div className="inline-block w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Loading navigation metrics...</p>
                    </div>
                  </ArkivQueryTooltip>
                ) : navigationMetricsData.length > 0 ? (
                  <div className="space-y-4">
                    {/* Aggregate summary */}
                    {(() => {
                      // Aggregate all patterns across all metrics
                      const patternMap = new Map<string, number>();
                      navigationMetricsData.forEach((metric: any) => {
                        metric.aggregates.forEach((agg: { pattern: string; count: number }) => {
                          const current = patternMap.get(agg.pattern) || 0;
                          patternMap.set(agg.pattern, current + agg.count);
                        });
                      });

                      const topPatterns = Array.from(patternMap.entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 20);

                      // Categorize patterns for visualization
                      const clickPatterns = topPatterns.filter(([p]) => p.startsWith('click:'));
                      const navPatterns = topPatterns.filter(([p]) => p.includes('→') || (!p.startsWith('click:') && !p.startsWith('action:')));
                      const actionPatterns = topPatterns.filter(([p]) => p.startsWith('action:'));

                      return (
                        <div className="mb-6 space-y-6">
                          {/* Visual Summary Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Patterns</div>
                              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{topPatterns.length}</div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Events</div>
                              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {topPatterns.reduce((sum, [, count]) => sum + count, 0)}
                              </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Top Pattern</div>
                              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate" title={topPatterns[0]?.[0]}>
                                {topPatterns[0]?.[0] || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {topPatterns[0]?.[1] || 0} events
                              </div>
                            </div>
                          </div>

                          {/* Pattern Type Breakdown */}
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                            <h5 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-3">Pattern Type Breakdown</h5>
                            <div className="space-y-3">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-700 dark:text-gray-300">Click Patterns</span>
                                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                    {clickPatterns.reduce((sum, [, count]) => sum + count, 0)}
                                  </span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 dark:bg-blue-600 rounded-full"
                                    style={{ width: `${(clickPatterns.reduce((sum, [, count]) => sum + count, 0) / topPatterns.reduce((sum, [, count]) => sum + count, 1)) * 100}%` }}
                                  />
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-700 dark:text-gray-300">Navigation Patterns</span>
                                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                    {navPatterns.reduce((sum, [, count]) => sum + count, 0)}
                                  </span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 dark:bg-emerald-600 rounded-full"
                                    style={{ width: `${(navPatterns.reduce((sum, [, count]) => sum + count, 0) / topPatterns.reduce((sum, [, count]) => sum + count, 1)) * 100}%` }}
                                  />
                                </div>
                              </div>
                              {actionPatterns.length > 0 && (
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-700 dark:text-gray-300">Action Completions</span>
                                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                      {actionPatterns.reduce((sum, [, count]) => sum + count, 0)}
                                    </span>
                                  </div>
                                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-purple-500 dark:bg-purple-600 rounded-full"
                                      style={{ width: `${(actionPatterns.reduce((sum, [, count]) => sum + count, 0) / topPatterns.reduce((sum, [, count]) => sum + count, 1)) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Top 10 Patterns Bar Chart */}
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                            <h5 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-3">Top 10 Patterns (Visual)</h5>
                            <div className="space-y-2">
                              {topPatterns.slice(0, 10).map(([pattern, count], idx) => {
                                const maxCount = topPatterns[0]?.[1] || 1;
                                const percentage = (count / maxCount) * 100;
                                const isClick = pattern.startsWith('click:');
                                const isAction = pattern.startsWith('action:');
                                const barColor = isAction
                                  ? 'bg-purple-500 dark:bg-purple-600'
                                  : isClick
                                  ? 'bg-blue-500 dark:bg-blue-600'
                                  : 'bg-emerald-500 dark:bg-emerald-600';
                                return (
                                  <div key={pattern} className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-mono text-gray-900 dark:text-gray-100 truncate flex-1 mr-2" title={pattern}>
                                        {pattern.length > 40 ? `${pattern.slice(0, 40)}...` : pattern}
                                      </span>
                                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">{count}</span>
                                    </div>
                                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full ${barColor} rounded-full transition-all duration-300`}
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">
                            Top Navigation Patterns (Aggregated) - Full Table
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm border border-gray-200 dark:border-gray-700">
                              <thead className="bg-gray-100 dark:bg-gray-800">
                                <tr>
                                  <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">Pattern</th>
                                  <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">Total Count</th>
                                </tr>
                              </thead>
                              <tbody>
                                {topPatterns.map(([pattern, count], idx) => {
                                  const maxCount = topPatterns[0]?.[1] || 1;
                                  const percentage = (count / maxCount) * 100;
                                  return (
                                    <tr key={pattern} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                      <td className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">{pattern}</td>
                                      <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-gray-900 dark:text-gray-100">{count}</span>
                                          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-[200px]">
                                            <div
                                              className="h-full bg-emerald-500 dark:bg-emerald-600 rounded-full transition-all duration-300"
                                              style={{ width: `${percentage}%` }}
                                            />
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Time Series Visualization */}
                    {(() => {
                      // Group metrics by date (hourly buckets for recent data)
                      const timeBuckets = new Map<string, number>();
                      navigationMetricsData.forEach((metric: any) => {
                        const date = new Date(metric.createdAt);
                        const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
                        const totalCount = metric.aggregates.reduce((sum: number, agg: { pattern: string; count: number }) => sum + agg.count, 0);
                        timeBuckets.set(hourKey, (timeBuckets.get(hourKey) || 0) + totalCount);
                      });

                      const timeSeries = Array.from(timeBuckets.entries())
                        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
                        .slice(-24); // Last 24 hours

                      const maxCount = Math.max(...timeSeries.map(([, count]) => count), 1);

                      return timeSeries.length > 0 ? (
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
                          <h5 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-3">Metrics Over Time (Last 24 Hours)</h5>
                          <div className="flex items-end gap-1 h-32">
                            {timeSeries.map(([timeKey, count], idx) => {
                              const height = (count / maxCount) * 100;
                              return (
                                <div key={timeKey} className="flex-1 flex flex-col items-center group relative">
                                  <div
                                    className="w-full bg-emerald-500 dark:bg-emerald-600 rounded-t transition-all duration-300 hover:bg-emerald-600 dark:hover:bg-emerald-500"
                                    style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}
                                    title={`${timeKey}: ${count} events`}
                                  />
                                  <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 dark:bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                    {new Date(timeKey).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}: {count}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>{timeSeries[0]?.[0] ? new Date(timeSeries[0][0]).toLocaleDateString() : ''}</span>
                            <span>{timeSeries[timeSeries.length - 1]?.[0] ? new Date(timeSeries[timeSeries.length - 1][0]).toLocaleDateString() : ''}</span>
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* Recent Metrics Table */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">
                        Recent Metrics Batches
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm border border-gray-200 dark:border-gray-700">
                          <thead className="bg-gray-100 dark:bg-gray-800">
                            <tr>
                              <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Page</th>
                              <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Patterns</th>
                              <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Total Count</th>
                              <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {navigationMetricsData.slice(0, 20).map((metric: any, idx: number) => {
                              const totalCount = metric.aggregates.reduce((sum: number, agg: { pattern: string; count: number }) => sum + agg.count, 0);
                              return (
                                <tr key={metric.key || idx} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                  <td className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">
                                    <div className="flex items-center gap-2">
                                      <span>{metric.page || '-'}</span>
                                      {metric.txHash && (
                                        <ViewOnArkivLink
                                          txHash={metric.txHash}
                                          entityKey={metric.key}
                                          label=""
                                          icon=""
                                          className="text-xs"
                                        />
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-xs">
                                    <details className="cursor-pointer">
                                      <summary className="text-blue-600 dark:text-blue-400 hover:underline">
                                        {metric.aggregates.length} pattern{metric.aggregates.length !== 1 ? 's' : ''}
                                      </summary>
                                      <div className="mt-2 space-y-1">
                                        {metric.aggregates.map((agg: { pattern: string; count: number }, aggIdx: number) => (
                                          <div key={aggIdx} className="text-xs font-mono bg-gray-100 dark:bg-gray-900 p-1 rounded text-gray-900 dark:text-gray-100">
                                            {agg.pattern}: {agg.count}
                                          </div>
                                        ))}
                                      </div>
                                    </details>
                                  </td>
                                  <td className="px-3 py-2 font-semibold text-gray-900 dark:text-gray-100">{totalCount}</td>
                                  <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(metric.createdAt).toLocaleString()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* JSON Data */}
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
                        View Raw JSON Data (Machine Readable)
                      </summary>
                      <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto border border-gray-200 dark:border-gray-700">
                        {JSON.stringify(navigationMetricsData, null, 2)}
                      </pre>
                    </details>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400">No navigation metrics available yet. Metrics are collected automatically from user interactions.</p>
                )}
              </div>
            )}
          </div>
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
                          {feedback.txHash && (
                            <ViewOnArkivLink
                              txHash={feedback.txHash}
                              entityKey={feedback.key}
                              label=""
                              icon=""
                              className="ml-2"
                            />
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


        {/* Static Client Section */}
        <section className="mb-8 border border-purple-200 dark:border-purple-800 rounded-lg bg-purple-50 dark:bg-purple-900/20">
          <div className="flex items-center justify-between p-4 border-b border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌐</span>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                  Static Client (No-JS)
                </h2>
              </div>
              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                Decentralized
              </span>
              <button
                onClick={() => {
                  const newState = !staticClientExpanded;
                  setStaticClientExpanded(newState);
                  localStorage.setItem('admin_static_client_expanded', String(newState));
                }}
                className="ml-2 px-3 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 bg-white dark:bg-purple-900/30 rounded border border-purple-300 dark:border-purple-700 transition-colors"
                title={staticClientExpanded ? 'Collapse static client section' : 'Expand static client section'}
              >
                {staticClientExpanded ? '▼ Collapse' : '▶ Expand'}
              </button>
            </div>
          </div>
          {staticClientExpanded && (
            <div className="p-6 space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-50">
                  Rebuild Static Client
                </h3>

                {buildStatus && (
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                    {buildStatus.lastBuild ? (
                      <div className="space-y-1">
                        <div><strong>Last Build:</strong> {new Date(buildStatus.lastBuild).toLocaleString()}</div>
                        {buildStatus.fileCount && <div><strong>Files Generated:</strong> {buildStatus.fileCount}</div>}
                        {buildStatus.entityCounts && (
                          <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                            <strong>Entity Counts:</strong>
                            <ul className="ml-4 mt-1 space-y-0.5">
                              <li>Profiles: {buildStatus.entityCounts.profiles || 0}</li>
                              <li>Skills: {buildStatus.entityCounts.skills || 0}</li>
                              <li>Asks: {buildStatus.entityCounts.asks || 0}</li>
                              <li>Offers: {buildStatus.entityCounts.offers || 0}</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-600 dark:text-gray-400">No previous build found</div>
                    )}
                  </div>
                )}

                <button
                  onClick={async () => {
                    if (rebuilding) return;

                    setRebuilding(true);
                    try {
                      const res = await fetch('/api/admin/rebuild-static', {
                        method: 'POST',
                      });

                      const data = await res.json();

                      if (data.ok) {
                        setBuildStatus({
                          lastBuild: data.buildTimestamp,
                          fileCount: data.fileCount,
                          entityCounts: data.entityCounts,
                        });
                        alert(`✅ Build successful!\n\nFiles: ${data.fileCount}\nOutput: ${data.outputDir}\n\nNext: Deploy to IPFS (see instructions below)`);
                      } else {
                        alert(`❌ Build failed: ${data.error || 'Unknown error'}`);
                      }
                    } catch (err: any) {
                      console.error('[Admin] Error rebuilding static client:', err);
                      alert(`❌ Build failed: ${err.message || 'Unknown error'}`);
                    } finally {
                      setRebuilding(false);
                    }
                  }}
                  disabled={rebuilding}
                  className={`px-4 py-2 text-white rounded-lg text-sm transition-colors ${
                    rebuilding
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {rebuilding ? 'Rebuilding...' : 'Rebuild Static Client'}
                </button>

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium mb-3 text-gray-900 dark:text-gray-50">
                    📋 Step-by-Step IPFS Deployment Instructions
                  </h4>
                  <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-decimal list-inside">
                    <li>
                      <strong>After rebuild completes:</strong> Static HTML files are in <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">static-app/public/</code>
                    </li>
                    <li>
                      <strong>Option 1 - Using ipfs-deploy (Recommended):</strong>
                      <ul className="ml-6 mt-1 space-y-1 list-disc">
                        <li>Install: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">npm install -g ipfs-deploy</code></li>
                        <li>Deploy: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">ipfs-deploy static-app/public -p pinata -d cloudflare</code></li>
                        <li>Copy the CID that is returned</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Option 2 - Using IPFS CLI:</strong>
                      <ul className="ml-6 mt-1 space-y-1 list-disc">
                        <li>Install IPFS: <a href="https://docs.ipfs.io/install/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">docs.ipfs.io/install</a></li>
                        <li>Add: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">ipfs add -r static-app/public/</code></li>
                        <li>Copy the root CID (last line)</li>
                        <li>Pin: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">ipfs pin add &lt;CID&gt;</code></li>
                      </ul>
                    </li>
                    <li>
                      <strong>Option 3 - Manual Upload:</strong>
                      <ul className="ml-6 mt-1 space-y-1 list-disc">
                        <li>Upload <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">static-app/public/</code> to a pinning service (Pinata, Web3.Storage, etc.)</li>
                        <li>Get the CID from the service</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Access your site:</strong>
                      <ul className="ml-6 mt-1 space-y-1 list-disc">
                        <li>Via IPFS: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">https://ipfs.io/ipfs/&lt;CID&gt;</code></li>
                        <li>Via Cloudflare: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">https://cloudflare-ipfs.com/ipfs/&lt;CID&gt;</code></li>
                        <li>Via ENS (if configured): <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">p2pmentor.eth</code></li>
                      </ul>
                    </li>
                    <li>
                      <strong>Update landing page:</strong> Edit <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">app/page.tsx</code> and update the button link to point to your IPFS URL
                    </li>
                  </ol>

                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>Note:</strong> The static client works entirely without JavaScript. All data is embedded in HTML at build time.
                      Generated files are in <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">static-app/public/</code> (gitignored, not committed).
                    </p>
                  </div>
                </div>
              </div>
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

