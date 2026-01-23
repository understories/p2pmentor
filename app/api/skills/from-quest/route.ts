/**
 * Skills from Quest API
 *
 * Handles skill creation and linking from quest step completion.
 * Creates skill entity if needed, then creates quest_completion_skill_link.
 *
 * Week 1 (Feb 1-7) - Skill linkage feature
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrivateKey, SPACE_ID } from '@/lib/config';
import { createSkill, getSkillBySlug, normalizeSkillSlug, ensureSkillEntity } from '@/lib/arkiv/skill';
import { createQuestCompletionSkillLink } from '@/lib/arkiv/questSkillLink';
import { getQuestStepProgress } from '@/lib/arkiv/questProgress';

/**
 * POST /api/skills/from-quest
 *
 * Create or link skill from quest step completion.
 * Body: { skillName, stepId, questId, proficiency?, progressEntityKey? }
 */
export async function POST(request: NextRequest) {
  // Verify beta access
  const { verifyBetaAccess } = await import('@/lib/auth/betaAccess');
  const betaCheck = await verifyBetaAccess(request, {
    requireArkivValidation: false,
  });

  if (!betaCheck.hasAccess) {
    return NextResponse.json(
      { ok: false, error: betaCheck.error || 'Beta access required' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { skillName, stepId, questId, proficiency, progressEntityKey, wallet } = body;

    if (!skillName || !stepId || !questId || !wallet) {
      return NextResponse.json(
        { ok: false, error: 'skillName, stepId, questId, and wallet are required' },
        { status: 400 }
      );
    }

    const privateKey = getPrivateKey();

    // Ensure skill entity exists (creates if needed)
    const skillEntity = await ensureSkillEntity(skillName);
    if (!skillEntity) {
      return NextResponse.json(
        { ok: false, error: 'Failed to create or find skill entity' },
        { status: 500 }
      );
    }

    // Get progress entity key if not provided
    let finalProgressEntityKey = progressEntityKey;
    if (!finalProgressEntityKey) {
      const progress = await getQuestStepProgress({
        wallet,
        questId,
        spaceId: SPACE_ID,
      });
      const stepProgress = progress.find((p) => p.stepId === stepId);
      if (stepProgress) {
        finalProgressEntityKey = stepProgress.key;
      } else {
        return NextResponse.json(
          { ok: false, error: 'Step progress not found. Complete the step first.' },
          { status: 400 }
        );
      }
    }

    // Create quest completion skill link
    const linkResult = await createQuestCompletionSkillLink({
      wallet,
      questId,
      stepId,
      skillId: skillEntity.key,
      skillName: skillEntity.name_canonical,
      proficiency,
      progressEntityKey: finalProgressEntityKey,
      privateKey,
      spaceId: SPACE_ID,
    });

    return NextResponse.json({
      ok: true,
      skill: skillEntity,
      link: {
        key: linkResult.key,
        txHash: linkResult.txHash,
      },
    });
  } catch (error: any) {
    console.error('[/api/skills/from-quest] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to link skill from quest' },
      { status: 500 }
    );
  }
}
