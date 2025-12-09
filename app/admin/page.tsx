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

export default function AdminDashboard() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [perfSummary, setPerfSummary] = useState<PerfSummary | null>(null);
  const [perfSamples, setPerfSamples] = useState<any[]>([]);

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
    }
  }, [authenticated]);

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

        {/* Performance Comparison */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
              Performance Comparison
            </h2>
            <a
              href={`/api/admin/perf-samples?seed=true`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              title="Generate real performance data from Arkiv queries"
            >
              Generate Real Data
            </a>
          </div>
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

