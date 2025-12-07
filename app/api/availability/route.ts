/**
 * Availability API route
 * 
 * Handles availability entity creation and retrieval.
 */

import { NextResponse } from 'next/server';
import { createAvailability, listAvailabilityForWallet } from '@/lib/arkiv/availability';
import { getPrivateKey } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet, timeBlocks, timezone, spaceId } = body;

    if (!wallet || !timeBlocks || !timezone) {
      return NextResponse.json(
        { ok: false, error: 'wallet, timeBlocks, and timezone are required' },
        { status: 400 }
      );
    }

    const { key, txHash } = await createAvailability({
      wallet,
      timeBlocks,
      timezone,
      privateKey: getPrivateKey(),
      spaceId: spaceId || 'local-dev',
    });

    return NextResponse.json({ ok: true, key, txHash });
  } catch (error: any) {
    console.error('Availability API error:', error);
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
    const spaceId = searchParams.get('spaceId') || undefined;

    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: 'Wallet parameter is required' },
        { status: 400 }
      );
    }

    const availabilities = await listAvailabilityForWallet(wallet, spaceId);
    return NextResponse.json({ ok: true, availabilities });
  } catch (error: any) {
    console.error('Availability API GET error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

