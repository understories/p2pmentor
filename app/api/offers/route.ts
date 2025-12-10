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
import { isTransactionTimeoutError } from '@/lib/arkiv/transaction-utils';
import type { WeeklyAvailability } from '@/lib/arkiv/availability';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet, action, skill, skill_id, skill_label, message, availabilityWindow, availabilityKey, isPaid, cost, paymentAddress, expiresIn } = body;

    // Use wallet from request, fallback to CURRENT_WALLET for example wallet
    const targetWallet = wallet || CURRENT_WALLET || '';
    if (!targetWallet) {
      return NextResponse.json(
        { ok: false, error: 'No wallet address provided' },
        { status: 400 }
      );
    }

    if (action === 'createOffer') {
      // For beta: require skill_id (new Skill entity system)
      // Legacy: fallback to skill string if skill_id not provided
      if ((!skill_id && !skill) || !message) {
        return NextResponse.json(
          { ok: false, error: 'skill_id (or skill) and message are required' },
          { status: 400 }
        );
      }

      // Validate availability: either availabilityWindow or availabilityKey must be provided
      if (!availabilityWindow && !availabilityKey) {
        return NextResponse.json(
          { ok: false, error: 'Either availabilityWindow or availabilityKey is required' },
          { status: 400 }
        );
      }

      // Parse expiresIn: if provided, use it; otherwise undefined (will use default in createOffer)
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
        const { key, txHash } = await createOffer({
          wallet: targetWallet,
          skill: skill || undefined, // Legacy: optional if skill_id provided
          skill_id: skill_id || undefined, // New: preferred for beta
          skill_label: skill_label || skill || undefined, // Derived from Skill entity
          message,
          availabilityWindow,
          availabilityKey: availabilityKey || undefined,
          isPaid: isPaid === true || isPaid === 'true',
          cost: cost || undefined,
          paymentAddress: paymentAddress || undefined,
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

