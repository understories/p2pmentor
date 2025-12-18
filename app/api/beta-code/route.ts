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
      const canUse = await canUseBetaCode(code, SPACE_ID);
      const usage = await getBetaCodeUsage(code, SPACE_ID);
      
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
      // CRITICAL: Validate limit before tracking (double safeguard, Arkiv-native)
      const canUse = await canUseBetaCode(code, SPACE_ID);
      if (!canUse) {
        const usage = await getBetaCodeUsage(code, SPACE_ID);
        return NextResponse.json({
          ok: false,
          error: `Beta code has reached its usage limit (${usage?.usageCount || 0}/${usage?.limit || 50}). Cannot track additional usage.`,
        }, { status: 403 }); // 403 Forbidden
      }

      // Prevent duplicate concurrent requests for the same code
      const normalizedCode = code.toLowerCase().trim();
      const existingRequest = pendingTrackingRequests.get(normalizedCode);
      
      if (existingRequest) {
        // Another request is already processing this code - wait for it
        console.log(`[api/beta-code] Duplicate request detected for code "${normalizedCode}", waiting for existing request...`);
        try {
          const { key, txHash } = await existingRequest;
          
          // Get updated usage (use SPACE_ID from config)
          const updatedUsage = await getBetaCodeUsage(code, SPACE_ID);
          
          return NextResponse.json({
            ok: true,
            key,
            txHash,
            usage: updatedUsage ? {
              usageCount: updatedUsage.usageCount,
              limit: updatedUsage.limit,
              remaining: Math.max(0, updatedUsage.limit - updatedUsage.usageCount),
            } : null,
            message: 'Beta code usage tracked (duplicate request handled)',
          });
        } catch (error: any) {
          // If the existing request failed, remove it and let this request try
          pendingTrackingRequests.delete(normalizedCode);
          // Fall through to create new request
        }
      }

      // Create new tracking request and store it
      const trackingPromise = (async () => {
        try {
          return await trackBetaCodeUsage(code, 50); // Default limit 50
        } finally {
          // Clean up after 5 seconds (transaction should complete by then)
          setTimeout(() => {
            pendingTrackingRequests.delete(normalizedCode);
          }, 5000);
        }
      })();
      
      pendingTrackingRequests.set(normalizedCode, trackingPromise);

      // Track usage (increment count)
      try {
        const { key, txHash } = await trackingPromise;
        
        // Get updated usage (use SPACE_ID from config)
        const updatedUsage = await getBetaCodeUsage(code, SPACE_ID);
        
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
      } catch (error: any) {
        // Remove from pending on error
        pendingTrackingRequests.delete(normalizedCode);
        
        console.error('[api/beta-code] Error tracking beta code usage:', error);
        // Check if it's a transaction replacement error
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('replacement transaction underpriced') || 
            errorMessage.includes('nonce') ||
            errorMessage.includes('underpriced')) {
          return NextResponse.json({
            ok: false,
            error: 'Transaction is still processing from a previous request. Please wait a moment and try again.',
            retryable: true,
          }, { status: 409 }); // 409 Conflict
        }
        // Re-throw to be caught by outer try-catch
        throw error;
      }
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
