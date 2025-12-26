/**
 * Seed Meta-Learning Quest
 *
 * Creates the meta-learning quest definition.
 * Run once to bootstrap the quest.
 *
 * Usage:
 *   npx tsx scripts/seed-meta-learning-quest.ts [--force]
 *
 * Options:
 *   --force: Re-seed even if quest already exists (creates new version with updated data)
 */

import 'dotenv/config';
import { createLearnerQuest, listLearnerQuests } from '../lib/arkiv/learnerQuest';
import { getPrivateKey, SPACE_ID } from '../lib/config';

const META_LEARNING_QUEST = {
  questId: 'meta_learning',
  title: 'Meta-Learning: Learn How to Learn',
  description: 'A foundational quest that teaches effective learning behaviors and mental models. Apply to any learning goal you already have on the platform.',
  source: 'refs/meta-learning-quest-implementation-plan.md',
  questType: 'meta_learning' as const,
  steps: [
    {
      stepId: 'choose_target',
      title: 'Choose a Learning Target',
      description: 'Select any active or upcoming learning goal from your quests, skills, or create a new one.',
      estimatedDuration: '5 minutes',
      conceptCard: {
        title: 'Learning is skill-agnostic',
        body: 'Learning works the same way across subjects. Languages, math, programming, philosophy, and music all rely on the same underlying processes.\n\nBy choosing a concrete learning target, you give your brain something specific to work on. The process you practice here will transfer to other skills later.\n\nThis quest is not about *what* you learn. It is about *how* you learn anything.',
      },
    },
    {
      stepId: 'focused_session',
      title: 'Focused Session',
      description: 'Complete a single focused learning session (20-30 minutes, distraction minimized, one clear objective).',
      estimatedDuration: '20-30 minutes',
      conceptCard: {
        title: 'Focused mode builds structure',
        body: 'Focused attention is when you deliberately concentrate on one problem or idea. This is where you build initial understanding and form the raw pieces of knowledge.\n\nFocused work feels effortful and slow. That is normal. If learning feels easy, you are often just recognizing information, not building it.\n\nFocused mode is necessary, but it is not sufficient on its own.',
      },
    },
    {
      stepId: 'diffuse_break',
      title: 'Diffuse Break',
      description: 'Intentionally disengage: walk, shower, light physical task, rest. No content consumption required.',
      estimatedDuration: '10-30 minutes',
      conceptCard: {
        title: 'Insight comes from letting go',
        body: 'When you step away, your brain continues working in the background. This relaxed state is often where connections form and insights appear.\n\nWalking, resting, showering, or doing light physical tasks all help activate this mode. Consuming new content usually does not.\n\nLearning improves when you deliberately alternate between focused effort and relaxed disengagement.',
      },
    },
    {
      stepId: 'retrieval_attempt',
      title: 'Retrieval Attempt',
      description: 'Without notes, write or record what you remember, what feels unclear, what you got wrong. Accuracy is not scored.',
      estimatedDuration: '10-15 minutes',
      conceptCard: {
        title: 'Trying to remember is what strengthens memory',
        body: 'Actively trying to recall what you learned strengthens memory far more than rereading or reviewing notes.\n\nStruggle during recall is a good sign. It means your brain is rebuilding the knowledge instead of passively recognizing it.\n\nGetting things wrong here is useful information, not failure.',
      },
    },
    {
      stepId: 'reflection',
      title: 'Reflection',
      description: 'Answer short prompts about what surprised you, what felt easy but wasn\'t, what felt hard but improved, and whether insight occurred after the break.',
      estimatedDuration: '5-10 minutes',
      conceptCard: {
        title: 'Awareness prevents false confidence',
        body: 'Your brain is very good at feeling like it understands something when it does not. This is called an illusion of competence.\n\nReflection helps you notice gaps, confusion, and unexpected difficulty. It trains you to judge learning by performance, not comfort.\n\nGood learners pay attention to what feels hard and unclear, not just what feels smooth.',
      },
    },
    {
      stepId: 'spacing_check',
      title: 'Spacing Check',
      description: 'After ≥24 hours, revisit the topic briefly and note what persisted, what decayed, what re-clicked quickly.',
      estimatedDuration: '10-15 minutes',
      conceptCard: {
        title: 'Forgetting is part of learning',
        body: 'Memory strengthens when learning is spread out over time. Revisiting material after forgetting has begun makes it more durable.\n\nIf everything feels familiar immediately, learning is shallow. If some things faded and need rebuilding, learning is working.\n\nSpacing turns short-term understanding into long-term skill.',
      },
    },
  ],
  metadata: {
    totalSteps: 6,
    estimatedTotalTime: '5-7 days (flexible)',
    completionCriteria: 'All artifact types exist + minimum time separation met',
  },
};

async function seedQuest(force: boolean = false) {
  const privateKey = getPrivateKey();
  if (!privateKey) {
    console.error('ARKIV_PRIVATE_KEY not set');
    process.exit(1);
  }

  const quest = META_LEARNING_QUEST;
  const targetSpaceId = SPACE_ID || 'beta-launch';
  console.log(`\n📦 Target Space ID: ${targetSpaceId}`);
  if (force) {
    console.log(`⚠️  Force mode: Will re-seed even if quest already exists (creates new version)\n`);
  } else {
    console.log(`\n`);
  }

  console.log(`\n🔍 Checking ${quest.title} quest...`);
  console.log(`   Quest ID: ${quest.questId}`);
  console.log(`   Steps: ${quest.steps.length}`);

  // Check if quest already exists in the target spaceId (unless force mode)
  if (!force) {
    const existingQuests = await listLearnerQuests({
      questType: 'meta_learning',
      spaceId: targetSpaceId,
    });
    const existingQuest = existingQuests.find(q => q.questId === quest.questId);

    if (existingQuest) {
      console.log(`⏭️  Skipping "${quest.title}" (already exists in ${targetSpaceId})`);
      console.log(`   Existing quest key: ${existingQuest.key}`);
      console.log(`   💡 Tip: Use --force flag to re-seed with updated data`);
      return;
    }
  } else {
    const existingQuests = await listLearnerQuests({
      questType: 'meta_learning',
      spaceId: targetSpaceId,
    });
    const existingQuest = existingQuests.find(q => q.questId === quest.questId);
    if (existingQuest) {
      console.log(`⚠️  Quest already exists, but force mode enabled - creating new version`);
      console.log(`   Old quest key: ${existingQuest.key}`);
      console.log(`   New version will become active (most recent by createdAt)`);
    }
  }

  console.log(`✨ Creating "${quest.title}" in ${targetSpaceId}...`);

  // For meta_learning quests, we store the steps and concept cards in the payload
  const result = await createLearnerQuest({
    questId: quest.questId,
    title: quest.title,
    description: quest.description,
    source: quest.source,
    questType: quest.questType,
    steps: quest.steps,
    metadata: quest.metadata,
    privateKey,
    spaceId: targetSpaceId,
  });

  if (result) {
    console.log('✅ Quest created successfully!');
    console.log(`   Key: ${result.key}`);
    console.log(`   TxHash: ${result.txHash}`);
    console.log(`   Space ID: ${targetSpaceId}`);
    console.log(`\nView on Arkiv Explorer: https://explorer.arkiv.network/entity/${result.key}`);
    console.log(`\n⚠️  Note: Steps and concept cards are stored in the quest payload.`);
    console.log(`   The quest definition payload contains: steps, metadata, conceptCards`);
  } else {
    console.error('❌ Failed to create quest');
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const force = args.includes('--force');

seedQuest(force).catch((error) => {
  console.error('Error seeding quest:', error);
  process.exit(1);
});

