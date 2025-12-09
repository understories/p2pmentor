/**
 * Admin API: Performance Samples
 * 
 * Exposes performance metrics for admin panel.
 * 
 * Reference: refs/docs/sprint2.md Section 2.3
 */

import { NextResponse } from 'next/server';
import { getPerfSamples, getPerfSamplesFiltered, getPerfSummary, clearPerfSamples } from '@/lib/metrics/perf';
import { buildNetworkGraphData } from '@/lib/arkiv/networkGraph';
import { listAsks, listAsksForWallet } from '@/lib/arkiv/asks';
import { listOffers, listOffersForWallet } from '@/lib/arkiv/offers';
import { getProfileByWallet, listUserProfiles } from '@/lib/arkiv/profile';
import { fetchNetworkOverview } from '@/lib/graph/networkQueries';
import { createDxMetric, listDxMetrics } from '@/lib/arkiv/dxMetrics';
import { CURRENT_WALLET, getPrivateKey } from '@/lib/config';

/**
 * GET /api/admin/perf-samples
 * 
 * Query params:
 * - source: 'graphql' | 'arkiv'
 * - operation: string
 * - route: string
 * - since: ISO timestamp
 * - limit: number (max samples to return)
 * 
 * Returns: Array of performance samples
 */
export async function GET(request: Request) {
  // TODO: Add authentication/authorization check
  // For now, this is internal-only (not exposed in production without auth)
  
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source') as 'graphql' | 'arkiv' | null;
  const operation = searchParams.get('operation') || undefined;
  const route = searchParams.get('route') || undefined;
  const since = searchParams.get('since') || undefined;
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;
  const summary = searchParams.get('summary') === 'true';
  const summaryOperation = searchParams.get('summaryOperation') || undefined;
  const seed = searchParams.get('seed') === 'true';
  const method = searchParams.get('method') as 'arkiv' | 'graphql' | 'both' | null;

  try {
    // Seed real performance data by making actual Arkiv/GraphQL calls
    // This generates REAL perf samples AND creates Arkiv entities for verification
    if (seed) {
      try {
        if (!CURRENT_WALLET) {
          return NextResponse.json(
            { success: false, error: 'ARKIV_PRIVATE_KEY not configured' },
            { status: 500 }
          );
        }

        const privateKey = getPrivateKey();
        const createdEntities: Array<{ source: string; operation: string; txHash: string }> = [];
        
        // Determine which methods to test based on query parameter
        const testArkiv = !method || method === 'arkiv' || method === 'both';
        const testGraphQL = method === 'graphql' || method === 'both';

        // Make real calls that go through instrumented code paths
        // These will record actual performance metrics from Arkiv entities
        
        // 1. JSON-RPC path operations (direct Arkiv calls)
        if (testArkiv) {
          // Warm up: Make initial requests to avoid cold start
          try {
            await listAsks({ limit: 1, includeExpired: false });
            await listOffers({ limit: 1, includeExpired: false });
            await new Promise(resolve => setTimeout(resolve, 200)); // Brief pause
          } catch (warmupErr) {
            // Ignore warmup errors
          }
          
          const startTime1 = Date.now();
          await listAsks({ limit: 25, includeExpired: false });
          const duration1 = Date.now() - startTime1;
          
          const startTime2 = Date.now();
          await listOffers({ limit: 25, includeExpired: false });
          const duration2 = Date.now() - startTime2;
          
          // Network graph via JSON-RPC path (warm measurement)
          const startTime3 = Date.now();
          const graphData = await buildNetworkGraphData({ 
            limitAsks: 25, 
            limitOffers: 25, 
            includeExpired: false 
          });
          const duration3 = Date.now() - startTime3;
          // Measure actual response payload (what client receives)
          const payloadSize3 = JSON.stringify(graphData).length;

          // Create DX metric entity for JSON-RPC path (verifiable on-chain)
          try {
            const { txHash: tx1 } = await createDxMetric({
              sample: {
                source: 'arkiv',
                operation: 'buildNetworkGraphData',
                route: '/network',
                durationMs: duration3,
                payloadBytes: payloadSize3,
                httpRequests: 4, // listAsks (2) + listOffers (2)
                createdAt: new Date().toISOString(),
              },
              privateKey,
            });
            createdEntities.push({ source: 'arkiv', operation: 'buildNetworkGraphData', txHash: tx1 });
          } catch (err) {
            console.error('[seed-perf] Failed to create Arkiv metric entity:', err);
          }
        }

        // 2. GraphQL path - networkOverview query
        if (testGraphQL) {
          try {
            // Use absolute URL for server-side GraphQL requests
            const graphqlEndpoint = process.env.GRAPH_SUBGRAPH_URL || 
              (process.env.NEXT_PUBLIC_APP_URL 
                ? `${process.env.NEXT_PUBLIC_APP_URL}/api/graphql`
                : 'http://localhost:3000/api/graphql');
            
            // Warm up: Make a request first to avoid cold start skewing results
            try {
              await fetch(graphqlEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  query: 'query { networkOverview(limitAsks: 1, limitOffers: 1) { skillRefs { name } } }',
                }),
              });
              await new Promise(resolve => setTimeout(resolve, 200)); // Brief pause
            } catch (warmupErr) {
              // Ignore warmup errors
            }
            
            // Now measure the actual request
            const startTime4 = Date.now();
            const graphqlResponse = await fetch(graphqlEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: `
                  query NetworkOverview {
                    networkOverview(limitAsks: 25, limitOffers: 25, includeExpired: false) {
                      skillRefs {
                        name
                        asks {
                          id
                          key
                          wallet
                          skill
                          createdAt
                          status
                          expiresAt
                        }
                        offers {
                          id
                          key
                          wallet
                          skill
                          isPaid
                          cost
                          paymentAddress
                          createdAt
                          status
                          expiresAt
                        }
                      }
                    }
                  }
                `,
              }),
            });
            const duration4 = Date.now() - startTime4;
            
            if (!graphqlResponse.ok) {
              throw new Error(`GraphQL request failed: ${graphqlResponse.status}`);
            }
            
            const graphqlResult = await graphqlResponse.json();
            // Measure actual GraphQL response payload (not transformed data)
            const payloadSize4 = JSON.stringify(graphqlResult).length;
            
            // Transform to match expected format (for verification)
            const { fetchNetworkOverview } = await import('@/lib/graph/networkQueries');
            const graphqlData = await fetchNetworkOverview({
              limitAsks: 25,
              limitOffers: 25,
              includeExpired: false,
            }, { endpoint: graphqlEndpoint });

            // Create DX metric entity for GraphQL path (verifiable on-chain)
            try {
              const { txHash: tx2 } = await createDxMetric({
                sample: {
                  source: 'graphql',
                  operation: 'networkOverview',
                  route: '/network',
                  durationMs: duration4,
                  payloadBytes: payloadSize4,
                  httpRequests: 1, // Single GraphQL request
                  createdAt: new Date().toISOString(),
                },
                privateKey,
              });
              createdEntities.push({ source: 'graphql', operation: 'networkOverview', txHash: tx2 });
              console.log('[seed-perf] GraphQL test successful:', { durationMs: duration4, payloadBytes: payloadSize4 });
            } catch (err) {
              console.error('[seed-perf] Failed to create GraphQL metric entity:', err);
            }
          } catch (error: any) {
            // GraphQL may not be enabled or may have failed
            console.error('[seed-perf] GraphQL path failed:', error.message || error);
            // Don't silently fail - return info about what happened
            return NextResponse.json({
              success: false,
              error: `GraphQL test failed: ${error.message || 'Unknown error'}`,
              note: 'Arkiv JSON-RPC test may have succeeded. Check entitiesCreated for details.',
              entitiesCreated: createdEntities.length,
              transactions: createdEntities,
            }, { status: 500 });
          }
        }

        // 4. Profile operations using default wallet (real Arkiv entities)
        if (CURRENT_WALLET) {
          await getProfileByWallet(CURRENT_WALLET).catch(() => null);
          await listAsksForWallet(CURRENT_WALLET).catch(() => []);
          await listOffersForWallet(CURRENT_WALLET).catch(() => []);
        }
        
        // 5. List all profiles (instrumented)
        await listUserProfiles().catch(() => []);

        return NextResponse.json({ 
          success: true, 
          message: 'Real performance data generated and stored as Arkiv entities',
          entitiesCreated: createdEntities.length,
          transactions: createdEntities.map(e => ({
            source: e.source,
            operation: e.operation,
            txHash: e.txHash,
            explorer: `https://explorer.mendoza.hoodi.arkiv.network/tx/${e.txHash}`,
          })),
          note: 'Check Mendoza explorer to verify on-chain. In-memory samples also available at /api/admin/perf-samples'
        });
      } catch (error: any) {
        console.error('[seed-perf] Error generating samples:', error);
        return NextResponse.json(
          { success: false, error: error.message || 'Failed to generate samples' },
          { status: 500 }
        );
      }
    }
    if (summary && summaryOperation) {
      // Return performance summary
      // ALWAYS query Arkiv entities first (real, verifiable data)
      // Then merge with in-memory samples if any
      let perfSummary = getPerfSummary(summaryOperation, route);
      
      try {
        // Query Arkiv entities for the operation
        const arkivMetrics = await listDxMetrics({
          operation: summaryOperation,
          route,
          limit: 100,
        });
        
        // Soft fallback warning: if Arkiv returns empty, warn user
        if (arkivMetrics.length === 0) {
          console.warn('[admin/perf-samples] No Arkiv entities found for operation:', summaryOperation);
          // Continue with in-memory data, but note the limitation
        }
        
        if (arkivMetrics.length > 0) {
          // Separate by source
          const arkivSamples = arkivMetrics
            .filter(m => m.source === 'arkiv')
            .map(m => ({
              source: m.source as 'arkiv',
              operation: m.operation,
              route: m.route,
              durationMs: m.durationMs,
              payloadBytes: m.payloadBytes,
              httpRequests: m.httpRequests,
              createdAt: m.createdAt,
            }));
          
          const graphqlSamples = arkivMetrics
            .filter(m => m.source === 'graphql')
            .map(m => ({
              source: m.source as 'graphql',
              operation: m.operation,
              route: m.route,
              durationMs: m.durationMs,
              payloadBytes: m.payloadBytes,
              httpRequests: m.httpRequests,
              createdAt: m.createdAt,
            }));
          
          // Aggregate Arkiv samples (real on-chain data)
          if (arkivSamples.length > 0) {
            const durations = arkivSamples.map(s => s.durationMs);
            const payloadSizes = arkivSamples.filter(s => s.payloadBytes !== undefined).map(s => s.payloadBytes!);
            const httpCounts = arkivSamples.filter(s => s.httpRequests !== undefined).map(s => s.httpRequests!);
            
            perfSummary.arkiv = {
              avgDurationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
              minDurationMs: Math.min(...durations),
              maxDurationMs: Math.max(...durations),
              avgPayloadBytes: payloadSizes.length > 0 ? payloadSizes.reduce((a, b) => a + b, 0) / payloadSizes.length : undefined,
              avgHttpRequests: httpCounts.length > 0 ? httpCounts.reduce((a, b) => a + b, 0) / httpCounts.length : undefined,
              samples: arkivSamples.length,
            };
          }
          
          // Aggregate GraphQL samples (real on-chain data)
          if (graphqlSamples.length > 0) {
            const durations = graphqlSamples.map(s => s.durationMs);
            const payloadSizes = graphqlSamples.filter(s => s.payloadBytes !== undefined).map(s => s.payloadBytes!);
            const httpCounts = graphqlSamples.filter(s => s.httpRequests !== undefined).map(s => s.httpRequests!);
            
            perfSummary.graphql = {
              avgDurationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
              minDurationMs: Math.min(...durations),
              maxDurationMs: Math.max(...durations),
              avgPayloadBytes: payloadSizes.length > 0 ? payloadSizes.reduce((a, b) => a + b, 0) / payloadSizes.length : undefined,
              avgHttpRequests: httpCounts.length > 0 ? httpCounts.reduce((a, b) => a + b, 0) / httpCounts.length : undefined,
              samples: graphqlSamples.length,
            };
          }
        }
        
        // If operation is 'buildNetworkGraphData', also check 'networkOverview' for GraphQL
        if (summaryOperation === 'buildNetworkGraphData') {
          const networkOverviewMetrics = await listDxMetrics({
            operation: 'networkOverview',
            source: 'graphql',
            limit: 100,
          });
          
          if (networkOverviewMetrics.length > 0) {
            const durations = networkOverviewMetrics.map(m => m.durationMs);
            const payloadSizes = networkOverviewMetrics.filter(m => m.payloadBytes !== undefined).map(m => m.payloadBytes!);
            const httpCounts = networkOverviewMetrics.filter(m => m.httpRequests !== undefined).map(m => m.httpRequests!);
            
            // Merge with existing GraphQL data or create new
            if (perfSummary.graphql) {
              // Merge: combine samples and recalculate
              const combinedSamples = (perfSummary.graphql.samples || 0) + networkOverviewMetrics.length;
              const combinedAvg = (
                (perfSummary.graphql.avgDurationMs * (perfSummary.graphql.samples || 0)) +
                (durations.reduce((a, b) => a + b, 0) / durations.length) * networkOverviewMetrics.length
              ) / combinedSamples;
              
              perfSummary.graphql = {
                avgDurationMs: combinedAvg,
                minDurationMs: Math.min(perfSummary.graphql.minDurationMs, Math.min(...durations)),
                maxDurationMs: Math.max(perfSummary.graphql.maxDurationMs, Math.max(...durations)),
                avgPayloadBytes: payloadSizes.length > 0 ? payloadSizes.reduce((a, b) => a + b, 0) / payloadSizes.length : perfSummary.graphql.avgPayloadBytes,
                avgHttpRequests: httpCounts.length > 0 ? httpCounts.reduce((a, b) => a + b, 0) / httpCounts.length : perfSummary.graphql.avgHttpRequests,
                samples: combinedSamples,
              };
            } else {
              perfSummary.graphql = {
                avgDurationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
                minDurationMs: Math.min(...durations),
                maxDurationMs: Math.max(...durations),
                avgPayloadBytes: payloadSizes.length > 0 ? payloadSizes.reduce((a, b) => a + b, 0) / payloadSizes.length : undefined,
                avgHttpRequests: httpCounts.length > 0 ? httpCounts.reduce((a, b) => a + b, 0) / httpCounts.length : undefined,
                samples: networkOverviewMetrics.length,
              };
            }
          }
        }
      } catch (error) {
        console.error('[admin/perf-samples] Failed to query Arkiv entities for summary:', error);
        // Continue with in-memory data only if Arkiv query fails
      }
      
      return NextResponse.json(perfSummary);
    }

    // Try to fetch from Arkiv entities first (verifiable on-chain)
    // Fall back to in-memory samples if Arkiv query fails
    let samples: any[] = [];
    let fromArkiv = false;
    
    try {
      const arkivMetrics = await listDxMetrics({
        source: source || undefined,
        operation,
        route,
        limit: limit || 100,
        since,
      });
      
      if (arkivMetrics.length > 0) {
        // Convert DxMetric to PerfSample format for compatibility
        samples = arkivMetrics.map(m => ({
          source: m.source,
          operation: m.operation,
          route: m.route,
          durationMs: m.durationMs,
          payloadBytes: m.payloadBytes,
          httpRequests: m.httpRequests,
          createdAt: m.createdAt,
          txHash: m.txHash, // Include txHash for verification
        }));
        fromArkiv = true;
      }
    } catch (error) {
      console.log('[admin/perf-samples] Arkiv query failed, using in-memory samples:', error);
    }
    
    // Fall back to in-memory samples if no Arkiv data
    if (samples.length === 0) {
      samples = getPerfSamplesFiltered({
        source: source || undefined,
        operation,
        route,
        since,
      });
    }

    // Apply limit if provided
    if (limit && limit > 0) {
      samples = samples.slice(0, limit);
    }

    return NextResponse.json({
      samples,
      count: samples.length,
      source: fromArkiv ? 'arkiv' : 'memory',
      note: fromArkiv 
        ? 'Data from verifiable Arkiv entities (on-chain)' 
        : 'Data from in-memory samples (not persisted)',
    });
  } catch (error) {
    console.error('[admin/perf-samples] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance samples' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/perf-samples
 * 
 * Clears all performance samples
 */
export async function DELETE(request: Request) {
  // TODO: Add authentication/authorization check
  
  try {
    clearPerfSamples();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/perf-samples] Error clearing samples:', error);
    return NextResponse.json(
      { error: 'Failed to clear performance samples' },
      { status: 500 }
    );
  }
}
