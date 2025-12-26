/**
 * Create Learner Quest API route
 *
 * Allows users to create their own reading list quests.
 * Focus: Reading list quests first (higher priority than language assessments).
 *
 * Reference: refs/resilient-learner-quests-plan.md Phase 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLearnerQuest } from '@/lib/arkiv/learnerQuest';
import { getPrivateKey, SPACE_ID } from '@/lib/config';
import { verifyBetaAccess } from '@/lib/auth/betaAccess';
import type { LearnerQuestMaterial } from '@/lib/arkiv/learnerQuest';

/**
 * POST /api/learner-quests/create
 *
 * Create a new reading list quest
 * Body: { questId, title, description, materials, wallet }
 */
export async function POST(request: NextRequest) {
  // 1. Verify beta access
  const betaCheck = await verifyBetaAccess(request, {
    requireArkivValidation: false, // Fast path - cookies are sufficient
  });

  if (!betaCheck.hasAccess) {
    return NextResponse.json(
      { ok: false, error: betaCheck.error || 'Beta access required. Please enter invite code at /beta' },
      { status: 403 }
    );
  }

  try {
    // 2. Parse quest data from body
    const body = await request.json();
    const { questId, title, description, materials, wallet } = body;

    // 3. Validate required fields
    if (!questId || !title || !description || !materials || !wallet) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: questId, title, description, materials, wallet' },
        { status: 400 }
      );
    }

    // 4. Validate materials array
    if (!Array.isArray(materials) || materials.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Reading list quests require at least one material' },
        { status: 400 }
      );
    }

    // 5. Validate each material has required fields
    for (const material of materials) {
      if (!material.id || !material.title || !material.url) {
        return NextResponse.json(
          { ok: false, error: 'Each material must have id, title, and url' },
          { status: 400 }
        );
      }
    }

    // 6. Normalize wallet address
    const normalizedWallet = wallet.toLowerCase();

    // 7. Get server-side private key for entity creation
    const privateKey = getPrivateKey();
    if (!privateKey) {
      return NextResponse.json(
        { ok: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // 8. Create quest with creatorWallet
    const result = await createLearnerQuest({
      questId,
      title,
      description,
      source: `user:${normalizedWallet}`, // Indicate user-created
      materials: materials as LearnerQuestMaterial[],
      questType: 'reading_list', // Focus on reading lists first
      creatorWallet: normalizedWallet, // Track creator
      questVersion: '1', // First version
      privateKey,
      spaceId: SPACE_ID,
      // steps and metadata are undefined for reading_list quests
    });

    if (!result) {
      return NextResponse.json(
        { ok: false, error: 'Failed to create quest' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      quest: {
        questId,
        title,
        description,
        key: result.key,
        txHash: result.txHash,
      },
    });
  } catch (error: any) {
    console.error('[learner-quests/create] POST error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create quest' },
      { status: 500 }
    );
  }
}

