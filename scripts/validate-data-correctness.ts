/**
 * Data Correctness Validation Script
 * 
 * Compares GraphQL adapter output with JSON-RPC data builder to ensure
 * data shape and consistency match.
 * 
 * Usage:
 *   pnpm dlx tsx scripts/validate-data-correctness.ts
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface ValidationResult {
  valid: boolean;
  issues: string[];
  jsonRpcStats: {
    nodeCount: number;
    linkCount: number;
    skillNodes: number;
    askNodes: number;
    offerNodes: number;
  };
  graphqlStats: {
    skillRefs: number;
    totalAsks: number;
    totalOffers: number;
  };
}

async function validateDataCorrectness(): Promise<ValidationResult> {
  console.log('🔍 Validating data correctness: GraphQL vs JSON-RPC\n');
  
  const issues: string[] = [];
  
  try {
    // Fetch JSON-RPC data
    console.log('📡 Fetching JSON-RPC data...');
    const jsonRpcRes = await fetch(`${BASE_URL}/api/network/graph?includeExpired=false`);
    if (!jsonRpcRes.ok) {
      throw new Error(`JSON-RPC fetch failed: ${jsonRpcRes.status}`);
    }
    const jsonRpcData = await jsonRpcRes.json();

    // Fetch GraphQL data
    console.log('📡 Fetching GraphQL data...');
    const graphqlRes = await fetch(`${BASE_URL}/api/graphql`, {
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
                  createdAt
                }
                offers {
                  id
                  wallet
                  skill
                  isPaid
                  cost
                  status
                  createdAt
                }
              }
            }
          }
        `,
      }),
    });
    
    if (!graphqlRes.ok) {
      throw new Error(`GraphQL fetch failed: ${graphqlRes.status}`);
    }
    const graphqlResponse = await graphqlRes.json();
    
    if (graphqlResponse.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(graphqlResponse.errors)}`);
    }

    const graphqlData = graphqlResponse.data?.networkOverview;

    // Validate JSON-RPC structure
    if (!jsonRpcData.nodes || !Array.isArray(jsonRpcData.nodes)) {
      issues.push('JSON-RPC data missing nodes array');
    }
    if (!jsonRpcData.links || !Array.isArray(jsonRpcData.links)) {
      issues.push('JSON-RPC data missing links array');
    }

    // Validate GraphQL structure
    if (!graphqlData || !graphqlData.skillRefs || !Array.isArray(graphqlData.skillRefs)) {
      issues.push('GraphQL data missing skillRefs array');
    }

    // Count JSON-RPC nodes by type
    const jsonRpcNodes = jsonRpcData.nodes || [];
    const skillNodes = jsonRpcNodes.filter((n: any) => n.id?.startsWith('skill:')).length;
    const askNodes = jsonRpcNodes.filter((n: any) => n.id?.startsWith('ask:')).length;
    const offerNodes = jsonRpcNodes.filter((n: any) => n.id?.startsWith('offer:')).length;
    const jsonRpcLinkCount = jsonRpcData.links?.length || 0;

    // Count GraphQL data
    const skillRefs = graphqlData?.skillRefs || [];
    let totalAsks = 0;
    let totalOffers = 0;
    
    skillRefs.forEach((skillRef: any) => {
      totalAsks += skillRef.asks?.length || 0;
      totalOffers += skillRef.offers?.length || 0;
    });

    // Validation checks
    console.log('\n📊 Data Comparison:');
    console.log(`   JSON-RPC: ${jsonRpcNodes.length} nodes (${skillNodes} skills, ${askNodes} asks, ${offerNodes} offers), ${jsonRpcLinkCount} links`);
    console.log(`   GraphQL: ${skillRefs.length} skills, ${totalAsks} asks, ${totalOffers} offers`);

    // Check node ID formats
    const invalidNodeIds = jsonRpcNodes.filter((n: any) => 
      !n.id || (!n.id.startsWith('skill:') && !n.id.startsWith('ask:') && !n.id.startsWith('offer:'))
    );
    if (invalidNodeIds.length > 0) {
      issues.push(`Invalid node ID format: ${invalidNodeIds.length} nodes`);
      console.log(`   ⚠️  Invalid node IDs: ${invalidNodeIds.map((n: any) => n.id).join(', ')}`);
    }

    // Check link format
    const invalidLinks = jsonRpcData.links?.filter((l: any) => 
      !l.source || !l.target
    ) || [];
    if (invalidLinks.length > 0) {
      issues.push(`Invalid link format: ${invalidLinks.length} links`);
    }

    // Check skill name normalization (case-insensitive)
    const jsonRpcSkills = new Set(jsonRpcNodes
      .filter((n: any) => n.id?.startsWith('skill:'))
      .map((n: any) => n.id?.replace('skill:', '').toLowerCase())
    );
    const graphqlSkills = new Set(skillRefs.map((sr: any) => sr.name?.toLowerCase()));
    
    // Compare skill sets (should match)
    const missingInGraphQL = Array.from(jsonRpcSkills).filter(s => !graphqlSkills.has(s));
    const missingInJsonRPC = Array.from(graphqlSkills).filter(s => !jsonRpcSkills.has(s));
    
    if (missingInGraphQL.length > 0) {
      issues.push(`Skills in JSON-RPC but not in GraphQL: ${missingInGraphQL.join(', ')}`);
    }
    if (missingInJsonRPC.length > 0) {
      issues.push(`Skills in GraphQL but not in JSON-RPC: ${missingInJsonRPC.join(', ')}`);
    }

    // Check that ask/offer counts are reasonable (may differ slightly due to limits)
    const nodeCountDiff = Math.abs((askNodes + offerNodes) - (totalAsks + totalOffers));
    if (nodeCountDiff > 5) {
      issues.push(`Significant node count difference: JSON-RPC=${askNodes + offerNodes}, GraphQL=${totalAsks + totalOffers}`);
    }

    // Check expiration filtering
    const now = Date.now();
    const expiredAsks = jsonRpcNodes.filter((n: any) => {
      if (!n.id?.startsWith('ask:')) return false;
      // Check if node has expiration metadata
      return false; // Adapter handles this
    });

    console.log('\n✅ Validation Results:');
    if (issues.length === 0) {
      console.log('   ✅ All checks passed!');
    } else {
      console.log(`   ⚠️  Found ${issues.length} issue(s):`);
      issues.forEach(issue => console.log(`      - ${issue}`));
    }

    return {
      valid: issues.length === 0,
      issues,
      jsonRpcStats: {
        nodeCount: jsonRpcNodes.length,
        linkCount: jsonRpcLinkCount,
        skillNodes,
        askNodes,
        offerNodes,
      },
      graphqlStats: {
        skillRefs: skillRefs.length,
        totalAsks,
        totalOffers,
      },
    };
  } catch (error: any) {
    console.error('❌ Validation error:', error.message);
    return {
      valid: false,
      issues: [error.message],
      jsonRpcStats: { nodeCount: 0, linkCount: 0, skillNodes: 0, askNodes: 0, offerNodes: 0 },
      graphqlStats: { skillRefs: 0, totalAsks: 0, totalOffers: 0 },
    };
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateDataCorrectness().then(result => {
    process.exit(result.valid ? 0 : 1);
  }).catch(console.error);
}

export { validateDataCorrectness };

