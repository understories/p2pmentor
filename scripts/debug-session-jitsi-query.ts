/**
 * Debug why Jitsi entities aren't matching sessions
 */

import { listSessions } from '../lib/arkiv/sessions';
import { getPublicClient } from '../lib/arkiv/client';
import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, getAttr as readAttr } from '@/lib/arkiv/read';

async function debugSessionJitsiQuery() {
  console.log('=== Debugging Session-Jitsi Matching ===\n');

  // Get scheduled sessions
  const scheduledSessions = await listSessions({ status: 'scheduled' });
  console.log(`Found ${scheduledSessions.length} scheduled sessions\n`);

  for (const session of scheduledSessions) {
    console.log(`\n=== Session ${session.key} ===`);
    console.log(`Skill: ${session.skill}`);
    console.log(`Mentor confirmed: ${session.mentorConfirmed}`);
    console.log(`Learner confirmed: ${session.learnerConfirmed}`);
    console.log(`Video Join URL: ${session.videoJoinUrl || '(empty)'}`);
    console.log(`Video Room Name: ${session.videoRoomName || '(empty)'}`);

    // Query Jitsi entities directly for this session key
    const publicClient = getPublicClient();
    const jitsiQuery = await arkivSelect('session_jitsi', publicClient)
      .where(eqAttr('session_key', session.key))
      .limit(10)
      .fetch();

    console.log(`\nDirect query for sessionKey="${session.key}":`);
    console.log(`  Found ${jitsiQuery.entities.length} Jitsi entities`);

    if (jitsiQuery.entities.length > 0) {
      jitsiQuery.entities.forEach((entity: any, idx: number) => {
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
          console.error('  Error decoding payload:', e);
        }

        const sessionKeyFromEntity = getAttr('session_key');
        console.log(`\n  Entity ${idx + 1}:`);
        console.log(`    Entity key: ${entity.key}`);
        console.log(`    Session key from entity: ${sessionKeyFromEntity}`);
        console.log(`    Session key from session: ${session.key}`);
        console.log(`    Match: ${sessionKeyFromEntity === session.key}`);
        console.log(`    Room name: ${payload.videoRoomName || 'N/A'}`);
        console.log(`    Join URL: ${payload.videoJoinUrl || 'N/A'}`);
      });
    } else {
      // Try querying all Jitsi entities to see what sessionKeys exist
      const allJitsi = await arkivSelect('session_jitsi', publicClient).limit(20).fetch();

      console.log(`\n  No match found. Checking all Jitsi entities...`);
      console.log(`  Total Jitsi entities: ${allJitsi.entities.length}`);

      const sessionKeysInJitsi = new Set<string>();
      allJitsi.entities.forEach((entity: any) => {
        const getAttr = (key: string): string => readAttr(entity, key);
        const sk = getAttr('session_key');
        if (sk) sessionKeysInJitsi.add(sk);
      });

      console.log(`  Session keys in Jitsi entities (first 5):`);
      Array.from(sessionKeysInJitsi)
        .slice(0, 5)
        .forEach((sk) => {
          console.log(`    - ${sk}`);
        });
      console.log(`  Looking for: ${session.key}`);
      console.log(`  Exact match in set: ${sessionKeysInJitsi.has(session.key)}`);
    }
  }
}

debugSessionJitsiQuery().catch(console.error);
