/**
 * UX Visualizations Component
 *
 * Visual mockups and interactive previews of UX possibilities
 * For visual thinkers - shows what can be built, not just described
 */

'use client';

import { useState, useEffect } from 'react';

interface UXVizProps {
  useGraphQL: boolean;
}

export function UXViz({ useGraphQL }: UXVizProps) {
  const [activeTab, setActiveTab] = useState<
    'realtime' | 'loading' | 'filters' | 'analytics' | 'graph'
  >('realtime');
  const [liveCount, setLiveCount] = useState(3);
  const [isLoading, setIsLoading] = useState(false);

  // Simulate live updates
  useEffect(() => {
    if (activeTab === 'realtime' && useGraphQL) {
      const interval = setInterval(() => {
        setLiveCount((prev) => prev + 1);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [activeTab, useGraphQL]);

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-2 dark:border-gray-700">
        {[
          { id: 'realtime', label: '⚡ Real-Time', icon: '⚡' },
          { id: 'loading', label: '📊 Progressive', icon: '📊' },
          { id: 'filters', label: '🔍 Filters', icon: '🔍' },
          { id: 'analytics', label: '📈 Analytics', icon: '📈' },
          { id: 'graph', label: '🌲 Graph View', icon: '🌲' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Real-Time Updates Mockup */}
      {activeTab === 'realtime' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
              Live Activity Feed
            </h4>
            <div className="space-y-2">
              {[
                {
                  time: '2s ago',
                  user: 'alice.eth',
                  action: 'created an ask',
                  skill: 'React',
                  color: 'emerald',
                },
                {
                  time: '5s ago',
                  user: 'bob.eth',
                  action: 'created an offer',
                  skill: 'TypeScript',
                  color: 'blue',
                },
                {
                  time: '8s ago',
                  user: 'carol.eth',
                  action: 'matched with',
                  skill: 'Solidity',
                  color: 'purple',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex animate-pulse items-center gap-3 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900"
                  style={{ animationDelay: `${idx * 0.2}s` }}
                >
                  <div className={`h-2 w-2 rounded-full bg-${item.color}-500 animate-ping`} />
                  <div className="flex-1 text-[10px]">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {item.user}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400"> {item.action} </span>
                    <span
                      className={`font-semibold text-${item.color}-600 dark:text-${item.color}-400`}
                    >
                      {item.skill}
                    </span>
                  </div>
                  <div className="text-[9px] text-gray-500 dark:text-gray-400">{item.time}</div>
                </div>
              ))}
              {useGraphQL && (
                <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-800 dark:bg-emerald-900/20">
                  <div className="flex items-center gap-2 text-[10px]">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    <span className="text-emerald-700 dark:text-emerald-300">
                      {liveCount} new updates in the last minute
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
              Notification Badge
            </h4>
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                  <span className="text-lg">🔔</span>
                </div>
                {useGraphQL && (
                  <div className="absolute -right-1 -top-1 flex h-5 w-5 animate-bounce items-center justify-center rounded-full bg-red-500">
                    <span className="text-[9px] font-bold text-white">{liveCount}</span>
                  </div>
                )}
              </div>
              <div className="text-[10px] text-gray-600 dark:text-gray-400">
                {useGraphQL
                  ? 'Live badge updates with GraphQL subscriptions'
                  : 'Static badge (requires page refresh)'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progressive Loading Mockup */}
      {activeTab === 'loading' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
              Skills Load First (Fast Query)
            </h4>
            <div className="space-y-2">
              {['React', 'TypeScript', 'Solidity', 'Rust'].map((skill, idx) => (
                <div
                  key={skill}
                  className="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900"
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                        {skill}
                      </span>
                    </div>
                    <button className="text-[10px] text-emerald-600 hover:underline dark:text-emerald-400">
                      Expand →
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-2 dark:border-blue-800 dark:bg-blue-900/20">
              <div className="text-[9px] text-blue-700 dark:text-blue-300">
                Skills load in ~50ms, asks/offers load on expand
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
              Skeleton Loading States
            </h4>
            <div className="space-y-2">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-gray-300 dark:bg-gray-600" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-gray-300 dark:bg-gray-600" />
                      <div className="h-2 w-1/2 animate-pulse rounded bg-gray-300 dark:bg-gray-600" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded border border-purple-200 bg-purple-50 p-2 dark:border-purple-800 dark:bg-purple-900/20">
              <div className="text-[9px] text-purple-700 dark:text-purple-300">
                Smooth skeleton → Content appears (no jarring spinners)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rich Filters Mockup */}
      {activeTab === 'filters' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
              Multi-Filter Search Bar
            </h4>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-[10px] dark:bg-emerald-900/30">
                  <span>Skill: React</span>
                  <button className="text-emerald-600 dark:text-emerald-400">×</button>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1.5 text-[10px] dark:bg-blue-900/30">
                  <span>Paid: Yes</span>
                  <button className="text-blue-600 dark:text-blue-400">×</button>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1.5 text-[10px] dark:bg-purple-900/30">
                  <span>Seniority: Senior</span>
                  <button className="text-purple-600 dark:text-purple-400">×</button>
                </div>
                <button className="rounded-full bg-gray-100 px-3 py-1.5 text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                  + Add Filter
                </button>
              </div>
              <div className="rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900">
                <div className="text-[9px] text-gray-600 dark:text-gray-400">
                  Single GraphQL query handles all filters → Instant results
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
              Filter Sidebar
            </h4>
            <div className="space-y-3">
              <div>
                <div className="mb-2 text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                  Skill
                </div>
                <div className="space-y-1">
                  {['React', 'TypeScript', 'Solidity'].map((skill) => (
                    <label
                      key={skill}
                      className="flex cursor-pointer items-center gap-2 text-[10px]"
                    >
                      <input type="checkbox" className="h-3 w-3" />
                      <span>{skill}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                  Type
                </div>
                <div className="space-y-1">
                  <label className="flex cursor-pointer items-center gap-2 text-[10px]">
                    <input type="radio" name="type" className="h-3 w-3" />
                    <span>Free</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[10px]">
                    <input type="radio" name="type" className="h-3 w-3" />
                    <span>Paid</span>
                  </label>
                </div>
              </div>
              <div>
                <div className="mb-2 text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                  Date Range
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    className="flex-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] dark:border-gray-700 dark:bg-gray-900"
                  />
                  <input
                    type="date"
                    className="flex-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Dashboard Mockup */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-1 text-[10px] text-gray-600 dark:text-gray-400">Total Asks</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">127</div>
              <div className="mt-1 text-[9px] text-emerald-600 dark:text-emerald-400">
                +12% this week
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-1 text-[10px] text-gray-600 dark:text-gray-400">Total Offers</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">89</div>
              <div className="mt-1 text-[9px] text-blue-600 dark:text-blue-400">+8% this week</div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
              Skill Popularity Chart
            </h4>
            <div className="space-y-2">
              {[
                { skill: 'React', count: 45, percentage: 100 },
                { skill: 'TypeScript', count: 32, percentage: 71 },
                { skill: 'Solidity', count: 28, percentage: 62 },
                { skill: 'Rust', count: 15, percentage: 33 },
              ].map((item) => (
                <div key={item.skill} className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {item.skill}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">{item.count}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-2 dark:border-blue-800 dark:bg-blue-900/20">
              <div className="text-[9px] text-blue-700 dark:text-blue-300">
                Server-side aggregation → Instant charts
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
              Match Rate Over Time
            </h4>
            <div className="flex h-32 items-end justify-between rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900">
              {[65, 72, 68, 75, 80, 78, 85].map((height, idx) => (
                <div
                  key={idx}
                  className="mx-0.5 flex-1 rounded-t bg-emerald-500 transition-all duration-500"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[9px] text-gray-600 dark:text-gray-400">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Graph View Mockup */}
      {activeTab === 'graph' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
              Graph Controls
            </h4>
            <div className="flex flex-wrap gap-2">
              <button className="rounded bg-emerald-100 px-3 py-1.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                Show All
              </button>
              <button className="rounded bg-gray-100 px-3 py-1.5 text-[10px] text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                Free Only
              </button>
              <button className="rounded bg-gray-100 px-3 py-1.5 text-[10px] text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                Paid Only
              </button>
              <button className="rounded bg-gray-100 px-3 py-1.5 text-[10px] text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                By Skill
              </button>
            </div>
            <div className="mt-3 rounded border border-purple-200 bg-purple-50 p-2 dark:border-purple-800 dark:bg-purple-900/20">
              <div className="text-[9px] text-purple-700 dark:text-purple-300">
                Filter graph with live GraphQL query → Instant re-render
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h4 className="mb-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
              Graph Visualization Preview
            </h4>
            <div className="relative h-64 overflow-hidden rounded border border-gray-700 bg-gray-900">
              {/* Simulated graph nodes */}
              <div className="absolute left-1/4 top-1/4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-semibold text-white shadow-lg">
                React
              </div>
              <div className="absolute right-1/4 top-1/3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-[10px] font-semibold text-white shadow-lg">
                TS
              </div>
              <div className="absolute bottom-1/4 left-1/3 flex h-12 w-12 items-center justify-center rounded-full bg-purple-500 text-[10px] font-semibold text-white shadow-lg">
                Solidity
              </div>
              <div className="absolute bottom-1/3 right-1/3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-[10px] font-semibold text-white shadow-lg">
                Rust
              </div>
              {/* Simulated connections */}
              <svg className="absolute inset-0 h-full w-full" style={{ zIndex: 0 }}>
                <line
                  x1="25%"
                  y1="25%"
                  x2="75%"
                  y2="33%"
                  stroke="#10b981"
                  strokeWidth="2"
                  opacity="0.5"
                />
                <line
                  x1="33%"
                  y1="75%"
                  x2="67%"
                  y2="67%"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  opacity="0.5"
                />
              </svg>
              <div className="absolute bottom-2 left-2 text-[9px] text-gray-400">
                Interactive graph with live filtering
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Insight */}
      <div className="rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-blue-50 p-4 dark:border-emerald-800 dark:from-emerald-900/20 dark:to-blue-900/20">
        <div className="mb-2 text-xs font-semibold text-gray-900 dark:text-gray-100">
          💡 What GraphQL Enables
        </div>
        <div className="space-y-1 text-[10px] text-gray-700 dark:text-gray-300">
          <div>
            <strong>All these mockups</strong> are now technically feasible with GraphQL:
          </div>
          <div>• Real-time updates (subscriptions)</div>
          <div>• Progressive loading (field selection)</div>
          <div>• Complex filtering (single query)</div>
          <div>• Server-side aggregations (charts)</div>
          <div>• Live graph filtering (query variables)</div>
        </div>
      </div>
    </div>
  );
}
