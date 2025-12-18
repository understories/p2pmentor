/**
 * Fixed Background Garden Component
 *
 * Displays emoji plants in a garden strip at the bottom of the screen.
 * Fixed in place like FloatingButtonCluster, visible on all pages.
 * Shows all system skills with profile counts.
 *
 * Reuses GardenLayer component for rendering.
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { GardenLayer } from './GardenLayer';
import { useSkillProfileCounts } from '@/lib/hooks/useSkillProfileCounts';
import { listLearningFollows } from '@/lib/arkiv/learningFollow';
import { profileToGardenSkills } from '@/lib/garden/types';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { SPACE_ID } from '@/lib/config';
import type { Skill } from '@/lib/arkiv/skill';
import type { GardenSkill } from '@/lib/garden/types';

export function FixedBackgroundGarden() {
  const pathname = usePathname();

  // Hide garden on landing, beta, auth, onboarding, and documentation pages
  // Onboarding has its own GardenLayer that shows during the skills step
  const hideGardenPaths = ['/', '/beta', '/auth', '/onboarding'];
  if (hideGardenPaths.includes(pathname) || pathname?.startsWith('/docs')) {
    return null;
  }
  const [allSystemSkills, setAllSystemSkills] = useState<GardenSkill[]>([]);
  const [userSkills, setUserSkills] = useState<GardenSkill[]>([]);
  const [learningSkillIds, setLearningSkillIds] = useState<string[]>([]);
  const skillProfileCounts = useSkillProfileCounts();
  const arkivBuilderMode = useArkivBuilderMode();

  // Deduplicate skills by name (case-insensitive) to prevent duplicates
  const deduplicatedSystemSkills = useMemo(() => {
    const seen = new Set<string>();
    return allSystemSkills.filter(skill => {
      const normalizedName = skill.name.toLowerCase().trim();
      if (seen.has(normalizedName)) {
        return false;
      }
      seen.add(normalizedName);
      return true;
    });
  }, [allSystemSkills]);

  // Load all system skills from /api/skills/explore (same as skills page)
  useEffect(() => {
    const loadSkills = async () => {
      try {
        const res = await fetch('/api/skills/explore');
        const data = await res.json();

        if (data.ok && data.skills) {
          // Convert Skill[] to GardenSkill[]
          const gardenSkills: GardenSkill[] = data.skills.map((skill: Skill) => ({
            id: skill.key,
            name: skill.name_canonical,
            level: 0, // Background skills don't have levels
          }));
          setAllSystemSkills(gardenSkills);
        }
      } catch (err) {
        console.error('Error loading system skills for background garden:', err);
      }
    };

    loadSkills();
  }, []);

  // Load user's skills and learning follows for glow effect
  useEffect(() => {
    const loadUserData = async () => {
      if (typeof window === 'undefined') return;

      const walletAddress = localStorage.getItem('wallet_address');
      if (!walletAddress) {
        return;
      }

      try {
        // Load user profile to get their skills
        const profileRes = await fetch(`/api/profile?wallet=${encodeURIComponent(walletAddress)}`);
        const profileData = await profileRes.json();

        if (profileData.ok && profileData.profile) {
          const skills = profileToGardenSkills(
            profileData.profile.skillsArray,
            profileData.profile.skillExpertise
          );
          setUserSkills(skills);
        }

        // Load learning follows
        const follows = await listLearningFollows({
          profile_wallet: walletAddress,
          active: true,
        });
        setLearningSkillIds(follows.map(f => f.skill_id));
      } catch (err) {
        console.error('Error loading user data for background garden:', err);
      }
    };

    loadUserData();
  }, []);

  // Don't render if no skills loaded yet
  if (deduplicatedSystemSkills.length === 0) {
    return null;
  }

  const gardenContent = (
    <GardenLayer
      skills={userSkills}
      allSkills={deduplicatedSystemSkills}
      skillProfileCounts={skillProfileCounts}
      learningSkillIds={learningSkillIds}
      className="pointer-events-none"
    />
  );

  return (
    <div className="fixed inset-0 z-[1] pointer-events-none">
      {arkivBuilderMode ? (
        <ArkivQueryTooltip
          query={[
            `GET /api/skills/explore`,
            `Queries:`,
            `1. listSkills({ status: 'active', limit: 1000, spaceId: '${SPACE_ID}' })`,
            `   → type='skill', status='active', spaceId='${SPACE_ID}'`,
            `2. listUserProfiles({ spaceId: '${SPACE_ID}' })`,
            `   → type='user_profile', spaceId='${SPACE_ID}'`,
            `3. Deduplicate skills by name_canonical (case-insensitive)`,
            `4. Count profiles with skill:`,
            `   - Check skill_ids array (new format)`,
            `   - Check skillsArray (legacy format)`,
            `   - Check skills string (legacy format)`,
            `Returns: Skill[] with profileCount for each skill`
          ]}
          label="Skill Garden"
        >
          {gardenContent}
        </ArkivQueryTooltip>
      ) : (
        gardenContent
      )}
    </div>
  );
}
