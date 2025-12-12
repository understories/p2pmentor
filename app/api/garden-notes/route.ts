/**
 * Garden Notes API route
 * 
 * Handles creation and listing of public garden notes (bulletin board).
 * 
 * Features:
 * - Public by design (anyone can read)
 * - On-chain / on-Arkiv (stored as Arkiv entity)
 * - Educational (explicit consent, blockchain teaching moments)
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  createGardenNote, 
  listGardenNotes, 
  getGardenNoteByKey,
  hasExceededDailyLimit,
  GARDEN_NOTE_MAX_LENGTH,
  GARDEN_NOTE_DAILY_LIMIT,
} from '@/lib/arkiv/gardenNote';
import { getPrivateKey, CURRENT_WALLET } from '@/lib/config';
import { verifyBetaAccess } from '@/lib/auth/betaAccess';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel') || 'public_garden_board';
    const targetWallet = searchParams.get('targetWallet') || undefined;
    const authorWallet = searchParams.get('authorWallet') || undefined;
    const tags = searchParams.get('tags') ? searchParams.get('tags')!.split(',') : undefined;
    const key = searchParams.get('key') || undefined;

    // Get single note by key
    if (key) {
      const note = await getGardenNoteByKey(key);
      if (!note) {
        return NextResponse.json(
          { ok: false, error: 'Garden note not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true, note });
    }

    // List notes
    const notes = await listGardenNotes({
      channel,
      targetWallet,
      authorWallet,
      tags,
      limit: 100,
    });

    return NextResponse.json({ ok: true, notes });
  } catch (error: any) {
    console.error('Error in GET /api/garden-notes:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch garden notes' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      wallet, 
      targetWallet, 
      message, 
      tags = [], 
      replyToNoteId,
      publishConsent,
    } = body;

    // Validate wallet
    const authorWallet = wallet || CURRENT_WALLET || '';
    if (!authorWallet) {
      return NextResponse.json(
        { ok: false, error: 'No wallet address provided' },
        { status: 400 }
      );
    }

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    if (message.length > GARDEN_NOTE_MAX_LENGTH) {
      return NextResponse.json(
        { ok: false, error: `Message cannot exceed ${GARDEN_NOTE_MAX_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Validate publish consent (must be explicit)
    if (!publishConsent) {
      return NextResponse.json(
        { ok: false, error: 'Publish consent must be explicitly granted' },
        { status: 400 }
      );
    }

    // Check daily limit
    const exceeded = await hasExceededDailyLimit(authorWallet);
    if (exceeded) {
      return NextResponse.json(
        { 
          ok: false, 
          error: `Daily limit reached. You can post up to ${GARDEN_NOTE_DAILY_LIMIT} notes per day.` 
        },
        { status: 429 }
      );
    }

    // Create garden note
    const { key, txHash } = await createGardenNote({
      authorWallet,
      targetWallet: targetWallet || undefined,
      message: message.trim(),
      tags: Array.isArray(tags) ? tags : [],
      replyToNoteId: replyToNoteId || undefined,
      privateKey: getPrivateKey(),
      publishConsent: true, // Already validated above
    });

    return NextResponse.json({ 
      ok: true, 
      key, 
      txHash,
      message: 'Garden note published successfully',
    });
  } catch (error: any) {
    console.error('Error in POST /api/garden-notes:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create garden note' },
      { status: 500 }
    );
  }
}

