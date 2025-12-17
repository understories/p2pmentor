/**
 * Learner Quests API route
 *
 * Handles quest definition fetching and progress tracking.
 *
 * Reference: refs/learner-quests-implementation-plan.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLearnerQuest, listLearnerQuests, markMaterialAsRead } from '@/lib/arkiv/learnerQuest';
import { getPrivateKey, SPACE_ID } from '@/lib/config';
import { verifyBetaAccess } from '@/lib/auth/betaAccess';

/**
 * GET /api/learner-quests
 *
 * Fetch quest(s)
 * Query params:
 *   - questId: optional, fetch specific quest by ID
 *   - If no questId, returns all active quests
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const questId = searchParams.get('questId');
    const questType = searchParams.get('questType') as 'reading_list' | 'language_assessment' | null;

    // Check if builder mode is enabled (from query param)
    const builderMode = searchParams.get('builderMode') === 'true';

    // Get spaceId(s) from query params or use default
    const spaceIdParam = searchParams.get('spaceId');
    const spaceIdsParam = searchParams.get('spaceIds');

    let spaceId: string | undefined;
    let spaceIds: string[] | undefined;

    if (builderMode && spaceIdsParam) {
      // Builder mode: query multiple spaceIds
      spaceIds = spaceIdsParam.split(',').map(s => s.trim());
    } else if (spaceIdParam) {
      // Override default spaceId
      spaceId = spaceIdParam;
    } else {
      // Use default from config
      spaceId = SPACE_ID;
    }

    if (questId) {
      // Fetch specific quest
      const quest = await getLearnerQuest(questId);
      if (!quest) {
        return NextResponse.json({ ok: false, error: 'Quest not found' }, { status: 404 });
      }

      // For language assessment quests, we need to include the payload
      // (which contains sections and questions)
      if (quest.questType === 'language_assessment') {
        const publicClient = (await import('@/lib/arkiv/client')).getPublicClient();
        const result = await publicClient.buildQuery()
          .where((await import('@arkiv-network/sdk/query')).eq('type', 'learner_quest'))
          .where((await import('@arkiv-network/sdk/query')).eq('questId', questId))
          .where((await import('@arkiv-network/sdk/query')).eq('status', 'active'))
          .withAttributes(true)
          .withPayload(true)
          .limit(1)
          .fetch();

        if (result?.entities && result.entities.length > 0) {
          const entity = result.entities[0];
          const decoded = entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
            ? entity.payload
            : JSON.stringify(entity.payload);
          const payload = JSON.parse(decoded);

          return NextResponse.json({
            ok: true,
            quest: {
              ...quest,
              payload, // Include full payload for language assessment quests
            },
          });
        }
      }

      return NextResponse.json({ ok: true, quest });
    } else {
      // List all active quests, optionally filtered by questType and spaceId
      console.log('[learner-quests] Querying quests with:', {
        questType,
        spaceId,
        spaceIds,
        SPACE_ID,
        builderMode,
      });
      const quests = await listLearnerQuests({
        ...(questType ? { questType } : {}),
        ...(spaceId ? { spaceId } : {}),
        ...(spaceIds ? { spaceIds } : {}),
      });
      console.log('[learner-quests] Found quests:', {
        count: quests.length,
        questIds: quests.map(q => q.questId),
        spaceIds: quests.map(q => q.spaceId),
      });
      return NextResponse.json({ ok: true, quests, count: quests.length });
    }
  } catch (error: any) {
    console.error('[learner-quests] GET error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch quests' }, { status: 500 });
  }
}

/**
 * POST /api/learner-quests
 *
 * Mark material as read (creates progress entity)
 * Body: { action: 'markRead', questId, materialId, sourceUrl, wallet }
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
    const { action, questId, materialId, sourceUrl, wallet } = body;

    if (action === 'markRead') {
      if (!questId || !materialId || !sourceUrl || !wallet) {
        return NextResponse.json(
          { ok: false, error: 'Missing required fields: questId, materialId, sourceUrl, wallet' },
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

      const result = await markMaterialAsRead({
        wallet: wallet.toLowerCase(),
        questId,
        materialId,
        sourceUrl,
        privateKey,
      });

      if (!result) {
        return NextResponse.json(
          { ok: false, error: 'Failed to mark material as read' },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, progress: result });
    }

    return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[learner-quests] POST error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}

