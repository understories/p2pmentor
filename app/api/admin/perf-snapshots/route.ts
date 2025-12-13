/**
 * Admin API: Performance Snapshots
 * 
 * Creates and retrieves performance snapshots for historical tracking.
 * 
 * Reference: Performance monitoring best practices
 */

import { NextResponse } from 'next/server';
import { createPerfSnapshot, listPerfSnapshots, getLatestSnapshot, shouldCreateSnapshot } from '@/lib/arkiv/perfSnapshots';
import { getPerfSummary, getPerfSamplesFiltered } from '@/lib/metrics/perf';
import { listDxMetrics } from '@/lib/arkiv/dxMetrics';
import { getPrivateKey, CURRENT_WALLET } from '@/lib/config';
import { getPublicClient } from '@/lib/arkiv/client';

/**
 * POST /api/admin/perf-snapshots
 * 
 * Creates a new performance snapshot with current metrics.
 * Query params:
 * - operation: string (default: 'buildNetworkGraphData')
 * - method: 'arkiv' | 'graphql' | 'both' (default: 'both')
 * - includePageLoad: boolean (default: true)
 */
export async function POST(request: Request) {
  try {
    if (!CURRENT_WALLET) {
      return NextResponse.json(
        { ok: false, error: 'ARKIV_PRIVATE_KEY not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const operation = searchParams.get('operation') || 'buildNetworkGraphData';
    const method = (searchParams.get('method') as 'arkiv' | 'graphql' | 'both') || 'both';
    const includePageLoad = searchParams.get('includePageLoad') !== 'false';
    const force = searchParams.get('force') === 'true'; // Allow manual override

    // Idempotency check: skip if last snapshot < 5 minutes old (unless forced)
    if (!force) {
      try {
        const lastSnapshot = await getLatestSnapshot(operation);
        if (lastSnapshot) {
          const lastTimestamp = new Date(lastSnapshot.timestamp).getTime();
          const now = Date.now();
          const minutesSince = (now - lastTimestamp) / (1000 * 60);
          
          if (minutesSince < 5) {
            return NextResponse.json({
              ok: false,
              error: 'Snapshot created too recently',
              message: `Last snapshot was ${minutesSince.toFixed(1)} minutes ago. Wait 5 minutes or use ?force=true to override.`,
              lastSnapshot: {
                timestamp: lastSnapshot.timestamp,
                minutesAgo: minutesSince.toFixed(1),
              },
            }, { status: 429 }); // 429 Too Many Requests
          }
        }
      } catch (err) {
        // If check fails, continue (don't block snapshot creation)
        console.log('[perf-snapshots] Idempotency check failed, continuing:', err);
      }
    }

    const privateKey = getPrivateKey();
    const timestamp = new Date().toISOString();

    // Capture Arkiv RPC metadata for snapshot context
    let arkivMetadata: { blockHeight?: number; chainId?: number; timestamp: string } | undefined;
    try {
      const publicClient = getPublicClient();
      // Get current block number (Arkiv block height)
      const blockNumber = await publicClient.getBlockNumber();
      const chainId = await publicClient.getChainId();
      
      arkivMetadata = {
        blockHeight: Number(blockNumber),
        chainId: Number(chainId),
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.log('[perf-snapshots] Failed to capture Arkiv metadata, continuing without it:', err);
      // Continue without metadata - don't block snapshot creation
      arkivMetadata = {
        timestamp: new Date().toISOString(),
      };
    }

    // Get current performance summary
    // For snapshots, we want to capture ALL operations (not just one specific operation)
    // This gives us a complete picture of all pages using GraphQL/Arkiv
    // Use the same aggregation logic as the summary endpoint (no operation filter)
    let perfSummary: any = { graphql: undefined, arkiv: undefined };
    
    // Query ALL Arkiv entities (not filtered by operation) to get complete picture
    try {
      const arkivMetrics = await listDxMetrics({
        limit: 500, // Get more samples for comprehensive snapshot
      });
      
      if (arkivMetrics.length > 0) {
        // Convert DxMetric to PerfSample format and aggregate
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
        
        // Aggregate Arkiv samples across all operations
        if (arkivSamples.length > 0) {
          const durations = arkivSamples.map(s => s.durationMs);
          const payloadSizes = arkivSamples.filter(s => s.payloadBytes !== undefined).map(s => s.payloadBytes!);
          const httpCounts = arkivSamples.filter(s => s.httpRequests !== undefined).map(s => s.httpRequests!);
          
          // Count queries per page/route (across all operations)
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
        
        // Aggregate GraphQL samples across all operations
        if (graphqlSamples.length > 0) {
          const durations = graphqlSamples.map(s => s.durationMs);
          const payloadSizes = graphqlSamples.filter(s => s.payloadBytes !== undefined).map(s => s.payloadBytes!);
          const httpCounts = graphqlSamples.filter(s => s.httpRequests !== undefined).map(s => s.httpRequests!);
          
          // Count queries per page/route (across all operations)
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
    } catch (error) {
      console.log('[perf-snapshots] Failed to query Arkiv metrics, using in-memory only:', error);
    }
    
    // Also check in-memory samples for any missing data
    // This ensures we capture all performance data, not just what's on-chain
    try {
      const { getPerfSamples } = await import('@/lib/metrics/perf');
      const allSamples = getPerfSamples();
      
      // Aggregate in-memory GraphQL samples (across all operations)
      const inMemoryGraphqlSamples = allSamples.filter(s => s.source === 'graphql');
      if (inMemoryGraphqlSamples.length > 0) {
        const durations = inMemoryGraphqlSamples.map(s => s.durationMs);
        const payloadSizes = inMemoryGraphqlSamples.filter(s => s.payloadBytes !== undefined).map(s => s.payloadBytes!);
        const httpCounts = inMemoryGraphqlSamples.filter(s => s.httpRequests !== undefined).map(s => s.httpRequests!);
        
        const pageCounts: Record<string, number> = {};
        inMemoryGraphqlSamples.forEach(s => {
          const page = s.route || '(no route)';
          pageCounts[page] = (pageCounts[page] || 0) + 1;
        });
        
        // Merge with existing GraphQL data (prefer Arkiv entities, but include in-memory)
        if (!perfSummary.graphql || perfSummary.graphql.samples === 0) {
          perfSummary.graphql = {
            avgDurationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
            minDurationMs: Math.min(...durations),
            maxDurationMs: Math.max(...durations),
            avgPayloadBytes: payloadSizes.length > 0 ? payloadSizes.reduce((a, b) => a + b, 0) / payloadSizes.length : undefined,
            avgHttpRequests: httpCounts.length > 0 ? httpCounts.reduce((a, b) => a + b, 0) / httpCounts.length : undefined,
            samples: inMemoryGraphqlSamples.length,
            pages: pageCounts,
          };
        } else {
          // Merge pages from in-memory with Arkiv
          Object.entries(pageCounts).forEach(([page, count]) => {
            perfSummary.graphql.pages[page] = (perfSummary.graphql.pages[page] || 0) + count;
          });
        }
      }
      
      // Aggregate in-memory Arkiv samples (across all operations)
      const inMemoryArkivSamples = allSamples.filter(s => s.source === 'arkiv');
      if (inMemoryArkivSamples.length > 0) {
        const durations = inMemoryArkivSamples.map(s => s.durationMs);
        const payloadSizes = inMemoryArkivSamples.filter(s => s.payloadBytes !== undefined).map(s => s.payloadBytes!);
        const httpCounts = inMemoryArkivSamples.filter(s => s.httpRequests !== undefined).map(s => s.httpRequests!);
        
        const pageCounts: Record<string, number> = {};
        inMemoryArkivSamples.forEach(s => {
          const page = s.route || '(no route)';
          pageCounts[page] = (pageCounts[page] || 0) + 1;
        });
        
        // Merge with existing Arkiv data (prefer Arkiv entities, but include in-memory)
        if (!perfSummary.arkiv || perfSummary.arkiv.samples === 0) {
          perfSummary.arkiv = {
            avgDurationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
            minDurationMs: Math.min(...durations),
            maxDurationMs: Math.max(...durations),
            avgPayloadBytes: payloadSizes.length > 0 ? payloadSizes.reduce((a, b) => a + b, 0) / payloadSizes.length : undefined,
            avgHttpRequests: httpCounts.length > 0 ? httpCounts.reduce((a, b) => a + b, 0) / httpCounts.length : undefined,
            samples: inMemoryArkivSamples.length,
            pages: pageCounts,
          };
        } else {
          // Merge pages from in-memory with Arkiv
          Object.entries(pageCounts).forEach(([page, count]) => {
            perfSummary.arkiv.pages[page] = (perfSummary.arkiv.pages[page] || 0) + count;
          });
        }
      }
    } catch (error) {
      console.log('[perf-snapshots] Failed to query in-memory samples:', error);
    }

    // Determine what was actually tested (not just what was requested)
    // If method=both but only one has data, update method to reflect reality
    let actualMethod: 'arkiv' | 'graphql' | 'both' = method;
    if (method === 'both') {
      const hasArkiv = !!perfSummary.arkiv && perfSummary.arkiv.samples > 0;
      const hasGraphQL = !!perfSummary.graphql && perfSummary.graphql.samples > 0;
      if (hasArkiv && hasGraphQL) {
        actualMethod = 'both';
      } else if (hasArkiv) {
        actualMethod = 'arkiv';
      } else if (hasGraphQL) {
        actualMethod = 'graphql';
      } else {
        // No data at all - keep requested method but note it
        actualMethod = method;
      }
    }

    // Get page load times if requested
    // Note: First request may include cold start, so we measure multiple times
    let pageLoadTimes;
    if (includePageLoad) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        // Measure twice to avoid cold start skewing results
        const pageLoadRes1 = await fetch(`${baseUrl}/api/admin/page-load-times?baseUrl=${encodeURIComponent(baseUrl)}`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between measurements
        const pageLoadRes2 = await fetch(`${baseUrl}/api/admin/page-load-times?baseUrl=${encodeURIComponent(baseUrl)}`);
        
        if (pageLoadRes1.ok && pageLoadRes2.ok) {
          const pageLoadData1 = await pageLoadRes1.json();
          const pageLoadData2 = await pageLoadRes2.json();
          
          // Use the better (faster) measurement to avoid cold start
          const data1 = pageLoadData1.ok && pageLoadData1.summary ? pageLoadData1.summary : null;
          const data2 = pageLoadData2.ok && pageLoadData2.summary ? pageLoadData2.summary : null;
          
          const bestData = data1 && data2 
            ? (data1.avgDurationMs < data2.avgDurationMs ? data1 : data2)
            : (data1 || data2);
          
          if (bestData) {
            pageLoadTimes = {
              avgDurationMs: bestData.avgDurationMs,
              minDurationMs: bestData.minDurationMs,
              maxDurationMs: bestData.maxDurationMs,
              total: bestData.total,
              successful: bestData.successful,
            };
          }
        }
      } catch (err) {
        console.error('[perf-snapshots] Failed to fetch page load times:', err);
        // Continue without page load times
      }
    }

    // Create snapshot entity with actual method tested
    const { key, txHash } = await createPerfSnapshot({
      snapshot: {
        timestamp,
        operation,
        method: actualMethod, // Use actual method, not requested
        graphql: perfSummary.graphql,
        arkiv: perfSummary.arkiv,
        pageLoadTimes,
        createdAt: timestamp,
      },
      privateKey,
    });

    return NextResponse.json({
      ok: true,
      snapshot: {
        key,
        txHash,
        timestamp,
        operation,
        method,
        explorer: `https://explorer.mendoza.hoodi.arkiv.network/tx/${txHash}`,
      },
    });
  } catch (error: any) {
    console.error('[admin/perf-snapshots] Error:', error);
    
    // Handle transaction errors gracefully (same pattern as other entity creation)
    const errorMessage = error.message || 'Failed to create snapshot';
    
    // Check for transaction-related errors
    if (errorMessage.includes('replacement transaction') || errorMessage.includes('underpriced')) {
      return NextResponse.json(
        { 
          ok: false, 
          error: 'Transaction conflict. Please wait a moment and try again.',
          details: 'A transaction is already pending. Wait for it to confirm before creating another snapshot.',
        },
        { status: 429 } // Too Many Requests
      );
    }
    
    // Check for transaction timeout (handled by handleTransactionWithTimeout)
    if (errorMessage.includes('Transaction submitted') || errorMessage.includes('confirmation pending')) {
      // Transaction was submitted but confirmation is pending - this is actually a success case
      // Extract txHash if available
      const txHashMatch = errorMessage.match(/0x[a-fA-F0-9]{40,64}/);
      if (txHashMatch) {
        const { searchParams } = new URL(request.url);
        const op = searchParams.get('operation') || 'buildNetworkGraphData';
        const meth = (searchParams.get('method') as 'arkiv' | 'graphql' | 'both') || 'both';
        return NextResponse.json({
          ok: true,
          snapshot: {
            key: 'pending',
            txHash: txHashMatch[0],
            timestamp: new Date().toISOString(),
            operation: op,
            method: meth,
            explorer: `https://explorer.mendoza.hoodi.arkiv.network/tx/${txHashMatch[0]}`,
            pending: true,
          },
          message: 'Snapshot transaction submitted. It will appear once confirmed.',
        });
      }
    }
    
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/perf-snapshots
 * 
 * Retrieves performance snapshots.
 * Query params:
 * - operation: string
 * - method: 'arkiv' | 'graphql' | 'both'
 * - limit: number
 * - since: ISO timestamp
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const operation = searchParams.get('operation') || undefined;
    const method = searchParams.get('method') as 'arkiv' | 'graphql' | 'both' | undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
    const since = searchParams.get('since') || undefined;
    const checkAuto = searchParams.get('checkAuto') === 'true';

    // If checkAuto, determine if we should create a snapshot automatically
    if (checkAuto && operation) {
      const shouldCreate = await shouldCreateSnapshot(operation);
      const latest = shouldCreate ? null : await getLatestSnapshot(operation);
      
      return NextResponse.json({
        ok: true,
        shouldCreateSnapshot: shouldCreate,
        lastSnapshot: latest ? {
          timestamp: latest.timestamp,
          hoursAgo: (Date.now() - new Date(latest.timestamp).getTime()) / (1000 * 60 * 60),
        } : null,
      });
    }

    // Otherwise, return snapshots
    const snapshots = await listPerfSnapshots({
      operation,
      method,
      limit,
      since,
    });

    return NextResponse.json({
      ok: true,
      snapshots,
      count: snapshots.length,
    });
  } catch (error: any) {
    console.error('[admin/perf-snapshots] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}

