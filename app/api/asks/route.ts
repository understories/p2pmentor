/**
 * Asks API route
 *
 * Handles ask creation and listing.
 *
 * Reference: refs/mentor-graph/pages/api/asks.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAsk, listAsks, listAsksForWallet } from '@/lib/arkiv/asks';
import { getPrivateKey, CURRENT_WALLET, SPACE_ID } from '@/lib/config';
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
    const { wallet, action, skill, skill_id, skill_label, message, expiresIn } = body;

    // Use wallet from request, fallback to CURRENT_WALLET for example wallet
    const targetWallet = wallet || CURRENT_WALLET || '';
    if (!targetWallet) {
      return NextResponse.json(
        { ok: false, error: 'No wallet address provided' },
        { status: 400 }
      );
    }

    if (action === 'createAsk') {
      // For beta: require skill_id (new Skill entity system)
      // Legacy: fallback to skill string if skill_id not provided
      if ((!skill_id && !skill) || !message) {
        return NextResponse.json(
          { ok: false, error: 'skill_id (or skill) and message are required' },
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
          skill: skill || undefined, // Legacy: optional if skill_id provided
          skill_id: skill_id || undefined, // New: preferred for beta
          skill_label: skill_label || skill || undefined, // Derived from Skill entity
          message,
          privateKey: getPrivateKey(),
          expiresIn: parsedExpiresIn,
        });

        // Create user-focused notification
        if (key) {
          try {
            const { createNotification } = await import('@/lib/arkiv/notifications');
            const skillName = skill_label || skill || 'a skill';
            // Use SPACE_ID from config (same as the ask entity)
            await createNotification({
              wallet: targetWallet.toLowerCase(),
              notificationType: 'entity_created',
              sourceEntityType: 'ask',
              sourceEntityKey: key,
              title: 'Ask Created',
              message: `You created an ask for "${skillName}"`,
              link: '/asks',
              metadata: {
                askKey: key,
                skill: skillName,
                skill_id: skill_id || undefined,
              },
              privateKey: getPrivateKey(),
            });
          } catch (notifError) {
            console.error('Failed to create notification for ask:', notifError);
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

    // Check if builder mode is enabled (from query param)
    const builderMode = searchParams.get('builderMode') === 'true';

    // Get spaceId(s) from query params or use default
    const spaceIdParam = searchParams.get('spaceId');
    const spaceIdsParam = searchParams.get('spaceIds');

    let spaceId: string | undefined;
    let spaceIds: string[] | undefined;

    if (builderMode && spaceIdsParam) {
      // Builder mode: query multiple spaceIds
      spaceIds = spaceIdsParam.split(',').map(s => s.trim());
    } else if (spaceIdParam) {
      // Override default spaceId
      spaceId = spaceIdParam;
    } else {
      // Use default from config
      spaceId = SPACE_ID;
    }

    if (wallet) {
      // List asks for specific wallet
      const asks = await listAsksForWallet(wallet);
      return NextResponse.json({ ok: true, asks });
    } else {
      // List all asks (with optional filters)
      const asks = await listAsks({ skill, spaceId, spaceIds });
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

