/**
 * Learning Follow API route
 * 
 * Handles learning community follow/unfollow.
 */

import { NextResponse } from 'next/server';
import { createLearningFollow } from '@/lib/arkiv/learningFollow';
import { getPrivateKey, CURRENT_WALLET } from '@/lib/config';
import { isTransactionTimeoutError } from '@/lib/arkiv/transaction-utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet, action, skill_id, mode } = body;

    // Use wallet from request, fallback to CURRENT_WALLET for example wallet
    const targetWallet = wallet || CURRENT_WALLET || '';
    if (!targetWallet) {
      return NextResponse.json(
        { ok: false, error: 'No wallet address provided' },
        { status: 400 }
      );
    }

    if (action === 'createFollow') {
      if (!skill_id) {
        return NextResponse.json(
          { ok: false, error: 'skill_id is required' },
          { status: 400 }
        );
      }

      try {
        const { key, txHash } = await createLearningFollow({
          profile_wallet: targetWallet,
          skill_id,
          mode: mode || 'learning',
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
