/**
 * Beta Code API Route
 *
 * Handles beta code validation and usage tracking on Arkiv.
 */

import { NextRequest, NextResponse } from 'next/server';
import { trackBetaCodeUsage, getBetaCodeUsage, canUseBetaCode } from '@/lib/arkiv/betaCode';
import { createBetaAccess } from '@/lib/arkiv/betaAccess';
import { getPrivateKey, SPACE_ID } from '@/lib/config';

// In-memory cache to prevent duplicate concurrent requests
// Key: normalized code, Value: Promise that resolves when tracking completes
const pendingTrackingRequests = new Map<string, Promise<{ key: string; txHash: string }>>();

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
      // Check if code can be used (use SPACE_ID from config)
      // Uses actual unique wallet count for accurate limit checking
      const canUse = await canUseBetaCode(code, SPACE_ID);
      const usage = await getBetaCodeUsage(code, SPACE_ID);

      // Get actual unique wallet count for accurate remaining calculation
      const { listBetaAccessByCode } = await import('@/lib/arkiv/betaAccess');
      const accessRecords = await listBetaAccessByCode(code.toLowerCase().trim(), SPACE_ID);
      const actualWalletCount = new Set(accessRecords.map(a => a.wallet.toLowerCase())).size;
      const limit = usage?.limit || 50;

      return NextResponse.json({
        ok: true,
        canUse,
        usage: {
          usageCount: actualWalletCount, // Use actual wallet count (source of truth)
          limit,
          remaining: Math.max(0, limit - actualWalletCount),
        },
      });
    } else if (action === 'track') {
      // Validate code format and check limit (but don't increment usageCount yet)
      // usageCount is incremented in createAccess when wallet is known (Arkiv-native: based on unique wallets)
      const normalizedCode = code.toLowerCase().trim();

      // Check current usage to validate limit
      const usage = await getBetaCodeUsage(normalizedCode, SPACE_ID);
      const canUse = usage ? usage.usageCount < usage.limit : true; // New code or under limit

      if (!canUse) {
        return NextResponse.json({
          ok: false,
          error: `Beta code has reached its usage limit (${usage?.usageCount || 0}/${usage?.limit || 50} unique wallets).`,
        }, { status: 403 }); // 403 Forbidden
      }

      // Return validation result (code is valid, limit check passed)
      // Actual usageCount increment happens in createAccess when wallet is known
      return NextResponse.json({
        ok: true,
        canUse: true,
        usage: usage ? {
          usageCount: usage.usageCount,
          limit: usage.limit,
          remaining: Math.max(0, usage.limit - usage.usageCount),
        } : {
          usageCount: 0,
          limit: 50,
          remaining: 50,
        },
        message: 'Beta code validated. Usage will be tracked when wallet connects.',
      });
    } else if (action === 'createAccess') {
      // Create beta access record (wallet binding) and increment usageCount for new wallets
      // CRITICAL: usageCount should equal unique wallet count (Arkiv-native, accurate tracking)
      const { wallet } = body;

      if (!wallet) {
        return NextResponse.json(
          { ok: false, error: 'Wallet address is required for createAccess' },
          { status: 400 }
        );
      }

      try {
        const privateKey = getPrivateKey();
        const normalizedCode = code.toLowerCase().trim();
        const normalizedWallet = wallet.toLowerCase();

        // Check if wallet already has access (prevent duplicates)
        const { getBetaAccessByWallet, listBetaAccessByCode } = await import('@/lib/arkiv/betaAccess');
        const existingAccess = await getBetaAccessByWallet(normalizedWallet, SPACE_ID);

        if (existingAccess && existingAccess.code === normalizedCode) {
          // Wallet already has access via this code - return success without incrementing
          return NextResponse.json({
            ok: true,
            key: existingAccess.key,
            txHash: existingAccess.txHash,
            message: 'Beta access already exists for this wallet',
            alreadyExists: true,
          });
        }

        // Check limit based on ACTUAL unique wallet count (Arkiv-native, accurate)
        // Count unique wallets from beta_access entities (source of truth)
        const accessRecords = await listBetaAccessByCode(normalizedCode, SPACE_ID);
        const uniqueWalletCount = new Set(accessRecords.map(a => a.wallet.toLowerCase())).size;

        const usage = await getBetaCodeUsage(normalizedCode, SPACE_ID);
        const limit = usage?.limit || 50;

        // Enforce limit based on actual unique wallet count
        if (uniqueWalletCount >= limit) {
          return NextResponse.json({
            ok: false,
            error: `Beta code has reached its usage limit (${uniqueWalletCount}/${limit} unique wallets).`,
          }, { status: 403 }); // 403 Forbidden
        }

        // Create beta access record first
        const { key, txHash } = await createBetaAccess({
          wallet: normalizedWallet,
          code: normalizedCode,
          privateKey,
        });

        // Then sync usageCount with actual unique wallet count (includes this new wallet)
        // This ensures usageCount = unique wallet count (Arkiv-native, accurate tracking)
        const { syncBetaCodeUsageCount } = await import('@/lib/arkiv/betaCode');
        await syncBetaCodeUsageCount(normalizedCode, SPACE_ID);

        return NextResponse.json({
          ok: true,
          key,
          txHash,
          message: 'Beta access record created and usage count incremented',
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

    const usage = await getBetaCodeUsage(code, SPACE_ID);
    const canUse = await canUseBetaCode(code, SPACE_ID);

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
