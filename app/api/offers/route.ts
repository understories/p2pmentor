/**
 * Offers API route
 * 
 * Handles offer creation and listing.
 * 
 * Reference: refs/mentor-graph/pages/api/offers.ts
 */

import { NextResponse } from 'next/server';
import { createOffer, listOffers, listOffersForWallet } from '@/lib/arkiv/offers';
import { getPrivateKey, CURRENT_WALLET } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet, action, skill, message, availabilityWindow, isPaid, paymentAddress, expiresIn } = body;

    // Use wallet from request, fallback to CURRENT_WALLET for example wallet
    const targetWallet = wallet || CURRENT_WALLET || '';
    if (!targetWallet) {
      return NextResponse.json(
        { ok: false, error: 'No wallet address provided' },
        { status: 400 }
      );
    }

    if (action === 'createOffer') {
      if (!skill || !message || !availabilityWindow) {
        return NextResponse.json(
          { ok: false, error: 'skill, message, and availabilityWindow are required' },
          { status: 400 }
        );
      }

      // Parse expiresIn: if provided, use it; otherwise undefined (will use default in createOffer)
      let parsedExpiresIn: number | undefined = undefined;
      if (expiresIn !== undefined && expiresIn !== null && expiresIn !== '') {
        const num = typeof expiresIn === 'number' ? expiresIn : Number(expiresIn);
        if (!isNaN(num) && num > 0 && isFinite(num)) {
          parsedExpiresIn = Math.floor(num);
        }
      }

      const { key, txHash } = await createOffer({
        wallet: targetWallet,
        skill,
        message,
        availabilityWindow,
        isPaid: isPaid === true || isPaid === 'true',
        paymentAddress: paymentAddress || undefined,
        privateKey: getPrivateKey(),
        expiresIn: parsedExpiresIn,
      });

      return NextResponse.json({ ok: true, key, txHash });
    } else {
      return NextResponse.json(
        { ok: false, error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Offers API error:', error);
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
      // List offers for specific wallet
      const offers = await listOffersForWallet(wallet);
      return NextResponse.json({ ok: true, offers });
    } else {
      // List all offers (with optional filters)
      const offers = await listOffers({ skill, spaceId });
      return NextResponse.json({ ok: true, offers });
    }
  } catch (error: any) {
    console.error('Offers API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

