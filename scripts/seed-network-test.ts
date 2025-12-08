/**
 * Seed script for testing network page
 * 
 * Creates diverse asks and offers to test matching functionality.
 * Uses the example wallet from ARKIV_PRIVATE_KEY.
 */

import 'dotenv/config';
import { createAsk } from '../lib/arkiv/asks';
import { createOffer } from '../lib/arkiv/offers';
import { getPrivateKey, CURRENT_WALLET } from '../lib/config';

// Simple delay to avoid rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function seedNetworkTest() {
  console.log('🌱 Seeding network test data (long-lasting for demos)...\n');
  
  if (!CURRENT_WALLET) {
    console.error('❌ ARKIV_PRIVATE_KEY is not available. Please set it in your .env file.');
    process.exit(1);
  }
  
  const wallet = CURRENT_WALLET;
  const privateKey = getPrivateKey();
  console.log(`Using wallet: ${wallet}\n`);

  // Use 7 days TTL for demo data (604800 seconds)
  const DEMO_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
  console.log(`📅 Setting TTL to ${DEMO_TTL_SECONDS / 86400} days for demo visibility\n`);

  try {
    // Create diverse asks (learning requests)
    console.log('❓ Creating asks (learning requests)...');
    const asks = [
      { skill: 'React', message: 'I want to learn React hooks and state management' },
      { skill: 'TypeScript', message: 'Looking for help with TypeScript generics and advanced types' },
      { skill: 'Solidity', message: 'Need guidance on smart contract security best practices' },
      { skill: 'Rust', message: 'Want to learn Rust ownership and borrowing concepts' },
      { skill: 'Next.js', message: 'Need help with Next.js App Router and server components' },
      { skill: 'GraphQL', message: 'Learning GraphQL queries and schema design' },
      { skill: 'Web3', message: 'Understanding Web3 architecture and dApp development' },
      { skill: 'Node.js', message: 'Node.js backend development and API design' },
    ];

    for (const ask of asks) {
      await delay(300); // 300ms delay to avoid rate limiting
      try {
        const result = await createAsk({
          wallet,
          skill: ask.skill,
          message: ask.message,
          privateKey,
          expiresIn: DEMO_TTL_SECONDS, // 7 days for demo
        });
        console.log(`✅ Ask created: ${ask.skill} - ${result.key.substring(0, 16)}...`);
      } catch (error: any) {
        console.log(`⚠️  Skipped ask (${ask.skill}): ${error.message}`);
      }
    }

    console.log('\n💼 Creating offers (teaching offers)...');
    // Create matching offers - some will match asks, some won't
    const offers = [
      { skill: 'React', message: 'Experienced React developer, happy to help with hooks and state management', availabilityWindow: 'Mon-Fri 6-8pm EST', isPaid: false },
      { skill: 'TypeScript', message: 'TypeScript expert available for mentoring on advanced patterns', availabilityWindow: 'Weekends flexible', isPaid: false },
      { skill: 'Solidity', message: 'Smart contract auditor offering security reviews and best practices', availabilityWindow: 'Weekdays 9am-5pm EST', isPaid: true, cost: '0.1 ETH' },
      { skill: 'Rust', message: 'Rust core contributor, can help with ownership and async programming', availabilityWindow: 'Evenings after 7pm EST', isPaid: false },
      { skill: 'Python', message: 'Python mentor for data science and web development', availabilityWindow: 'Flexible', isPaid: false },
      { skill: 'JavaScript', message: 'JavaScript fundamentals and modern ES6+ features', availabilityWindow: 'Weekends 10am-2pm EST', isPaid: false },
      { skill: 'GraphQL', message: 'GraphQL schema design and query optimization', availabilityWindow: 'Weekdays flexible', isPaid: true, cost: '0.05 ETH' },
      { skill: 'Web3', message: 'Web3 development and smart contract integration', availabilityWindow: 'Evenings', isPaid: false },
    ];

    for (const offer of offers) {
      await delay(300);
      try {
        const result = await createOffer({
          wallet,
          skill: offer.skill,
          message: offer.message,
          availabilityWindow: offer.availabilityWindow,
          isPaid: offer.isPaid,
          cost: offer.cost,
          privateKey,
          expiresIn: DEMO_TTL_SECONDS, // 7 days for demo
        });
        console.log(`✅ Offer created: ${offer.skill} (${offer.isPaid ? 'Paid' : 'Free'}) - ${result.key.substring(0, 16)}...`);
      } catch (error: any) {
        console.log(`⚠️  Skipped offer (${offer.skill}): ${error.message}`);
      }
    }

    console.log('\n✨ Seeding complete!');
    console.log('\n📊 Expected matches:');
    console.log('  - React ask ↔ React offer (Free)');
    console.log('  - TypeScript ask ↔ TypeScript offer (Free)');
    console.log('  - Solidity ask ↔ Solidity offer (Paid: 0.1 ETH)');
    console.log('  - Rust ask ↔ Rust offer (Free)');
    console.log('  - GraphQL ask ↔ GraphQL offer (Paid: 0.05 ETH)');
    console.log('  - Web3 ask ↔ Web3 offer (Free)');
    console.log('  - Next.js ask (no match - no Next.js offer)');
    console.log('  - Node.js ask (no match - no Node.js offer)');
    console.log('  - Python offer (no match - no Python ask)');
    console.log('  - JavaScript offer (no match - no JavaScript ask)');
    console.log('\n⏰ Data expires in 7 days (good for demos)');
    console.log('\n🌐 Visit http://localhost:3000/network/compare to see the comparison!');
    console.log('   Or http://localhost:3000/network/forest for the graph visualization');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

seedNetworkTest();


