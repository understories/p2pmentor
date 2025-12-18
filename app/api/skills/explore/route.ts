/**
 * Skills Explore API route
 * 
 * Lists all skill entities with profile counts (how many profiles have each skill).
 */

import { NextResponse } from 'next/server';
import { listSkills, normalizeSkillSlug } from '@/lib/arkiv/skill';
import { listUserProfiles } from '@/lib/arkiv/profile';
import { SPACE_ID } from '@/lib/config';
import type { Skill } from '@/lib/arkiv/skill';

export async function GET(request: Request) {
  try {
    // Check if builder mode is enabled (from query param)
    const { searchParams } = new URL(request.url);
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

    // Get all skills (with space ID filtering)
    // Use a high limit to ensure we get all skills (Arkiv may have many skills)
    const skills = await listSkills({ status: 'active', spaceId, spaceIds, limit: 1000 });
    
    // Log for debugging
    console.log('[api/skills/explore] Skills query:', {
      spaceId,
      spaceIds,
      skillsFound: skills.length,
      skillNames: skills.slice(0, 5).map(s => s.name_canonical),
    });
    
    // Get all profiles (with same space ID filtering)
    const allProfiles = await listUserProfiles({ spaceId, spaceIds });
    
    console.log('[api/skills/explore] Profiles query:', {
      spaceId,
      spaceIds,
      profilesFound: allProfiles.length,
    });
    
    // Deduplicate profiles by wallet (most recent for each wallet)
    // This ensures consistent counts with /api/profiles which also deduplicates
    // Reuse same logic as /api/profiles/route.ts for consistency
    const profilesMap = new Map<string, typeof allProfiles[0]>();
    allProfiles.forEach((profile) => {
      const existing = profilesMap.get(profile.wallet);
      if (!existing || (profile.createdAt && existing.createdAt && new Date(profile.createdAt) > new Date(existing.createdAt))) {
        profilesMap.set(profile.wallet, profile);
      }
    });
    
    const profiles = Array.from(profilesMap.values());
    
    console.log('[api/skills/explore] Deduplicated profiles:', {
      beforeDedupe: allProfiles.length,
      afterDedupe: profiles.length,
      uniqueWallets: profiles.length,
    });
    
    // Deduplicate skills by name_canonical (case-insensitive) or slug
    // If duplicates exist, keep the most recent one (by createdAt) and merge profile counts
    const skillMap = new Map<string, Skill & { profileCount: number; allKeys: string[] }>();
    
    skills.forEach(skill => {
      // Use normalized name_canonical as the deduplication key (case-insensitive)
      const dedupeKey = skill.name_canonical.toLowerCase().trim();
      const existing = skillMap.get(dedupeKey);
      
      if (existing) {
        // Duplicate found - keep the most recent one (by createdAt)
        const existingDate = new Date(existing.createdAt).getTime();
        const currentDate = new Date(skill.createdAt).getTime();
        
        if (currentDate > existingDate) {
          // Current skill is newer - replace existing
          skillMap.set(dedupeKey, {
            ...skill,
            profileCount: 0, // Will be calculated below
            allKeys: [...existing.allKeys, skill.key],
          });
        } else {
          // Existing skill is newer or same - keep it, but track the duplicate key
          existing.allKeys.push(skill.key);
        }
      } else {
        // New skill - add to map
        skillMap.set(dedupeKey, {
          ...skill,
          profileCount: 0, // Will be calculated below
          allKeys: [skill.key],
        });
      }
    });
    
    // Count profiles for each deduplicated skill
    // For duplicates, count profiles that reference ANY of the duplicate skill keys
    // IMPORTANT: Only count profiles that match the skill's spaceId to ensure accurate counts
    const skillsWithCounts = Array.from(skillMap.values()).map(skill => {
      let count = 0;
      
      profiles.forEach(profile => {
        // CRITICAL: Only count profiles from the same spaceId as the skill
        // This ensures accurate counts when querying multiple spaceIds or different environments
        if (profile.spaceId !== skill.spaceId) {
          return; // Skip profiles from different spaceIds
        }
        
        // Check if profile has this skill
        // Check skill_ids array (new format) - check against all duplicate keys
        const skillIds = (profile as any).skill_ids || [];
        if (skill.allKeys.some(key => skillIds.includes(key))) {
          count++;
          return;
        }
        
        // Check skillsArray (legacy format) - match by name
        if (profile.skillsArray) {
          const hasSkill = profile.skillsArray.some(
            skillName => skillName.toLowerCase().trim() === skill.name_canonical.toLowerCase().trim()
          );
          if (hasSkill) {
            count++;
            return;
          }
        }
        
        // Check skills string (legacy format)
        if (profile.skills) {
          const skillsList = profile.skills.split(',').map(s => s.trim().toLowerCase());
          if (skillsList.includes(skill.name_canonical.toLowerCase().trim())) {
            count++;
          }
        }
      });
      
      // Remove allKeys from the returned object (internal only)
      const { allKeys, ...skillWithoutKeys } = skill;
      return {
        ...skillWithoutKeys,
        profileCount: count,
      };
    });
    
    // Sort by profile count (descending), then by name
    skillsWithCounts.sort((a, b) => {
      if (b.profileCount !== a.profileCount) {
        return b.profileCount - a.profileCount;
      }
      return a.name_canonical.localeCompare(b.name_canonical);
    });
    
    return NextResponse.json({ 
      ok: true, 
      skills: skillsWithCounts,
      totalSkills: skillsWithCounts.length,
      totalProfiles: profiles.length,
    });
  } catch (error: any) {
    console.error('[api/skills/explore] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

