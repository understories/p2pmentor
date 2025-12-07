/**
 * Asks API route
 * 
 * Handles ask creation and listing.
 * 
 * Reference: refs/mentor-graph/pages/api/asks.ts
 */

import { NextResponse } from 'next/server';
import { createAsk, listAsks, listAsksForWallet } from '@/lib/arkiv/asks';
import { getPrivateKey, CURRENT_WALLET } from '@/lib/config';
import { isTransactionTimeoutError } from '@/lib/arkiv/transaction-utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet, action, skill, message, expiresIn } = body;

    // Use wallet from request, fallback to CURRENT_WALLET for example wallet
    const targetWallet = wallet || CURRENT_WALLET || '';
    if (!targetWallet) {
      return NextResponse.json(
        { ok: false, error: 'No wallet address provided' },
        { status: 400 }
      );
    }

    if (action === 'createAsk') {
      if (!skill || !message) {
        return NextResponse.json(
          { ok: false, error: 'skill and message are required' },
          { status: 400 }
        );
      }

      // Parse expiresIn: if provided, use it; otherwise undefined (will use default in createAsk)
      let parsedExpiresIn: number | undefined = undefined;
      if (expiresIn !== undefined && expiresIn !== null && expiresIn !== '') {
        const num = typeof expiresIn === 'number' ? expiresIn : Number(expiresIn);
        if (!isNaN(num) && num > 0 && isFinite(num)) {
          parsedExpiresIn = Math.floor(num);
          // Validate TTL: minimum 60 seconds (1 minute), maximum 31536000 seconds (1 year)
          if (parsedExpiresIn < 60) {
            return NextResponse.json(
              { ok: false, error: 'Expiration must be at least 60 seconds (1 minute)' },
              { status: 400 }
            );
          }
          if (parsedExpiresIn > 31536000) {
            return NextResponse.json(
              { ok: false, error: 'Expiration cannot exceed 31536000 seconds (1 year)' },
              { status: 400 }
            );
          }
        }
      }

      try {
        const { key, txHash } = await createAsk({
          wallet: targetWallet,
          skill,
          message,
          privateKey: getPrivateKey(),
          expiresIn: parsedExpiresIn,
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
    console.error('Asks API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const skill = searchParams.get('skill') || undefined;
    const spaceId = searchParams.get('spaceId') || undefined;

    if (wallet) {
      // List asks for specific wallet
      const asks = await listAsksForWallet(wallet);
      return NextResponse.json({ ok: true, asks });
    } else {
      // List all asks (with optional filters)
      const asks = await listAsks({ skill, spaceId });
      return NextResponse.json({ ok: true, asks });
    }
  } catch (error: any) {
    console.error('Asks API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

