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
import { eq } from '@arkiv-network/sdk/query';

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
  const jitsiQuery = await publicClient.buildQuery()
    .where(eq('type', 'session_jitsi'))
    .withAttributes(true)
    .withPayload(true)
    .limit(10)
    .fetch();
  
  console.log(`   Found ${jitsiQuery.entities.length} Jitsi entities in Arkiv\n`);

  if (jitsiQuery.entities.length > 0) {
    console.log('   Sample Jitsi entities:');
    jitsiQuery.entities.slice(0, 3).forEach((entity: any, idx: number) => {
      const attrs = entity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };
      
      let payload: any = {};
      try {
        if (entity.payload) {
          const decoded = entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
            ? entity.payload
            : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('   Error decoding payload:', e);
      }

      const sessionKey = getAttr('sessionKey');
      const roomName = payload.videoRoomName || getAttr('videoRoomName') || 'N/A';
      const joinUrl = payload.videoJoinUrl || getAttr('videoJoinUrl') || 'N/A';
      
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
    const enc = new TextEncoder();
    const testJitsiInfo = generateJitsiMeeting('test-create-' + Date.now(), JITSI_BASE_URL);
    
    console.log('   Creating test Jitsi entity...');
    const result = await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({
        videoProvider: testJitsiInfo.videoProvider,
        videoRoomName: testJitsiInfo.videoRoomName,
        videoJoinUrl: testJitsiInfo.videoJoinUrl,
        generatedAt: new Date().toISOString(),
      })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'session_jitsi' },
        { key: 'sessionKey', value: 'test-session-' + Date.now() },
        { key: 'mentorWallet', value: '0x0000000000000000000000000000000000000000' },
        { key: 'learnerWallet', value: '0x1111111111111111111111111111111111111111' },
        { key: 'spaceId', value: 'local-dev' },
        { key: 'createdAt', value: new Date().toISOString() },
      ],
      expiresIn: 3600, // 1 hour
    });
    
    console.log('✅ Test Jitsi entity created!');
    console.log(`   Entity Key: ${result.entityKey}`);
    console.log(`   Transaction Hash: ${result.txHash}`);
    console.log(`   Room Name: ${testJitsiInfo.videoRoomName}`);
    console.log(`   Join URL: ${testJitsiInfo.videoJoinUrl}\n`);
    
    // Wait a moment and try to query it back
    console.log('4. Waiting 2 seconds and querying back...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const queryBack = await publicClient.buildQuery()
      .where(eq('type', 'session_jitsi'))
      .where(eq('key', result.entityKey))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch();
    
    if (queryBack.entities.length > 0) {
      console.log('✅ Successfully queried back the Jitsi entity!');
      const entity = queryBack.entities[0];
      const attrs = entity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };
      
      let payload: any = {};
      try {
        if (entity.payload) {
          const decoded = entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
            ? entity.payload
            : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('   Error decoding payload:', e);
      }
      
      console.log(`   Room Name: ${payload.videoRoomName || getAttr('videoRoomName') || 'N/A'}`);
      console.log(`   Join URL: ${payload.videoJoinUrl || getAttr('videoJoinUrl') || 'N/A'}`);
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


