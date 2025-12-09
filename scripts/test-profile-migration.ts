/**
 * Test Profile Page Migration
 * 
 * Runs performance tests for profile page before and after GraphQL migration.
 * Creates snapshots and documents metrics.
 * 
 * Usage:
 *   pnpm dlx tsx scripts/test-profile-migration.ts
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const TEST_WALLET = process.env.TEST_WALLET || '0x4b6D14e3ad668a2273Ce3Cf9A22cda202f404c5F'; // Default wallet

interface TestResult {
  method: 'arkiv' | 'graphql';
  success: boolean;
  durationMs: number;
  payloadBytes: number;
  httpRequests: number;
  entitiesCreated: number;
  txHash?: string;
  error?: string;
}

async function testProfilePage(method: 'arkiv' | 'graphql'): Promise<TestResult> {
  console.log(`\n🧪 Testing profile page with ${method.toUpperCase()}...`);
  
  const startTime = Date.now();
  
  try {
    // Test profile page load
    // For Arkiv: 5 parallel API calls
    // For GraphQL: 1 GraphQL query + 1 API call (sessions)
    if (method === 'arkiv') {
      // Simulate 5 parallel calls
      const [profileRes, asksRes, offersRes, sessionsRes, feedbackRes] = await Promise.all([
        fetch(`${BASE_URL}/api/profile?wallet=${encodeURIComponent(TEST_WALLET)}`),
        fetch(`${BASE_URL}/api/asks?wallet=${encodeURIComponent(TEST_WALLET)}`),
        fetch(`${BASE_URL}/api/offers?wallet=${encodeURIComponent(TEST_WALLET)}`),
        fetch(`${BASE_URL}/api/sessions?wallet=${encodeURIComponent(TEST_WALLET)}`),
        fetch(`${BASE_URL}/api/feedback?wallet=${encodeURIComponent(TEST_WALLET)}`),
      ]);
      
      const [profileData, asksData, offersData, sessionsData, feedbackData] = await Promise.all([
        profileRes.json(),
        asksRes.json(),
        offersRes.json(),
        sessionsRes.json(),
        feedbackRes.json(),
      ]);
      
      const durationMs = Date.now() - startTime;
      const payloadBytes = JSON.stringify({
        profile: profileData,
        asks: asksData,
        offers: offersData,
        sessions: sessionsData,
        feedback: feedbackData,
      }).length;
      
      // Create performance metric
      const metricRes = await fetch(`${BASE_URL}/api/admin/perf-samples?seed=true&method=arkiv&operation=loadProfileData&route=/profiles/[wallet]`, {
        method: 'GET',
      });
      const metricData = await metricRes.json();
      
      return {
        method: 'arkiv',
        success: true,
        durationMs,
        payloadBytes,
        httpRequests: 5,
        entitiesCreated: metricData.entitiesCreated || 0,
        txHash: metricData.transactions?.[0]?.txHash,
      };
    } else {
      // GraphQL: Single query + 1 API call
      const [graphqlRes, sessionsRes] = await Promise.all([
        fetch(`${BASE_URL}/api/graphql`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              query ProfileDetail($wallet: String!) {
                profile(wallet: $wallet) {
                  id wallet displayName username bio bioShort bioLong timezone seniority skills availabilityWindow createdAt
                  asks(limit: 50) { id key wallet skill message status createdAt expiresAt ttlSeconds txHash }
                  offers(limit: 50) { id key wallet skill message availabilityWindow isPaid cost paymentAddress status createdAt expiresAt ttlSeconds txHash }
                }
                feedback(wallet: $wallet, limit: 50) {
                  id key sessionKey mentorWallet learnerWallet feedbackFrom feedbackTo rating notes technicalDxFeedback createdAt txHash
                }
              }
            `,
            variables: { wallet: TEST_WALLET },
          }),
        }),
        fetch(`${BASE_URL}/api/sessions?wallet=${encodeURIComponent(TEST_WALLET)}`),
      ]);
      
      const [graphqlData, sessionsData] = await Promise.all([
        graphqlRes.json(),
        sessionsRes.json(),
      ]);
      
      const durationMs = Date.now() - startTime;
      const payloadBytes = JSON.stringify({
        profile: graphqlData.data?.profile,
        feedback: graphqlData.data?.feedback,
        sessions: sessionsData,
      }).length;
      
      // Create performance metric
      const metricRes = await fetch(`${BASE_URL}/api/admin/perf-samples?seed=true&method=graphql&operation=loadProfileData&route=/profiles/[wallet]`, {
        method: 'GET',
      });
      const metricData = await metricRes.json();
      
      return {
        method: 'graphql',
        success: true,
        durationMs,
        payloadBytes,
        httpRequests: 2, // 1 GraphQL + 1 API
        entitiesCreated: metricData.entitiesCreated || 0,
        txHash: metricData.transactions?.[0]?.txHash,
      };
    }
  } catch (error: any) {
    console.error(`❌ ${method.toUpperCase()} test failed:`, error.message);
    return {
      method,
      success: false,
      durationMs: Date.now() - startTime,
      payloadBytes: 0,
      httpRequests: method === 'arkiv' ? 5 : 2,
      entitiesCreated: 0,
      error: error.message,
    };
  }
}

async function createSnapshot(operation: string = 'loadProfileData'): Promise<{ success: boolean; txHash?: string; error?: string }> {
  console.log(`\n📸 Creating performance snapshot...`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/admin/perf-snapshots?operation=${operation}&method=both&force=true`, {
      method: 'POST',
    });

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(data.error || 'Snapshot creation failed');
    }

    console.log(`✅ Snapshot created: ${data.snapshot?.txHash?.slice(0, 20)}...`);
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

async function main() {
  console.log('🚀 Profile Page Migration Testing');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Test Wallet: ${TEST_WALLET}`);
  
  const results: TestResult[] = [];
  
  // Step 1: Baseline - 10 Arkiv tests
  console.log('\n📊 Step 1: Running 10 Arkiv JSON-RPC baseline tests...');
  for (let i = 1; i <= 10; i++) {
    console.log(`   Test ${i}/10...`);
    const result = await testProfilePage('arkiv');
    results.push(result);
    if (!result.success) {
      console.error(`   ⚠️  Test ${i} failed, continuing...`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Step 2: Create Arkiv baseline snapshot
  await createSnapshot();
  
  // Step 3: 10 GraphQL tests
  console.log('\n📊 Step 2: Running 10 GraphQL tests...');
  for (let i = 1; i <= 10; i++) {
    console.log(`   Test ${i}/10...`);
    const result = await testProfilePage('graphql');
    results.push(result);
    if (!result.success) {
      console.error(`   ⚠️  Test ${i} failed, continuing...`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Step 4: Create GraphQL snapshot
  await createSnapshot();
  
  // Step 5: Summary
  const arkivResults = results.filter(r => r.method === 'arkiv' && r.success);
  const graphqlResults = results.filter(r => r.method === 'graphql' && r.success);
  
  console.log('\n✅ Testing Complete!');
  console.log(`\n📊 Results Summary:`);
  console.log(`   Arkiv JSON-RPC: ${arkivResults.length} successful`);
  if (arkivResults.length > 0) {
    const avgDuration = arkivResults.reduce((sum, r) => sum + r.durationMs, 0) / arkivResults.length;
    const avgPayload = arkivResults.reduce((sum, r) => sum + r.payloadBytes, 0) / arkivResults.length;
    console.log(`     Avg Duration: ${avgDuration.toFixed(2)}ms`);
    console.log(`     Avg Payload: ${(avgPayload / 1024).toFixed(2)} KB`);
    console.log(`     HTTP Requests: 5 per query`);
  }
  
  console.log(`   GraphQL: ${graphqlResults.length} successful`);
  if (graphqlResults.length > 0) {
    const avgDuration = graphqlResults.reduce((sum, r) => sum + r.durationMs, 0) / graphqlResults.length;
    const avgPayload = graphqlResults.reduce((sum, r) => sum + r.payloadBytes, 0) / graphqlResults.length;
    console.log(`     Avg Duration: ${avgDuration.toFixed(2)}ms`);
    console.log(`     Avg Payload: ${(avgPayload / 1024).toFixed(2)} KB`);
    console.log(`     HTTP Requests: 2 per query (60% reduction)`);
  }
  
  return {
    arkivResults,
    graphqlResults,
  };
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as testProfileMigration };

