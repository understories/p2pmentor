/**
 * Test script to verify Jitsi generation for sessions
 *
 * This script checks if Jitsi entities are being created correctly
 * when both parties confirm a session.
 */

import { listSessions, getSessionByKey } from '../lib/arkiv/sessions';
import { getPublicClient } from '../lib/arkiv/client';
import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, getAttr as readAttr } from '@/lib/arkiv/read';

async function testJitsiGeneration() {
  console.log('Testing Jitsi generation...\n');

  // Get all scheduled sessions
  const scheduledSessions = await listSessions({ status: 'scheduled' });
  console.log(`Found ${scheduledSessions.length} scheduled sessions\n`);

  for (const session of scheduledSessions) {
    console.log(`\n=== Session ${session.key} ===`);
    console.log(`Status: ${session.status}`);
    console.log(`Mentor confirmed: ${session.mentorConfirmed}`);
    console.log(`Learner confirmed: ${session.learnerConfirmed}`);
    console.log(`Video provider: ${session.videoProvider || 'N/A'}`);
    console.log(`Video room name: ${session.videoRoomName || 'N/A'}`);
    console.log(`Video join URL: ${session.videoJoinUrl || 'N/A'}`);

    // Check if Jitsi entity exists directly
    const publicClient = getPublicClient();
    const jitsiResult = await arkivSelect('session_jitsi', publicClient)
      .where(eqAttr('session_key', session.key))
      .limit(1)
      .fetch();

    if (jitsiResult.entities.length > 0) {
      console.log(`✅ Jitsi entity found!`);
      const jitsiEntity = jitsiResult.entities[0];
      const getAttr = (key: string): string => readAttr(jitsiEntity, key);

      let payload: any = {};
      try {
        if (jitsiEntity.payload) {
          const decoded =
            jitsiEntity.payload instanceof Uint8Array
              ? new TextDecoder().decode(jitsiEntity.payload)
              : typeof jitsiEntity.payload === 'string'
                ? jitsiEntity.payload
                : JSON.stringify(jitsiEntity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('Error decoding payload:', e);
      }

      console.log(`  - Room name: ${payload.videoRoomName || 'N/A'}`);
      console.log(`  - Join URL: ${payload.videoJoinUrl || 'N/A'}`);
    } else {
      console.log(`❌ No Jitsi entity found for this session`);
      if (session.mentorConfirmed && session.learnerConfirmed) {
        console.log(`⚠️  WARNING: Both parties confirmed but no Jitsi entity!`);
      }
    }
  }

  // Also check pending sessions that might have both confirmed
  const pendingSessions = await listSessions({ status: 'pending' });
  const bothConfirmedPending = pendingSessions.filter(
    (s) => s.mentorConfirmed && s.learnerConfirmed
  );

  if (bothConfirmedPending.length > 0) {
    console.log(
      `\n⚠️  Found ${bothConfirmedPending.length} pending sessions with both parties confirmed:`
    );
    bothConfirmedPending.forEach((s) => {
      console.log(`  - Session ${s.key}: ${s.skill}`);
    });
  }
}

testJitsiGeneration().catch(console.error);
