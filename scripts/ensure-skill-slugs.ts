/**
 * Ensure All Skills Have Slugs
 * 
 * Script to verify and fix skills that are missing slugs.
 * Since topics = skills, every skill should have a slug for topic page access.
 */

import { listSkills, createSkill, getSkillBySlug, normalizeSkillSlug } from '../lib/arkiv/skill';
import { getPrivateKey } from '../lib/config';

async function ensureSkillSlugs() {
  console.log('🔍 Checking all skills for slugs...\n');

  try {
    // Get all active skills
    const skills = await listSkills({ status: 'active', limit: 1000 });
    console.log(`Found ${skills.length} active skills\n`);

    const skillsWithoutSlugs: typeof skills = [];
    const skillsWithSlugs: typeof skills = [];

    // Check each skill
    for (const skill of skills) {
      if (!skill.slug || skill.slug.trim() === '') {
        skillsWithoutSlugs.push(skill);
        console.log(`❌ Missing slug: ${skill.name_canonical} (key: ${skill.key})`);
      } else {
        skillsWithSlugs.push(skill);
        // Verify slug is normalized correctly
        const expectedSlug = normalizeSkillSlug(skill.name_canonical);
        if (skill.slug !== expectedSlug) {
          console.log(`⚠️  Slug mismatch: ${skill.name_canonical}`);
          console.log(`   Current: "${skill.slug}"`);
          console.log(`   Expected: "${expectedSlug}"`);
        }
      }
    }

    console.log(`\n✅ ${skillsWithSlugs.length} skills have slugs`);
    console.log(`❌ ${skillsWithoutSlugs.length} skills missing slugs\n`);

    if (skillsWithoutSlugs.length === 0) {
      console.log('✨ All skills have slugs! No action needed.');
      return;
    }

    console.log('⚠️  Note: Skills are immutable on Arkiv.');
    console.log('   Skills without slugs cannot be updated - they would need to be recreated.');
    console.log('   However, new skills created via createSkill() will always have slugs.\n');

    // Check if we can query by name_canonical instead
    console.log('🔍 Testing slug lookup for skills without slugs...\n');
    for (const skill of skillsWithoutSlugs.slice(0, 5)) {
      const expectedSlug = normalizeSkillSlug(skill.name_canonical);
      const foundBySlug = await getSkillBySlug(expectedSlug);
      if (foundBySlug) {
        console.log(`✅ Skill "${skill.name_canonical}" can be found by expected slug "${expectedSlug}"`);
      } else {
        console.log(`❌ Skill "${skill.name_canonical}" cannot be found by expected slug "${expectedSlug}"`);
        console.log(`   This skill will show "Topic not found" on /topic/${expectedSlug}`);
      }
    }

    console.log('\n📝 Summary:');
    console.log(`   - All new skills created via createSkill() will have slugs`);
    console.log(`   - Skills without slugs may need manual review`);
    console.log(`   - Topic pages use slug lookup, so skills without slugs won't be accessible`);

  } catch (error: any) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
ensureSkillSlugs()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

