/**
 * Skills Explore API route
 * 
 * Lists all skill entities with profile counts (how many profiles have each skill).
 */

import { NextResponse } from 'next/server';
import { listSkills } from '@/lib/arkiv/skill';
import { listUserProfiles } from '@/lib/arkiv/profile';

export async function GET(request: Request) {
  try {
    // Get all skills
    const skills = await listSkills({ status: 'active', limit: 500 });
    
    // Get all profiles
    const profiles = await listUserProfiles();
    
    // Count profiles for each skill
    const skillsWithCounts = skills.map(skill => {
      let count = 0;
      
      profiles.forEach(profile => {
        // Check if profile has this skill
        // Check skill_ids array (new format)
        const skillIds = (profile as any).skill_ids || [];
        if (skillIds.includes(skill.key)) {
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
      
      return {
        ...skill,
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

