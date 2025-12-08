/**
 * UX Vision Component
 * 
 * Shows design possibilities and UX improvements enabled by GraphQL
 * Guides the design process with concrete examples
 */

'use client';

import { UXViz } from './UXVisualizations';

interface UXVisionProps {
  useGraphQL: boolean;
}

export function UXVision({ useGraphQL }: UXVisionProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          🎨 Design Possibilities with GraphQL
        </h3>
        <p className="text-xs text-gray-700 dark:text-gray-300">
          GraphQL enables richer, more interactive experiences. Here's what your design team can now build:
        </p>
      </div>

      {/* Visual Mockups - For Visual Thinkers */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-purple-300 dark:border-purple-700">
        <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <span className="text-lg">👁️</span>
          Visual Mockups - See What's Possible
        </div>
        <p className="text-[10px] text-gray-600 dark:text-gray-400 mb-4">
          Interactive previews of UI patterns enabled by GraphQL. Click tabs to explore different features.
        </p>
        <UXViz useGraphQL={useGraphQL} />
      </div>

      {/* Real-time Updates */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span className="text-lg">⚡</span>
          Real-Time Updates & Live Data
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Live Network Activity
            </div>
            <div className="space-y-2 text-[10px] text-gray-600 dark:text-gray-400">
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>New asks/offers appear instantly as they're created</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Graph nodes animate in when new connections form</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Live counters update without page refresh</span>
              </div>
            </div>
            <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
              <div className="text-[9px] font-mono text-gray-500 dark:text-gray-400">
                GraphQL Subscriptions → Live updates
              </div>
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Notification System
            </div>
            <div className="space-y-2 text-[10px] text-gray-600 dark:text-gray-400">
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Toast notifications when matches are found</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Badge counts for new opportunities</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Real-time chat indicators</span>
              </div>
            </div>
            <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
              <div className="text-[9px] font-mono text-gray-500 dark:text-gray-400">
                Subscribe to user's asks/offers
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progressive Loading */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span className="text-lg">📊</span>
          Progressive Loading & Skeleton States
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Skills Load First
            </div>
            <div className="space-y-2 text-[10px] text-gray-600 dark:text-gray-400">
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Show skill list immediately (fast query)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Load asks/offers per skill on expand</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Skeleton loaders for smooth transitions</span>
              </div>
            </div>
            <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
              <div className="text-[9px] font-mono text-gray-500 dark:text-gray-400">
                Query skills → Expand → Query asks/offers
              </div>
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Infinite Scroll
            </div>
            <div className="space-y-2 text-[10px] text-gray-600 dark:text-gray-400">
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Load 20 items, fetch more on scroll</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Cursor-based pagination (efficient)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>No page reloads, smooth experience</span>
              </div>
            </div>
            <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
              <div className="text-[9px] font-mono text-gray-500 dark:text-gray-400">
                Query with limit/offset or cursor
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rich Filtering & Search */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span className="text-lg">🔍</span>
          Rich Filtering & Search Experience
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Multi-Filter Search
            </div>
            <div className="space-y-1.5 text-[10px] text-gray-600 dark:text-gray-400">
              <div>• Skill + Seniority + Location</div>
              <div>• Paid/Free toggle</div>
              <div>• Date range picker</div>
              <div>• Availability window</div>
            </div>
            <div className="mt-2 p-1.5 bg-gray-50 dark:bg-gray-900 rounded text-[9px] font-mono text-gray-500 dark:text-gray-400">
              Single query with all filters
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Instant Search
            </div>
            <div className="space-y-1.5 text-[10px] text-gray-600 dark:text-gray-400">
              <div>• Debounced input (300ms)</div>
              <div>• Results update as you type</div>
              <div>• Highlight matching terms</div>
              <div>• Search across skills, profiles, topics</div>
            </div>
            <div className="mt-2 p-1.5 bg-gray-50 dark:bg-gray-900 rounded text-[9px] font-mono text-gray-500 dark:text-gray-400">
              Query on input change
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Saved Filters
            </div>
            <div className="space-y-1.5 text-[10px] text-gray-600 dark:text-gray-400">
              <div>• Save favorite filter combos</div>
              <div>• Share filter URLs</div>
              <div>• Quick filter buttons</div>
              <div>• "New this week" preset</div>
            </div>
            <div className="mt-2 p-1.5 bg-gray-50 dark:bg-gray-900 rounded text-[9px] font-mono text-gray-500 dark:text-gray-400">
              Query variables in URL
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Visualizations */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span className="text-lg">📈</span>
          Advanced Visualizations
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Interactive Analytics Dashboard
            </div>
            <div className="space-y-2 text-[10px] text-gray-600 dark:text-gray-400">
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Skill popularity charts (aggregated counts)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Match rate over time (time-series data)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Average cost per skill (paid offers)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Heatmaps of activity by timezone</span>
              </div>
            </div>
            <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
              <div className="text-[9px] font-mono text-gray-500 dark:text-gray-400">
                Server-side aggregations → Charts
              </div>
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Enhanced Graph View
            </div>
            <div className="space-y-2 text-[10px] text-gray-600 dark:text-gray-400">
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Filter graph by skill (live query)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Highlight paid vs free connections</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Show only active matches</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Cluster by skill or wallet</span>
              </div>
            </div>
            <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
              <div className="text-[9px] font-mono text-gray-500 dark:text-gray-400">
                Query with filters → Render graph
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance = Better UX */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span className="text-lg">⚡</span>
          Performance = Better User Experience
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <div className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
              Faster Load Times
            </div>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-300">
              60-75% faster than JSON-RPC
            </div>
            <div className="text-[9px] text-gray-600 dark:text-gray-400 mt-2">
              Single request vs multiple sequential calls
            </div>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="text-[10px] font-semibold text-blue-800 dark:text-blue-200 mb-2">
              Smaller Payloads
            </div>
            <div className="text-[10px] text-blue-700 dark:text-blue-300">
              60-80% reduction in data transfer
            </div>
            <div className="text-[9px] text-gray-600 dark:text-gray-400 mt-2">
              Only fetch fields you need
            </div>
          </div>

          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="text-[10px] font-semibold text-purple-800 dark:text-purple-200 mb-2">
              Smoother Interactions
            </div>
            <div className="text-[10px] text-purple-700 dark:text-purple-300">
              No loading spinners for simple actions
            </div>
            <div className="text-[9px] text-gray-600 dark:text-gray-400 mt-2">
              Optimistic updates + caching
            </div>
          </div>
        </div>
      </div>

      {/* Design Patterns */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span className="text-lg">🎯</span>
          Design Patterns Now Possible
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Query Builder UI
            </div>
            <div className="text-[10px] text-gray-600 dark:text-gray-400 space-y-1">
              <div>• Visual filter builder (drag & drop)</div>
              <div>• Preview query before executing</div>
              <div>• Save and share complex queries</div>
              <div>• Export results to CSV/JSON</div>
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Smart Recommendations
            </div>
            <div className="text-[10px] text-gray-600 dark:text-gray-400 space-y-1">
              <div>• "People like you also asked..."</div>
              <div>• Skill suggestions based on profile</div>
              <div>• Match probability indicators</div>
              <div>• Personalized skill recommendations</div>
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Collaborative Features
            </div>
            <div className="text-[10px] text-gray-600 dark:text-gray-400 space-y-1">
              <div>• Shared network views (team workspaces)</div>
              <div>• Live collaboration on queries</div>
              <div>• Comment threads on asks/offers</div>
              <div>• Real-time presence indicators</div>
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Mobile-First Experiences
            </div>
            <div className="text-[10px] text-gray-600 dark:text-gray-400 space-y-1">
              <div>• Smaller payloads = faster mobile</div>
              <div>• Progressive loading for slow networks</div>
              <div>• Offline-first with GraphQL cache</div>
              <div>• Push notifications for matches</div>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="p-4 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
        <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2">
          💡 Next Steps for Design Team
        </div>
        <div className="text-[10px] text-gray-700 dark:text-gray-300 space-y-1">
          <div>1. <strong>Prototype</strong> real-time features with GraphQL subscriptions</div>
          <div>2. <strong>Design</strong> progressive loading states for better perceived performance</div>
          <div>3. <strong>Explore</strong> complex filtering UIs (multi-select, date ranges, etc.)</div>
          <div>4. <strong>Plan</strong> analytics dashboards using server-side aggregations</div>
          <div>5. <strong>Test</strong> mobile experiences with optimized payloads</div>
        </div>
      </div>
    </div>
  );
}

