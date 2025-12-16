/**
 * Seed Learner Quest
 *
 * Creates the initial Web3Privacy Foundations quest definition.
 * Run once to bootstrap the quest.
 *
 * Usage: npx tsx scripts/seed-learner-quest.ts
 */

import { createLearnerQuest } from '../lib/arkiv/learnerQuest';
import { WEB3PRIVACY_FOUNDATIONS_QUEST } from '../lib/arkiv/learnerQuestData';
import { getPrivateKey } from '../lib/config';

async function seedQuest() {
  const privateKey = getPrivateKey();
  if (!privateKey) {
    console.error('ARKIV_PRIVATE_KEY not set');
    process.exit(1);
  }

  console.log('Creating Web3Privacy Foundations quest...');
  console.log(`Quest ID: ${WEB3PRIVACY_FOUNDATIONS_QUEST.questId}`);
  console.log(`Materials: ${WEB3PRIVACY_FOUNDATIONS_QUEST.materials.length}`);

  const result = await createLearnerQuest({
    questId: WEB3PRIVACY_FOUNDATIONS_QUEST.questId,
    title: WEB3PRIVACY_FOUNDATIONS_QUEST.title,
    description: WEB3PRIVACY_FOUNDATIONS_QUEST.description,
    source: WEB3PRIVACY_FOUNDATIONS_QUEST.source,
    materials: WEB3PRIVACY_FOUNDATIONS_QUEST.materials,
    privateKey,
  });

  if (result) {
    console.log('✅ Quest created successfully!');
    console.log(`   Key: ${result.key}`);
    console.log(`   TxHash: ${result.txHash}`);
    console.log(`\nView on Arkiv Explorer: https://explorer.arkiv.network/entity/${result.key}`);
  } else {
    console.error('❌ Failed to create quest');
    process.exit(1);
  }
}

seedQuest().catch((error) => {
  console.error('Error seeding quest:', error);
  process.exit(1);
});

