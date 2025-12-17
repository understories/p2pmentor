/**
 * Onboarding Events API route
 * 
 * Handles onboarding event creation using server-side signing wallet.
 * Follows Arkiv-native patterns and engineering guidelines.
 * 
 * All entity creation uses server-side signing wallet (ARKIV_PRIVATE_KEY),
 * not the user's MetaMask wallet, to avoid unexpected transaction popups.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOnboardingEvent } from '@/lib/arkiv/onboardingEvent';
import { getPrivateKey, SPACE_ID } from '@/lib/config';
import { verifyBetaAccess } from '@/lib/auth/betaAccess';

export async function POST(request: NextRequest) {
  try {
    // Verify beta access
    const betaCheck = await verifyBetaAccess(request, {
      requireArkivValidation: false, // Fast path - cookies are sufficient
    });

    if (!betaCheck.hasAccess) {
      return NextResponse.json(
        { ok: false, error: betaCheck.error || 'Beta access required. Please enter invite code at /beta' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { wallet, eventType } = body;

    if (!wallet || !eventType) {
      return NextResponse.json(
        { ok: false, error: 'wallet and eventType are required' },
        { status: 400 }
      );
    }

    // Validate eventType
    const validEventTypes = ['profile_created', 'skill_added', 'ask_created', 'offer_created', 'network_explored', 'community_joined'];
    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { ok: false, error: `Invalid eventType. Must be one of: ${validEventTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Create onboarding event using server-side signing wallet
    // Use SPACE_ID from config (beta-launch in production, local-dev in development)
    const { key, txHash } = await createOnboardingEvent({
      wallet,
      eventType,
      privateKey: getPrivateKey(),
      spaceId: SPACE_ID,
    });

    return NextResponse.json({ ok: true, key, txHash });
  } catch (error: any) {
    console.error('Onboarding events API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

