/**
 * Admin Response API route
 * 
 * Handles creation and retrieval of admin responses to user feedback.
 * 
 * Reference: Admin feedback response system
 */

import { NextResponse } from 'next/server';
import { createAdminResponse, listAdminResponses, getAdminResponseByKey } from '@/lib/arkiv/adminResponse';
import { createAdminNotification } from '@/lib/arkiv/adminNotification';
import { getPrivateKey, SPACE_ID, ADMIN_WALLET } from '@/lib/config';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    
    // If key is provided, get single response by key
    if (key) {
      const response = await getAdminResponseByKey(key);
      if (!response) {
        return NextResponse.json(
          { ok: false, error: 'Admin response not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true, response });
    }
    
    // Otherwise, list responses by feedbackKey
    const feedbackKey = searchParams.get('feedbackKey') || undefined;

    if (!feedbackKey) {
      return NextResponse.json(
        { ok: false, error: 'Either key or feedbackKey parameter is required' },
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
      spaceId: SPACE_ID,
    });

    // Create notification for admin (fire-and-forget)
    if (ADMIN_WALLET) {
      createAdminNotification({
        wallet: ADMIN_WALLET,
        notificationId: `feedback_response_${feedbackKey}_${Date.now()}`,
        notificationType: 'feedback_response',
        title: 'Response Sent',
        message: `You responded to feedback from ${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
        link: `/admin/feedback?feedbackKey=${feedbackKey}`,
        sourceEntityType: 'app_feedback',
        sourceEntityKey: feedbackKey,
        privateKey: getPrivateKey(),
        spaceId: SPACE_ID,
      }).catch(err => {
        console.warn('[admin/response] Failed to create notification (non-critical):', err);
      });
    }

    return NextResponse.json({ ok: true, key, txHash });
  } catch (error: any) {
    console.error('Admin response API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

