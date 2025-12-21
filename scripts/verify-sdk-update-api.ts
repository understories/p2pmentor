/**
 * Verify Arkiv SDK Update API
 *
 * Part of U0.1: SDK API Verification
 * This script checks if the Arkiv SDK supports entity updates and what the API signature is.
 *
 * Usage:
 *   tsx scripts/verify-sdk-update-api.ts
 */

import { getWalletClientFromPrivateKey } from '../lib/arkiv/client';
import { getPrivateKey } from '../lib/config';
import { handleTransactionWithTimeout } from '../lib/arkiv/transaction-utils';

async function verifySDKUpdateAPI() {
  console.log('🔍 Verifying Arkiv SDK Update API...\n');

  try {
    const privateKey = getPrivateKey();
    const walletClient = getWalletClientFromPrivateKey(privateKey);

    // Check if walletClient has updateEntity method
    console.log('1. Checking walletClient methods...');
    const walletClientMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(walletClient));
    const hasUpdateEntity = 'updateEntity' in walletClient;
    const hasUpdateMethod = walletClientMethods.some(m => m.toLowerCase().includes('update'));

    console.log(`   - Has 'updateEntity' method: ${hasUpdateEntity}`);
    console.log(`   - Has any 'update' method: ${hasUpdateMethod}`);
    console.log(`   - Available methods: ${walletClientMethods.filter(m => !m.startsWith('_')).join(', ')}`);

    // Check TypeScript types (if available)
    console.log('\n2. Checking TypeScript types...');
    try {
      // Try to access the type definition
      const walletClientType = typeof walletClient;
      console.log(`   - walletClient type: ${walletClientType}`);
      
      // Check if we can see method signatures
      if (hasUpdateEntity) {
        const updateEntityType = typeof (walletClient as any).updateEntity;
        console.log(`   - updateEntity type: ${updateEntityType}`);
      }
    } catch (error: any) {
      console.log(`   - Type check error: ${error.message}`);
    }

    // Try to create a test entity first (required for update)
    console.log('\n3. Creating test entity for update verification...');
    const testPayload = new TextEncoder().encode(JSON.stringify({
      test: 'initial',
      createdAt: new Date().toISOString(),
    }));

    const createResult = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: testPayload,
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'sdk_verification_test' },
          { key: 'test', value: 'initial' },
          { key: 'spaceId', value: 'local-dev' },
          { key: 'createdAt', value: new Date().toISOString() },
        ],
        expiresIn: 3600, // 1 hour
      });
    });

    console.log(`   ✅ Test entity created: ${createResult.entityKey.slice(0, 16)}...`);
    console.log(`   ✅ Transaction hash: ${createResult.txHash.slice(0, 16)}...`);

    // Try to call updateEntity if it exists
    if (hasUpdateEntity) {
      console.log('\n4. Attempting to call updateEntity...');
      try {
        const updatedPayload = new TextEncoder().encode(JSON.stringify({
          test: 'updated',
          createdAt: new Date().toISOString(),
        }));

        const updateResult = await handleTransactionWithTimeout(async () => {
          return await (walletClient as any).updateEntity({
            entityKey: createResult.entityKey,
            payload: updatedPayload,
            contentType: 'application/json',
            attributes: [
              { key: 'type', value: 'sdk_verification_test' },
              { key: 'test', value: 'updated' },
              { key: 'spaceId', value: 'local-dev' },
              { key: 'updatedAt', value: new Date().toISOString() },
            ],
            expiresIn: 3600,
          });
        });

        console.log('   ✅ updateEntity call succeeded!');
        console.log(`   ✅ Updated entity key: ${updateResult.entityKey?.slice(0, 16) || 'N/A'}...`);
        console.log(`   ✅ Transaction hash: ${updateResult.txHash?.slice(0, 16) || 'N/A'}...`);
        console.log('\n📋 Update API Signature:');
        console.log('   walletClient.updateEntity({');
        console.log('     entityKey: string,');
        console.log('     payload: Uint8Array,');
        console.log('     contentType: string,');
        console.log('     attributes: Array<{ key: string; value: string }>,');
        console.log('     expiresIn?: number,');
        console.log('   })');
        console.log('\n✅ SDK Update API is available and working!');
        return true;
      } catch (error: any) {
        console.log(`   ❌ updateEntity call failed: ${error.message}`);
        console.log('\n📋 Error details:');
        console.log(`   - Error type: ${error.constructor.name}`);
        console.log(`   - Error message: ${error.message}`);
        if (error.stack) {
          console.log(`   - Stack trace: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
        }
        return false;
      }
    } else {
      console.log('\n4. updateEntity method not found on walletClient');
      console.log('   ⚠️  SDK may not support entity updates yet, or method name is different');
      console.log('\n📋 Next steps:');
      console.log('   1. Check Arkiv SDK documentation: https://arkiv.network/docs');
      console.log('   2. Check SDK version: npm list @arkiv-network/sdk');
      console.log('   3. Check for alternative method names (e.g., update, modifyEntity)');
      console.log('   4. Contact Arkiv team or check GitHub issues');
      return false;
    }
  } catch (error: any) {
    console.error('\n❌ Verification failed:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  }
}

// Run verification
verifySDKUpdateAPI()
  .then((success) => {
    if (success) {
      console.log('\n✅ Verification complete: SDK supports entity updates');
      process.exit(0);
    } else {
      console.log('\n⚠️  Verification complete: SDK update API not available or not working');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Verification error:', error);
    process.exit(1);
  });

