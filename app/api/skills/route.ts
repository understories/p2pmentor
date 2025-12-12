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
  // Verify beta access
  const { verifyBetaAccess } = await import('@/lib/auth/betaAccess');
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
    // Arkiv needs time to index new entities, so retry with delays
    let newSkill: Awaited<ReturnType<typeof getSkillBySlug>> | null = null;
    const maxRetries = 5;
    const retryDelay = 1000; // Start with 1 second
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      newSkill = await getSkillBySlug(normalizedSlug);
      if (newSkill) {
        break;
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        const delay = retryDelay * Math.pow(2, attempt);
        console.log(`[api/skills] Skill not yet indexed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    if (!newSkill) {
      // Transaction was successful (we have key and txHash), but entity not yet queryable
      // Return success with pending status, similar to transaction timeout pattern
      return NextResponse.json({
        ok: true,
        skill: {
          key,
          name_canonical: name_canonical.trim(),
          slug: normalizedSlug,
          description: description?.trim() || undefined,
          status: 'active' as const,
          spaceId: 'local-dev',
          createdAt: new Date().toISOString(),
          txHash,
        },
        key,
        txHash,
        pending: true,
        message: 'Skill created successfully. It may take a moment to appear in queries.',
      });
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
