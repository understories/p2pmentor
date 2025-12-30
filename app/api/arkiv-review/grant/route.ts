/**
 * Review Mode Grant API Route
 * 
 * Server-signed grant issuance for Arkiv review mode.
 * Grants are issued by the app signer wallet to enable reviewers to bypass onboarding.
 * 
 * POST /api/arkiv-review/grant
 * Body: { subjectWallet }
 * 
 * Flow:
 * 1. Password verification happens client-side before this API is called
 * 2. Beta code is already verified at /beta page before user reaches /auth
 * 3. Issue review_mode_grant entity signed by server signer
 * 4. Return grant details
 */

import { NextRequest, NextResponse } from 'next/server';
import { issueReviewModeGrant } from '@/lib/arkiv/reviewModeGrant';
import { getBetaAccessByWallet } from '@/lib/arkiv/betaAccess';
import { SPACE_ID } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subjectWallet } = body;

    if (!subjectWallet) {
      return NextResponse.json(
        { ok: false, error: 'subjectWallet is required' },
        { status: 400 }
      );
    }

    // Normalize wallet address
    const normalizedWallet = subjectWallet.toLowerCase().trim();

    // Check if beta_access exists
    // For review mode, auto-create beta_access if missing (review mode is independent dev-UI)
    let betaAccess = await getBetaAccessByWallet(normalizedWallet, SPACE_ID);
    
    if (!betaAccess) {
      // Review mode should auto-create beta_access if missing
      // This allows review mode to work with new wallets without requiring beta code flow
      console.log('[arkiv-review/grant] Beta access not found, auto-creating for review mode');
      
      const { createBetaAccess } = await import('@/lib/arkiv/betaAccess');
      const { getPrivateKey } = await import('@/lib/config');
      
      try {
        const { key, txHash } = await createBetaAccess({
          wallet: normalizedWallet,
          code: 'REVIEW_MODE', // Special code for review mode access
          privateKey: getPrivateKey(),
          spaceId: SPACE_ID,
        });
        
        console.log('[arkiv-review/grant] Beta access created for review mode', { key, txHash });
        
        // Re-fetch to get the created access
        betaAccess = await getBetaAccessByWallet(normalizedWallet, SPACE_ID);
        
        if (!betaAccess) {
          // Still not found after creation (indexing delay) - proceed anyway for review mode
          console.warn('[arkiv-review/grant] Beta access created but not yet queryable, proceeding for review mode');
        }
      } catch (error: any) {
        console.error('[arkiv-review/grant] Failed to create beta access for review mode:', error);
        // For review mode, proceed anyway (review mode is independent)
        // The grant will be issued even if beta_access creation failed
      }
    }

    // Issue grant using server signer
    const { key, txHash, expiresAt } = await issueReviewModeGrant({
      subjectWallet: normalizedWallet,
    });

    return NextResponse.json({
      ok: true,
      key,
      txHash,
      expiresAt,
    });
  } catch (error: any) {
    console.error('[arkiv-review/grant] POST error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to issue review mode grant' },
      { status: 500 }
    );
  }
}

