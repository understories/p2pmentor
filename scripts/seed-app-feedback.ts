/**
 * Seed script for app feedback
 * 
 * Creates sample app feedback entities on Arkiv for testing/admin dashboard.
 * Uses the example wallet from ARKIV_PRIVATE_KEY.
 * 
 * Reference: refs/docs/sprint2.md Section 4.1
 */

import 'dotenv/config';
import { createAppFeedback } from '../lib/arkiv/appFeedback';
import { getPrivateKey, CURRENT_WALLET } from '../lib/config';

// Simple delay to avoid rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function seedAppFeedback() {
  console.log('🌱 Seeding app feedback data...\n');
  
  if (!CURRENT_WALLET) {
    console.error('❌ ARKIV_PRIVATE_KEY is not available. Please set it in your .env file.');
    process.exit(1);
  }
  
  const wallet = CURRENT_WALLET;
  const privateKey = getPrivateKey();
  console.log(`Using wallet: ${wallet}\n`);

  try {
    // Sample feedback entries
    const feedbacks = [
      {
        page: '/network',
        message: 'The network visualization is really helpful for finding mentors! The graph view makes it easy to see connections.',
        rating: 5,
      },
      {
        page: '/me',
        message: 'Love the dashboard! It would be great to see more stats about my sessions.',
        rating: 4,
      },
      {
        page: '/network',
        message: 'The skill filtering works well, but I wish there was a way to save favorite mentors.',
        rating: 4,
      },
      {
        page: '/me/sessions',
        message: 'Session management is clear and easy to use. The confirmation flow is intuitive.',
        rating: 5,
      },
      {
        page: '/network',
        message: 'Sometimes the graph takes a while to load. Could use some optimization.',
        rating: 3,
      },
      {
        page: '/me',
        message: 'Great overall experience! The peer-to-peer model is refreshing.',
        rating: 5,
      },
      {
        page: '/network/forest',
        message: 'The forest view is beautiful but a bit overwhelming. Maybe add a tutorial?',
        rating: 3,
      },
      {
        page: '/me/skills',
        message: 'Easy to add and manage skills. The autocomplete is helpful.',
        rating: 4,
      },
      {
        page: '/network',
        message: 'Would love to see more detailed mentor profiles before requesting a session.',
        rating: 4,
      },
      {
        page: '/me',
        message: 'The feedback system after sessions is great for building trust in the community.',
        rating: 5,
      },
    ];

    console.log(`📝 Creating ${feedbacks.length} app feedback entries...\n`);

    for (let i = 0; i < feedbacks.length; i++) {
      const feedback = feedbacks[i];
      await delay(500); // 500ms delay to avoid rate limiting
      
      try {
        const result = await createAppFeedback({
          wallet,
          page: feedback.page,
          message: feedback.message,
          rating: feedback.rating,
          privateKey,
          spaceId: 'local-dev',
        });

        console.log(`✅ [${i + 1}/${feedbacks.length}] Created feedback for ${feedback.page} (${feedback.rating}⭐)`);
        console.log(`   Key: ${result.key}`);
        console.log(`   Tx: ${result.txHash}\n`);
      } catch (error: any) {
        console.error(`❌ [${i + 1}/${feedbacks.length}] Failed to create feedback for ${feedback.page}:`, error.message);
      }
    }

    console.log('✨ App feedback seeding complete!\n');
    console.log('💡 You can now view these in the admin dashboard at /admin/feedback');
  } catch (error: any) {
    console.error('❌ Error seeding app feedback:', error);
    process.exit(1);
  }
}

seedAppFeedback();


