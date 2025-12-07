/**
 * Debug why confirmations aren't being detected
 */

import { listSessions } from '../lib/arkiv/sessions';
import { getPublicClient } from '../lib/arkiv/client';
import { eq } from '@arkiv-network/sdk/query';

async function debugConfirmations() {
  console.log('=== Debugging Confirmations ===\n');

  // Get scheduled sessions
  const scheduledSessions = await listSessions({ status: 'scheduled' });
  console.log(`Found ${scheduledSessions.length} scheduled sessions\n`);

  const publicClient = getPublicClient();

  for (const session of scheduledSessions) {
    console.log(`\n=== Session ${session.key} ===`);
    console.log(`Skill: ${session.skill}`);
    console.log(`Mentor wallet: ${session.mentorWallet}`);
    console.log(`Learner wallet: ${session.learnerWallet}`);
    console.log(`Mentor confirmed (from session): ${session.mentorConfirmed}`);
    console.log(`Learner confirmed (from session): ${session.learnerConfirmed}`);

    // Query confirmations directly
    const confirmationsQuery = await publicClient.buildQuery()
      .where(eq('type', 'session_confirmation'))
      .where(eq('sessionKey', session.key))
      .withAttributes(true)
      .withPayload(true)
      .limit(10)
      .fetch();

    console.log(`\nDirect query for confirmations with sessionKey="${session.key}":`);
    console.log(`  Found ${confirmationsQuery.entities.length} confirmation entities`);

    if (confirmationsQuery.entities.length > 0) {
      confirmationsQuery.entities.forEach((entity: any, idx: number) => {
        const attrs = entity.attributes || {};
        const getAttr = (key: string): string => {
          if (Array.isArray(attrs)) {
            const attr = attrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(attrs[key] || '');
        };

        const sessionKey = getAttr('sessionKey');
        const confirmedBy = getAttr('confirmedBy');
        const mentorWallet = getAttr('mentorWallet');
        const learnerWallet = getAttr('learnerWallet');

        console.log(`\n  Confirmation ${idx + 1}:`);
        console.log(`    Session key: ${sessionKey}`);
        console.log(`    Confirmed by: ${confirmedBy}`);
        console.log(`    Mentor wallet: ${mentorWallet}`);
        console.log(`    Learner wallet: ${learnerWallet}`);
        console.log(`    Matches mentor: ${confirmedBy?.toLowerCase() === session.mentorWallet?.toLowerCase()}`);
        console.log(`    Matches learner: ${confirmedBy?.toLowerCase() === session.learnerWallet?.toLowerCase()}`);
      });
    } else {
      console.log(`  No confirmations found!`);
      
      // Check if there are any confirmations at all
      const allConfirmations = await publicClient.buildQuery()
        .where(eq('type', 'session_confirmation'))
        .withAttributes(true)
        .limit(20)
        .fetch();
      
      console.log(`\n  Total confirmations in system: ${allConfirmations.entities.length}`);
      if (allConfirmations.entities.length > 0) {
        console.log(`  Sample confirmation sessionKeys:`);
        allConfirmations.entities.slice(0, 5).forEach((entity: any) => {
          const attrs = entity.attributes || {};
          const getAttr = (key: string): string => {
            if (Array.isArray(attrs)) {
              const attr = attrs.find((a: any) => a.key === key);
              return String(attr?.value || '');
            }
            return String(attrs[key] || '');
          };
          console.log(`    - ${getAttr('sessionKey')}`);
        });
      }
    }
  }
}

debugConfirmations().catch(console.error);

