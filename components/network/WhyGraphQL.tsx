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
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Why GraphQL Over Direct JSON-RPC?</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Better Queries */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="font-semibold text-blue-800 dark:text-blue-200 mb-2 text-xs">1. Richer Query Patterns</div>
            <ul className="space-y-1 text-[10px] text-gray-700 dark:text-gray-300">
              <li>• <strong>Multi-hop queries:</strong> Skills → Asks → Profiles → Sessions</li>
              <li>• <strong>Nested relationships:</strong> Get profile with all asks/offers in one query</li>
              <li>• <strong>Field selection:</strong> Request only needed fields (reduces payload)</li>
              <li>• <strong>Complex filters:</strong> Combine multiple conditions in query</li>
            </ul>
          </div>

          {/* Visualization Improvements */}
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <div className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2 text-xs">2. Better Visualizations</div>
            <ul className="space-y-1 text-[10px] text-gray-700 dark:text-gray-300">
              <li>• <strong>Real-time updates:</strong> GraphQL subscriptions for live data</li>
              <li>• <strong>Efficient caching:</strong> Apollo/Relay cache reduces redundant queries</li>
              <li>• <strong>Incremental loading:</strong> Load skills, then asks, then offers progressively</li>
              <li>• <strong>Complex aggregations:</strong> Count matches, group by skill, etc.</li>
            </ul>
          </div>

          {/* Ecosystem Integration */}
          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="font-semibold text-purple-800 dark:text-purple-200 mb-2 text-xs">3. Ecosystem Tooling</div>
            <ul className="space-y-1 text-[10px] text-gray-700 dark:text-gray-300">
              <li>• <strong>Apollo Client:</strong> Caching, optimistic updates, error handling</li>
              <li>• <strong>Relay:</strong> Declarative data fetching, automatic batching</li>
              <li>• <strong>GraphiQL:</strong> Interactive query explorer</li>
              <li>• <strong>Code generation:</strong> TypeScript types from schema</li>
            </ul>
          </div>

          {/* Future Possibilities */}
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="font-semibold text-amber-800 dark:text-amber-200 mb-2 text-xs">4. Future Possibilities</div>
            <ul className="space-y-1 text-[10px] text-gray-700 dark:text-gray-300">
              <li>• <strong>Subgraph migration:</strong> Move to full blockchain indexing</li>
              <li>• <strong>Cross-chain queries:</strong> Query multiple Arkiv networks</li>
              <li>• <strong>Analytics:</strong> Complex aggregations for insights</li>
              <li>• <strong>Public API:</strong> Expose GraphQL for community tools</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Visualization Improvements */}
      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 text-sm">Visualization Improvements Enabled</h4>
        
        <div className="space-y-3">
          <div>
            <div className="font-medium text-gray-800 dark:text-gray-200 mb-1 text-xs">Current (JSON-RPC):</div>
            <ul className="text-[10px] text-gray-600 dark:text-gray-400 space-y-0.5 ml-2">
              <li>• Fetch all asks/offers, filter client-side</li>
              <li>• Manual relationship building (skills → asks → offers)</li>
              <li>• No incremental loading</li>
              <li>• Limited to what Arkiv indexer provides</li>
            </ul>
          </div>

          <div>
            <div className="font-medium text-emerald-700 dark:text-emerald-300 mb-1 text-xs">With GraphQL:</div>
            <ul className="text-[10px] text-gray-600 dark:text-gray-400 space-y-0.5 ml-2">
              <li>• <strong>Query specific relationships:</strong> Get skill with only active asks/offers</li>
              <li>• <strong>Progressive loading:</strong> Load skills first, then expand on hover</li>
              <li>• <strong>Aggregations:</strong> Count matches per skill, average cost, etc.</li>
              <li>• <strong>Filtering:</strong> Complex queries (e.g., "paid offers for React created in last week")</li>
              <li>• <strong>Subscriptions:</strong> Real-time updates when new asks/offers appear</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Concrete Example */}
      <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
        <h4 className="font-semibold text-gray-100 mb-2 text-xs">Example: Enhanced Forest View Query</h4>
        <div className="space-y-2">
          <div>
            <div className="text-[10px] text-gray-400 mb-1">Current (JSON-RPC):</div>
            <div className="bg-gray-800 p-2 rounded font-mono text-[10px] text-gray-300">
              <code>{`// Fetch everything, filter client-side
const asks = await listAsks({ limit: 500 });
const offers = await listOffers({ limit: 500 });
// Then filter, group, and build graph`}</code>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-emerald-400 mb-1">With GraphQL:</div>
            <div className="bg-gray-800 p-2 rounded font-mono text-[10px] text-gray-300">
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
      <div className="mt-4 p-3 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 text-xs">Key Benefits</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-gray-700 dark:text-gray-300">
          <div>
            <strong>For Development:</strong>
            <ul className="mt-1 space-y-0.5 ml-2">
              <li>• Type-safe queries</li>
              <li>• Better developer experience</li>
              <li>• Easier to test and debug</li>
            </ul>
          </div>
          <div>
            <strong>For Users:</strong>
            <ul className="mt-1 space-y-0.5 ml-2">
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


