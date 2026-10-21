/**
 * Direct test of Jitsi generation
 *
 * This script tests Jitsi generation directly to verify it works.
 */

import { generateJitsiMeeting } from '../lib/jitsi';
import { JITSI_BASE_URL } from '../lib/config';
import { getPublicClient } from '../lib/arkiv/client';
import { getWalletClientFromPrivateKey } from '../lib/arkiv/client';
import { getPrivateKey } from '../lib/config';
import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, getAttr as readAttr, getEntityByKey } from '@/lib/arkiv/read';
import { createArkivEntity } from '../lib/arkiv/write';

async function testJitsiGeneration() {
  console.log('=== Testing Jitsi Generation ===\n');

  // Test 1: Generate Jitsi info
  const testSessionKey = 'test-session-key-12345';
  console.log('1. Testing Jitsi info generation...');
  const jitsiInfo = generateJitsiMeeting(testSessionKey, JITSI_BASE_URL);
  console.log('✅ Generated Jitsi info:', jitsiInfo);
  console.log(`   Room name: ${jitsiInfo.videoRoomName}`);
  console.log(`   Join URL: ${jitsiInfo.videoJoinUrl}`);
  console.log(`   Provider: ${jitsiInfo.videoProvider}\n`);

  // Test 2: Check if we can query for Jitsi entities
  console.log('2. Testing Jitsi entity query...');
  const publicClient = getPublicClient();
  const jitsiQuery = await arkivSelect('session_jitsi', publicClient).limit(10).fetch();

  console.log(`   Found ${jitsiQuery.entities.length} Jitsi entities in Arkiv\n`);

  if (jitsiQuery.entities.length > 0) {
    console.log('   Sample Jitsi entities:');
    jitsiQuery.entities.slice(0, 3).forEach((entity: any, idx: number) => {
      const getAttr = (key: string): string => readAttr(entity, key);

      let payload: any = {};
      try {
        if (entity.payload) {
          const decoded =
            entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
                ? entity.payload
                : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('   Error decoding payload:', e);
      }

      const sessionKey = getAttr('session_key');
      const roomName = payload.videoRoomName || 'N/A';
      const joinUrl = payload.videoJoinUrl || 'N/A';

      console.log(`   Entity ${idx + 1}:`);
      console.log(`     Session Key: ${sessionKey}`);
      console.log(`     Room Name: ${roomName}`);
      console.log(`     Join URL: ${joinUrl}`);
    });
    console.log('');
  }

  // Test 3: Try to create a test Jitsi entity
  console.log('3. Testing Jitsi entity creation...');
  try {
    const walletClient = getWalletClientFromPrivateKey(getPrivateKey());
    const testJitsiInfo = generateJitsiMeeting('test-create-' + Date.now(), JITSI_BASE_URL);

    console.log('   Creating test Jitsi entity...');
    const result = await createArkivEntity(walletClient, {
      type: 'session_jitsi',
      attributes: {
        session_key: 'test-session-' + Date.now(),
        mentor_wallet: '0x0000000000000000000000000000000000000000',
        learner_wallet: '0x1111111111111111111111111111111111111111',
        space_id: 'local-dev',
        created_at: new Date().toISOString(),
      },
      payload: {
        videoProvider: testJitsiInfo.videoProvider,
        videoRoomName: testJitsiInfo.videoRoomName,
        videoJoinUrl: testJitsiInfo.videoJoinUrl,
        generatedAt: new Date().toISOString(),
      },
      lifetimeSeconds: 3600, // 1 hour
    });

    console.log('✅ Test Jitsi entity created!');
    console.log(`   Entity Key: ${result.entityKey}`);
    console.log(`   Transaction Hash: ${result.txHash}`);
    console.log(`   Room Name: ${testJitsiInfo.videoRoomName}`);
    console.log(`   Join URL: ${testJitsiInfo.videoJoinUrl}\n`);

    // Wait a moment and try to query it back
    console.log('4. Waiting 2 seconds and querying back...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const entity = await getEntityByKey(result.entityKey, publicClient);

    if (entity && readAttr(entity, 'type') === 'session_jitsi') {
      console.log('✅ Successfully queried back the Jitsi entity!');
      const getAttr = (key: string): string => readAttr(entity, key);

      let payload: any = {};
      try {
        if (entity.payload) {
          const decoded =
            entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
                ? entity.payload
                : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('   Error decoding payload:', e);
      }

      console.log(`   Room Name: ${payload.videoRoomName || 'N/A'}`);
      console.log(`   Join URL: ${payload.videoJoinUrl || 'N/A'}`);
    } else {
      console.log('⚠️  Could not query back the entity (may need more time to propagate)');
    }
  } catch (error: any) {
    console.error('❌ Error creating test Jitsi entity:', error.message);
    if (error.message?.includes('Transaction receipt')) {
      console.log('   (This is a transaction receipt timeout - entity may still be created)');
    }
  }

  console.log('\n=== Test Complete ===');
}

testJitsiGeneration().catch(console.error);
