/**
 * Seed Learner Quest
 *
 * Creates learner quest definitions.
 * Run once to bootstrap each quest.
 *
 * Usage: 
 *   npx tsx scripts/seed-learner-quest.ts [questId] [--force]
 *   npx tsx scripts/seed-learner-quest.ts web3privacy_foundations
 *   npx tsx scripts/seed-learner-quest.ts lesswrong_sequences
 *   npx tsx scripts/seed-learner-quest.ts web3privacy_foundations --force
 *
 * Options:
 *   --force: Re-seed even if quest already exists (creates new version with updated data)
 */

import 'dotenv/config';
import { createLearnerQuest, listLearnerQuests } from '../lib/arkiv/learnerQuest';
import { WEB3PRIVACY_FOUNDATIONS_QUEST, LESSWRONG_SEQUENCES_QUEST } from '../lib/arkiv/learnerQuestData';
import { getPrivateKey, SPACE_ID } from '../lib/config';

async function seedQuest(questId?: string, force: boolean = false) {
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

  const targetSpaceId = SPACE_ID || 'beta-launch';
  console.log(`\n📦 Target Space ID: ${targetSpaceId}`);
  if (force) {
    console.log(`⚠️  Force mode: Will re-seed even if quest already exists (creates new version)\n`);
  } else {
    console.log(`\n`);
  }

  for (const quest of questsToSeed) {
    console.log(`\n🔍 Checking ${quest.title} quest...`);
    console.log(`   Quest ID: ${quest.questId}`);
    console.log(`   Materials: ${quest.materials.length}`);

    // Check if quest already exists in the target spaceId (unless force mode)
    if (!force) {
      const existingQuests = await listLearnerQuests({ 
        spaceId: targetSpaceId 
      });
      const existingQuest = existingQuests.find(q => q.questId === quest.questId);

      if (existingQuest) {
        console.log(`⏭️  Skipping "${quest.title}" (already exists in ${targetSpaceId})`);
        console.log(`   Existing quest key: ${existingQuest.key}`);
        console.log(`   💡 Tip: Use --force flag to re-seed with updated data`);
        continue;
      }
    } else {
      const existingQuests = await listLearnerQuests({ 
        spaceId: targetSpaceId 
      });
      const existingQuest = existingQuests.find(q => q.questId === quest.questId);
      if (existingQuest) {
        console.log(`⚠️  Quest already exists, but force mode enabled - creating new version`);
        console.log(`   Old quest key: ${existingQuest.key}`);
        console.log(`   New version will become active (most recent by createdAt)`);
      }
    }

    console.log(`✨ Creating "${quest.title}" in ${targetSpaceId}...`);

    const result = await createLearnerQuest({
      questId: quest.questId,
      title: quest.title,
      description: quest.description,
      source: quest.source,
      materials: quest.materials,
      privateKey,
      spaceId: targetSpaceId,
    });

    if (result) {
      console.log('✅ Quest created successfully!');
      console.log(`   Key: ${result.key}`);
      console.log(`   TxHash: ${result.txHash}`);
      console.log(`   Space ID: ${targetSpaceId}`);
      console.log(`\nView on Arkiv Explorer: https://explorer.arkiv.network/entity/${result.key}`);
    } else {
      console.error('❌ Failed to create quest');
      process.exit(1);
    }
  }
}

const questId = process.argv[2];
const force = process.argv.includes('--force');
seedQuest(questId, force).catch((error) => {
  console.error('Error seeding quest:', error);
  process.exit(1);
});

