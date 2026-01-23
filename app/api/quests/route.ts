/**
 * Quests API
 *
 * Phase 2: Entity-first quest serving with configurable fallback.
 * 
 * Modes (controlled by QUEST_ENTITY_MODE env var):
 * - 'entity': Entity-based quests only (Phase 2 - production)
 * - 'dual': Try entity first, fallback to file (Phase 1 - transition)
 * - 'file': File-based quests only (legacy, for development)
 *
 * GET /api/quests - List all available quests
 * GET /api/quests?trackId=arkiv - Get specific quest by track ID
 * GET /api/quests?questId=arkiv_builder&version=1 - Get specific quest version
 */

import { NextRequest, NextResponse } from 'next/server';
import { QUEST_ENTITY_MODE } from '@/lib/config';
import { listQuests, loadQuest } from '@/lib/quests';
import { 
  getLatestQuestDefinition, 
  getQuestDefinition, 
  listQuestDefinitions 
} from '@/lib/arkiv/questDefinition';

/**
 * Convert entity quest to LoadedQuest format with stepContent
 */
function entityQuestToLoadedQuest(questEntity: { quest: any }): any {
  return {
    ...questEntity.quest,
    stepContent: questEntity.quest.steps.reduce((acc: Record<string, string>, step: any) => {
      // Entity quests: content is inlined in step.content (added by sync script)
      if (step.content) {
        acc[step.stepId] = step.content;
      }
      return acc;
    }, {}),
  };
}

/**
 * Get quest by questId (entity-first)
 */
async function getQuestById(
  questId: string,
  version?: string | null
): Promise<{ quest: any; source: string } | null> {
  // Entity mode: only try entities
  if (QUEST_ENTITY_MODE === 'entity') {
    const questEntity = version
      ? await getQuestDefinition({ questId, version })
      : await getLatestQuestDefinition({ questId });

    if (questEntity && questEntity.quest) {
      return {
        quest: entityQuestToLoadedQuest(questEntity),
        source: 'entity',
      };
    }
    return null; // No fallback in entity mode
  }

  // Dual mode: try entity first, fallback to file
  if (QUEST_ENTITY_MODE === 'dual') {
    try {
      const questEntity = version
        ? await getQuestDefinition({ questId, version })
        : await getLatestQuestDefinition({ questId });

      if (questEntity && questEntity.quest) {
        return {
          quest: entityQuestToLoadedQuest(questEntity),
          source: 'entity',
        };
      }
    } catch (entityError) {
      console.warn('[/api/quests] Entity query failed, falling back to file:', entityError);
    }

    // Fallback to file
    const fileQuest = await loadQuest(questId);
    if (fileQuest) {
      return { quest: fileQuest, source: 'file' };
    }
    return null;
  }

  // File mode: only files
  const fileQuest = await loadQuest(questId);
  return fileQuest ? { quest: fileQuest, source: 'file' } : null;
}

/**
 * Get quest by trackId (entity-first)
 */
async function getQuestByTrackId(trackId: string): Promise<{ quest: any; source: string } | null> {
  // Entity mode: only try entities
  if (QUEST_ENTITY_MODE === 'entity') {
    const questEntities = await listQuestDefinitions({ track: trackId });
    if (questEntities.length > 0) {
      const latest = questEntities.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      if (latest && latest.quest) {
        return {
          quest: entityQuestToLoadedQuest(latest),
          source: 'entity',
        };
      }
    }
    return null; // No fallback in entity mode
  }

  // Dual mode: try entity first, fallback to file
  if (QUEST_ENTITY_MODE === 'dual') {
    try {
      const questEntities = await listQuestDefinitions({ track: trackId });
      if (questEntities.length > 0) {
        const latest = questEntities.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        if (latest && latest.quest) {
          return {
            quest: entityQuestToLoadedQuest(latest),
            source: 'entity',
          };
        }
      }
    } catch (entityError) {
      console.warn('[/api/quests] Entity query failed, falling back to file:', entityError);
    }

    // Fallback to file
    const fileQuest = await loadQuest(trackId);
    return fileQuest ? { quest: fileQuest, source: 'file' } : null;
  }

  // File mode: only files
  const fileQuest = await loadQuest(trackId);
  return fileQuest ? { quest: fileQuest, source: 'file' } : null;
}

/**
 * List all quests (entity-first)
 */
async function listAllQuests(): Promise<{ quests: any[]; source: string }> {
  // Entity mode: only entities
  if (QUEST_ENTITY_MODE === 'entity') {
    const entityQuests = await listQuestDefinitions();
    const quests = entityQuests.map((q) => ({
      questId: q.quest.questId,
      trackId: q.track,
      track: q.track,
      title: q.quest.title,
      description: q.quest.description,
      estimatedDuration: q.quest.estimatedDuration,
      difficulty: q.quest.difficulty,
      stepCount: q.quest.steps.length,
      hasBadge: !!q.quest.badge,
      version: q.version,
      source: 'entity' as const,
    }));
    return { quests, source: 'entity' };
  }

  // Dual mode: try entity first, fallback to file
  if (QUEST_ENTITY_MODE === 'dual') {
    try {
      const entityQuests = await listQuestDefinitions();
      if (entityQuests.length > 0) {
        const quests = entityQuests.map((q) => ({
          questId: q.quest.questId,
          trackId: q.track,
          track: q.track,
          title: q.quest.title,
          description: q.quest.description,
          estimatedDuration: q.quest.estimatedDuration,
          difficulty: q.quest.difficulty,
          stepCount: q.quest.steps.length,
          hasBadge: !!q.quest.badge,
          version: q.version,
          source: 'entity' as const,
        }));
        return { quests, source: 'entity' };
      }
    } catch (entityError) {
      console.warn('[/api/quests] Entity query failed, falling back to file:', entityError);
    }

    // Fallback to file
    const fileQuests = await listQuests();
    return {
      quests: fileQuests.map(q => ({ ...q, source: 'file' as const })),
      source: 'file',
    };
  }

  // File mode: only files
  const fileQuests = await listQuests();
  return {
    quests: fileQuests.map(q => ({ ...q, source: 'file' as const })),
    source: 'file',
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const trackId = searchParams.get('trackId');
    const questId = searchParams.get('questId');
    const version = searchParams.get('version');

    // Get specific quest by questId + version
    if (questId) {
      const result = await getQuestById(questId, version);
      if (!result) {
        return NextResponse.json(
          { ok: false, error: `Quest not found: ${questId}` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        ok: true,
        quest: result.quest,
        source: result.source,
      });
    }

    // Get specific quest by trackId
    if (trackId) {
      const result = await getQuestByTrackId(trackId);
      if (!result) {
        return NextResponse.json(
          { ok: false, error: `Quest not found: ${trackId}` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        ok: true,
        quest: result.quest,
        source: result.source,
      });
    }

    // List all quests
    const { quests, source } = await listAllQuests();
    return NextResponse.json({
      ok: true,
      quests,
      source,
    });
  } catch (error: any) {
    console.error('[/api/quests] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to load quests' },
      { status: 500 }
    );
  }
}
