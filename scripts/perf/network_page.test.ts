/**
 * Performance test for network page
 * 
 * Compares JSON-RPC vs GraphQL performance for network data.
 * 
 * Usage:
 *   pnpm run perf:network
 * 
 * Reference: refs/docs/sprint2.md Section 2.2
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface PerfResult {
  endpoint: string;
  status: number;
  durationMs: number;
  payloadBytes: number;
  error?: string;
}

async function measureEndpoint(
  url: string,
  method: string = 'GET',
  body?: any
): Promise<PerfResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    let payloadBytes = 0;
    if (response.ok) {
      const text = await response.text();
      payloadBytes = new Blob([text]).size;
    }

    return {
      endpoint: url,
      status: response.status,
      durationMs,
      payloadBytes,
    };
  } catch (error) {
    const endTime = Date.now();
    return {
      endpoint: url,
      status: 0,
      durationMs: endTime - startTime,
      payloadBytes: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function runPerfTest() {
  console.log('🚀 Network Page Performance Test\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  const results: PerfResult[] = [];

  // Test 1: Network graph data via API (JSON-RPC path)
  console.log('1. Testing /api/network/graph (JSON-RPC path)...');
  const jsonRpcResult = await measureEndpoint(
    `${BASE_URL}/api/network/graph?includeExpired=false`
  );
  results.push({ ...jsonRpcResult, endpoint: '/api/network/graph (JSON-RPC)' });

  // Test 2: GraphQL network overview query
  console.log('2. Testing /api/graphql (networkOverview query)...');
  const graphqlQuery = {
    query: `
      query NetworkOverview {
        networkOverview(limitAsks: 25, limitOffers: 25, includeExpired: false) {
          skillRefs {
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
              status
            }
          }
        }
      }
    `,
  };
  const graphqlResult = await measureEndpoint(
    `${BASE_URL}/api/graphql`,
    'POST',
    graphqlQuery
  );
  results.push({ ...graphqlResult, endpoint: '/api/graphql (GraphQL)' });

  // Test 3: Network page (full page load)
  console.log('3. Testing /network page...');
  const pageResult = await measureEndpoint(`${BASE_URL}/network`);
  results.push({ ...pageResult, endpoint: '/network (page)' });

  // Print results
  console.log('\n📊 Results:\n');
  console.log('┌─────────────────────────────────┬────────┬──────────────┬──────────────┐');
  console.log('│ Endpoint                          │ Status │ Duration (ms)│ Payload (KB)│');
  console.log('├─────────────────────────────────┼────────┼──────────────┼──────────────┤');

  results.forEach((result) => {
    const status = result.status > 0 ? result.status.toString() : 'ERROR';
    const duration = result.durationMs.toFixed(2).padStart(12);
    const payload = (result.payloadBytes / 1024).toFixed(2).padStart(12);
    const endpoint = result.endpoint.padEnd(31);
    console.log(`│ ${endpoint} │ ${status.padEnd(6)} │ ${duration} │ ${payload} │`);
  });

  console.log('└─────────────────────────────────┴────────┴──────────────┴──────────────┘\n');

  // Comparison
  const jsonRpc = results.find(r => r.endpoint.includes('JSON-RPC'));
  const graphql = results.find(r => r.endpoint.includes('GraphQL'));

  if (jsonRpc && graphql && jsonRpc.status === 200 && graphql.status === 200) {
    console.log('📈 Comparison:\n');
    const speedup = ((jsonRpc.durationMs - graphql.durationMs) / jsonRpc.durationMs * 100).toFixed(1);
    const payloadDiff = ((graphql.payloadBytes - jsonRpc.payloadBytes) / jsonRpc.payloadBytes * 100).toFixed(1);
    
    console.log(`  Duration: GraphQL is ${speedup}% ${graphql.durationMs < jsonRpc.durationMs ? 'faster' : 'slower'}`);
    console.log(`  Payload:  GraphQL is ${Math.abs(parseFloat(payloadDiff))}% ${graphql.payloadBytes < jsonRpc.payloadBytes ? 'smaller' : 'larger'}`);
    console.log(`  HTTP Requests: JSON-RPC (multiple), GraphQL (1)\n`);
  }

  // Exit with error if any test failed
  const hasErrors = results.some(r => r.status !== 200 || r.error);
  if (hasErrors) {
    console.error('❌ Some tests failed. Check results above.');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
  }
}

// Run the test
runPerfTest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

