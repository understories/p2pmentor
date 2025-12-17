/**
 * Learning Follow API route
 * 
 * Handles learning community follow/unfollow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLearningFollow, unfollowSkill, listLearningFollows } from '@/lib/arkiv/learningFollow';
import { getPrivateKey, CURRENT_WALLET, SPACE_ID } from '@/lib/config';
import { isTransactionTimeoutError } from '@/lib/arkiv/transaction-utils';
import { verifyBetaAccess } from '@/lib/auth/betaAccess';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const profile_wallet = searchParams.get('profile_wallet') || undefined;
    const skill_id = searchParams.get('skill_id') || undefined;
    const active = searchParams.get('active') !== 'false'; // Default to true
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;

    // Extract spaceId from query params (for builder mode) or use SPACE_ID from config
    const spaceId = searchParams.get('spaceId') || undefined;
    const spaceIds = searchParams.get('spaceIds')?.split(',') || undefined;
    
    const follows = await listLearningFollows({
      profile_wallet,
      skill_id,
      active,
      spaceId: spaceId || SPACE_ID,
      spaceIds,
      limit,
    });

    return NextResponse.json({ ok: true, follows });
  } catch (error: any) {
    console.error('Learning Follow API GET error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json();
    const { wallet, action, skill_id, mode, profile_wallet } = body;

    // Use wallet from request (profile_wallet for backward compatibility), fallback to CURRENT_WALLET
    const targetWallet = wallet || profile_wallet || CURRENT_WALLET || '';
    if (!targetWallet) {
      return NextResponse.json(
        { ok: false, error: 'No wallet address provided' },
        { status: 400 }
      );
    }

    if (action === 'createFollow' || action === 'follow') {
      if (!skill_id) {
        return NextResponse.json(
          { ok: false, error: 'skill_id is required' },
          { status: 400 }
        );
      }

      // Use SPACE_ID from config (beta-launch in production, local-dev in development)
      try {
        const { key, txHash } = await createLearningFollow({
          profile_wallet: targetWallet,
          skill_id,
          mode: mode || 'learning',
          privateKey: getPrivateKey(),
          spaceId: SPACE_ID,
        });

        return NextResponse.json({ ok: true, key, txHash });
      } catch (error: any) {
        // Handle transaction receipt timeout gracefully
        if (isTransactionTimeoutError(error)) {
          return NextResponse.json({ 
            ok: true, 
            key: null,
            txHash: null,
            pending: true,
            message: error.message || 'Transaction submitted, confirmation pending'
          });
        }
        throw error;
      }
    } else if (action === 'unfollow') {
      if (!skill_id) {
        return NextResponse.json(
          { ok: false, error: 'skill_id is required' },
          { status: 400 }
        );
      }

      try {
        const { key, txHash } = await unfollowSkill({
          profile_wallet: targetWallet,
          skill_id,
          privateKey: getPrivateKey(),
        });

        return NextResponse.json({ ok: true, key, txHash });
      } catch (error: any) {
        // Handle transaction receipt timeout gracefully
        if (isTransactionTimeoutError(error)) {
          return NextResponse.json({ 
            ok: true, 
            key: null,
            txHash: null,
            pending: true,
            message: error.message || 'Transaction submitted, confirmation pending'
          });
        }
        throw error;
      }
    } else {
      return NextResponse.json(
        { ok: false, error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Learning Follow API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
