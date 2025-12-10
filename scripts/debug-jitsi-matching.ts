/**
 * Debug script to check why Jitsi entities aren't matching sessions
 */

import { listSessions } from '../lib/arkiv/sessions';
import { getPublicClient } from '../lib/arkiv/client';
import { eq } from '@arkiv-network/sdk/query';

async function debugJitsiMatching() {
  console.log('=== Debugging Jitsi Entity Matching ===\n');

  // Get all scheduled sessions
  const scheduledSessions = await listSessions({ status: 'scheduled' });
  console.log(`Found ${scheduledSessions.length} scheduled sessions\n`);

  // Get all Jitsi entities
  const publicClient = getPublicClient();
  const jitsiQuery = await publicClient.buildQuery()
    .where(eq('type', 'session_jitsi'))
    .withAttributes(true)
    .withPayload(true)
    .limit(100)
    .fetch();

  console.log(`Found ${jitsiQuery.entities.length} Jitsi entities\n`);

  // Build a map of sessionKey -> Jitsi info
  const jitsiMap: Record<string, any> = {};
  jitsiQuery.entities.forEach((entity: any) => {
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
    if (sessionKey) {
      jitsiMap[sessionKey] = {
        videoProvider: payload.videoProvider || getAttr('videoProvider'),
        videoRoomName: payload.videoRoomName || getAttr('videoRoomName'),
        videoJoinUrl: payload.videoJoinUrl || getAttr('videoJoinUrl'),
        entityKey: entity.key,
      };
    }
  });

  console.log('=== Matching Analysis ===\n');

  for (const session of scheduledSessions) {
    console.log(`Session: ${session.key}`);
    console.log(`  Skill: ${session.skill}`);
    console.log(`  Mentor confirmed: ${session.mentorConfirmed}`);
    console.log(`  Learner confirmed: ${session.learnerConfirmed}`);
    
    const jitsiInfo = jitsiMap[session.key];
    if (jitsiInfo) {
      console.log(`  ✅ Jitsi entity FOUND:`);
      console.log(`     Room: ${jitsiInfo.videoRoomName || 'N/A'}`);
      console.log(`     URL: ${jitsiInfo.videoJoinUrl || 'N/A'}`);
      console.log(`     Entity Key: ${jitsiInfo.entityKey}`);
    } else {
      console.log(`  ❌ No Jitsi entity found for this session key`);
      console.log(`     Looking for sessionKey: ${session.key}`);
      console.log(`     Available Jitsi sessionKeys: ${Object.keys(jitsiMap).slice(0, 5).join(', ')}...`);
    }
    console.log('');
  }

  // Also check if there are Jitsi entities without matching sessions
  const sessionKeys = new Set(scheduledSessions.map(s => s.key));
  const orphanedJitsi = Object.keys(jitsiMap).filter(sk => !sessionKeys.has(sk));
  if (orphanedJitsi.length > 0) {
    console.log(`\n⚠️  Found ${orphanedJitsi.length} Jitsi entities without matching scheduled sessions:`);
    orphanedJitsi.slice(0, 5).forEach(sk => {
      console.log(`  - ${sk}`);
    });
  }
}

debugJitsiMatching().catch(console.error);


