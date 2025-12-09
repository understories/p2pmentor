/**
 * Validation script to compare GraphQL adapter output with JSON-RPC output
 * 
 * Ensures data shape matches exactly before enabling GraphQL in production.
 * 
 * Usage: pnpm dlx tsx scripts/validate-graphql-adapter.ts
 */

import { buildNetworkGraphData } from '../lib/arkiv/networkGraph';

async function validateAdapter() {
  console.log('🔍 Validating GraphQL adapter matches JSON-RPC data shape...\n');

  // Test 1: Basic comparison (no filters)
  console.log('Test 1: Basic query (no filters)');
  const jsonRpcResult = await buildNetworkGraphData({
    limitAsks: 10,
    limitOffers: 10,
    includeExpired: false,
  });

  // Enable GraphQL via localStorage (client-side) or env var (server-side)
  // For this script, we'll test both paths
  process.env.USE_GRAPHQL_FOR_NETWORK = 'true';
  
  const graphqlResult = await buildNetworkGraphData({
    limitAsks: 10,
    limitOffers: 10,
    includeExpired: false,
  });

  // Compare results
  const issues: string[] = [];

  // Check node counts
  if (jsonRpcResult.nodes.length !== graphqlResult.nodes.length) {
    issues.push(
      `Node count mismatch: JSON-RPC=${jsonRpcResult.nodes.length}, GraphQL=${graphqlResult.nodes.length}`
    );
  }

  // Check link counts
  if (jsonRpcResult.links.length !== graphqlResult.links.length) {
    issues.push(
      `Link count mismatch: JSON-RPC=${jsonRpcResult.links.length}, GraphQL=${graphqlResult.links.length}`
    );
  }

  // Check node ID formats
  const jsonRpcNodeIds = new Set(jsonRpcResult.nodes.map(n => n.id));
  const graphqlNodeIds = new Set(graphqlResult.nodes.map(n => n.id));
  
  const missingInGraphQL = [...jsonRpcNodeIds].filter(id => !graphqlNodeIds.has(id));
  const extraInGraphQL = [...graphqlNodeIds].filter(id => !jsonRpcNodeIds.has(id));

  if (missingInGraphQL.length > 0) {
    issues.push(`Missing nodes in GraphQL: ${missingInGraphQL.slice(0, 5).join(', ')}${missingInGraphQL.length > 5 ? '...' : ''}`);
  }

  if (extraInGraphQL.length > 0) {
    issues.push(`Extra nodes in GraphQL: ${extraInGraphQL.slice(0, 5).join(', ')}${extraInGraphQL.length > 5 ? '...' : ''}`);
  }

  // Check node ID format consistency
  const jsonRpcAskNodes = jsonRpcResult.nodes.filter(n => n.type === 'ask');
  const graphqlAskNodes = graphqlResult.nodes.filter(n => n.type === 'ask');
  
  const jsonRpcAskIds = jsonRpcAskNodes.map(n => n.id);
  const graphqlAskIds = graphqlAskNodes.map(n => n.id);
  
  const jsonRpcAskIdFormat = jsonRpcAskIds[0]?.match(/^ask:/);
  const graphqlAskIdFormat = graphqlAskIds[0]?.match(/^ask:/);
  
  if (!jsonRpcAskIdFormat || !graphqlAskIdFormat) {
    issues.push('Ask node ID format mismatch (should start with "ask:")');
  }

  // Check link source/target consistency
  const jsonRpcLinkKeys = new Set(jsonRpcResult.links.map(l => `${l.source}-${l.target}`));
  const graphqlLinkKeys = new Set(graphqlResult.links.map(l => `${l.source}-${l.target}`));
  
  const missingLinks = [...jsonRpcLinkKeys].filter(key => !graphqlLinkKeys.has(key));
  const extraLinks = [...graphqlLinkKeys].filter(key => !jsonRpcLinkKeys.has(key));

  if (missingLinks.length > 0) {
    issues.push(`Missing links in GraphQL: ${missingLinks.slice(0, 5).join(', ')}${missingLinks.length > 5 ? '...' : ''}`);
  }

  if (extraLinks.length > 0) {
    issues.push(`Extra links in GraphQL: ${extraLinks.slice(0, 5).join(', ')}${extraLinks.length > 5 ? '...' : ''}`);
  }

  // Report results
  if (issues.length === 0) {
    console.log('✅ All validation checks passed!\n');
    console.log(`   Nodes: ${jsonRpcResult.nodes.length} (both methods)`);
    console.log(`   Links: ${jsonRpcResult.links.length} (both methods)`);
    console.log('\n✅ GraphQL adapter is ready for production use.');
    return true;
  } else {
    console.log('❌ Validation issues found:\n');
    issues.forEach(issue => console.log(`   - ${issue}`));
    console.log('\n❌ GraphQL adapter needs fixes before enabling in production.');
    return false;
  }
}

// Run validation
validateAdapter()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Error during validation:', err);
    process.exit(1);
  });

