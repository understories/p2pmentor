/**
 * Lite Asks API route
 *
 * Handles lite ask creation and listing.
 * No authentication required - public endpoint.
 *
 * Reference: refs/lite-implementation-plan.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLiteAsk, listLiteAsks } from '@/lib/arkiv/liteAsks';
import { getPrivateKey } from '@/lib/config';
import { isTransactionTimeoutError } from '@/lib/arkiv/transaction-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, discordHandle, skill, description, spaceId } = body;

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Name is required' },
        { status: 400 }
      );
    }
    if (!discordHandle || !discordHandle.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Discord handle is required' },
        { status: 400 }
      );
    }
    if (!skill || !skill.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Skill/topic is required' },
        { status: 400 }
      );
    }

    // Validate spaceId
    const finalSpaceId = spaceId && spaceId.trim() ? spaceId.trim() : 'nsjan26';

    try {
      const { key, txHash } = await createLiteAsk({
        name: name.trim(),
        discordHandle: discordHandle.trim(),
        skill: skill.trim(),
        description: description?.trim(),
        spaceId: finalSpaceId,
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
    console.error('Lite Asks API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skill = searchParams.get('skill') || undefined;
    const spaceId = searchParams.get('spaceId') || 'nsjan26';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
    const includeExpired = searchParams.get('includeExpired') === 'true';

    // List all lite asks (with optional filters)
    const asks = await listLiteAsks({ skill, spaceId, limit, includeExpired });
    return NextResponse.json({ ok: true, asks });
  } catch (error: any) {
    console.error('Lite Asks API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

