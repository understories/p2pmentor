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
  onSeedClick?: () => void; // Callback when identity seed is clicked (for welcome step)
  showSeedTooltip?: boolean; // Show "grow" tooltip on seed
}

export function GardenLayer({ 
  skills, 
  showIdentitySeed = false,
  animateNew,
  className = '',
  onSeedClick,
  showSeedTooltip = false,
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

  // Find the identity seed slot
  const identitySeedSlot = slots.find(s => s?.id === 'identity_seed');

  return (
    <div className={`fixed inset-0 z-0 ${className}`}>
      {/* Bottom garden strip - responsive spacing with padding to prevent cutoff */}
      <div className="absolute inset-x-0 bottom-6 md:bottom-12 flex justify-center items-end gap-3 md:gap-8 px-4 md:px-8 z-50">
        {slots.map((skill, i) =>
          skill ? (
            <div
              key={skill.id}
              className={`
                flex flex-col items-center gap-1
                ${skill.id === 'identity_seed' && showSeedTooltip 
                  ? 'pointer-events-auto cursor-pointer z-50' 
                  : skill.id === 'identity_seed' 
                  ? 'pointer-events-auto cursor-pointer' 
                  : 'pointer-events-none'}
                ${animateNew === skill.id ? 'hg-anim-plant-grow-in hg-anim-plant-sparkle' : skill.id === 'identity_seed' && showSeedTooltip ? '' : 'hg-anim-plant-idle'}
              `}
              onClick={skill.id === 'identity_seed' && onSeedClick ? (e) => {
                e.stopPropagation();
                e.preventDefault();
                onSeedClick();
              } : undefined}
              role={skill.id === 'identity_seed' && showSeedTooltip ? 'button' : undefined}
              tabIndex={skill.id === 'identity_seed' && showSeedTooltip ? 0 : undefined}
              onKeyDown={skill.id === 'identity_seed' && onSeedClick && showSeedTooltip ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onSeedClick();
                }
              } : undefined}
              onMouseEnter={(e) => {
                if (skill.id === 'identity_seed' && showSeedTooltip) {
                  e.currentTarget.style.transform = 'scale(1.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (skill.id === 'identity_seed' && showSeedTooltip) {
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
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
                {levelToEmoji(skill.level)}
              </span>
              {skill.id === 'identity_seed' && showSeedTooltip && (
                <span className="text-xs font-medium text-green-400 dark:text-green-300 animate-pulse mt-1">
                  grow
                </span>
              )}
              {skill.name !== 'Identity' && skill.id !== 'identity_seed' && (
                <span 
                  className="text-[10px] md:text-[11px] text-gray-600 dark:text-gray-400 text-center whitespace-normal"
                  style={{
                    maxWidth: '70px',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    lineHeight: '1.3',
                    minHeight: '28px',
                    display: 'inline-block',
                  }}
                  title={skill.name}
                >
                  {skill.name}
                </span>
              )}
            </div>
          ) : (
            <div key={i} className="w-8 md:w-10 h-8 md:h-10 pointer-events-none" aria-hidden="true" />
          ),
        )}
      </div>
    </div>
  );
}
