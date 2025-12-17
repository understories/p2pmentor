/**
 * Hook for loading skill profile counts
 *
 * Reusable hook that loads profile counts for all skills from /api/skills/explore
 * Returns a map of normalized skill names to profile counts
 */

import { useState, useEffect } from 'react';

export function useSkillProfileCounts(): Record<string, number> {
  const [skillProfileCounts, setSkillProfileCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadSkillProfileCounts = async () => {
      try {
        const res = await fetch('/api/skills/explore');
        const data = await res.json();

        if (data.ok && data.skills) {
          const countsMap: Record<string, number> = {};
          data.skills.forEach((skill: any) => {
            // Map by skill name (case-insensitive) for matching
            const normalizedName = skill.name_canonical.toLowerCase().trim();
            countsMap[normalizedName] = skill.profileCount;
          });
          setSkillProfileCounts(countsMap);
        }
      } catch (err) {
        console.error('Error loading skill profile counts:', err);
      }
    };

    loadSkillProfileCounts();
  }, []);

  return skillProfileCounts;
}

