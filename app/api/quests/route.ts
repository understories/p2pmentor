/**
 * Quests API
 *
 * Dual-mode quest serving: Entity-first with file fallback.
 * 
 * Phase 1 (Current): Try entity query first, fallback to file-based quests.
 * Phase 2 (Future): Entity-first, files only for development.
 *
 * GET /api/quests - List all available quests
 * GET /api/quests?trackId=arkiv - Get specific quest by track ID
 * GET /api/quests?questId=arkiv_builder&version=1 - Get specific quest version
 */

import { NextRequest, NextResponse } from 'next/server';
import { listQuests, loadQuest, loadQuestDefinition } from '@/lib/quests';
import { 
  getLatestQuestDefinition, 
  getQuestDefinition, 
  listQuestDefinitions 
} from '@/lib/arkiv/questDefinition';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const trackId = searchParams.get('trackId');
    const questId = searchParams.get('questId');
    const version = searchParams.get('version');

    // Get specific quest by questId + version (entity-first)
    if (questId) {
      try {
        // Try entity query first
        const questEntity = version
          ? await getQuestDefinition({ questId, version })
          : await getLatestQuestDefinition({ questId });

        if (questEntity && questEntity.quest) {
          // Convert entity quest to LoadedQuest format (with stepContent)
          // Note: Entity quests have markdown content inlined in step.content
          // (added by sync script), while file-based quests use contentFile
          const loadedQuest = {
            ...questEntity.quest,
            stepContent: questEntity.quest.steps.reduce((acc, step) => {
              // Entity quests: content is inlined in step.content (added by sync script)
              if ((step as any).content) {
                acc[step.stepId] = (step as any).content;
              }
              return acc;
            }, {} as Record<string, string>),
          };

          return NextResponse.json({ 
            ok: true, 
            quest: loadedQuest,
            source: 'entity', // Indicate source for debugging
          });
        }
      } catch (entityError) {
        console.warn('[/api/quests] Entity query failed, falling back to file:', entityError);
      }

      // Fallback: Try to find quest by trackId (if questId maps to trackId)
      // This is a temporary bridge during migration
      const fileQuest = await loadQuest(questId);
      if (fileQuest) {
        return NextResponse.json({ 
          ok: true, 
          quest: fileQuest,
          source: 'file', // Indicate source for debugging
        });
      }

      return NextResponse.json(
        { ok: false, error: `Quest not found: ${questId}` },
        { status: 404 }
      );
    }

    // Get specific quest by trackId (file-based, for backward compatibility)
    if (trackId) {
      // Try entity query first (by track)
      try {
        const questEntities = await listQuestDefinitions({ track: trackId });
        if (questEntities.length > 0) {
          // Get latest version
          const latest = questEntities.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];

          if (latest && latest.quest) {
            const loadedQuest = {
              ...latest.quest,
              stepContent: latest.quest.steps.reduce((acc, step) => {
                // Entity quests: content is inlined in step.content
                if ((step as any).content) {
                  acc[step.stepId] = (step as any).content;
                }
                return acc;
              }, {} as Record<string, string>),
            };

            return NextResponse.json({ 
              ok: true, 
              quest: loadedQuest,
              source: 'entity',
            });
          }
        }
      } catch (entityError) {
        console.warn('[/api/quests] Entity query failed, falling back to file:', entityError);
      }

      // Fallback to file-based
      const quest = await loadQuest(trackId);
      if (!quest) {
        return NextResponse.json(
          { ok: false, error: `Quest not found: ${trackId}` },
          { status: 404 }
        );
      }
      return NextResponse.json({ 
        ok: true, 
        quest,
        source: 'file',
      });
    }

    // List all quests (dual-mode: combine entities + files)
    try {
      // Try entity query first
      const entityQuests = await listQuestDefinitions();
      
      if (entityQuests.length > 0) {
        // Convert to quest summary format
        const quests = entityQuests.map((q) => ({
          questId: q.quest.questId,
          trackId: q.track, // Use track as trackId for URL routing
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

        return NextResponse.json({ 
          ok: true, 
          quests,
          source: 'entity',
        });
      }
    } catch (entityError) {
      console.warn('[/api/quests] Entity query failed, falling back to file:', entityError);
    }

    // Fallback to file-based
    const fileQuests = await listQuests();
    return NextResponse.json({ 
      ok: true, 
      quests: fileQuests.map(q => ({ ...q, source: 'file' as const })),
      source: 'file',
    });
  } catch (error: any) {
    console.error('[/api/quests] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to load quests' },
      { status: 500 }
    );
  }
}
