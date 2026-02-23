/**
 * Featured Quests API
 *
 * GET: Get currently featured quests for a network/space
 *
 * A network can feature a "quest of the week" by setting
 * featured=true and featuredUntil on quest definition entities.
 *
 * Week 4 (Feb 22-29) - Partner-ready weekly quests
 */

import { NextResponse } from 'next/server';
import { listQuestDefinitions } from '@/lib/arkiv/questDefinition';
import type { QuestDefinitionEntity } from '@/lib/arkiv/questDefinition';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const track = searchParams.get('track');
    const spaceId = searchParams.get('spaceId') || undefined;

    const allQuests = await listQuestDefinitions({
      track: track || undefined,
      spaceId,
    });

    // Filter for featured quests (featured attribute present and not expired)
    const now = new Date();
    const featuredQuests: QuestDefinitionEntity[] = [];
    const regularQuests: QuestDefinitionEntity[] = [];

    for (const quest of allQuests) {
      const questDef = quest.quest;
      const featured = questDef.featured === true;
      const featuredUntil = questDef.featuredUntil;

      if (featured && (!featuredUntil || new Date(featuredUntil) > now)) {
        featuredQuests.push(quest);
      } else {
        regularQuests.push(quest);
      }
    }

    return NextResponse.json({
      ok: true,
      featured: featuredQuests.map((q) => ({
        questId: q.questId,
        track: q.track,
        version: q.version,
        title: q.quest.title,
        description: q.quest.description,
        difficulty: q.quest.difficulty,
        stepCount: q.quest.steps?.length || 0,
        hasBadge: !!q.quest.badge,
        entityKey: q.key,
        featuredUntil: q.quest.featuredUntil,
      })),
      regular: regularQuests.map((q) => ({
        questId: q.questId,
        track: q.track,
        version: q.version,
        title: q.quest.title,
        description: q.quest.description,
        difficulty: q.quest.difficulty,
        stepCount: q.quest.steps?.length || 0,
        hasBadge: !!q.quest.badge,
        entityKey: q.key,
      })),
    });
  } catch (error: any) {
    console.error('[GET /api/quests/featured] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to get featured quests' },
      { status: 500 }
    );
  }
}
