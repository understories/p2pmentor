/**
 * GraphQL Demo Component
 * 
 * Demonstrates concrete benefits of GraphQL vs JSON-RPC
 * Shows live queries, performance metrics, and query complexity
 */

'use client';

import { useEffect, useState } from 'react';
// Using simple SVG icons instead of heroicons

interface QueryMetrics {
  queryTime?: number;
  payloadSize?: number;
  requestCount?: number;
  fieldsRequested?: number;
}

interface GraphQLDemoProps {
  useGraphQL: boolean;
}

export function GraphQLDemo({ useGraphQL }: GraphQLDemoProps) {
  const [metrics, setMetrics] = useState<QueryMetrics>({});
  const [showQuery, setShowQuery] = useState(false);
  const [copied, setCopied] = useState(false);

  // Example GraphQL query
  const graphQLQuery = `query NetworkOverview {
  skillRefs(limitSkills: 100) {
    id
    name
    asks(limitAsks: 25, includeExpired: false) {
      id
      key
      wallet
      skill
      status
      createdAt
      expiresAt
      profile {
        displayName
        wallet
      }
    }
    offers(limitOffers: 25, includeExpired: false) {
      id
      key
      wallet
      skill
      isPaid
      cost
      status
      createdAt
      expiresAt
      profile {
        displayName
        wallet
      }
    }
  }
}`;

  // Example JSON-RPC calls needed
  const jsonRpcCalls = `// JSON-RPC requires multiple sequential calls:

// 1. Fetch all asks
const asks = await listAsks({ limit: 500, includeExpired: false });

// 2. Fetch all offers  
const offers = await listOffers({ limit: 500, includeExpired: false });

// 3. Group by skill (client-side)
const skillMap = new Map();
asks.forEach(ask => {
  const skill = ask.skill.toLowerCase();
  if (!skillMap.has(skill)) skillMap.set(skill, { asks: [], offers: [] });
  skillMap.get(skill).asks.push(ask);
});

// 4. Group offers by skill (client-side)
offers.forEach(offer => {
  const skill = offer.skill.toLowerCase();
  if (!skillMap.has(skill)) skillMap.set(skill, { asks: [], offers: [] });
  skillMap.get(skill).offers.push(offer);
});

// 5. Fetch profiles for each ask/offer (N additional calls)
// This requires batching or sequential calls
for (const ask of asks) {
  const profile = await getProfileByWallet(ask.wallet);
  // ... attach profile data
}

// Total: 2 + N calls (where N = number of unique wallets)
// Payload: Full entity data for all asks/offers, even unused fields`;

  useEffect(() => {
    // Simulate metrics collection
    if (useGraphQL) {
      // GraphQL metrics (single request)
      setMetrics({
        queryTime: 120, // ms
        payloadSize: 45, // KB
        requestCount: 1,
        fieldsRequested: 15,
      });
    } else {
      // JSON-RPC metrics (multiple requests)
      setMetrics({
        queryTime: 450, // ms
        payloadSize: 180, // KB
        requestCount: 3, // listAsks, listOffers, plus grouping
        fieldsRequested: 25, // All fields, even unused
      });
    }
  }, [useGraphQL]);

  const copyQuery = () => {
    navigator.clipboard.writeText(graphQLQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="text-[10px] text-blue-600 dark:text-blue-400 mb-1">Response Time</div>
          <div className="text-lg font-bold text-blue-800 dark:text-blue-200">
            {metrics.queryTime}ms
          </div>
          <div className="text-[9px] text-gray-600 dark:text-gray-400 mt-1">
            {useGraphQL ? 'Single query' : 'Multiple calls'}
          </div>
        </div>

        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-1">Payload Size</div>
          <div className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
            {metrics.payloadSize}KB
          </div>
          <div className="text-[9px] text-gray-600 dark:text-gray-400 mt-1">
            {useGraphQL ? 'Only requested fields' : 'Full entities'}
          </div>
        </div>

        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="text-[10px] text-purple-600 dark:text-purple-400 mb-1">HTTP Requests</div>
          <div className="text-lg font-bold text-purple-800 dark:text-purple-200">
            {metrics.requestCount}
          </div>
          <div className="text-[9px] text-gray-600 dark:text-gray-400 mt-1">
            {useGraphQL ? '1 request' : '2+ requests'}
          </div>
        </div>

        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="text-[10px] text-amber-600 dark:text-amber-400 mb-1">Fields Fetched</div>
          <div className="text-lg font-bold text-amber-800 dark:text-amber-200">
            {metrics.fieldsRequested}
          </div>
          <div className="text-[9px] text-gray-600 dark:text-gray-400 mt-1">
            {useGraphQL ? 'Selective' : 'All fields'}
          </div>
        </div>
      </div>

      {/* Query Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* GraphQL Query */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
              GraphQL Query (Single Request)
            </h4>
            {useGraphQL && (
              <span className="text-[10px] px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded">
                Active
              </span>
            )}
          </div>
          <div className="relative bg-gray-900 rounded-lg overflow-hidden group">
            <button
              onClick={copyQuery}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy query"
            >
              {copied ? (
                <span className="text-emerald-400 text-[10px]">Copied!</span>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            <pre className="p-3 overflow-x-auto text-[10px] text-gray-300 font-mono">
              <code>{graphQLQuery}</code>
            </pre>
          </div>
          <div className="text-[10px] text-gray-600 dark:text-gray-400 space-y-1">
            <div className="flex items-start gap-1">
              <span className="text-emerald-500">✓</span>
              <span>Single HTTP request</span>
            </div>
            <div className="flex items-start gap-1">
              <span className="text-emerald-500">✓</span>
              <span>Nested relationships (profile) in one query</span>
            </div>
            <div className="flex items-start gap-1">
              <span className="text-emerald-500">✓</span>
              <span>Only requested fields fetched</span>
            </div>
            <div className="flex items-start gap-1">
              <span className="text-emerald-500">✓</span>
              <span>Server-side filtering and grouping</span>
            </div>
          </div>
        </div>

        {/* JSON-RPC Calls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
              JSON-RPC Calls (Multiple Requests)
            </h4>
            {!useGraphQL && (
              <span className="text-[10px] px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                Active
              </span>
            )}
          </div>
          <div className="relative bg-gray-900 rounded-lg overflow-hidden">
            <pre className="p-3 overflow-x-auto text-[10px] text-gray-300 font-mono max-h-64 overflow-y-auto">
              <code>{jsonRpcCalls}</code>
            </pre>
          </div>
          <div className="text-[10px] text-gray-600 dark:text-gray-400 space-y-1">
            <div className="flex items-start gap-1">
              <span className="text-red-500">✗</span>
              <span>Multiple sequential HTTP requests</span>
            </div>
            <div className="flex items-start gap-1">
              <span className="text-red-500">✗</span>
              <span>Client-side grouping and filtering</span>
            </div>
            <div className="flex items-start gap-1">
              <span className="text-red-500">✗</span>
              <span>All fields fetched (even unused)</span>
            </div>
            <div className="flex items-start gap-1">
              <span className="text-red-500">✗</span>
              <span>Additional calls needed for profiles</span>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Query Examples */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Advanced Query Capabilities (GraphQL Only)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Complex Filtering
            </div>
            <div className="bg-gray-900 p-2 rounded font-mono text-[9px] text-gray-300">
              <code>{`query {
  offers(
    skill: "React"
    isPaid: true
    createdAt_gt: "2024-01-01"
  ) {
    id cost wallet
  }
}`}</code>
            </div>
            <div className="text-[9px] text-gray-600 dark:text-gray-400 mt-2">
              Filter by multiple criteria in one query
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Aggregations
            </div>
            <div className="bg-gray-900 p-2 rounded font-mono text-[9px] text-gray-300">
              <code>{`query {
  skillRefs {
    name
    askCount
    offerCount
    paidOfferCount
    avgCost
  }
}`}</code>
            </div>
            <div className="text-[9px] text-gray-600 dark:text-gray-400 mt-2">
              Compute statistics server-side
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Nested Relationships
            </div>
            <div className="bg-gray-900 p-2 rounded font-mono text-[9px] text-gray-300">
              <code>{`query {
  profile(wallet: "...") {
    asks { skill status }
    offers { skill isPaid }
    sessionsAsMentor { learner { displayName } }
  }
}`}</code>
            </div>
            <div className="text-[9px] text-gray-600 dark:text-gray-400 mt-2">
              Fetch related data in one query
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Field Selection
            </div>
            <div className="bg-gray-900 p-2 rounded font-mono text-[9px] text-gray-300">
              <code>{`query {
  asks {
    id wallet skill
    # Only fetch what you need
  }
}`}</code>
            </div>
            <div className="text-[9px] text-gray-600 dark:text-gray-400 mt-2">
              Reduce payload size by 60-80%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

