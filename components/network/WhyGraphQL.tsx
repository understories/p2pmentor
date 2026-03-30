/**
 * Why GraphQL Component
 *
 * Explains the benefits and improvements GraphQL enables
 * Shows concrete use cases and visualization improvements
 */

'use client';

export function WhyGraphQL() {
  return (
    <div className="space-y-4 text-xs">
      {/* Core Benefits */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Why GraphQL Over Direct JSON-RPC?
        </h4>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Better Queries */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="mb-2 text-xs font-semibold text-blue-800 dark:text-blue-200">
              1. Richer Query Patterns
            </div>
            <ul className="space-y-1 text-[10px] text-gray-700 dark:text-gray-300">
              <li>
                • <strong>Multi-hop queries:</strong> Skills → Asks → Profiles → Sessions
              </li>
              <li>
                • <strong>Nested relationships:</strong> Get profile with all asks/offers in one
                query
              </li>
              <li>
                • <strong>Field selection:</strong> Request only needed fields (reduces payload)
              </li>
              <li>
                • <strong>Complex filters:</strong> Combine multiple conditions in query
              </li>
            </ul>
          </div>

          {/* Visualization Improvements */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
            <div className="mb-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              2. Better Visualizations
            </div>
            <ul className="space-y-1 text-[10px] text-gray-700 dark:text-gray-300">
              <li>
                • <strong>Real-time updates:</strong> GraphQL subscriptions for live data
              </li>
              <li>
                • <strong>Efficient caching:</strong> Apollo/Relay cache reduces redundant queries
              </li>
              <li>
                • <strong>Incremental loading:</strong> Load skills, then asks, then offers
                progressively
              </li>
              <li>
                • <strong>Complex aggregations:</strong> Count matches, group by skill, etc.
              </li>
            </ul>
          </div>

          {/* Ecosystem Integration */}
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-900/20">
            <div className="mb-2 text-xs font-semibold text-purple-800 dark:text-purple-200">
              3. Ecosystem Tooling
            </div>
            <ul className="space-y-1 text-[10px] text-gray-700 dark:text-gray-300">
              <li>
                • <strong>Apollo Client:</strong> Caching, optimistic updates, error handling
              </li>
              <li>
                • <strong>Relay:</strong> Declarative data fetching, automatic batching
              </li>
              <li>
                • <strong>GraphiQL:</strong> Interactive query explorer
              </li>
              <li>
                • <strong>Code generation:</strong> TypeScript types from schema
              </li>
            </ul>
          </div>

          {/* Future Possibilities */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
            <div className="mb-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
              4. Future Possibilities
            </div>
            <ul className="space-y-1 text-[10px] text-gray-700 dark:text-gray-300">
              <li>
                • <strong>Subgraph migration:</strong> Move to full blockchain indexing
              </li>
              <li>
                • <strong>Cross-chain queries:</strong> Query multiple Arkiv networks
              </li>
              <li>
                • <strong>Analytics:</strong> Complex aggregations for insights
              </li>
              <li>
                • <strong>Public API:</strong> Expose GraphQL for community tools
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Visualization Improvements */}
      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
        <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Visualization Improvements Enabled
        </h4>

        <div className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-medium text-gray-800 dark:text-gray-200">
              Current (JSON-RPC):
            </div>
            <ul className="ml-2 space-y-0.5 text-[10px] text-gray-600 dark:text-gray-400">
              <li>• Fetch all asks/offers, filter client-side</li>
              <li>• Manual relationship building (skills → asks → offers)</li>
              <li>• No incremental loading</li>
              <li>• Limited to what Arkiv indexer provides</li>
            </ul>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              With GraphQL:
            </div>
            <ul className="ml-2 space-y-0.5 text-[10px] text-gray-600 dark:text-gray-400">
              <li>
                • <strong>Query specific relationships:</strong> Get skill with only active
                asks/offers
              </li>
              <li>
                • <strong>Progressive loading:</strong> Load skills first, then expand on hover
              </li>
              <li>
                • <strong>Aggregations:</strong> Count matches per skill, average cost, etc.
              </li>
              <li>
                • <strong>Filtering:</strong> Complex queries (e.g., "paid offers for React created
                in last week")
              </li>
              <li>
                • <strong>Subscriptions:</strong> Real-time updates when new asks/offers appear
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Concrete Example */}
      <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900 p-4">
        <h4 className="mb-2 text-xs font-semibold text-gray-100">
          Example: Enhanced Forest View Query
        </h4>
        <div className="space-y-2">
          <div>
            <div className="mb-1 text-[10px] text-gray-400">Current (JSON-RPC):</div>
            <div className="rounded bg-gray-800 p-2 font-mono text-[10px] text-gray-300">
              <code>{`// Fetch everything, filter client-side
const asks = await listAsks({ limit: 500 });
const offers = await listOffers({ limit: 500 });
// Then filter, group, and build graph`}</code>
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] text-emerald-400">With GraphQL:</div>
            <div className="rounded bg-gray-800 p-2 font-mono text-[10px] text-gray-300">
              <code>{`// Query exactly what we need
query {
  skillRefs {
    name
    asks(includeExpired: false, limit: 25) {
      id wallet skill
      profile { displayName }
    }
    offers(includeExpired: false, limit: 25) {
      id wallet skill isPaid cost
      profile { displayName }
    }
    matchCount  # Aggregation
  }
}`}</code>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Summary */}
      <div className="mt-4 rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-blue-50 p-3 dark:border-emerald-800 dark:from-emerald-900/20 dark:to-blue-900/20">
        <h4 className="mb-2 text-xs font-semibold text-gray-900 dark:text-gray-100">
          Key Benefits
        </h4>
        <div className="grid grid-cols-1 gap-2 text-[10px] text-gray-700 dark:text-gray-300 md:grid-cols-2">
          <div>
            <strong>For Development:</strong>
            <ul className="ml-2 mt-1 space-y-0.5">
              <li>• Type-safe queries</li>
              <li>• Better developer experience</li>
              <li>• Easier to test and debug</li>
            </ul>
          </div>
          <div>
            <strong>For Users:</strong>
            <ul className="ml-2 mt-1 space-y-0.5">
              <li>• Faster visualizations</li>
              <li>• More interactive features</li>
              <li>• Real-time updates</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
