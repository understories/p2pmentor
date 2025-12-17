/**
 * Seed Learner Quest
 *
 * Creates learner quest definitions.
 * Run once to bootstrap each quest.
 *
 * Usage: 
 *   npx tsx scripts/seed-learner-quest.ts [questId]
 *   npx tsx scripts/seed-learner-quest.ts web3privacy_foundations
 *   npx tsx scripts/seed-learner-quest.ts lesswrong_sequences
 */

import 'dotenv/config';
import { createLearnerQuest } from '../lib/arkiv/learnerQuest';
import { WEB3PRIVACY_FOUNDATIONS_QUEST, LESSWRONG_SEQUENCES_QUEST } from '../lib/arkiv/learnerQuestData';
import { getPrivateKey } from '../lib/config';

async function seedQuest(questId?: string) {
  const privateKey = getPrivateKey();
  if (!privateKey) {
    console.error('ARKIV_PRIVATE_KEY not set');
    process.exit(1);
  }

  const quests = [
    WEB3PRIVACY_FOUNDATIONS_QUEST,
    LESSWRONG_SEQUENCES_QUEST,
  ];

  const questsToSeed = questId
    ? quests.filter(q => q.questId === questId)
    : quests;

  if (questsToSeed.length === 0) {
    console.error(`Quest not found: ${questId}`);
    console.error(`Available quests: ${quests.map(q => q.questId).join(', ')}`);
    process.exit(1);
  }

  for (const quest of questsToSeed) {
    console.log(`\nCreating ${quest.title} quest...`);
    console.log(`Quest ID: ${quest.questId}`);
    console.log(`Materials: ${quest.materials.length}`);

    const result = await createLearnerQuest({
      questId: quest.questId,
      title: quest.title,
      description: quest.description,
      source: quest.source,
      materials: quest.materials,
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
}

const questId = process.argv[2];
seedQuest(questId).catch((error) => {
  console.error('Error seeding quest:', error);
  process.exit(1);
});

