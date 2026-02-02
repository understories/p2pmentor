/**
 * Lite Offers API route
 *
 * Handles lite offer creation and listing.
 * No authentication required - public endpoint.
 *
 * Reference: refs/lite-implementation-plan.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLiteOffer, listLiteOffers } from '@/lib/arkiv/liteOffers';
import { getPrivateKey } from '@/lib/config';
import { isTransactionTimeoutError } from '@/lib/arkiv/transaction-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, discordHandle, skill, description, cost, spaceId } = body;

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 });
    }
    if (!discordHandle || !discordHandle.trim()) {
      return NextResponse.json({ ok: false, error: 'Discord handle is required' }, { status: 400 });
    }
    if (!skill || !skill.trim()) {
      return NextResponse.json({ ok: false, error: 'Skill/topic is required' }, { status: 400 });
    }

    // Validate spaceId
    const finalSpaceId = spaceId && spaceId.trim() ? spaceId.trim() : 'nsfeb26';

    try {
      const { key, txHash } = await createLiteOffer({
        name: name.trim(),
        discordHandle: discordHandle.trim(),
        skill: skill.trim(),
        description: description?.trim(),
        cost: cost?.trim(),
        spaceId: finalSpaceId,
        privateKey: getPrivateKey(),
      });

      return NextResponse.json({ ok: true, key, txHash });
    } catch (error: unknown) {
      // Handle transaction receipt timeout gracefully
      if (isTransactionTimeoutError(error)) {
        return NextResponse.json({
          ok: true,
          key: null,
          txHash: null,
          pending: true,
          message:
            error instanceof Error ? error.message : 'Transaction submitted, confirmation pending',
        });
      }
      throw error;
    }
  } catch (error: unknown) {
    console.error('Lite Offers API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skill = searchParams.get('skill') || undefined;
    const spaceId = searchParams.get('spaceId') || 'nsfeb26';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
    const includeExpired = searchParams.get('includeExpired') === 'true';

    // List all lite offers (with optional filters)
    const offers = await listLiteOffers({ skill, spaceId, limit, includeExpired });
    return NextResponse.json({ ok: true, offers });
  } catch (error: unknown) {
    console.error('Lite Offers API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
