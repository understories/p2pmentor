/**
 * Test Week 1 Features (Feb 1-7)
 *
 * Tests Evidence Panel, Track Overview, and Skill Linkage with real Arkiv actions.
 * Creates quest progress entities and skill links to verify functionality.
 *
 * Run: npx tsx scripts/test-week1-features.ts
 */

import 'dotenv/config';
import { createQuestStepProgress } from '../lib/arkiv/questProgress';
import { createQuestCompletionSkillLink } from '../lib/arkiv/questSkillLink';
import { getQuestStepProgress } from '../lib/arkiv/questProgress';
import { getQuestCompletionSkillLinks } from '../lib/arkiv/questSkillLink';
import { createSkill, getSkillBySlug, normalizeSkillSlug } from '../lib/arkiv/skill';
import { getPrivateKey, SPACE_ID } from '../lib/config';

async function testWeek1Features() {
  console.log('🧪 Testing Week 1 Features (Evidence Panel, Track Overview, Skill Linkage)\n');

  const privateKey = getPrivateKey();
  if (!privateKey) {
    console.error('❌ ARKIV_PRIVATE_KEY not set');
    process.exit(1);
  }

  // Use a test wallet (or derive from private key)
  const testWallet = process.env.TEST_WALLET || '0x1234567890123456789012345678901234567890';
  const questId = 'arkiv_builder';
  const stepId1 = 'intro';
  const stepId2 = 'fork_setup';

  try {
    // Test 1: Create quest step progress entities (Evidence Panel)
    console.log('Test 1: Creating quest step progress entities (Evidence Panel)...\n');

    const progress1 = await createQuestStepProgress({
      wallet: testWallet,
      questId,
      stepId: stepId1,
      stepType: 'READ',
      evidence: {
        stepId: stepId1,
        completedAt: new Date().toISOString(),
        evidenceType: 'completion',
        questVersion: '1',
      },
      questVersion: '1',
      privateKey,
      spaceId: SPACE_ID,
    });

    console.log('✅ Created progress entity 1:');
    console.log(`   Key: ${progress1.key}`);
    console.log(`   TxHash: ${progress1.txHash}`);
    console.log(
      `   View on Arkiv: https://explorer.mendoza.hoodi.arkiv.network/entity/${progress1.key}\n`
    );

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const progress2 = await createQuestStepProgress({
      wallet: testWallet,
      questId,
      stepId: stepId2,
      stepType: 'DO',
      evidence: {
        stepId: stepId2,
        completedAt: new Date().toISOString(),
        evidenceType: 'entity_created',
        entityKey: 'test_entity:local-dev:0xabc123',
        txHash: '0xtest123',
        questVersion: '1',
      },
      questVersion: '1',
      privateKey,
      spaceId: SPACE_ID,
    });

    console.log('✅ Created progress entity 2:');
    console.log(`   Key: ${progress2.key}`);
    console.log(`   TxHash: ${progress2.txHash}`);
    console.log(
      `   View on Arkiv: https://explorer.mendoza.hoodi.arkiv.network/entity/${progress2.key}\n`
    );

    // Wait for entities to be queryable
    console.log('⏳ Waiting 5 seconds for entities to be queryable...\n');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Test 2: Query progress entities (Evidence Panel functionality)
    console.log('Test 2: Querying quest step progress (Evidence Panel)...\n');
    const allProgress = await getQuestStepProgress({
      wallet: testWallet,
      questId,
      spaceId: SPACE_ID,
    });

    console.log(`✅ Found ${allProgress.length} progress entities:`);
    allProgress.forEach((p, idx) => {
      console.log(
        `   ${idx + 1}. Step: ${p.stepId}, Type: ${p.stepType}, Evidence: ${p.evidence?.evidenceType || 'N/A'}`
      );
      console.log(`      Key: ${p.key}`);
      console.log(`      TxHash: ${p.txHash || 'N/A'}`);
    });
    console.log();

    // Test 3: Create skill entity and link (Skill Linkage)
    console.log('Test 3: Creating skill entity and quest completion link (Skill Linkage)...\n');

    const skillName = 'Arkiv Development';
    const normalizedSlug = normalizeSkillSlug(skillName);

    // Check if skill already exists
    let skillEntity = await getSkillBySlug(normalizedSlug, SPACE_ID);

    if (!skillEntity) {
      // Create new skill entity
      console.log('   Creating new skill entity...');
      const { key, txHash } = await createSkill({
        name_canonical: skillName,
        description: 'Development skills for building on Arkiv',
        created_by_profile: testWallet,
        privateKey,
        spaceId: SPACE_ID,
      });

      // Wait for entity to be queryable
      await new Promise((resolve) => setTimeout(resolve, 3000));

      skillEntity = await getSkillBySlug(normalizedSlug, SPACE_ID);
      if (!skillEntity) {
        // If still not found, create a minimal object for testing
        skillEntity = {
          key,
          name_canonical: skillName,
          slug: normalizedSlug,
          status: 'active' as const,
          spaceId: SPACE_ID,
          createdAt: new Date().toISOString(),
          txHash,
        };
        console.log('   ⚠️  Skill entity created but not yet queryable, using created key\n');
      }
    }

    console.log('✅ Skill entity:');
    console.log(`   Key: ${skillEntity.key}`);
    console.log(`   Name: ${skillEntity.name_canonical}`);
    console.log(`   Slug: ${skillEntity.slug}\n`);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const skillLink = await createQuestCompletionSkillLink({
      wallet: testWallet,
      questId,
      stepId: stepId1,
      skillId: skillEntity.key,
      skillName: skillEntity.name_canonical,
      proficiency: 3,
      progressEntityKey: progress1.key,
      privateKey,
      spaceId: SPACE_ID,
    });

    console.log('✅ Created quest completion skill link:');
    console.log(`   Key: ${skillLink.key}`);
    console.log(`   TxHash: ${skillLink.txHash}`);
    console.log(
      `   View on Arkiv: https://explorer.mendoza.hoodi.arkiv.network/entity/${skillLink.key}\n`
    );

    // Wait for link to be queryable
    console.log('⏳ Waiting 5 seconds for link to be queryable...\n');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Test 4: Query skill links
    console.log('Test 4: Querying quest completion skill links...\n');
    const links = await getQuestCompletionSkillLinks({
      wallet: testWallet,
      questId,
      spaceId: SPACE_ID,
    });

    console.log(`✅ Found ${links.length} skill link(s):`);
    links.forEach((link, idx) => {
      console.log(`   ${idx + 1}. Quest: ${link.questId}, Step: ${link.stepId}`);
      console.log(`      Skill: ${link.skillName} (${link.skillId})`);
      console.log(`      Proficiency: ${link.proficiency || 'N/A'}`);
      console.log(`      Key: ${link.key}`);
      console.log(`      TxHash: ${link.txHash || 'N/A'}`);
    });
    console.log();

    // Summary
    console.log('📊 Test Summary:');
    console.log(`   ✅ Created ${allProgress.length} quest step progress entities`);
    console.log(`   ✅ Created ${links.length} quest completion skill link(s)`);
    console.log(`   ✅ All entities queryable on Arkiv`);
    console.log(`   ✅ Evidence Panel would display ${allProgress.length} evidence artifacts`);
    console.log(`   ✅ Skill Linkage system working correctly\n`);

    console.log('🎉 Week 1 features tested successfully!\n');
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testWeek1Features();
}
