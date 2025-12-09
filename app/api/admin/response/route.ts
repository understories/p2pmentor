/**
 * Admin Response API route
 * 
 * Handles creation and retrieval of admin responses to user feedback.
 * 
 * Reference: Admin feedback response system
 */

import { NextResponse } from 'next/server';
import { createAdminResponse, listAdminResponses } from '@/lib/arkiv/adminResponse';
import { getPrivateKey } from '@/lib/config';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const feedbackKey = searchParams.get('feedbackKey') || undefined;

    if (!feedbackKey) {
      return NextResponse.json(
        { ok: false, error: 'feedbackKey parameter is required' },
        { status: 400 }
      );
    }

    const responses = await listAdminResponses({ feedbackKey });
    return NextResponse.json({ ok: true, responses });
  } catch (error: any) {
    console.error('Admin response API GET error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Check authentication (simple session check)
    // In production, you'd want more robust auth
    const body = await request.json();
    const { feedbackKey, wallet, message, adminWallet } = body;

    if (!feedbackKey || !wallet || !message || !adminWallet) {
      return NextResponse.json(
        { ok: false, error: 'feedbackKey, wallet, message, and adminWallet are required' },
        { status: 400 }
      );
    }

    // Validate message is not empty
    if (!message.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Response message cannot be empty' },
        { status: 400 }
      );
    }

    const { key, txHash } = await createAdminResponse({
      feedbackKey,
      wallet,
      message: message.trim(),
      adminWallet,
      privateKey: getPrivateKey(),
      spaceId: 'local-dev',
    });

    return NextResponse.json({ ok: true, key, txHash });
  } catch (error: any) {
    console.error('Admin response API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

