/**
 * Skills Explore API route
 * 
 * Lists all skill entities with profile counts (how many profiles have each skill).
 */

import { NextResponse } from 'next/server';
import { listSkills, normalizeSkillSlug } from '@/lib/arkiv/skill';
import { listUserProfiles } from '@/lib/arkiv/profile';
import type { Skill } from '@/lib/arkiv/skill';

export async function GET(request: Request) {
  try {
    // Get all skills
    const skills = await listSkills({ status: 'active', limit: 500 });
    
    // Get all profiles
    const profiles = await listUserProfiles();
    
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
    const skillsWithCounts = Array.from(skillMap.values()).map(skill => {
      let count = 0;
      
      profiles.forEach(profile => {
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

