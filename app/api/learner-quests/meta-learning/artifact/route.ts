/**
 * Meta-Learning Quest Artifact API route
 *
 * Handles artifact creation for meta-learning quest.
 *
 * Reference: refs/meta-learning-quest-implementation-plan.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMetaLearningArtifact } from '@/lib/arkiv/metaLearningQuest';
import { getPrivateKey } from '@/lib/config';
import { verifyBetaAccess } from '@/lib/auth/betaAccess';

/**
 * POST /api/learner-quests/meta-learning/artifact
 *
 * Create a meta-learning artifact (idempotent)
 * Body: { wallet, questId, stepId, artifactType, targetKey, ttlSeconds, idempotencyKey, data }
 */
export async function POST(request: NextRequest) {
  // Verify beta access
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
    const body = await request.json();
    const {
      wallet,
      questId,
      stepId,
      artifactType,
      targetKey,
      ttlSeconds,
      idempotencyKey,
      data,
    } = body;

    // Validate required fields
    if (!wallet || !questId || !stepId || !artifactType || !targetKey || !ttlSeconds || !idempotencyKey || !data) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: wallet, questId, stepId, artifactType, targetKey, ttlSeconds, idempotencyKey, data' },
        { status: 400 }
      );
    }

    // Validate ttlSeconds
    if (typeof ttlSeconds !== 'number' || ttlSeconds < 3600 || !Number.isInteger(ttlSeconds)) {
      return NextResponse.json(
        { ok: false, error: 'ttlSeconds must be an integer >= 3600 (1 hour)' },
        { status: 400 }
      );
    }

    // Use server-side private key for entity creation
    const privateKey = getPrivateKey();
    if (!privateKey) {
      return NextResponse.json(
        { ok: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const result = await createMetaLearningArtifact({
      wallet: wallet.toLowerCase(),
      questId,
      stepId,
      artifactType,
      targetKey,
      ttlSeconds,
      idempotencyKey,
      data,
      privateKey,
    });

    if (!result) {
      return NextResponse.json(
        { ok: false, error: 'Failed to create artifact' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      artifact: {
        key: result.key,
        txHash: result.txHash,
        stepId,
        artifactType,
      },
    });
  } catch (error: any) {
    console.error('[learner-quests/meta-learning/artifact] POST error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}

