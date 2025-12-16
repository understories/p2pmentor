/**
 * Network Comparison Page
 * 
 * Side-by-side comparison of Arkiv JSON-RPC vs GraphQL API paths
 * Shows the GraphQL tool in action
 */

'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { CodeComparison } from '@/components/network/CodeComparison';
import { IntegrationGuide } from '@/components/network/IntegrationGuide';
import { WhyGraphQL } from '@/components/network/WhyGraphQL';
import { GraphQLDemo } from '@/components/network/GraphQLDemo';
import { UXVision } from '@/components/network/UXVision';
// Using simple SVG icon instead of heroicons

const NetworkForestGraph = dynamic(
  () => import('@/components/network/NetworkForestGraph'),
  { ssr: false }
);

export default function NetworkComparePage() {
  const [mounted, setMounted] = useState(false);
  const [useGraphQL, setUseGraphQL] = useState(false);
  const [showDevRel, setShowDevRel] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [showDemo, setShowDemo] = useState(true); // Show demo by default
  const [showUX, setShowUX] = useState(false); // UX vision section

  useEffect(() => {
    setMounted(true);
    // Check localStorage for GraphQL preference
    const stored = localStorage.getItem('USE_GRAPHQL');
    if (stored !== null) {
      setUseGraphQL(stored === 'true');
    }
  }, []);

  const toggleGraphQL = (enabled: boolean) => {
    setUseGraphQL(enabled);
    localStorage.setItem('USE_GRAPHQL', String(enabled));
    // Trigger storage event for other tabs/components
    window.dispatchEvent(new Event('storage'));
    // Force reload to apply changes
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <main className="min-h-screen text-gray-900 dark:text-gray-100">
      <div className="min-h-screen flex flex-col">
        <header className="p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-semibold">GraphQL API Comparison</h1>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Toggle between Arkiv JSON-RPC and GraphQL API paths
              </p>
            </div>
            <BackButton
              href="/network"
              label="Back to network"
              className="text-xs text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 underline border-0 bg-transparent p-0"
            />
          </div>
          
          {/* Toggle */}
          <div className="flex items-center gap-4 p-2.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="flex-1">
              <div className="text-sm font-medium mb-1">Data Source</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {useGraphQL 
                  ? 'Using GraphQL API (wraps Arkiv JSON-RPC)'
                  : 'Using Arkiv JSON-RPC directly'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${!useGraphQL ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                Arkiv
              </span>
              <button
                onClick={() => toggleGraphQL(!useGraphQL)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  useGraphQL ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    useGraphQL ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-xs ${useGraphQL ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}`}>
                GraphQL
              </span>
            </div>
          </div>

          {/* Info Panel */}
          <div className="mt-2 p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="text-xs space-y-1">
              <div className="flex items-start gap-2">
                <span className="font-semibold">Current Path:</span>
                <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">
                  {useGraphQL 
                    ? 'POST /api/graphql → GraphQL Resolvers → Arkiv JSON-RPC'
                    : 'GET /api/network/graph → Arkiv JSON-RPC'}
                </code>
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {useGraphQL 
                  ? '✅ GraphQL API wraps Arkiv queries - Same data, GraphQL interface'
                  : '✅ Direct Arkiv queries - Fast and simple'}
              </div>
            </div>
          </div>

          {/* UX Vision - Collapsible */}
          <div className="mt-3 border border-purple-300 dark:border-purple-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowUX(!showUX)}
              className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">🎨</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  UX Vision: Design Possibilities with GraphQL
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${showUX ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showUX && (
              <div className="p-4 bg-white dark:bg-gray-900 border-t border-purple-300 dark:border-purple-700">
                <UXVision useGraphQL={useGraphQL} />
              </div>
            )}
          </div>

          {/* Why GraphQL - Collapsible */}
          <div className="mt-3 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowWhy(!showWhy)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">💡</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Why GraphQL? Benefits & Visualization Improvements
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${showWhy ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showWhy && (
              <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-300 dark:border-gray-700">
                <WhyGraphQL />
              </div>
            )}
          </div>

          {/* Integration Guide - Collapsible */}
          <div className="mt-3 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowDevRel(!showDevRel)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">🔌</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  How to Connect Arkiv to GraphQL
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${showDevRel ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showDevRel && (
              <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-300 dark:border-gray-700">
                <IntegrationGuide />
              </div>
            )}
          </div>

          {/* Live Demo - Collapsible (shown by default) */}
          <div className="mt-3 border border-emerald-300 dark:border-emerald-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowDemo(!showDemo)}
              className="w-full px-4 py-3 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 hover:from-emerald-100 hover:to-blue-100 dark:hover:from-emerald-900/30 dark:hover:to-blue-900/30 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Live Demo: Query Performance & Capabilities
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${showDemo ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showDemo && (
              <div className="p-4 bg-white dark:bg-gray-900 border-t border-emerald-300 dark:border-emerald-700">
                <GraphQLDemo useGraphQL={useGraphQL} />
              </div>
            )}
          </div>

          {/* Code Comparison - Collapsible */}
          <div className="mt-3 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowCode(!showCode)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">💻</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Code Comparison
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${showCode ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showCode && (
              <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-300 dark:border-gray-700">
                <CodeComparison useGraphQL={useGraphQL} />
              </div>
            )}
          </div>
        </header>

        {/* Graph Visualization */}
        <section className="flex-1 relative">
          <NetworkForestGraph />
        </section>
      </div>
    </main>
  );
}

