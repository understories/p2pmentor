/**
 * Seed Explorer Demo Data for Local-Dev-Seed SpaceId
 *
 * Creates example entities in `local-dev-seed` spaceId to test and demonstrate
 * the explorer's spaceId filtering functionality.
 *
 * **CRITICAL SAFETY:**
 * - Requires BETA_SPACE_ID=local-dev-seed environment variable
 * - Verifies SPACE_ID before creating any entities
 * - Fails immediately if spaceId is incorrect
 * - Only seeds to local-dev-seed, never to other spaces
 *
 * **Prerequisites:**
 * 1. Install dependencies: `npm install` or `pnpm install`
 * 2. Set ARKIV_PRIVATE_KEY in .env file (required for creating entities)
 * 3. Ensure .env file exists in project root
 *
 * **Usage:**
 *   BETA_SPACE_ID=local-dev-seed npx tsx scripts/seed-explorer-demo.ts
 *
 * **Alternative (if tsx is installed locally):**
 *   BETA_SPACE_ID=local-dev-seed pnpm tsx scripts/seed-explorer-demo.ts
 *   BETA_SPACE_ID=local-dev-seed npm run -- tsx scripts/seed-explorer-demo.ts
 *
 * **Rate Limiting:**
 * - 400ms delay between each entity creation
 * - Sequential execution (not parallel)
 * - Graceful error handling (continues on error)
 */

import 'dotenv/config';
import { createSkill } from '../lib/arkiv/skill';
import { createAsk } from '../lib/arkiv/asks';
import { createOffer } from '../lib/arkiv/offers';
import { createUserProfile } from '../lib/arkiv/profile';
import { getPrivateKey, CURRENT_WALLET, SPACE_ID } from '../lib/config';
import { listSkills } from '../lib/arkiv/skill';
import { listAsks } from '../lib/arkiv/asks';
import { listOffers } from '../lib/arkiv/offers';
import { listUserProfiles } from '../lib/arkiv/profile';

// CRITICAL: Target spaceId - must match environment variable
const TARGET_SPACE_ID = 'local-dev-seed';

// Rate limiting delay (ms)
const DELAY_MS = 400;

// Simple delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Verify spaceId safety before proceeding
 */
function verifySpaceIdSafety() {
  if (SPACE_ID !== TARGET_SPACE_ID) {
    console.error('\n❌ CRITICAL ERROR: Incorrect spaceId detected!');
    console.error(`   Current SPACE_ID: "${SPACE_ID}"`);
    console.error(`   Expected: "${TARGET_SPACE_ID}"`);
    console.error('\n   This script ONLY seeds to local-dev-seed space.');
    console.error('   Set BETA_SPACE_ID=local-dev-seed environment variable and try again.');
    console.error('\n   Example:');
    console.error(`   BETA_SPACE_ID=${TARGET_SPACE_ID} npx tsx scripts/seed-explorer-demo.ts\n`);
    process.exit(1);
  }
  console.log(`✅ SpaceId verified: ${SPACE_ID}`);
}

/**
 * Seed example skills
 */
async function seedSkills(privateKey: `0x${string}`) {
  console.log('\n📚 Seeding Skills...\n');

  const skillsToSeed = [
    { name: 'React', description: 'React framework and ecosystem for building user interfaces' },
    { name: 'TypeScript', description: 'TypeScript programming language with static typing' },
    { name: 'Solidity', description: 'Solidity smart contract development for Ethereum' },
    { name: 'Rust', description: 'Rust systems programming language' },
    { name: 'Next.js', description: 'Next.js React framework for production' },
  ];

  const results = [];
  for (const skill of skillsToSeed) {
    await delay(DELAY_MS);
    try {
      // Check if skill already exists
      const existing = await listSkills({
        slug: skill.name.toLowerCase().replace(/\s+/g, '-'),
        spaceId: TARGET_SPACE_ID,
        limit: 1,
      });

      if (existing.length > 0) {
        console.log(`⏭️  Skipping "${skill.name}" (already exists in ${TARGET_SPACE_ID})`);
        results.push({ skill: skill.name, status: 'skipped', key: existing[0].key });
        continue;
      }

      // Create skill with explicit spaceId
      const { key, txHash } = await createSkill({
        name_canonical: skill.name,
        description: skill.description,
        privateKey,
        spaceId: TARGET_SPACE_ID, // Explicit parameter
      });

      console.log(`✅ Created skill "${skill.name}" (key: ${key.slice(0, 16)}..., tx: ${txHash.slice(0, 10)}...)`);
      results.push({ skill: skill.name, status: 'created', key, txHash });
    } catch (error: any) {
      console.error(`❌ Failed to create skill "${skill.name}":`, error.message);
      results.push({ skill: skill.name, status: 'error', error: error.message });
    }
  }

  return results;
}

/**
 * Seed example profile
 * Note: Profiles are keyed by wallet, so we can only create/update one profile per wallet
 */
async function seedProfile(privateKey: `0x${string}`, wallet: string) {
  console.log('\n👤 Seeding Profile...\n');

  await delay(DELAY_MS);
  try {
    // Check if profile already exists
    const existing = await listUserProfiles({ spaceId: TARGET_SPACE_ID });
    const existingProfile = existing.find((p) => p.wallet.toLowerCase() === wallet.toLowerCase() && p.spaceId === TARGET_SPACE_ID);

    if (existingProfile) {
      console.log(`⏭️  Profile already exists in ${TARGET_SPACE_ID} (will update)`);
      console.log(`   Existing: ${existingProfile.displayName || existingProfile.wallet}`);
    }

    // Create or update profile (uses SPACE_ID from config, which we verified)
    // This will create a new profile or update existing one (Pattern B)
    const { key, txHash } = await createUserProfile({
      wallet,
      displayName: 'Explorer Demo User',
      username: 'explorer-demo',
      bioShort: 'Demo profile for testing explorer spaceId filtering functionality',
      skillsArray: ['React', 'TypeScript', 'Solidity'],
      timezone: 'America/New_York',
      contactLinks: {
        github: 'explorer-demo',
        twitter: 'explorer_demo',
      },
      privateKey,
    });

    console.log(`✅ Created/updated profile "Explorer Demo User" (key: ${key.slice(0, 16)}..., tx: ${txHash.slice(0, 10)}...)`);
    return { profile: 'Explorer Demo User', status: existingProfile ? 'updated' : 'created', key, txHash };
  } catch (error: any) {
    console.error(`❌ Failed to create profile:`, error.message);
    return { profile: 'Explorer Demo User', status: 'error', error: error.message };
  }
}

/**
 * Seed example asks
 */
async function seedAsks(privateKey: `0x${string}`, wallet: string) {
  console.log('\n❓ Seeding Asks...\n');

  const asksToSeed = [
    { skill: 'React', message: 'I want to learn React hooks and state management patterns' },
    { skill: 'TypeScript', message: 'Looking for help with TypeScript generics and advanced types' },
    { skill: 'Solidity', message: 'Need guidance on smart contract security best practices' },
  ];

  const results = [];
  for (const ask of asksToSeed) {
    await delay(DELAY_MS);
    try {
      // Check if ask already exists (by skill and message)
      const existing = await listAsks({ spaceId: TARGET_SPACE_ID, limit: 100 });
      const existingAsk = existing.find(
        (a) => a.skill === ask.skill && a.message === ask.message && a.spaceId === TARGET_SPACE_ID
      );

      if (existingAsk) {
        console.log(`⏭️  Skipping ask "${ask.skill}" (already exists in ${TARGET_SPACE_ID})`);
        results.push({ ask: ask.skill, status: 'skipped', key: existingAsk.key });
        continue;
      }

      // Create ask (uses SPACE_ID from config, which we verified)
      const { key, txHash } = await createAsk({
        wallet,
        skill: ask.skill,
        message: ask.message,
        privateKey,
        expiresIn: 7 * 24 * 60 * 60, // 7 days
      });

      console.log(`✅ Created ask "${ask.skill}" (key: ${key.slice(0, 16)}..., tx: ${txHash.slice(0, 10)}...)`);
      results.push({ ask: ask.skill, status: 'created', key, txHash });
    } catch (error: any) {
      console.error(`❌ Failed to create ask "${ask.skill}":`, error.message);
      results.push({ ask: ask.skill, status: 'error', error: error.message });
    }
  }

  return results;
}

/**
 * Seed example offers
 */
async function seedOffers(privateKey: `0x${string}`, wallet: string) {
  console.log('\n💼 Seeding Offers...\n');

  const offersToSeed = [
    {
      skill: 'React',
      message: 'Experienced React developer, happy to help with hooks and state management',
      availabilityWindow: 'Mon-Fri 6-8pm EST',
      isPaid: false,
    },
    {
      skill: 'TypeScript',
      message: 'TypeScript expert available for mentoring on advanced patterns',
      availabilityWindow: 'Weekends flexible',
      isPaid: false,
    },
    {
      skill: 'Solidity',
      message: 'Smart contract auditor offering security reviews and best practices',
      availabilityWindow: 'Weekdays 9am-5pm EST',
      isPaid: true,
      cost: '0.1 ETH',
    },
  ];

  const results = [];
  for (const offer of offersToSeed) {
    await delay(DELAY_MS);
    try {
      // Check if offer already exists
      const existing = await listOffers({ spaceId: TARGET_SPACE_ID, limit: 100 });
      const existingOffer = existing.find(
        (o) => o.skill === offer.skill && o.message === offer.message && o.spaceId === TARGET_SPACE_ID
      );

      if (existingOffer) {
        console.log(`⏭️  Skipping offer "${offer.skill}" (already exists in ${TARGET_SPACE_ID})`);
        results.push({ offer: offer.skill, status: 'skipped', key: existingOffer.key });
        continue;
      }

      // Create offer (uses SPACE_ID from config, which we verified)
      const { key, txHash } = await createOffer({
        wallet,
        skill: offer.skill,
        message: offer.message,
        availabilityWindow: offer.availabilityWindow,
        isPaid: offer.isPaid,
        cost: offer.cost,
        privateKey,
        expiresIn: 7 * 24 * 60 * 60, // 7 days
      });

      console.log(
        `✅ Created offer "${offer.skill}" (${offer.isPaid ? 'Paid' : 'Free'}) (key: ${key.slice(0, 16)}..., tx: ${txHash.slice(0, 10)}...)`
      );
      results.push({ offer: offer.skill, status: 'created', key, txHash });
    } catch (error: any) {
      console.error(`❌ Failed to create offer "${offer.skill}":`, error.message);
      results.push({ offer: offer.skill, status: 'error', error: error.message });
    }
  }

  return results;
}

/**
 * Main seed function
 */
async function seedExplorerDemo() {
  console.log('\n🌱 Seeding Explorer Demo Data for Local-Dev-Seed SpaceId\n');
  console.log('=' .repeat(60));

  // CRITICAL: Verify spaceId before proceeding
  verifySpaceIdSafety();

  // Check for private key
  if (!process.env.ARKIV_PRIVATE_KEY) {
    console.error('\n❌ ERROR: ARKIV_PRIVATE_KEY is not set');
    console.error('\n   This script requires ARKIV_PRIVATE_KEY to create entities on Arkiv.');
    console.error('\n   To fix this:');
    console.error('   1. Make sure you have a .env file in the project root');
    console.error('   2. Add ARKIV_PRIVATE_KEY=0x... to your .env file');
    console.error('   3. Or export it: export ARKIV_PRIVATE_KEY=0x...');
    console.error('\n   Example .env file:');
    console.error('     ARKIV_PRIVATE_KEY=0x1234567890abcdef...');
    console.error('     BETA_SPACE_ID=local-dev-seed');
    console.error('\n   After setting ARKIV_PRIVATE_KEY, run the script again.\n');
    process.exit(1);
  }

  const privateKey = getPrivateKey();
  if (!privateKey) {
    console.error('\n❌ ERROR: Could not get private key from ARKIV_PRIVATE_KEY');
    console.error('   Make sure ARKIV_PRIVATE_KEY is set correctly in your .env file');
    console.error('   Format should be: ARKIV_PRIVATE_KEY=0x...\n');
    process.exit(1);
  }

  const wallet = CURRENT_WALLET;
  if (!wallet) {
    console.error('\n❌ ERROR: Could not derive wallet from ARKIV_PRIVATE_KEY');
    console.error('   The ARKIV_PRIVATE_KEY may be invalid or incorrectly formatted');
    console.error('   Expected format: ARKIV_PRIVATE_KEY=0x... (must start with 0x)\n');
    process.exit(1);
  }

  console.log(`\n📦 Target Space ID: ${TARGET_SPACE_ID}`);
  console.log(`🔑 Using wallet: ${wallet}\n`);

  try {
    // Seed in order: Skills first (needed for asks/offers), then profile, then asks/offers
    const skillResults = await seedSkills(privateKey);
    const profileResult = await seedProfile(privateKey, wallet);
    const askResults = await seedAsks(privateKey, wallet);
    const offerResults = await seedOffers(privateKey, wallet);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Seeding Summary:\n');

    const allResults = [
      ...skillResults.map((r) => ({ type: 'skill', ...r })),
      { type: 'profile', ...profileResult },
      ...askResults.map((r) => ({ type: 'ask', ...r })),
      ...offerResults.map((r) => ({ type: 'offer', ...r })),
    ];

    const created = allResults.filter((r) => r.status === 'created').length;
    const skipped = allResults.filter((r) => r.status === 'skipped').length;
    const errors = allResults.filter((r) => r.status === 'error').length;

    console.log(`  ✅ Created: ${created}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);

    if (errors > 0) {
      console.log('\n❌ Errors:');
      allResults
        .filter((r) => r.status === 'error')
        .forEach((r) => {
          const name = (r as any).skill || (r as any).profile || (r as any).ask || (r as any).offer;
          const errorMsg = (r as any).error || 'Unknown error';
          console.log(`  - ${r.type} "${name}": ${errorMsg}`);
        });
    }

    console.log('\n✨ Seeding complete!');
    console.log(`\n🌐 Visit https://p2pmentor.com/explorer and filter by "Local Dev Seed" to see the seeded entities.`);
    console.log(`\n⏰ Note: Explorer index cache refreshes every 60 seconds.`);
    console.log(`   If entities don't appear immediately, wait up to 60 seconds and refresh.\n`);

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run seed script
seedExplorerDemo();

