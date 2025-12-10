/**
 * Skills API route
 * 
 * Handles Skill entity listing and creation.
 * Arkiv-native: all skills are Arkiv entities.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listSkills, createSkill, getSkillBySlug } from '@/lib/arkiv/skill';
import { getPrivateKey } from '@/lib/config';

/**
 * GET /api/skills
 * 
 * List all active skills (or filter by slug)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'active' | 'archived' | null;
    const slug = searchParams.get('slug');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100;

    const skills = await listSkills({
      status: status || 'active',
      slug: slug || undefined,
      limit,
    });

    return NextResponse.json({ ok: true, skills });
  } catch (error: any) {
    console.error('[api/skills] Error listing skills:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to list skills' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/skills
 * 
 * Create a new Skill entity
 * Body: { name_canonical: string, description?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name_canonical, description } = body;

    if (!name_canonical || !name_canonical.trim()) {
      return NextResponse.json(
        { ok: false, error: 'name_canonical is required' },
        { status: 400 }
      );
    }

    // Check if skill already exists by slug
    const normalizedSlug = name_canonical.toLowerCase().trim().replace(/\s+/g, '-');
    const existing = await getSkillBySlug(normalizedSlug);
    if (existing) {
      return NextResponse.json({
        ok: true,
        skill: existing,
        message: 'Skill already exists',
        alreadyExists: true,
      });
    }

    // Create new skill entity
    const { key, txHash } = await createSkill({
      name_canonical: name_canonical.trim(),
      description: description?.trim() || undefined,
      privateKey: getPrivateKey(),
      spaceId: 'local-dev',
    });

    // Fetch the newly created skill to return
    const newSkill = await getSkillBySlug(normalizedSlug);
    if (!newSkill) {
      return NextResponse.json(
        { ok: false, error: 'Skill created but could not be retrieved' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      skill: newSkill,
      key,
      txHash,
    });
  } catch (error: any) {
    console.error('[api/skills] Error creating skill:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create skill' },
      { status: 500 }
    );
  }
}
