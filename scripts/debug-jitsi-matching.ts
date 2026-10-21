/**
 * Debug script to check why Jitsi entities aren't matching sessions
 */

import { listSessions } from '../lib/arkiv/sessions';
import { getPublicClient } from '../lib/arkiv/client';
import { arkivSelect, getAttr as readAttr } from '@/lib/arkiv/read';

async function debugJitsiMatching() {
  console.log('=== Debugging Jitsi Entity Matching ===\n');

  // Get all scheduled sessions
  const scheduledSessions = await listSessions({ status: 'scheduled' });
  console.log(`Found ${scheduledSessions.length} scheduled sessions\n`);

  // Get all Jitsi entities
  const publicClient = getPublicClient();
  const jitsiQuery = await arkivSelect('session_jitsi', publicClient).limit(100).fetch();

  console.log(`Found ${jitsiQuery.entities.length} Jitsi entities\n`);

  // Build a map of sessionKey -> Jitsi info
  const jitsiMap: Record<string, any> = {};
  jitsiQuery.entities.forEach((entity: any) => {
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
      console.error('Error decoding payload:', e);
    }

    const sessionKey = getAttr('session_key');
    if (sessionKey) {
      jitsiMap[sessionKey] = {
        videoProvider: payload.videoProvider || getAttr('video_provider'),
        videoRoomName: payload.videoRoomName,
        videoJoinUrl: payload.videoJoinUrl,
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
      console.log(
        `     Available Jitsi sessionKeys: ${Object.keys(jitsiMap).slice(0, 5).join(', ')}...`
      );
    }
    console.log('');
  }

  // Also check if there are Jitsi entities without matching sessions
  const sessionKeys = new Set(scheduledSessions.map((s) => s.key));
  const orphanedJitsi = Object.keys(jitsiMap).filter((sk) => !sessionKeys.has(sk));
  if (orphanedJitsi.length > 0) {
    console.log(
      `\n⚠️  Found ${orphanedJitsi.length} Jitsi entities without matching scheduled sessions:`
    );
    orphanedJitsi.slice(0, 5).forEach((sk) => {
      console.log(`  - ${sk}`);
    });
  }
}

debugJitsiMatching().catch(console.error);
