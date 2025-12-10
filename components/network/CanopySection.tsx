/**
 * Canopy Section Component
 * 
 * Hero section showing top skills as glowing constellation nodes.
 * Clicking a skill filters the page by that skill.
 * Part of Network page "Canopy Map" transformation.
 */

'use client';

import { useTheme } from '@/lib/theme';

interface CanopySectionProps {
  skills: Array<{ skill: string; count: number }>;
  onSkillClick: (skill: string) => void;
  selectedSkill?: string;
}

export function CanopySection({
  skills,
  onSkillClick,
  selectedSkill,
}: CanopySectionProps) {
  const { theme } = useTheme();

  // Show top 10 skills
  const topSkills = skills.slice(0, 10);

  return (
    <div className="relative mb-8 p-6 rounded-2xl overflow-hidden">
      {/* Subtle constellation overlay background */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: theme === 'dark'
            ? 'radial-gradient(circle at 20% 30%, rgba(34, 197, 94, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(34, 197, 94, 0.1) 0%, transparent 50%)'
            : 'radial-gradient(circle at 20% 30%, rgba(34, 197, 94, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(34, 197, 94, 0.05) 0%, transparent 50%)',
        }}
      />
      
      <div className="relative z-10">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
          The Canopy
        </h2>
        <div className="flex flex-wrap gap-3">
          {topSkills.length > 0 ? (
            topSkills.map(({ skill, count }) => {
              const isSelected = selectedSkill?.toLowerCase() === skill.toLowerCase();
              return (
                <button
                  key={skill}
                  onClick={() => onSkillClick(skill)}
                  className={`
                    px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                    ${isSelected
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800'
                    }
                  `}
                  style={{
                    boxShadow: isSelected
                      ? '0 0 16px rgba(34, 197, 94, 0.6), 0 0 8px rgba(34, 197, 94, 0.4)'
                      : theme === 'dark'
                      ? '0 0 8px rgba(34, 197, 94, 0.2)'
                      : '0 2px 4px rgba(0, 0, 0, 0.1)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.boxShadow = theme === 'dark'
                        ? '0 0 12px rgba(34, 197, 94, 0.4)'
                        : '0 0 8px rgba(34, 197, 94, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.boxShadow = theme === 'dark'
                        ? '0 0 8px rgba(34, 197, 94, 0.2)'
                        : '0 2px 4px rgba(0, 0, 0, 0.1)';
                    }
                  }}
                >
                  <span className="mr-2">✦</span>
                  {skill}
                  <span className="ml-2 text-xs opacity-75">({count})</span>
                </button>
              );
            })
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No skills found
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
