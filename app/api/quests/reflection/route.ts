/**
 * Quest Reflection API
 *
 * POST: Create a reflection for a quest step
 * GET: Get reflections for a user/quest
 *
 * Week 2 (Feb 8-14) - Intrinsic motivation design
 */

import { NextResponse } from 'next/server';
import { createQuestReflection, getQuestReflections } from '@/lib/arkiv/reflection';
import { isTransactionTimeoutError } from '@/lib/arkiv/transaction-utils';
import { getPrivateKey } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet, questId, stepId, prompt, reflectionText, visibility, progressEntityKey } = body;

    if (!wallet || !questId || !stepId || !reflectionText) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: wallet, questId, stepId, reflectionText' },
        { status: 400 }
      );
    }

    if (reflectionText.length < 10) {
      return NextResponse.json(
        { ok: false, error: 'Reflection must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (reflectionText.length > 2000) {
      return NextResponse.json(
        { ok: false, error: 'Reflection must be under 2000 characters' },
        { status: 400 }
      );
    }

    const privateKey = getPrivateKey();

    try {
      const result = await createQuestReflection({
        wallet,
        questId,
        stepId,
        prompt: prompt || 'Explain in your own words',
        reflectionText,
        visibility: visibility || 'private',
        progressEntityKey,
        privateKey,
      });

      return NextResponse.json({
        ok: true,
        reflection: { key: result.key, txHash: result.txHash },
      });
    } catch (error: any) {
      if (isTransactionTimeoutError(error)) {
        return NextResponse.json({
          ok: true,
          reflection: { key: null, txHash: null },
          pending: true,
          message: error.message || 'Transaction submitted, confirmation pending',
        });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('[POST /api/quests/reflection] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create reflection' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const questId = searchParams.get('questId');
    const stepId = searchParams.get('stepId');
    const visibility = searchParams.get('visibility') as 'private' | 'public' | null;

    const reflections = await getQuestReflections({
      wallet: wallet || undefined,
      questId: questId || undefined,
      stepId: stepId || undefined,
      visibility: visibility || undefined,
    });

    return NextResponse.json({ ok: true, reflections });
  } catch (error: any) {
    console.error('[GET /api/quests/reflection] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to get reflections' },
      { status: 500 }
    );
  }
}
