/**
 * Beta Code API Route
 * 
 * Handles beta code validation and usage tracking on Arkiv.
 */

import { NextRequest, NextResponse } from 'next/server';
import { trackBetaCodeUsage, getBetaCodeUsage, canUseBetaCode } from '@/lib/arkiv/betaCode';
import { createBetaAccess } from '@/lib/arkiv/betaAccess';
import { getPrivateKey } from '@/lib/config';

/**
 * POST /api/beta-code
 * 
 * Validate and track beta code usage
 * Body: { code: string, action: 'validate' | 'track' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, action = 'validate' } = body;

    if (!code) {
      return NextResponse.json(
        { ok: false, error: 'Beta code is required' },
        { status: 400 }
      );
    }

    if (action === 'validate') {
      // Check if code can be used
      const canUse = await canUseBetaCode(code);
      const usage = await getBetaCodeUsage(code);
      
      return NextResponse.json({
        ok: true,
        canUse,
        usage: usage ? {
          usageCount: usage.usageCount,
          limit: usage.limit,
          remaining: Math.max(0, usage.limit - usage.usageCount),
        } : null,
      });
    } else if (action === 'track') {
      // Track usage (increment count)
      const { key, txHash } = await trackBetaCodeUsage(code, 50); // Default limit 50
      
      // Get updated usage
      const updatedUsage = await getBetaCodeUsage(code);
      
      return NextResponse.json({
        ok: true,
        key,
        txHash,
        usage: updatedUsage ? {
          usageCount: updatedUsage.usageCount,
          limit: updatedUsage.limit,
          remaining: Math.max(0, updatedUsage.limit - updatedUsage.usageCount),
        } : null,
      });
    } else if (action === 'createAccess') {
      // Create beta access record (wallet binding - optional, can be done post-auth)
      const { wallet } = body;
      
      if (!wallet) {
        return NextResponse.json(
          { ok: false, error: 'Wallet address is required for createAccess' },
          { status: 400 }
        );
      }

      try {
        const privateKey = getPrivateKey();
        const { key, txHash } = await createBetaAccess({
          wallet,
          code,
          privateKey,
        });

        return NextResponse.json({
          ok: true,
          key,
          txHash,
          message: 'Beta access record created',
        });
      } catch (error: any) {
        console.error('[api/beta-code] Error creating beta access:', error);
        return NextResponse.json(
          { ok: false, error: error.message || 'Failed to create beta access record' },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { ok: false, error: 'Invalid action. Use "validate" or "track"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[api/beta-code] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to process beta code' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/beta-code
 * 
 * Get beta code usage info
 * Query params: code
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { ok: false, error: 'Beta code is required' },
        { status: 400 }
      );
    }

    const usage = await getBetaCodeUsage(code);
    const canUse = await canUseBetaCode(code);

    return NextResponse.json({
      ok: true,
      usage: usage ? {
        usageCount: usage.usageCount,
        limit: usage.limit,
        remaining: Math.max(0, usage.limit - usage.usageCount),
        txHash: usage.txHash,
      } : null,
      canUse,
    });
  } catch (error: any) {
    console.error('[api/beta-code] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch beta code usage' },
      { status: 500 }
    );
  }
}
