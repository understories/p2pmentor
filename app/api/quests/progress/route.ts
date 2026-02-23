/**
 * Quest Progress API
 *
 * Records and retrieves quest step progress.
 *
 * GET /api/quests/progress?wallet=0x...&questId=arkiv_builder
 * POST /api/quests/progress - Record step completion
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrivateKey, ARKIV_PRIVATE_KEY } from '@/lib/config';
import {
  createQuestStepProgress,
  getQuestStepProgress,
  calculateQuestCompletion,
} from '@/lib/arkiv/questProgress';
import { createStepEvidence, type QuestStepType } from '@/lib/arkiv/questStep';
import { getRequiredStepIds } from '@/lib/quests';
import { logTelemetryEvent } from '@/lib/arkiv/questTelemetry';

/**
 * GET - Retrieve quest progress for a user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet');
    const questId = searchParams.get('questId');
    const trackId = searchParams.get('trackId'); // Optional: for loading quest definition

    if (!wallet) {
      return NextResponse.json({ ok: false, error: 'wallet is required' }, { status: 400 });
    }

    if (!questId) {
      return NextResponse.json({ ok: false, error: 'questId is required' }, { status: 400 });
    }

    // Get progress (uses questId from stored entities)
    const progress = await getQuestStepProgress({ wallet, questId });

    // Get required steps for completion calculation
    // Use trackId if provided, otherwise try questId as trackId
    const requiredStepIds = trackId
      ? await getRequiredStepIds(trackId)
      : await getRequiredStepIds(questId);
    const totalSteps = requiredStepIds.length || progress.length;

    const completion = await calculateQuestCompletion({
      wallet,
      questId,
      totalSteps,
      requiredStepIds,
    });

    return NextResponse.json({
      ok: true,
      progress,
      completion,
    });
  } catch (error: any) {
    console.error('[/api/quests/progress GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to load progress' },
      { status: 500 }
    );
  }
}

/**
 * POST - Record step completion
 */
export async function POST(request: NextRequest) {
  let parsedQuestId = 'unknown';
  let parsedStepId = 'unknown';
  try {
    const body = await request.json();
    const { wallet, questId, stepId, stepType, evidenceData } = body;
    parsedQuestId = questId || 'unknown';
    parsedStepId = stepId || 'unknown';

    // Validate required fields
    if (!wallet) {
      return NextResponse.json({ ok: false, error: 'wallet is required' }, { status: 400 });
    }
    if (!questId) {
      return NextResponse.json({ ok: false, error: 'questId is required' }, { status: 400 });
    }
    if (!stepId) {
      return NextResponse.json({ ok: false, error: 'stepId is required' }, { status: 400 });
    }
    if (!stepType) {
      return NextResponse.json({ ok: false, error: 'stepType is required' }, { status: 400 });
    }

    // Validate stepType
    const validStepTypes: QuestStepType[] = ['READ', 'DO', 'QUIZ', 'SUBMIT', 'SESSION', 'VERIFY'];
    if (!validStepTypes.includes(stepType)) {
      return NextResponse.json(
        { ok: false, error: `Invalid stepType: ${stepType}` },
        { status: 400 }
      );
    }

    // Get private key for server-side signing
    const privateKey = getPrivateKey();

    // Create evidence for this step type
    const evidence = createStepEvidence(stepType, stepId, evidenceData || {});

    // Record progress
    const result = await createQuestStepProgress({
      wallet,
      questId,
      stepId,
      stepType,
      evidence,
      privateKey,
    });

    if (result.status === 'error') {
      if (ARKIV_PRIVATE_KEY) {
        logTelemetryEvent({
          eventType: 'step_completion_error',
          questId,
          stepId,
          errorType: 'entity_creation_failed',
          errorMessage: result.error,
          privateKey,
        }).catch(() => {});
      }
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      key: result.key,
      txHash: result.txHash,
      status: result.status,
    });
  } catch (error: any) {
    console.error('[/api/quests/progress POST] Error:', error);
    if (ARKIV_PRIVATE_KEY) {
      try {
        logTelemetryEvent({
          eventType: 'step_completion_error',
          questId: parsedQuestId,
          stepId: parsedStepId,
          errorType: 'unexpected_error',
          errorMessage: error?.message,
          privateKey: getPrivateKey(),
        }).catch(() => {});
      } catch {
        // getPrivateKey() itself failed — skip telemetry
      }
    }
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to record progress' },
      { status: 500 }
    );
  }
}
