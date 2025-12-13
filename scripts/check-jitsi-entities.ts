/**
 * Check what Jitsi entities actually exist and what they're connected to
 */

import { getPublicClient } from '../lib/arkiv/client';
import { eq } from '@arkiv-network/sdk/query';
import { listSessions } from '../lib/arkiv/sessions';

async function checkJitsiEntities() {
  console.log('=== Checking Jitsi Entities in Arkiv ===\n');

  const publicClient = getPublicClient();

  // Get ALL Jitsi entities
  const allJitsi = await publicClient.buildQuery()
    .where(eq('type', 'session_jitsi'))
    .withAttributes(true)
    .withPayload(true)
    .limit(100)
    .fetch();

  console.log(`Found ${allJitsi.entities.length} Jitsi entities total\n`);

  // Get all scheduled sessions
  const scheduledSessions = await listSessions({ status: 'scheduled' });
  console.log(`Found ${scheduledSessions.length} scheduled sessions\n`);

  // Build map of session keys from scheduled sessions
  const scheduledSessionKeys = new Set(scheduledSessions.map(s => s.key.toLowerCase()));

  console.log('=== Jitsi Entities Analysis ===\n');
  
  allJitsi.entities.forEach((entity: any, idx: number) => {
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
      console.error('Error decoding payload:', e);
    }

    const sessionKey = getAttr('sessionKey');
    const mentorWallet = getAttr('mentorWallet');
    const learnerWallet = getAttr('learnerWallet');
    const roomName = payload.videoRoomName || getAttr('videoRoomName') || 'N/A';
    const joinUrl = payload.videoJoinUrl || getAttr('videoJoinUrl') || 'N/A';

    console.log(`Jitsi Entity ${idx + 1}:`);
    console.log(`  Entity Key: ${entity.key}`);
    console.log(`  Session Key: ${sessionKey}`);
    console.log(`  Mentor: ${mentorWallet}`);
    console.log(`  Learner: ${learnerWallet}`);
    console.log(`  Room Name: ${roomName}`);
    console.log(`  Join URL: ${joinUrl}`);
    console.log(`  Matches scheduled session: ${scheduledSessionKeys.has(sessionKey?.toLowerCase() || '')}`);
    
    // Check if this session key exists in scheduled sessions
    const matchingSession = scheduledSessions.find(s => s.key.toLowerCase() === sessionKey?.toLowerCase());
    if (matchingSession) {
      console.log(`  ✅ MATCHES scheduled session: ${matchingSession.skill}`);
      console.log(`     Session mentorConfirmed: ${matchingSession.mentorConfirmed}`);
      console.log(`     Session learnerConfirmed: ${matchingSession.learnerConfirmed}`);
      console.log(`     Session videoJoinUrl: ${matchingSession.videoJoinUrl || '(empty)'}`);
    } else {
      console.log(`  ❌ No matching scheduled session found`);
    }
    console.log('');
  });

  // Now check the query logic - query Jitsi entities by sessionKey for each scheduled session
  console.log('\n=== Testing Query Logic ===\n');
  
  for (const session of scheduledSessions) {
    console.log(`Session: ${session.key} (${session.skill})`);
    console.log(`  mentorConfirmed: ${session.mentorConfirmed}, learnerConfirmed: ${session.learnerConfirmed}`);
    
    // Query Jitsi entities directly by sessionKey attribute
    const jitsiBySessionKey = await publicClient.buildQuery()
      .where(eq('type', 'session_jitsi'))
      .where(eq('sessionKey', session.key))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch();

    console.log(`  Direct query by sessionKey="${session.key}": ${jitsiBySessionKey.entities.length} entities`);
    
    if (jitsiBySessionKey.entities.length > 0) {
      const jitsiEntity = jitsiBySessionKey.entities[0];
      const attrs = jitsiEntity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };
      
      let payload: any = {};
      try {
        if (jitsiEntity.payload) {
          const decoded = jitsiEntity.payload instanceof Uint8Array
            ? new TextDecoder().decode(jitsiEntity.payload)
            : typeof jitsiEntity.payload === 'string'
            ? jitsiEntity.payload
            : JSON.stringify(jitsiEntity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('Error:', e);
      }
      
      console.log(`  ✅ Found Jitsi entity!`);
      console.log(`     Room: ${payload.videoRoomName || getAttr('videoRoomName')}`);
      console.log(`     URL: ${payload.videoJoinUrl || getAttr('videoJoinUrl')}`);
    } else {
      console.log(`  ❌ No Jitsi entity found`);
    }
    console.log('');
  }
}

checkJitsiEntities().catch(console.error);


