/**
 * Week 1 Performance Testing Script
 * 
 * Runs performance tests for Arkiv JSON-RPC vs GraphQL comparison.
 * This script automates the testing process outlined in Week 1 execution checklist.
 * 
 * Usage:
 *   pnpm dlx tsx scripts/run-week1-tests.ts
 */

import { getPrivateKey, CURRENT_WALLET } from '@/lib/config';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'plantingseeds';

interface TestResult {
  method: 'arkiv' | 'graphql' | 'both';
  success: boolean;
  entitiesCreated: number;
  transactions: Array<{ source: string; operation: string; txHash: string }>;
  error?: string;
}

interface PerformanceSample {
  source: 'arkiv' | 'graphql';
  operation: string;
  durationMs: number;
  payloadBytes?: number;
  httpRequests?: number;
  createdAt: string;
  route?: string;
}

async function runPerformanceTest(method: 'arkiv' | 'graphql' | 'both'): Promise<TestResult> {
  console.log(`\n🧪 Running ${method.toUpperCase()} performance test...`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/admin/perf-samples?seed=true&method=${method}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Test failed');
    }

    console.log(`✅ ${method.toUpperCase()} test completed: ${data.entitiesCreated} entities created`);
    if (data.transactions && data.transactions.length > 0) {
      console.log(`   Transactions:`);
      data.transactions.forEach((tx: any) => {
        console.log(`   - ${tx.source}/${tx.operation}: ${tx.txHash?.slice(0, 20)}...`);
        console.log(`     Explorer: ${tx.explorer}`);
      });
    }

    return {
      method,
      success: true,
      entitiesCreated: data.entitiesCreated || 0,
      transactions: data.transactions || [],
    };
  } catch (error: any) {
    console.error(`❌ ${method.toUpperCase()} test failed:`, error.message);
    return {
      method,
      success: false,
      entitiesCreated: 0,
      transactions: [],
      error: error.message,
    };
  }
}

async function createSnapshot(operation: string = 'buildNetworkGraphData'): Promise<{ success: boolean; txHash?: string; error?: string }> {
  console.log(`\n📸 Creating performance snapshot...`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/admin/perf-snapshots?operation=${operation}&method=both&force=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(data.error || 'Snapshot creation failed');
    }

    console.log(`✅ Snapshot created: ${data.snapshot?.txHash?.slice(0, 20)}...`);
    console.log(`   Explorer: ${data.snapshot?.explorer}`);

    return {
      success: true,
      txHash: data.snapshot?.txHash,
    };
  } catch (error: any) {
    console.error(`❌ Snapshot creation failed:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getPerformanceSummary(operation: string = 'buildNetworkGraphData'): Promise<any> {
  try {
    const response = await fetch(`${BASE_URL}/api/admin/perf-samples?summary=true&summaryOperation=${operation}`);
    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Failed to fetch performance summary:', error);
    return null;
  }
}

async function validateDataCorrectness(): Promise<{ valid: boolean; issues: string[] }> {
  console.log(`\n🔍 Validating data correctness...`);
  
  const issues: string[] = [];
  
  try {
    // Fetch both JSON-RPC and GraphQL data
    const [jsonRpcRes, graphqlRes] = await Promise.all([
      fetch(`${BASE_URL}/api/network/graph?includeExpired=false`),
      fetch(`${BASE_URL}/api/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              networkOverview(limitAsks: 25, limitOffers: 25, includeExpired: false) {
                skillRefs {
                  id
                  name
                  asks {
                    id
                    wallet
                    skill
                    status
                  }
                  offers {
                    id
                    wallet
                    skill
                    isPaid
                    status
                  }
                }
              }
            }
          `,
        }),
      }),
    ]);

    const jsonRpcData = await jsonRpcRes.json();
    const graphqlData = await graphqlRes.json();

    if (!jsonRpcData.nodes || !jsonRpcData.links) {
      issues.push('JSON-RPC data missing nodes or links');
    }

    if (!graphqlData.data?.networkOverview?.skillRefs) {
      issues.push('GraphQL data missing networkOverview.skillRefs');
    }

    // Count nodes and links
    const jsonRpcNodeCount = jsonRpcData.nodes?.length || 0;
    const jsonRpcLinkCount = jsonRpcData.links?.length || 0;

    // Count GraphQL nodes (skills + asks + offers)
    let graphqlNodeCount = 0;
    let graphqlLinkCount = 0;
    
    if (graphqlData.data?.networkOverview?.skillRefs) {
      graphqlData.data.networkOverview.skillRefs.forEach((skillRef: any) => {
        graphqlNodeCount += 1; // skill node
        graphqlNodeCount += skillRef.asks?.length || 0;
        graphqlNodeCount += skillRef.offers?.length || 0;
        graphqlLinkCount += skillRef.asks?.length || 0;
        graphqlLinkCount += skillRef.offers?.length || 0;
      });
    }

    console.log(`   JSON-RPC: ${jsonRpcNodeCount} nodes, ${jsonRpcLinkCount} links`);
    console.log(`   GraphQL: ${graphqlNodeCount} nodes, ${graphqlLinkCount} links`);

    // Note: Exact counts may differ due to adapter logic, but should be close
    if (Math.abs(jsonRpcNodeCount - graphqlNodeCount) > 5) {
      issues.push(`Node count mismatch: JSON-RPC=${jsonRpcNodeCount}, GraphQL=${graphqlNodeCount}`);
    }

    // Verify node ID format
    if (jsonRpcData.nodes) {
      const invalidIds = jsonRpcData.nodes.filter((n: any) => 
        !n.id || (!n.id.startsWith('skill:') && !n.id.startsWith('ask:') && !n.id.startsWith('offer:'))
      );
      if (invalidIds.length > 0) {
        issues.push(`Invalid node ID format: ${invalidIds.length} nodes`);
      }
    }

    // Verify link format
    if (jsonRpcData.links) {
      const invalidLinks = jsonRpcData.links.filter((l: any) => 
        !l.source || !l.target
      );
      if (invalidLinks.length > 0) {
        issues.push(`Invalid link format: ${invalidLinks.length} links`);
      }
    }

    if (issues.length === 0) {
      console.log(`✅ Data correctness validation passed`);
    } else {
      console.log(`⚠️  Data correctness issues found:`, issues);
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  } catch (error: any) {
    console.error(`❌ Validation error:`, error.message);
    return {
      valid: false,
      issues: [error.message],
    };
  }
}

async function main() {
  console.log('🚀 Starting Week 1 Performance Testing');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Wallet: ${CURRENT_WALLET || 'Not configured'}`);
  
  if (!CURRENT_WALLET) {
    console.error('❌ CURRENT_WALLET not configured. Set ARKIV_PRIVATE_KEY in .env');
    process.exit(1);
  }

  const results: TestResult[] = [];

  // Step 1: Run 10 Arkiv tests
  console.log('\n📊 Step 1: Running 10 Arkiv JSON-RPC tests...');
  for (let i = 1; i <= 10; i++) {
    console.log(`   Test ${i}/10...`);
    const result = await runPerformanceTest('arkiv');
    results.push(result);
    if (!result.success) {
      console.error(`   ⚠️  Test ${i} failed, continuing...`);
    }
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Step 2: Create Arkiv snapshot
  console.log('\n📸 Creating Arkiv baseline snapshot...');
  await createSnapshot();

  // Step 3: Run 10 GraphQL tests
  console.log('\n📊 Step 2: Running 10 GraphQL tests...');
  for (let i = 1; i <= 10; i++) {
    console.log(`   Test ${i}/10...`);
    const result = await runPerformanceTest('graphql');
    results.push(result);
    if (!result.success) {
      console.error(`   ⚠️  Test ${i} failed, continuing...`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Step 4: Create GraphQL snapshot
  console.log('\n📸 Creating GraphQL snapshot...');
  await createSnapshot();

  // Step 5: Run "Both" comparison test
  console.log('\n📊 Step 3: Running "Both" comparison test...');
  const bothResult = await runPerformanceTest('both');
  results.push(bothResult);

  // Step 6: Create comparison snapshot
  console.log('\n📸 Creating comparison snapshot...');
  await createSnapshot();

  // Step 7: Validate data correctness
  const validation = await validateDataCorrectness();

  // Step 8: Get final performance summary
  console.log('\n📈 Fetching performance summary...');
  const summary = await getPerformanceSummary();
  
  if (summary) {
    console.log('\n📊 Performance Summary:');
    if (summary.arkiv) {
      console.log(`   Arkiv JSON-RPC:`);
      console.log(`     Avg Duration: ${summary.arkiv.avgDurationMs.toFixed(2)}ms`);
      console.log(`     Avg Payload: ${summary.arkiv.avgPayloadBytes ? (summary.arkiv.avgPayloadBytes / 1024).toFixed(2) : 'N/A'} KB`);
      console.log(`     HTTP Requests: ${summary.arkiv.avgHttpRequests?.toFixed(1) || 'N/A'}`);
      console.log(`     Samples: ${summary.arkiv.samples}`);
    }
    if (summary.graphql) {
      console.log(`   GraphQL:`);
      console.log(`     Avg Duration: ${summary.graphql.avgDurationMs.toFixed(2)}ms`);
      console.log(`     Avg Payload: ${summary.graphql.avgPayloadBytes ? (summary.graphql.avgPayloadBytes / 1024).toFixed(2) : 'N/A'} KB`);
      console.log(`     HTTP Requests: ${summary.graphql.avgHttpRequests?.toFixed(1) || '1'}`);
      console.log(`     Samples: ${summary.graphql.samples}`);
    }
  }

  // Summary
  console.log('\n✅ Week 1 Testing Complete!');
  console.log(`   Total tests run: ${results.length}`);
  console.log(`   Successful: ${results.filter(r => r.success).length}`);
  console.log(`   Failed: ${results.filter(r => !r.success).length}`);
  console.log(`   Data correctness: ${validation.valid ? '✅ Passed' : '⚠️  Issues found'}`);
  
  if (validation.issues.length > 0) {
    console.log(`   Issues: ${validation.issues.join(', ')}`);
  }

  return {
    results,
    validation,
    summary,
  };
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as runWeek1Tests };

