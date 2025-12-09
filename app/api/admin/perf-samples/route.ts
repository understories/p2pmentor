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
  
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
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
            
            // Check if this is a transaction receipt timeout (common on testnets)
            const errorMessage = err instanceof Error ? err.message : String(err);
            const isTimeoutError = errorMessage.includes('Transaction receipt') || 
                                  errorMessage.includes('confirmation pending') ||
                                  errorMessage.includes('Transaction submitted');
            
            if (isTimeoutError) {
              // Transaction was submitted but receipt not available - this is OK for testnets
              // Extract txHash if available
              const txHashMatch = errorMessage.match(/0x[a-fA-F0-9]{40,64}/);
              const txHash = txHashMatch ? txHashMatch[0] : 'pending';
              
              createdEntities.push({ source: 'arkiv', operation: 'buildNetworkGraphData', txHash });
              console.log('[seed-perf] Arkiv test - transaction submitted but confirmation pending:', { 
                durationMs: duration3, 
                payloadBytes: payloadSize3,
                txHash,
              });
            }
            // Continue - don't throw, entity was likely created
          }
        }

        // 2. GraphQL path - networkOverview query
        // Use the SAME logic as /network/compare page: fetchNetworkOverview
        if (testGraphQL) {
          try {
            // Use the exact same function that the app uses
            // This ensures we're testing the real GraphQL path, not a different implementation
            const { fetchNetworkOverview } = await import('@/lib/graph/networkQueries');
            
            // For server-side calls, we need an absolute URL
            // Construct from request URL (works in both local and production)
            const graphqlEndpoint = `${requestUrl.origin}/api/graphql`;
            
            // Warm up: Execute query once to avoid cold start skewing results
            try {
              await fetchNetworkOverview({
                limitAsks: 1,
                limitOffers: 1,
                includeExpired: false,
              }, { endpoint: graphqlEndpoint });
              await new Promise(resolve => setTimeout(resolve, 200)); // Brief pause
            } catch (warmupErr) {
              console.log('[seed-perf] Warmup query failed (non-fatal):', warmupErr);
              // Ignore warmup errors
            }
            
            // Now measure the actual request (same params as JSON-RPC test)
            const startTime4 = Date.now();
            let graphqlData;
            try {
              graphqlData = await fetchNetworkOverview({
                limitAsks: 25,
                limitOffers: 25,
                includeExpired: false,
              }, { endpoint: graphqlEndpoint });
            } catch (fetchError: any) {
              console.error('[seed-perf] fetchNetworkOverview error:', {
                message: fetchError?.message,
                stack: fetchError?.stack,
                error: fetchError,
              });
              throw new Error(`fetchNetworkOverview failed: ${fetchError?.message || 'Unknown error'}`);
            }
            const duration4 = Date.now() - startTime4;
            
            // Measure actual GraphQL response payload
            const payloadSize4 = JSON.stringify(graphqlData).length;
            
            // Verify we got real data (same validation as network/compare)
            // fetchNetworkOverview returns GraphQLNetworkOverviewResponse which has skillRefs
            if (!graphqlData) {
              throw new Error('GraphQL query returned null or undefined');
            }
            
            if (!graphqlData.skillRefs || !Array.isArray(graphqlData.skillRefs)) {
              console.error('[seed-perf] Invalid GraphQL response structure:', {
                hasData: !!graphqlData,
                dataKeys: graphqlData ? Object.keys(graphqlData) : [],
                dataType: typeof graphqlData,
                dataSample: JSON.stringify(graphqlData).substring(0, 500),
                fullData: graphqlData,
              });
              throw new Error(`GraphQL query returned invalid data structure. Expected skillRefs array, got: ${JSON.stringify(graphqlData).substring(0, 500)}`);
            }
            
            console.log('[seed-perf] GraphQL query successful:', {
              skillRefsCount: graphqlData.skillRefs.length,
              totalAsks: graphqlData.skillRefs.reduce((sum, s) => sum + (s.asks?.length || 0), 0),
              totalOffers: graphqlData.skillRefs.reduce((sum, s) => sum + (s.offers?.length || 0), 0),
            });

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
              console.log('[seed-perf] GraphQL test successful:', { 
                durationMs: duration4, 
                payloadBytes: payloadSize4,
                txHash: tx2,
              });
            } catch (err) {
              console.error('[seed-perf] Failed to create GraphQL metric entity:', err);
              
              // Check if this is a transaction receipt timeout (common on testnets)
              const errorMessage = err instanceof Error ? err.message : String(err);
              const isTimeoutError = errorMessage.includes('Transaction receipt') || 
                                    errorMessage.includes('confirmation pending') ||
                                    errorMessage.includes('Transaction submitted');
              
              if (isTimeoutError) {
                // Transaction was submitted but receipt not available - this is OK for testnets
                // Extract txHash if available
                const txHashMatch = errorMessage.match(/0x[a-fA-F0-9]{40,64}/);
                const txHash = txHashMatch ? txHashMatch[0] : 'pending';
                
                createdEntities.push({ source: 'graphql', operation: 'networkOverview', txHash });
                console.log('[seed-perf] GraphQL test - transaction submitted but confirmation pending:', { 
                  durationMs: duration4, 
                  payloadBytes: payloadSize4,
                  txHash,
                });
                // Continue - don't throw, entity was likely created
              } else {
                // Re-throw for actual errors
                throw new Error(`Failed to create GraphQL metric entity: ${errorMessage}`);
              }
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

        // 4. Test Asks page operations (both GraphQL and JSON-RPC)
        if (testGraphQL) {
          try {
            const { fetchAsks } = await import('@/lib/graph/asksQueries');
            // For server-side calls, we need an absolute URL (same pattern as networkOverview)
            const graphqlEndpoint = `${requestUrl.origin}/api/graphql`;
            
            // Warm up: Execute query once to avoid cold start skewing results
            try {
              await fetchAsks({ limit: 1 }, { endpoint: graphqlEndpoint });
              await new Promise(resolve => setTimeout(resolve, 200)); // Brief pause
            } catch (warmupErr) {
              console.log('[seed-perf] Warmup asks query failed (non-fatal):', warmupErr);
              // Ignore warmup errors
            }
            
            const startTime = Date.now();
            let asksData;
            try {
              asksData = await fetchAsks({ limit: 25 }, { endpoint: graphqlEndpoint });
            } catch (fetchError: any) {
              console.error('[seed-perf] fetchAsks error:', {
                message: fetchError?.message,
                stack: fetchError?.stack,
                error: fetchError,
              });
              throw new Error(`fetchAsks failed: ${fetchError?.message || 'Unknown error'}`);
            }
            const duration = Date.now() - startTime;
            const payloadSize = JSON.stringify(asksData).length;
            
            console.log('[seed-perf] GraphQL asks query successful:', {
              asksCount: asksData.length,
              durationMs: duration,
              payloadBytes: payloadSize,
            });
            
            // Create DX metric for GraphQL asks
            try {
              const { txHash } = await createDxMetric({
                sample: {
                  source: 'graphql',
                  operation: 'listAsks',
                  route: '/asks',
                  durationMs: duration,
                  payloadBytes: payloadSize,
                  httpRequests: 1,
                  createdAt: new Date().toISOString(),
                },
                privateKey,
              });
              createdEntities.push({ source: 'graphql', operation: 'listAsks', txHash });
            } catch (err) {
              console.error('[seed-perf] Failed to create GraphQL asks metric:', err);
            }
          } catch (err: any) {
            console.error('[seed-perf] GraphQL asks test failed:', {
              message: err?.message,
              stack: err?.stack,
              error: err,
            });
          }
        }
        
        if (testArkiv) {
          try {
            const startTime = Date.now();
            const asksData = await listAsks({ limit: 25 });
            const duration = Date.now() - startTime;
            const payloadSize = JSON.stringify(asksData).length;
            
            // Create DX metric for JSON-RPC asks
            try {
              const { txHash } = await createDxMetric({
                sample: {
                  source: 'arkiv',
                  operation: 'listAsks',
                  route: '/asks',
                  durationMs: duration,
                  payloadBytes: payloadSize,
                  httpRequests: 1,
                  createdAt: new Date().toISOString(),
                },
                privateKey,
              });
              createdEntities.push({ source: 'arkiv', operation: 'listAsks', txHash });
            } catch (err) {
              console.error('[seed-perf] Failed to create Arkiv asks metric:', err);
            }
          } catch (err) {
            console.error('[seed-perf] Arkiv asks test failed:', err);
          }
        }

        // 5. Test Offers page operations (both GraphQL and JSON-RPC)
        if (testGraphQL) {
          try {
            const { fetchOffers } = await import('@/lib/graph/offersQueries');
            // For server-side calls, we need an absolute URL (same pattern as networkOverview)
            const graphqlEndpoint = `${requestUrl.origin}/api/graphql`;
            
            // Warm up: Execute query once to avoid cold start skewing results
            try {
              await fetchOffers({ limit: 1 }, { endpoint: graphqlEndpoint });
              await new Promise(resolve => setTimeout(resolve, 200)); // Brief pause
            } catch (warmupErr) {
              console.log('[seed-perf] Warmup offers query failed (non-fatal):', warmupErr);
              // Ignore warmup errors
            }
            
            const startTime = Date.now();
            let offersData;
            try {
              offersData = await fetchOffers({ limit: 25 }, { endpoint: graphqlEndpoint });
            } catch (fetchError: any) {
              console.error('[seed-perf] fetchOffers error:', {
                message: fetchError?.message,
                stack: fetchError?.stack,
                error: fetchError,
              });
              throw new Error(`fetchOffers failed: ${fetchError?.message || 'Unknown error'}`);
            }
            const duration = Date.now() - startTime;
            const payloadSize = JSON.stringify(offersData).length;
            
            console.log('[seed-perf] GraphQL offers query successful:', {
              offersCount: offersData.length,
              durationMs: duration,
              payloadBytes: payloadSize,
            });
            
            // Create DX metric for GraphQL offers
            try {
              const { txHash } = await createDxMetric({
                sample: {
                  source: 'graphql',
                  operation: 'listOffers',
                  route: '/offers',
                  durationMs: duration,
                  payloadBytes: payloadSize,
                  httpRequests: 1,
                  createdAt: new Date().toISOString(),
                },
                privateKey,
              });
              createdEntities.push({ source: 'graphql', operation: 'listOffers', txHash });
            } catch (err) {
              console.error('[seed-perf] Failed to create GraphQL offers metric:', err);
            }
          } catch (err: any) {
            console.error('[seed-perf] GraphQL offers test failed:', {
              message: err?.message,
              stack: err?.stack,
              error: err,
            });
          }
        }
        
        if (testArkiv) {
          try {
            const startTime = Date.now();
            const offersData = await listOffers({ limit: 25 });
            const duration = Date.now() - startTime;
            const payloadSize = JSON.stringify(offersData).length;
            
            // Create DX metric for JSON-RPC offers
            try {
              const { txHash } = await createDxMetric({
                sample: {
                  source: 'arkiv',
                  operation: 'listOffers',
                  route: '/offers',
                  durationMs: duration,
                  payloadBytes: payloadSize,
                  httpRequests: 1,
                  createdAt: new Date().toISOString(),
                },
                privateKey,
              });
              createdEntities.push({ source: 'arkiv', operation: 'listOffers', txHash });
            } catch (err) {
              console.error('[seed-perf] Failed to create Arkiv offers metric:', err);
            }
          } catch (err) {
            console.error('[seed-perf] Arkiv offers test failed:', err);
          }
        }

        // 6. Test Profile page operations (both GraphQL and JSON-RPC)
        if (CURRENT_WALLET) {
          if (testGraphQL) {
            try {
              const { fetchProfileDetail } = await import('@/lib/graph/profileQueries');
              // For server-side calls, we need an absolute URL (same pattern as networkOverview)
              const graphqlEndpoint = `${requestUrl.origin}/api/graphql`;
              
              // Warm up: Execute query once to avoid cold start skewing results
              try {
                await fetchProfileDetail({ wallet: CURRENT_WALLET, limitAsks: 1, limitOffers: 1, limitFeedback: 1 }, { endpoint: graphqlEndpoint });
                await new Promise(resolve => setTimeout(resolve, 200)); // Brief pause
              } catch (warmupErr) {
                console.log('[seed-perf] Warmup profile query failed (non-fatal):', warmupErr);
                // Ignore warmup errors
              }
              
              const startTime = Date.now();
              let profileData;
              try {
                profileData = await fetchProfileDetail({ wallet: CURRENT_WALLET }, { endpoint: graphqlEndpoint });
              } catch (fetchError: any) {
                console.error('[seed-perf] fetchProfileDetail error:', {
                  message: fetchError?.message,
                  stack: fetchError?.stack,
                  error: fetchError,
                });
                throw new Error(`fetchProfileDetail failed: ${fetchError?.message || 'Unknown error'}`);
              }
              const duration = Date.now() - startTime;
              const payloadSize = JSON.stringify(profileData).length;
              
              console.log('[seed-perf] GraphQL profile query successful:', {
                hasProfile: !!profileData.profile,
                feedbackCount: profileData.feedback?.length || 0,
                durationMs: duration,
                payloadBytes: payloadSize,
              });
              
              // Create DX metric for GraphQL profile
              try {
                const { txHash } = await createDxMetric({
                  sample: {
                    source: 'graphql',
                    operation: 'loadProfileData',
                    route: '/profiles/[wallet]',
                    durationMs: duration,
                    payloadBytes: payloadSize,
                    httpRequests: 2, // 1 GraphQL + 1 API (sessions)
                    createdAt: new Date().toISOString(),
                  },
                  privateKey,
                });
                createdEntities.push({ source: 'graphql', operation: 'loadProfileData', txHash });
              } catch (err) {
                console.error('[seed-perf] Failed to create GraphQL profile metric:', err);
              }
            } catch (err) {
              console.error('[seed-perf] GraphQL profile test failed:', err);
            }
          }
          
          if (testArkiv) {
            try {
              const startTime = Date.now();
              const [profile, asks, offers] = await Promise.all([
                getProfileByWallet(CURRENT_WALLET).catch(() => null),
                listAsksForWallet(CURRENT_WALLET).catch(() => []),
                listOffersForWallet(CURRENT_WALLET).catch(() => []),
              ]);
              const duration = Date.now() - startTime;
              const payloadSize = JSON.stringify({ profile, asks, offers }).length;
              
              // Create DX metric for JSON-RPC profile
              try {
                const { txHash } = await createDxMetric({
                  sample: {
                    source: 'arkiv',
                    operation: 'loadProfileData',
                    route: '/profiles/[wallet]',
                    durationMs: duration,
                    payloadBytes: payloadSize,
                    httpRequests: 3, // profile + asks + offers
                    createdAt: new Date().toISOString(),
                  },
                  privateKey,
                });
                createdEntities.push({ source: 'arkiv', operation: 'loadProfileData', txHash });
              } catch (err) {
                console.error('[seed-perf] Failed to create Arkiv profile metric:', err);
              }
            } catch (err) {
              console.error('[seed-perf] Arkiv profile test failed:', err);
            }
          }
        }
        
        // 7. List all profiles (instrumented)
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
    if (summary) {
      // Return performance summary
      // If summaryOperation is specified, filter by that operation
      // Otherwise, aggregate across all operations (grouped by route)
      let perfSummary: any;
      
      if (summaryOperation) {
        // Filter by specific operation (existing logic)
        perfSummary = getPerfSummary(summaryOperation, route);
        
        try {
        // Query Arkiv entities
        // If summaryOperation is provided, filter by it; otherwise get all operations
        const arkivMetrics = await listDxMetrics({
          operation: summaryOperation || undefined,
          route,
          limit: 200, // Increased limit when aggregating all operations
        });
        
        // Soft fallback warning: if Arkiv returns empty, warn user
        if (arkivMetrics.length === 0 && summaryOperation) {
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
            
            // Count queries per page/route
            const pageCounts: Record<string, number> = {};
            arkivSamples.forEach(s => {
              const page = s.route || '(no route)';
              pageCounts[page] = (pageCounts[page] || 0) + 1;
            });
            
            perfSummary.arkiv = {
              avgDurationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
              minDurationMs: Math.min(...durations),
              maxDurationMs: Math.max(...durations),
              avgPayloadBytes: payloadSizes.length > 0 ? payloadSizes.reduce((a, b) => a + b, 0) / payloadSizes.length : undefined,
              avgHttpRequests: httpCounts.length > 0 ? httpCounts.reduce((a, b) => a + b, 0) / httpCounts.length : undefined,
              samples: arkivSamples.length,
              pages: pageCounts,
            };
          }
          
          // Aggregate GraphQL samples (real on-chain data)
          if (graphqlSamples.length > 0) {
            const durations = graphqlSamples.map(s => s.durationMs);
            const payloadSizes = graphqlSamples.filter(s => s.payloadBytes !== undefined).map(s => s.payloadBytes!);
            const httpCounts = graphqlSamples.filter(s => s.httpRequests !== undefined).map(s => s.httpRequests!);
            
            // Count queries per page/route
            const pageCounts: Record<string, number> = {};
            graphqlSamples.forEach(s => {
              const page = s.route || '(no route)';
              pageCounts[page] = (pageCounts[page] || 0) + 1;
            });
            
            perfSummary.graphql = {
              avgDurationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
              minDurationMs: Math.min(...durations),
              maxDurationMs: Math.max(...durations),
              avgPayloadBytes: payloadSizes.length > 0 ? payloadSizes.reduce((a, b) => a + b, 0) / payloadSizes.length : undefined,
              avgHttpRequests: httpCounts.length > 0 ? httpCounts.reduce((a, b) => a + b, 0) / httpCounts.length : undefined,
              samples: graphqlSamples.length,
              pages: pageCounts,
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
            
            // Count queries per page/route for networkOverview
            const networkOverviewPageCounts: Record<string, number> = {};
            networkOverviewMetrics.forEach(m => {
              const page = m.route || '(no route)';
              networkOverviewPageCounts[page] = (networkOverviewPageCounts[page] || 0) + 1;
            });
            
            // Merge with existing GraphQL data or create new
            if (perfSummary.graphql) {
              // Merge: combine samples and recalculate
              const combinedSamples = (perfSummary.graphql.samples || 0) + networkOverviewMetrics.length;
              const combinedAvg = (
                (perfSummary.graphql.avgDurationMs * (perfSummary.graphql.samples || 0)) +
                (durations.reduce((a, b) => a + b, 0) / durations.length) * networkOverviewMetrics.length
              ) / combinedSamples;
              
              // Merge page counts
              const mergedPages = { ...(perfSummary.graphql.pages || {}), ...networkOverviewPageCounts };
              Object.keys(mergedPages).forEach(page => {
                mergedPages[page] = (perfSummary.graphql?.pages?.[page] || 0) + (networkOverviewPageCounts[page] || 0);
              });
              
              perfSummary.graphql = {
                avgDurationMs: combinedAvg,
                minDurationMs: Math.min(perfSummary.graphql.minDurationMs, Math.min(...durations)),
                maxDurationMs: Math.max(perfSummary.graphql.maxDurationMs, Math.max(...durations)),
                avgPayloadBytes: payloadSizes.length > 0 ? payloadSizes.reduce((a, b) => a + b, 0) / payloadSizes.length : perfSummary.graphql.avgPayloadBytes,
                avgHttpRequests: httpCounts.length > 0 ? httpCounts.reduce((a, b) => a + b, 0) / httpCounts.length : perfSummary.graphql.avgHttpRequests,
                samples: combinedSamples,
                pages: mergedPages,
              };
            } else {
              perfSummary.graphql = {
                avgDurationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
                minDurationMs: Math.min(...durations),
                maxDurationMs: Math.max(...durations),
                avgPayloadBytes: payloadSizes.length > 0 ? payloadSizes.reduce((a, b) => a + b, 0) / payloadSizes.length : undefined,
                avgHttpRequests: httpCounts.length > 0 ? httpCounts.reduce((a, b) => a + b, 0) / httpCounts.length : undefined,
                samples: networkOverviewMetrics.length,
                pages: networkOverviewPageCounts,
              };
            }
          }
        }
        } catch (error) {
          console.error('[admin/perf-samples] Failed to query Arkiv entities for summary:', error);
          // Continue with in-memory data only if Arkiv query fails
        }
      } else {
        // No summaryOperation specified - aggregate across all operations by route
        const allSamples = getPerfSamples();
        const graphqlSamples = allSamples.filter(s => s.source === 'graphql');
        const arkivSamples = allSamples.filter(s => s.source === 'arkiv');
        
        const aggregateByRoute = (samples: typeof allSamples) => {
          if (samples.length === 0) return undefined;
          
          const durations = samples.map(s => s.durationMs);
          const payloadSizes = samples.filter(s => s.payloadBytes !== undefined).map(s => s.payloadBytes!);
          const httpCounts = samples.filter(s => s.httpRequests !== undefined).map(s => s.httpRequests!);
          
          // Count queries per page/route (aggregate across all operations)
          const pageCounts: Record<string, number> = {};
          samples.forEach(s => {
            const page = s.route || '(no route)';
            pageCounts[page] = (pageCounts[page] || 0) + 1;
          });
          
          return {
            avgDurationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
            minDurationMs: Math.min(...durations),
            maxDurationMs: Math.max(...durations),
            avgPayloadBytes: payloadSizes.length > 0
              ? payloadSizes.reduce((a, b) => a + b, 0) / payloadSizes.length
              : undefined,
            avgHttpRequests: httpCounts.length > 0
              ? httpCounts.reduce((a, b) => a + b, 0) / httpCounts.length
              : undefined,
            samples: samples.length,
            pages: pageCounts,
          };
        };
        
        perfSummary = {
          graphql: aggregateByRoute(graphqlSamples),
          arkiv: aggregateByRoute(arkivSamples),
        };
        
        // Also query Arkiv entities and merge
        try {
          const arkivMetrics = await listDxMetrics({
            route,
            limit: 200,
          });
          
          if (arkivMetrics.length > 0) {
            const arkivSamplesFromArkiv = arkivMetrics
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
            
            const graphqlSamplesFromArkiv = arkivMetrics
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
            
            // Merge Arkiv data with in-memory data
            const allArkivSamples = [...arkivSamples, ...arkivSamplesFromArkiv];
            const allGraphqlSamples = [...graphqlSamples, ...graphqlSamplesFromArkiv];
            
            perfSummary.arkiv = aggregateByRoute(allArkivSamples);
            perfSummary.graphql = aggregateByRoute(allGraphqlSamples);
          }
        } catch (error) {
          console.error('[admin/perf-samples] Failed to query Arkiv entities for all operations:', error);
          // Continue with in-memory data only
        }
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
