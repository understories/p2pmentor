/**
 * Debug why Jitsi entities aren't matching sessions
 */

import { listSessions } from '../lib/arkiv/sessions';
import { getPublicClient } from '../lib/arkiv/client';
import { eq } from '@arkiv-network/sdk/query';

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
    const jitsiQuery = await publicClient.buildQuery()
      .where(eq('type', 'session_jitsi'))
      .where(eq('sessionKey', session.key))
      .withAttributes(true)
      .withPayload(true)
      .limit(10)
      .fetch();

    console.log(`\nDirect query for sessionKey="${session.key}":`);
    console.log(`  Found ${jitsiQuery.entities.length} Jitsi entities`);

    if (jitsiQuery.entities.length > 0) {
      jitsiQuery.entities.forEach((entity: any, idx: number) => {
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
          console.error('  Error decoding payload:', e);
        }

        const sessionKeyFromEntity = getAttr('sessionKey');
        console.log(`\n  Entity ${idx + 1}:`);
        console.log(`    Entity key: ${entity.key}`);
        console.log(`    Session key from entity: ${sessionKeyFromEntity}`);
        console.log(`    Session key from session: ${session.key}`);
        console.log(`    Match: ${sessionKeyFromEntity === session.key}`);
        console.log(`    Room name: ${payload.videoRoomName || getAttr('videoRoomName') || 'N/A'}`);
        console.log(`    Join URL: ${payload.videoJoinUrl || getAttr('videoJoinUrl') || 'N/A'}`);
      });
    } else {
      // Try querying all Jitsi entities to see what sessionKeys exist
      const allJitsi = await publicClient.buildQuery()
        .where(eq('type', 'session_jitsi'))
        .withAttributes(true)
        .limit(20)
        .fetch();

      console.log(`\n  No match found. Checking all Jitsi entities...`);
      console.log(`  Total Jitsi entities: ${allJitsi.entities.length}`);
      
      const sessionKeysInJitsi = new Set<string>();
      allJitsi.entities.forEach((entity: any) => {
        const attrs = entity.attributes || {};
        const getAttr = (key: string): string => {
          if (Array.isArray(attrs)) {
            const attr = attrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(attrs[key] || '');
        };
        const sk = getAttr('sessionKey');
        if (sk) sessionKeysInJitsi.add(sk);
      });

      console.log(`  Session keys in Jitsi entities (first 5):`);
      Array.from(sessionKeysInJitsi).slice(0, 5).forEach(sk => {
        console.log(`    - ${sk}`);
      });
      console.log(`  Looking for: ${session.key}`);
      console.log(`  Exact match in set: ${sessionKeysInJitsi.has(session.key)}`);
    }
  }
}

debugSessionJitsiQuery().catch(console.error);

