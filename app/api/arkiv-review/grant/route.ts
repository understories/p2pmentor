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

