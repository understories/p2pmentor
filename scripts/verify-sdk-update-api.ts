/**
 * Verify Arkiv SDK Update API
 *
 * Part of U0.1: SDK API Verification
 * This script checks that the Arkiv SDK (0.8+) supports entity updates via `patchEntity`
 * (0.6's `updateEntity` was removed) and that our `replaceArkivEntity` helper works end to end.
 *
 * Usage:
 *   tsx scripts/verify-sdk-update-api.ts
 */

import { getWalletClientFromPrivateKey } from '../lib/arkiv/client';
import { getPrivateKey } from '../lib/config';
import { handleTransactionWithTimeout } from '../lib/arkiv/transaction-utils';
import { createArkivEntity, replaceArkivEntity } from '../lib/arkiv/write';
import { getEntityByKey, getAttr, parsePayload } from '../lib/arkiv/read';

async function verifySDKUpdateAPI() {
  console.log('🔍 Verifying Arkiv SDK Update API (patchEntity)...\n');

  try {
    const privateKey = getPrivateKey();
    const walletClient = getWalletClientFromPrivateKey(privateKey);

    // Check if walletClient has patchEntity method (0.8 replacement for updateEntity)
    console.log('1. Checking walletClient methods...');
    const hasPatchEntity = typeof (walletClient as any).patchEntity === 'function';
    const hasLegacyUpdateEntity = 'updateEntity' in walletClient;

    console.log(`   - Has 'patchEntity' method: ${hasPatchEntity}`);
    console.log(`   - Has legacy 'updateEntity' method: ${hasLegacyUpdateEntity}`);

    if (!hasPatchEntity) {
      console.log('\n2. patchEntity method not found on walletClient');
      console.log('   ⚠️  Expected @arkiv-network/sdk >= 0.8');
      console.log('\n📋 Next steps:');
      console.log('   1. Check Arkiv SDK documentation: https://arkiv.network/docs');
      console.log('   2. Check SDK version: npm list @arkiv-network/sdk');
      return false;
    }

    // Create a short-lived test entity (required for update)
    console.log('\n2. Creating test entity for update verification...');
    const createResult = await handleTransactionWithTimeout(async () => {
      return await createArkivEntity(walletClient, {
        type: 'sdk_verification_test',
        attributes: {
          test: 'initial',
          space_id: 'local-dev',
          created_at: new Date().toISOString(),
        },
        payload: { test: 'initial', createdAt: new Date().toISOString() },
        lifetimeSeconds: 3600, // 1 hour
      });
    });

    console.log(`   ✅ Test entity created: ${createResult.entityKey.slice(0, 16)}...`);
    console.log(`   ✅ Transaction hash: ${createResult.txHash.slice(0, 16)}...`);

    // Replace attributes and payload (patchEntity with set/unset)
    console.log('\n3. Attempting to patch entity (replaceArkivEntity)...');
    try {
      const updateResult = await handleTransactionWithTimeout(async () => {
        return await replaceArkivEntity(walletClient, {
          entityKey: createResult.entityKey,
          type: 'sdk_verification_test',
          attributes: {
            test: 'updated',
            space_id: 'local-dev',
            updated_at: new Date().toISOString(),
          },
          payload: { test: 'updated', updatedAt: new Date().toISOString() },
        });
      });

      console.log('   ✅ patchEntity call succeeded!');
      console.log(`   ✅ Updated entity key: ${updateResult.entityKey.slice(0, 16)}...`);
      console.log(`   ✅ Transaction hash: ${updateResult.txHash.slice(0, 16)}...`);

      // Read back and verify
      console.log('\n4. Reading entity back...');
      const entity = await getEntityByKey(createResult.entityKey);
      const testAttr = getAttr(entity, 'test');
      const createdAtAttr = getAttr(entity, 'created_at');
      const payload = parsePayload(entity);
      console.log(`   - test attribute: ${testAttr}`);
      console.log(`   - created_at attribute (should be unset): ${createdAtAttr || '(absent)'}`);
      console.log(`   - payload.test: ${payload.test}`);
      if (testAttr !== 'updated' || payload.test !== 'updated') {
        console.log('   ❌ Entity was not updated as expected');
        return false;
      }

      console.log('\n📋 Update API Signature (SDK 0.8):');
      console.log('   walletClient.patchEntity({');
      console.log('     entityKey: Hex,');
      console.log('     set?: Record<string, ArkivValue>,');
      console.log('     unset?: string[],');
      console.log('     payload?: Uint8Array,');
      console.log('     contentType?: string,');
      console.log('   })');
      console.log(
        '   App code: replaceArkivEntity(walletClient, { entityKey, type, attributes, payload })'
      );
      console.log('\n✅ SDK Update API is available and working!');
      return true;
    } catch (error: any) {
      console.log(`   ❌ patchEntity call failed: ${error.message}`);
      console.log('\n📋 Error details:');
      console.log(`   - Error type: ${error.constructor.name}`);
      console.log(`   - Error message: ${error.message}`);
      if (error.stack) {
        console.log(`   - Stack trace: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
      }
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
