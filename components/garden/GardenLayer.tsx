/**
 * Garden Layer Component
 * 
 * Displays emoji plants in a garden strip at the bottom of the screen.
 * Used in onboarding and persistent on /me and /garden pages.
 * 
 * Phase 6: Emoji Garden - game-like visual progression
 */

'use client';

import { useMemo } from 'react';
import { GardenSkill, assignSkillsToSlots, levelToEmoji } from '@/lib/garden/types';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';

interface GardenLayerProps {
  skills: GardenSkill[]; // User's skills (for glowing)
  allSkills?: GardenSkill[]; // All skills in system (for background display)
  skillProfileCounts?: Record<string, number>; // Profile counts by skill name (normalized)
  learningSkillIds?: string[]; // Skill IDs the user is learning (for glowing)
  showIdentitySeed?: boolean; // Show central 🌱 for identity step
  animateNew?: string; // ID of newly added skill to animate
  className?: string;
  onSeedClick?: () => void; // Callback when identity seed is clicked (for welcome step)
  showSeedTooltip?: boolean; // Show "grow" tooltip on seed
}

export function GardenLayer({ 
  skills, // User's skills (for glowing)
  allSkills, // All skills in system (for background display)
  skillProfileCounts = {}, // Profile counts by skill name (normalized)
  learningSkillIds = [], // Skill IDs the user is learning (for glowing)
  showIdentitySeed = false,
  animateNew,
  className = '',
  onSeedClick,
  showSeedTooltip = false,
}: GardenLayerProps) {
  const arkivBuilderMode = useArkivBuilderMode();

  // Use allSkills if provided, otherwise fall back to user's skills
  const skillsToDisplay = allSkills || skills;
  
  // Create a set of user's skill names (normalized) for glowing
  const userSkillNames = useMemo(() => {
    return new Set(skills.map(s => s.name.toLowerCase().trim()));
  }, [skills]);

  // Create a set of learning skill IDs for glowing
  const learningSkillIdSet = useMemo(() => {
    return new Set(learningSkillIds);
  }, [learningSkillIds]);
  
  // Remove duplicates from allSkills by skill name
  // Keep the first occurrence of each skill name to ensure consistent slot assignment
  const uniqueSkillsToDisplay = useMemo(() => {
    const seen = new Map<string, GardenSkill>(); // Map normalized name -> first skill seen
    const result: GardenSkill[] = [];
    
    skillsToDisplay.forEach(skill => {
      const normalizedName = skill.name.toLowerCase().trim();
      if (!seen.has(normalizedName)) {
        seen.set(normalizedName, skill);
        result.push(skill);
      }
      // If duplicate found, skip it (already have one with this name)
    });
    
    return result;
  }, [skillsToDisplay]);
  
  const slots = useMemo(() => {
    // For background display, use more slots to show all skills
    const maxSlots = allSkills ? Math.min(uniqueSkillsToDisplay.length, 20) : 7;
    const assigned = assignSkillsToSlots(uniqueSkillsToDisplay, maxSlots);
    // If showing identity seed and no skills yet, add central seed
    if (showIdentitySeed && uniqueSkillsToDisplay.length === 0) {
      // Place identity seed in center slot (index 3)
      const withSeed = [...assigned];
      withSeed[3] = {
        id: 'identity_seed',
        name: 'Identity',
        level: 0,
      };
      return withSeed;
    }
    return assigned;
  }, [uniqueSkillsToDisplay, showIdentitySeed, allSkills]);

  // Find the identity seed slot
  const identitySeedSlot = slots.find(s => s?.id === 'identity_seed');

  return (
    <div className={`fixed inset-0 ${showSeedTooltip ? 'z-20' : 'z-[1]'} ${className}`}>
      {/* Bottom garden strip - responsive spacing with padding to prevent cutoff, lowered for visibility */}
      <div className="absolute inset-x-0 bottom-2 md:bottom-4 flex justify-center items-end gap-3 md:gap-8 px-4 md:px-8 pb-20 md:pb-24 overflow-visible">
        {slots.map((skill, i) =>
          skill ? (
            skill.id === 'identity_seed' && showSeedTooltip && onSeedClick ? (
              <button
                key={skill.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onSeedClick();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onSeedClick();
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                className="flex flex-col items-center gap-1 relative z-[100] cursor-pointer bg-transparent border-none p-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded-lg transition-transform duration-200 hover:scale-110 active:scale-95"
                style={{
                  zIndex: 100,
                }}
                aria-label="Grow - continue to next step"
              >
              <span 
                className={`text-3xl md:text-4xl relative inline-block transition-all duration-300 ${
                  skill.id === 'identity_seed' && showSeedTooltip ? 'hg-anim-seed-pulse-continuous' : ''
                }`}
                style={{
                  filter: skill.id === 'identity_seed' && showSeedTooltip
                    ? 'drop-shadow(0 0 20px rgba(34, 197, 94, 0.8)) drop-shadow(0 0 40px rgba(34, 197, 94, 0.4))'
                    : skill.id === 'identity_seed' 
                    ? 'drop-shadow(0 0 20px rgba(34, 197, 94, 0.8)) drop-shadow(0 0 40px rgba(34, 197, 94, 0.4))'
                    : skill.level === 5 
                    ? 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 12px rgba(34, 197, 94, 0.4))' 
                    : 'none',
                }}
                >
                  🌱
                </span>
              {skill.id === 'identity_seed' && showSeedTooltip && (
                <span className="text-xs font-medium text-green-400 dark:text-green-300 animate-pulse mt-1">
                  grow
                </span>
              )}
              </button>
            ) : (
              <div
                key={skill.id}
                className={`
                  flex flex-col items-center gap-1
                  ${skill.id === 'identity_seed' ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}
                  ${animateNew === skill.id ? 'hg-anim-plant-grow-in hg-anim-plant-sparkle' : 'hg-anim-plant-idle'}
                `}
              >
                <span 
                  className={`text-3xl md:text-4xl relative inline-block transition-all duration-300 ${
                    skill.id === 'identity_seed' && showSeedTooltip ? 'hg-anim-seed-pulse-continuous' : ''
                  }`}
                  style={{
                    filter: skill.id === 'identity_seed' && showSeedTooltip
                      ? 'drop-shadow(0 0 20px rgba(34, 197, 94, 0.8)) drop-shadow(0 0 40px rgba(34, 197, 94, 0.4))'
                      : skill.id === 'identity_seed' 
                      ? 'drop-shadow(0 0 20px rgba(34, 197, 94, 0.8)) drop-shadow(0 0 40px rgba(34, 197, 94, 0.4))'
                      : userSkillNames.has(skill.name.toLowerCase().trim()) || learningSkillIdSet.has(skill.id)
                      ? 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.8)) drop-shadow(0 0 16px rgba(34, 197, 94, 0.5))' // Glow for user's skills or learning skills
                      : 'none',
                  }}
                >
                  🌱
                </span>
                {skill.id === 'identity_seed' && showSeedTooltip && (
                  <span className="text-xs font-medium text-green-400 dark:text-green-300 animate-pulse mt-1">
                    grow
                  </span>
                )}
                {skill.name !== 'Identity' && skill.id !== 'identity_seed' && (
                  <div className="flex flex-col items-center gap-0.5 w-full max-w-[100px] min-w-0">
                    <span
                      className="text-[10px] md:text-[11px] text-gray-600 dark:text-gray-400 text-center whitespace-normal break-words"
                      style={{
                        maxWidth: '100px',
                        width: '100%',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                        lineHeight: '1.3',
                        minHeight: '28px',
                        display: 'block',
                        overflow: 'visible',
                        textOverflow: 'clip',
                        hyphens: 'auto',
                        WebkitHyphens: 'auto',
                        msHyphens: 'auto',
                      }}
                      title={skill.name}
                    >
                      {skill.name}
                    </span>
                    {(() => {
                      const normalizedName = skill.name.toLowerCase().trim();
                      const profileCount = skillProfileCounts[normalizedName] ?? 0;
                      const countText = profileCount > 0 ? `${profileCount}` : '0';

                      // Always show count
                      const content = (
                        <span className={`text-[9px] md:text-[10px] font-medium ${
                          profileCount > 0 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {countText}
                        </span>
                      );

                      if (arkivBuilderMode && profileCount > 0) {
                        return (
                          <ArkivQueryTooltip
                            query={[
                              `GET /api/skills/explore`,
                              `Queries:`,
                              `1. listSkills({ status: 'active', limit: 500 })`,
                              `   → type='skill', status='active'`,
                              `2. listUserProfiles()`,
                              `   → type='user_profile'`,
                              `3. Count profiles with skill:`,
                              `   - Check skill_ids array (new format)`,
                              `   - Check skillsArray (legacy format)`,
                              `   - Check skills string (legacy format)`,
                              `Returns: Skill[] with profileCount for "${skill.name}"`
                            ]}
                            label={`${profileCount} ${profileCount === 1 ? 'profile' : 'profiles'}`}
                          >
                            {content}
                          </ArkivQueryTooltip>
                        );
                      }
                      return content;
                    })()}
                  </div>
                )}
              </div>
            )
          ) : (
            <div key={i} className="w-8 md:w-10 h-8 md:h-10 pointer-events-none" aria-hidden="true" />
          ),
        )}
      </div>
    </div>
  );
}
