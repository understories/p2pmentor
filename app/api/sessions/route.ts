/**
 * Sessions API route
 * 
 * Handles session creation, listing, and confirmation.
 * 
 * Based on mentor-graph implementation, adapted for Next.js App Router.
 * 
 * Reference: refs/mentor-graph/pages/api/me.ts (createSession action)
 */

import { NextResponse } from 'next/server';
import { createSession, listSessions, listSessionsForWallet, confirmSession, rejectSession } from '@/lib/arkiv/sessions';
import { getPrivateKey, CURRENT_WALLET } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, wallet, mentorWallet, learnerWallet, skill, sessionDate, duration, notes, sessionKey, confirmedByWallet, rejectedByWallet } = body;

    // Use wallet from request, fallback to CURRENT_WALLET for example wallet
    const targetWallet = wallet || CURRENT_WALLET || '';
    if (!targetWallet) {
      return NextResponse.json(
        { ok: false, error: 'No wallet address provided' },
        { status: 400 }
      );
    }

    if (action === 'createSession') {
      if (!mentorWallet || !learnerWallet || !skill || !sessionDate) {
        return NextResponse.json(
          { ok: false, error: 'mentorWallet, learnerWallet, skill, and sessionDate are required' },
          { status: 400 }
        );
      }

      try {
        const { key, txHash } = await createSession({
          mentorWallet,
          learnerWallet,
          skill,
          sessionDate,
          duration: duration ? parseInt(duration, 10) : undefined,
          notes: notes || undefined,
          privateKey: getPrivateKey(),
        });

        return NextResponse.json({ ok: true, key, txHash });
      } catch (error: any) {
        // Handle transaction receipt timeout gracefully
        // If error mentions pending confirmation, return partial success
        if (error.message?.includes('confirmation pending') || error.message?.includes('Transaction submitted')) {
          // Transaction was submitted but receipt not available - this is OK for testnets
          // Return success with a note that confirmation is pending
          return NextResponse.json({ 
            ok: true, 
            key: null, // Entity key not available yet
            txHash: null, // TxHash not available yet
            pending: true,
            message: error.message || 'Transaction submitted, confirmation pending'
          });
        }
        throw error; // Re-throw other errors
      }
    } else if (action === 'confirmSession') {
      if (!sessionKey || !confirmedByWallet) {
        return NextResponse.json(
          { ok: false, error: 'sessionKey and confirmedByWallet are required' },
          { status: 400 }
        );
      }

      const { key, txHash } = await confirmSession({
        sessionKey,
        confirmedByWallet,
        privateKey: getPrivateKey(),
        mentorWallet,
        learnerWallet,
      });

      return NextResponse.json({ ok: true, key, txHash });
    } else if (action === 'rejectSession') {
      if (!sessionKey || !rejectedByWallet) {
        return NextResponse.json(
          { ok: false, error: 'sessionKey and rejectedByWallet are required' },
          { status: 400 }
        );
      }

      const { key, txHash } = await rejectSession({
        sessionKey,
        rejectedByWallet,
        privateKey: getPrivateKey(),
        mentorWallet,
        learnerWallet,
      });

      return NextResponse.json({ ok: true, key, txHash });
    } else {
      return NextResponse.json(
        { ok: false, error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Sessions API error:', error);
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
    const mentorWallet = searchParams.get('mentorWallet') || undefined;
    const learnerWallet = searchParams.get('learnerWallet') || undefined;
    const skill = searchParams.get('skill') || undefined;
    const status = searchParams.get('status') || undefined;
    const spaceId = searchParams.get('spaceId') || undefined;

    if (wallet) {
      // List sessions for specific wallet
      const sessions = await listSessionsForWallet(wallet);
      return NextResponse.json({ ok: true, sessions });
    } else {
      // List all sessions (with optional filters)
      const sessions = await listSessions({
        mentorWallet,
        learnerWallet,
        skill,
        status,
        spaceId,
      });
      return NextResponse.json({ ok: true, sessions });
    }
  } catch (error: any) {
    console.error('Sessions API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

