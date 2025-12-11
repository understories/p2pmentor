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

interface GardenLayerProps {
  skills: GardenSkill[];
  showIdentitySeed?: boolean; // Show central 🌱 for identity step
  animateNew?: string; // ID of newly added skill to animate
  className?: string;
}

export function GardenLayer({ 
  skills, 
  showIdentitySeed = false,
  animateNew,
  className = ''
}: GardenLayerProps) {
  const slots = useMemo(() => {
    const assigned = assignSkillsToSlots(skills, 7);
    // If showing identity seed and no skills yet, add central seed
    if (showIdentitySeed && skills.length === 0) {
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
  }, [skills, showIdentitySeed]);

  return (
    <div className={`pointer-events-none fixed inset-0 z-0 ${className}`}>
      {/* Bottom garden strip - responsive spacing */}
      <div className="absolute inset-x-0 bottom-6 md:bottom-12 flex justify-center items-end gap-4 md:gap-10 px-2 md:px-4">
        {slots.map((skill, i) =>
          skill ? (
            <div
              key={skill.id}
              className={`
                flex flex-col items-center gap-1
                ${animateNew === skill.id ? 'hg-anim-plant-grow-in hg-anim-plant-sparkle' : 'hg-anim-plant-idle'}
              `}
            >
              <span 
                className="text-3xl md:text-4xl relative inline-block"
                style={{
                  filter: skill.level === 5 
                    ? 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 12px rgba(34, 197, 94, 0.4))' 
                    : 'none',
                }}
              >
                {levelToEmoji(skill.level)}
                {skill.level === 5 && (
                  <span className="absolute -top-1 -right-1 text-lg animate-pulse">✨</span>
                )}
              </span>
              {skill.name !== 'Identity' && (
                <span className="text-[10px] md:text-[11px] text-gray-600 dark:text-gray-400 text-center max-w-[60px] truncate">
                  {skill.name}
                </span>
              )}
            </div>
          ) : (
            <div key={i} className="w-8 md:w-10 h-8 md:h-10" aria-hidden="true" />
          ),
        )}
      </div>
    </div>
  );
}
