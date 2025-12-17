/**
 * Availability API route
 * 
 * Handles availability entity creation and retrieval.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAvailability, listAvailabilityForWallet, deleteAvailability, type WeeklyAvailability } from '@/lib/arkiv/availability';
import { getPrivateKey, SPACE_ID } from '@/lib/config';
import { isTransactionTimeoutError } from '@/lib/arkiv/transaction-utils';
import { verifyBetaAccess } from '@/lib/auth/betaAccess';

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
    const { wallet, timeBlocks, timezone, spaceId } = body;

    if (!wallet || !timezone) {
      return NextResponse.json(
        { ok: false, error: 'wallet and timezone are required' },
        { status: 400 }
      );
    }

    // timeBlocks can be either a string (legacy) or WeeklyAvailability object (structured)
    if (!timeBlocks || (typeof timeBlocks === 'string' && !timeBlocks.trim())) {
      return NextResponse.json(
        { ok: false, error: 'timeBlocks is required' },
        { status: 400 }
      );
    }

    // Use SPACE_ID from config (beta-launch in production, local-dev in development)
    const targetSpaceId = spaceId || SPACE_ID;
    
    try {
      const { key, txHash } = await createAvailability({
        wallet,
        timeBlocks: timeBlocks as string | WeeklyAvailability, // Support both formats
        timezone,
        privateKey: getPrivateKey(),
        spaceId: targetSpaceId,
      });

      // Create user-focused notification
      if (key) {
        try {
          const { createNotification } = await import('@/lib/arkiv/notifications');
          await createNotification({
            wallet: wallet.toLowerCase(),
            notificationType: 'entity_created',
            sourceEntityType: 'availability',
            sourceEntityKey: key,
            title: 'Availability Set',
            message: 'You set your availability',
            link: '/me/availability',
            metadata: {
              availabilityKey: key,
              timezone: timezone,
            },
            privateKey: getPrivateKey(),
            spaceId: targetSpaceId,
          });
        } catch (notifError) {
          console.error('Failed to create notification for availability:', notifError);
        }
      }

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

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { availabilityKey, wallet } = body;

    if (!availabilityKey || !wallet) {
      return NextResponse.json(
        { ok: false, error: 'availabilityKey and wallet are required' },
        { status: 400 }
      );
    }

    try {
      const { key, txHash } = await deleteAvailability({
        availabilityKey,
        wallet,
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
  } catch (error: any) {
    console.error('Availability API DELETE error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

