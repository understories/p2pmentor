/**
 * Debug why confirmations aren't being detected
 */

import { listSessions } from '../lib/arkiv/sessions';
import { getPublicClient } from '../lib/arkiv/client';
import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, getAttr as readAttr } from '@/lib/arkiv/read';

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
    const confirmationsQuery = await arkivSelect('session_confirmation', publicClient)
      .where(eqAttr('session_key', session.key))
      .limit(10)
      .fetch();

    console.log(`\nDirect query for confirmations with sessionKey="${session.key}":`);
    console.log(`  Found ${confirmationsQuery.entities.length} confirmation entities`);

    if (confirmationsQuery.entities.length > 0) {
      confirmationsQuery.entities.forEach((entity: any, idx: number) => {
        const getAttr = (key: string): string => readAttr(entity, key);

        const sessionKey = getAttr('session_key');
        const confirmedBy = getAttr('confirmed_by');
        const mentorWallet = getAttr('mentor_wallet');
        const learnerWallet = getAttr('learner_wallet');

        console.log(`\n  Confirmation ${idx + 1}:`);
        console.log(`    Session key: ${sessionKey}`);
        console.log(`    Confirmed by: ${confirmedBy}`);
        console.log(`    Mentor wallet: ${mentorWallet}`);
        console.log(`    Learner wallet: ${learnerWallet}`);
        console.log(
          `    Matches mentor: ${confirmedBy?.toLowerCase() === session.mentorWallet?.toLowerCase()}`
        );
        console.log(
          `    Matches learner: ${confirmedBy?.toLowerCase() === session.learnerWallet?.toLowerCase()}`
        );
      });
    } else {
      console.log(`  No confirmations found!`);

      // Check if there are any confirmations at all
      const allConfirmations = await arkivSelect('session_confirmation', publicClient)
        .limit(20)
        .fetch();

      console.log(`\n  Total confirmations in system: ${allConfirmations.entities.length}`);
      if (allConfirmations.entities.length > 0) {
        console.log(`  Sample confirmation sessionKeys:`);
        allConfirmations.entities.slice(0, 5).forEach((entity: any) => {
          const getAttr = (key: string): string => readAttr(entity, key);
          console.log(`    - ${getAttr('session_key')}`);
        });
      }
    }
  }
}

debugConfirmations().catch(console.error);
