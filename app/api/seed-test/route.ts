/**
 * Test seeding API route
 * 
 * Creates test asks and offers for network page testing.
 * Only works in development mode.
 */

import { NextResponse } from 'next/server';
import { createAsk } from '@/lib/arkiv/asks';
import { createOffer } from '@/lib/arkiv/offers';
import { getPrivateKey, CURRENT_WALLET } from '@/lib/config';

// Simple delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST() {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { ok: false, error: 'Seeding only available in development' },
      { status: 403 }
    );
  }

  if (!CURRENT_WALLET) {
    return NextResponse.json(
      { ok: false, error: 'ARKIV_PRIVATE_KEY not configured' },
      { status: 500 }
    );
  }

  const wallet = CURRENT_WALLET;
  const privateKey = getPrivateKey();
  const results: string[] = [];

  try {
    // Create diverse asks
    const asks = [
      { skill: 'React', message: 'I want to learn React hooks and state management' },
      { skill: 'TypeScript', message: 'Looking for help with TypeScript generics and advanced types' },
      { skill: 'Solidity', message: 'Need guidance on smart contract security best practices' },
      { skill: 'Rust', message: 'Want to learn Rust ownership and borrowing concepts' },
      { skill: 'Next.js', message: 'Need help with Next.js App Router and server components' },
    ];

    for (const ask of asks) {
      await delay(300);
      try {
        const result = await createAsk({
          wallet,
          skill: ask.skill,
          message: ask.message,
          privateKey,
        });
        results.push(`✅ Ask: ${ask.skill}`);
      } catch (error: any) {
        results.push(`⚠️ Ask (${ask.skill}): ${error.message}`);
      }
    }

    // Create matching offers
    const offers = [
      { skill: 'React', message: 'Experienced React developer, happy to help with hooks and state management', availabilityWindow: 'Mon-Fri 6-8pm EST' },
      { skill: 'TypeScript', message: 'TypeScript expert available for mentoring on advanced patterns', availabilityWindow: 'Weekends flexible' },
      { skill: 'Solidity', message: 'Smart contract auditor offering security reviews and best practices', availabilityWindow: 'Weekdays 9am-5pm EST' },
      { skill: 'Rust', message: 'Rust core contributor, can help with ownership and async programming', availabilityWindow: 'Evenings after 7pm EST' },
      { skill: 'Python', message: 'Python mentor for data science and web development', availabilityWindow: 'Flexible' },
      { skill: 'JavaScript', message: 'JavaScript fundamentals and modern ES6+ features', availabilityWindow: 'Weekends 10am-2pm EST' },
    ];

    for (const offer of offers) {
      await delay(300);
      try {
        const result = await createOffer({
          wallet,
          skill: offer.skill,
          message: offer.message,
          availabilityWindow: offer.availabilityWindow,
          privateKey,
        });
        results.push(`✅ Offer: ${offer.skill}`);
      } catch (error: any) {
        results.push(`⚠️ Offer (${offer.skill}): ${error.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Test data seeded successfully',
      results,
      expectedMatches: [
        'React ask ↔ React offer',
        'TypeScript ask ↔ TypeScript offer',
        'Solidity ask ↔ Solidity offer',
        'Rust ask ↔ Rust offer',
      ],
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to seed test data', results },
      { status: 500 }
    );
  }
}

