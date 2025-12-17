/**
 * Seed HSK 1 Language Assessment Quest
 *
 * Loads question bank from JSON and creates quest entity on Arkiv.
 *
 * Usage:
 *   ARKIV_PRIVATE_KEY=0x... tsx scripts/seed-hsk1-quest.ts
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createLanguageAssessmentQuest } from '@/lib/arkiv/languageQuest';
import { listLearnerQuests } from '@/lib/arkiv/learnerQuest';
import { getPrivateKey, SPACE_ID } from '@/lib/config';

async function seedHSK1Quest() {
  const privateKey = getPrivateKey();
  if (!privateKey) {
    console.error('Error: ARKIV_PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  // Load question bank from JSON
  const questionBankPath = path.join(process.cwd(), 'static-data/language-quests/hsk1-questions.json');
  if (!fs.existsSync(questionBankPath)) {
    console.error(`Error: Question bank not found at ${questionBankPath}`);
    process.exit(1);
  }

  const questionBank = JSON.parse(fs.readFileSync(questionBankPath, 'utf-8'));

  // Calculate totals from sections
  const totalQuestions = questionBank.sections.reduce((sum: number, section: any) => sum + section.questions.length, 0);
  const totalPoints = questionBank.sections.reduce((sum: number, section: any) => sum + section.points, 0);

  console.log(`\n📚 Seeding HSK 1 Language Assessment Quest`);
  console.log(`   Language: ${questionBank.language}`);
  console.log(`   Proficiency Level: ${questionBank.proficiencyLevel}`);
  console.log(`   Sections: ${questionBank.sections.length}`);
  console.log(`   Total Questions: ${totalQuestions}`);
  console.log(`   Total Points: ${totalPoints}`);
  console.log(`   Passing Score: ${questionBank.passingScore} (${Math.round((questionBank.passingScore / totalPoints) * 100)}%)`);
  console.log(`   Time Limit: ${questionBank.timeLimit}s (${Math.round(questionBank.timeLimit / 60)} minutes)\n`);

  const targetSpaceId = SPACE_ID;
  console.log(`📦 Target Space ID: ${targetSpaceId}\n`);

  // Check if quest already exists in the target spaceId
  const existingQuests = await listLearnerQuests({ 
    questType: 'language_assessment',
    spaceId: targetSpaceId 
  });
  const existingQuest = existingQuests.find(q => q.questId === 'hsk1');

  if (existingQuest) {
    console.log(`⏭️  Skipping HSK 1 quest (already exists in ${targetSpaceId})`);
    console.log(`   Existing quest key: ${existingQuest.key}`);
    process.exit(0);
  }

  console.log(`✨ Creating HSK 1 quest in ${targetSpaceId}...\n`);

  const result = await createLanguageAssessmentQuest({
    questId: 'hsk1',
    title: questionBank.certificationName,
    description: `Test your ${questionBank.proficiencyLevel} level Chinese proficiency. This assessment covers reading and recognition, grammar and sentence patterns, and essential vocabulary.`,
    source: 'p2pmentor',
    language: questionBank.language,
    proficiencyLevel: questionBank.proficiencyLevel,
    sections: questionBank.sections,
    metadata: {
      totalQuestions,
      totalPoints,
      passingScore: questionBank.passingScore,
      timeLimit: questionBank.timeLimit,
      certificationName: questionBank.certificationName,
    },
    privateKey,
    spaceId: targetSpaceId,
  });

  if (result) {
    console.log('✅ Successfully created HSK 1 quest!');
    console.log(`   Entity Key: ${result.key}`);
    console.log(`   Transaction Hash: ${result.txHash}`);
    console.log(`   Space ID: ${targetSpaceId}`);
    console.log(`\n   View on Arkiv: https://explorer.mendoza.hoodi.arkiv.network/entity/${result.key}`);
  } else {
    console.error('❌ Failed to create quest');
    process.exit(1);
  }
}

seedHSK1Quest().catch((error) => {
  console.error('Error seeding quest:', error);
  process.exit(1);
});

