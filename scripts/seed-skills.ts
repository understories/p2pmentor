/**
 * Seed script for curated Skills
 * 
 * Creates initial Skill entities for beta launch.
 * These are curated skills that users can select from.
 * 
 * Run with: pnpm tsx scripts/seed-skills.ts
 */

import { createSkill } from '../lib/arkiv/skill';
import { getPrivateKey } from '../lib/config';

const CURATED_SKILLS = [
  // Languages
  { name: 'Spanish', description: 'Spanish language learning and practice' },
  { name: 'Portuguese', description: 'Portuguese language learning and practice' },
  { name: 'English', description: 'English language learning and practice' },
  { name: 'French', description: 'French language learning and practice' },
  { name: 'German', description: 'German language learning and practice' },
  
  // Ethereum & Web3
  { name: 'Ethereum', description: 'Ethereum development and blockchain fundamentals' },
  { name: 'Solidity', description: 'Solidity smart contract development' },
  { name: 'zk-SNARKs', description: 'Zero-knowledge proof systems' },
  { name: 'Web3', description: 'Web3 development and dApp building' },
  { name: 'DeFi', description: 'Decentralized finance protocols and concepts' },
  
  // Frontend Development
  { name: 'React', description: 'React framework and ecosystem' },
  { name: 'TypeScript', description: 'TypeScript programming language' },
  { name: 'Next.js', description: 'Next.js React framework' },
  { name: 'JavaScript', description: 'JavaScript programming language' },
  { name: 'CSS', description: 'CSS styling and design' },
  
  // Backend & Systems
  { name: 'Rust', description: 'Rust systems programming language' },
  { name: 'Go', description: 'Go programming language' },
  { name: 'Python', description: 'Python programming language' },
  { name: 'Node.js', description: 'Node.js server-side JavaScript' },
  
  // Design & Creative
  { name: 'Design', description: 'UI/UX design principles and practices' },
  { name: 'Writing', description: 'Technical and creative writing' },
  { name: 'Coaching', description: 'Professional and personal coaching' },
  
  // Other
  { name: 'Mathematics', description: 'Mathematical concepts and problem-solving' },
  { name: 'Data Science', description: 'Data analysis and machine learning' },
];

async function seedSkills() {
  try {
    const privateKey = getPrivateKey();
    console.log('🌱 Seeding curated Skills...\n');

    const results = [];
    for (const skill of CURATED_SKILLS) {
      try {
        // Check if skill already exists by slug
        const { listSkills } = await import('../lib/arkiv/skill');
        const existing = await listSkills({ slug: skill.name.toLowerCase().replace(/\s+/g, '-'), limit: 1 });
        
        if (existing.length > 0) {
          console.log(`⏭️  Skipping "${skill.name}" (already exists)`);
          results.push({ skill: skill.name, status: 'skipped', key: existing[0].key });
          continue;
        }

        const { key, txHash } = await createSkill({
          name_canonical: skill.name,
          description: skill.description,
          privateKey,
          spaceId: 'local-dev',
        });

        console.log(`✅ Created "${skill.name}" (key: ${key}, tx: ${txHash})`);
        results.push({ skill: skill.name, status: 'created', key, txHash });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error: any) {
        console.error(`❌ Failed to create "${skill.name}":`, error.message);
        results.push({ skill: skill.name, status: 'error', error: error.message });
      }
    }

    console.log('\n📊 Summary:');
    const created = results.filter(r => r.status === 'created').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'error').length;
    console.log(`  Created: ${created}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Errors: ${errors}`);

    if (errors > 0) {
      console.log('\n❌ Errors:');
      results.filter(r => r.status === 'error').forEach(r => {
        console.log(`  - ${r.skill}: ${r.error}`);
      });
    }

    process.exit(0);
  } catch (error: any) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

seedSkills();
