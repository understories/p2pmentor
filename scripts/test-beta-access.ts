/**
 * Test Beta Access Implementation
 *
 * Tests beta access entity creation and querying on Arkiv.
 * Verifies the implementation works with real Arkiv queries.
 *
 * Run: npx tsx scripts/test-beta-access.ts
 */

import {
  createBetaAccess,
  getBetaAccessByWallet,
  listBetaAccessByCode,
} from '../lib/arkiv/betaAccess';
import { getPrivateKey } from '../lib/config';

async function testBetaAccess() {
  console.log('🧪 Testing Beta Access Implementation\n');

  const testWallet = '0x1234567890123456789012345678901234567890';
  const testCode = 'test_beta_2025';
  const privateKey = getPrivateKey();

  if (!privateKey) {
    console.error('❌ ARKIV_PRIVATE_KEY not set');
    process.exit(1);
  }

  try {
    // Test 1: Create beta access
    console.log('Test 1: Creating beta access entity...');
    const { key, txHash } = await createBetaAccess({
      wallet: testWallet,
      code: testCode,
      privateKey,
    });
    console.log('✅ Created beta access entity:');
    console.log(`   Key: ${key}`);
    console.log(`   TxHash: ${txHash}`);
    console.log(`   View on Arkiv: https://explorer.kaolin.hoodi.arkiv.network/entity/${key}\n`);

    // Wait a moment for entity to be queryable
    console.log('⏳ Waiting 3 seconds for entity to be queryable...\n');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Test 2: Query by wallet
    console.log('Test 2: Querying beta access by wallet...');
    const accessByWallet = await getBetaAccessByWallet(testWallet);
    if (accessByWallet) {
      console.log('✅ Found beta access:');
      console.log(`   Wallet: ${accessByWallet.wallet}`);
      console.log(`   Code: ${accessByWallet.code}`);
      console.log(`   Granted At: ${accessByWallet.grantedAt}`);
      console.log(`   Key: ${accessByWallet.key}`);
    } else {
      console.log('❌ Beta access not found (may need more time for query)');
    }
    console.log();

    // Test 3: Query by code
    console.log('Test 3: Querying beta access by code...');
    const accessByCode = await listBetaAccessByCode(testCode);
    console.log(`✅ Found ${accessByCode.length} access record(s) for code "${testCode}"`);
    if (accessByCode.length > 0) {
      accessByCode.forEach((access, i) => {
        console.log(`   ${i + 1}. Wallet: ${access.wallet}, Granted: ${access.grantedAt}`);
      });
    }
    console.log();

    console.log('✅ All tests completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Verify entity on Arkiv Explorer');
    console.log('   2. Test middleware protection');
    console.log('   3. Test API route protection');
    console.log('   4. Test client-side BetaGate component');
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testBetaAccess();
