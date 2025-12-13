/**
 * Skills Step Component
 * 
 * Step 2: Plant your first skill with expertise level (0-5)
 */

'use client';

import { useState, useEffect } from 'react';
import { listSkills } from '@/lib/arkiv/skill';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import type { Skill } from '@/lib/arkiv/skill';
import { ensureSkillEntity } from '@/lib/arkiv/skill-helpers';
import { listUserProfiles } from '@/lib/arkiv/profile';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';

interface SkillsStepProps {
  wallet: string;
  onComplete: () => void;
  onError: (error: Error) => void;
  onSkillAdded?: (skillId: string) => void; // Callback when skill is added (for garden animation)
}

export function SkillsStep({ wallet, onComplete, onError, onSkillAdded }: SkillsStepProps) {
  const [step, setStep] = useState<'input' | 'level'>('input'); // Two-step flow: input name, then set level
  const [currentSkillName, setCurrentSkillName] = useState('');
  const [expertise, setExpertise] = useState(1);
  const [existingSkills, setExistingSkills] = useState<Skill[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSkills, setCreatedSkills] = useState<Array<{ skillId: string; skillName: string; expertise: number }>>([]);
  const arkivBuilderMode = useArkivBuilderMode();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [confirmationType, setConfirmationType] = useState<'new' | 'existing'>('new');

  // Load existing skills for autocomplete
  useEffect(() => {
    async function loadSkills() {
      try {
        const skills = await listSkills({ status: 'active', limit: 50 });
        setExistingSkills(skills);
      } catch (err) {
        console.error('Failed to load skills:', err);
      } finally {
        setIsLoadingSkills(false);
      }
    }
    loadSkills();
  }, []);

  // Step 1: Submit skill name and move to level selection
  const handleSkillNameSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!currentSkillName.trim()) {
      onError(new Error('Skill name is required'));
      return;
    }
    // Move to level selection step
    setStep('level');
  };

  // Get profile count for a skill
  const getSkillProfileCount = async (skillKey: string): Promise<number> => {
    try {
      const allProfiles = await listUserProfiles();
      const skill = existingSkills.find(s => s.key === skillKey);
      if (!skill) return 0;

      let count = 0;
      allProfiles.forEach(profile => {
        // Check skill_ids array (new format)
        if (Array.isArray((profile as any).skill_ids) && (profile as any).skill_ids.includes(skillKey)) {
          count++;
          return;
        }
        // Check skillsArray (match by name)
        if (Array.isArray(profile.skillsArray) && profile.skillsArray.some(s => s.toLowerCase() === skill.name_canonical.toLowerCase())) {
          count++;
          return;
        }
        // Check skills string (legacy)
        if (typeof profile.skills === 'string' && profile.skills.toLowerCase().includes(skill.name_canonical.toLowerCase())) {
          count++;
        }
      });
      return count;
    } catch (error) {
      console.error('Error getting skill profile count:', error);
      return 0;
    }
  };

  // Step 2: Plant skill with selected expertise level
  const handlePlantSkill = async () => {
    if (!currentSkillName.trim()) {
      onError(new Error('Skill name is required'));
      return;
    }

    setIsSubmitting(true);

    try {
      // Ensure skill entity exists (Arkiv-native - creates if doesn't exist)
      const skillEntity = await ensureSkillEntity(currentSkillName.trim());
      if (!skillEntity) {
        throw new Error('Failed to create or find skill entity');
      }

      // Find the skill in our list (may need to reload if it was just created)
      let skill = existingSkills.find(s => s.key === skillEntity.key);
      if (!skill) {
        // Skill was just created, reload skills list
        const updatedSkills = await listSkills({ status: 'active', limit: 50 });
        setExistingSkills(updatedSkills);
        skill = updatedSkills.find(s => s.key === skillEntity.key);
        if (!skill) {
          // Use the entity data we have
          skill = {
            key: skillEntity.key,
            name_canonical: skillEntity.name_canonical,
            slug: skillEntity.slug,
            status: 'active' as const,
            spaceId: 'local-dev',
            createdAt: new Date().toISOString(),
          } as Skill;
        }
      }

      // Check if this is a new skill (was just created) or existing
      const wasNewSkill = !existingSkills.find(s => s.key === skillEntity.key);
      
      // Get current profile
      const profile = await getProfileByWallet(wallet);
      if (!profile) {
        throw new Error('Profile not found. Please complete the identity step first.');
      }
      
      const currentSkills = profile.skillsArray || [];
      const currentExpertise = profile.skillExpertise || {};
      
      let newSkills: string[];
      let newExpertise: Record<string, number>;
      
      // Add skill to profile if not already there
      if (!currentSkills.includes(skill.name_canonical)) {
        newSkills = [...currentSkills, skill.name_canonical];
      } else {
        newSkills = currentSkills;
      }
      newExpertise = {
        ...currentExpertise,
        [skill.key]: expertise,
      };
      
      // Use API route for profile update (uses global Arkiv signing wallet)
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateProfile',
          wallet, // Profile wallet address (used as 'wallet' attribute on entity)
          displayName: profile.displayName,
          bio: profile.bio,
          bioShort: profile.bioShort,
          skills: newSkills.join(', '),
          skillsArray: newSkills,
          skill_ids: [...(profile as any).skill_ids || [], skill.key].filter((id, idx, arr) => arr.indexOf(id) === idx), // Add skill_id, deduplicate
          skillExpertise: newExpertise, // Store in payload
          timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      // Show confirmation based on whether skill was new or existing
      if (wasNewSkill) {
        setConfirmationType('new');
        setConfirmationMessage(`You added a new skill to the network! "${skill.name_canonical}" has been planted in the Arkiv garden.`);
      } else {
        // Get profile count for existing skill
        const profileCount = await getSkillProfileCount(skill.key);
        setConfirmationType('existing');
        setConfirmationMessage(`You are joining ${profileCount} other${profileCount === 1 ? '' : 's'} in the network learning "${skill.name_canonical}".`);
      }
      setShowConfirmation(true);

      setCreatedSkills([...createdSkills, {
        skillId: skill.key,
        skillName: skill.name_canonical,
        expertise,
      }]);

      // Trigger garden animation callback if provided
      onSkillAdded?.(skill.key);

      // After planting, show "anything else?" prompt
      // Don't reset - let user decide to add more or continue
      setStep('input');
      setCurrentSkillName('');
      setExpertise(1);
    } catch (err) {
      onError(err instanceof Error ? err : new Error('Failed to add skill'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinue = () => {
    if (createdSkills.length === 0) {
      onError(new Error('Please add at least one skill'));
      return;
    }
    onComplete();
  };

  const expertiseLabels = ['Beginner', 'Beginner', 'Intermediate', 'Advanced', 'Advanced', 'Expert'];
  const expertiseEmojis = ['🌱', '🌿', '🌳', '🌲', '🌴', '🌴✨'];

  // Step 1: Input skill name (floating style - minimal, focused)
  if (step === 'input') {
    return (
      <>
        {/* Confirmation Modal */}
        {showConfirmation && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <div className="text-6xl mb-4 animate-pulse">
                  {confirmationType === 'new' ? '🌱' : '👥'}
                </div>
                <h3 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                  {confirmationType === 'new' ? 'Skill Planted!' : 'Welcome to the Community!'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {confirmationMessage}
                </p>
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 font-medium text-lg shadow-lg hover:shadow-xl"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-8 animate-fade-in">
        <div className="text-center">
          <h2 
            className="text-4xl md:text-5xl font-bold mb-4 text-white dark:text-white drop-shadow-lg"
            style={{
              textShadow: '0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3)',
            }}
          >
            {createdSkills.length > 0 ? 'Anything else?' : 'What skill are you growing?'}
          </h2>
          <p 
            className="text-gray-200 dark:text-gray-300 text-lg drop-shadow-md"
            style={{
              textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
            }}
          >
            {createdSkills.length > 0 ? 'Add another skill or continue to the next step.' : 'Every skill grows in its own time.'}
          </p>
        </div>

        <form onSubmit={handleSkillNameSubmit} className="space-y-6">
          <div>
            <input
              id="skillName"
              type="text"
              value={currentSkillName}
              onChange={(e) => setCurrentSkillName(e.target.value)}
              placeholder="e.g., Spanish, Solidity, Writing, Leadership"
              list="skillSuggestions"
              required
              autoFocus
              className="w-full px-6 py-4 text-lg border-2 border-white/30 dark:border-white/20 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-md text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all shadow-lg"
              disabled={isSubmitting}
            />
            <datalist id="skillSuggestions">
              {existingSkills.slice(0, 20).map((skill) => (
                <option key={skill.key} value={skill.name_canonical} />
              ))}
            </datalist>
          </div>

          <div className="flex gap-3">
            {createdSkills.length > 0 && (
              <button
                type="button"
                onClick={handleContinue}
                className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-200 font-medium text-lg shadow-lg hover:shadow-xl"
              >
                Continue →
              </button>
            )}
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `Clicking opens expertise level selector`,
                  `Next step: ensureSkillEntity() + POST /api/profile { action: 'updateProfile', ... }`,
                  `Creates/Updates: type='skill' entity (if new), type='user_profile' entity (update)`,
                  `Attributes: wallet='${wallet.toLowerCase().slice(0, 8)}...', skills, skillExpertise`,
                  `Payload: Full profile data with updated skills`
                ]}
                label={createdSkills.length > 0 ? 'Add Skill' : 'Continue'}
              >
                <button
                  type="submit"
                  disabled={!currentSkillName.trim() || isSubmitting}
                  className={`${createdSkills.length > 0 ? 'flex-1' : 'w-full'} px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-medium text-lg disabled:opacity-50 shadow-lg hover:shadow-xl`}
                >
                  {createdSkills.length > 0 ? 'Add Skill' : 'Continue →'}
                </button>
              </ArkivQueryTooltip>
            ) : (
              <button
                type="submit"
                disabled={!currentSkillName.trim() || isSubmitting}
                className={`${createdSkills.length > 0 ? 'flex-1' : 'w-full'} px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-medium text-lg disabled:opacity-50 shadow-lg hover:shadow-xl`}
              >
                {createdSkills.length > 0 ? 'Add Skill' : 'Continue →'}
              </button>
            )}
          </div>
        </form>

        {/* Show created skills if any */}
        {createdSkills.length > 0 && (
          <div className="pt-6">
            <p 
              className="text-sm text-gray-200 dark:text-gray-300 mb-3 drop-shadow-md text-center"
              style={{
                textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
              }}
            >
              Your skills:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {createdSkills.map((skill, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center gap-2 px-3 py-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-lg shadow-lg border border-white/20"
                >
                  <span className="text-lg">{expertiseEmojis[skill.expertise]}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{skill.skillName}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </>
    );
  }

  // Step 2: Set expertise level with sprout in center
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <h2 
          className="text-4xl md:text-5xl font-bold mb-4 text-white dark:text-white drop-shadow-lg"
          style={{
            textShadow: '0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3)',
          }}
        >
          {currentSkillName}
        </h2>
        <p 
          className="text-gray-200 dark:text-gray-300 text-lg mb-8 drop-shadow-md"
          style={{
            textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
          }}
        >
          How experienced are you?
        </p>
      </div>

      {/* Large sprout in center */}
      <div className="flex justify-center">
        <div 
          className="text-8xl hg-anim-plant-idle transition-all duration-300"
          style={{
            transform: `scale(${1 + (expertise * 0.05)})`,
            filter: expertise >= 3 ? 'drop-shadow(0 0 20px rgba(34, 197, 94, 0.4))' : 'none',
          }}
        >
          {expertiseEmojis[expertise]}
        </div>
      </div>

      {/* Slider underneath */}
      <div className="space-y-4">
        <div className="px-2">
          <input
            id="expertise"
            type="range"
            min="0"
            max="5"
            value={expertise}
            onChange={(e) => setExpertise(Number(e.target.value))}
            className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-600"
            disabled={isSubmitting}
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
            <span>Beginner</span>
            <span className="font-medium">{expertiseLabels[expertise]}</span>
            <span>Expert</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setStep('input');
              setCurrentSkillName('');
            }}
            className="flex-1 px-6 py-4 border-2 border-white/30 dark:border-white/20 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-md text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 transition-all font-medium shadow-lg"
            disabled={isSubmitting}
          >
            Back
          </button>
          {arkivBuilderMode ? (
            <ArkivQueryTooltip
              query={[
                `handlePlantSkill()`,
                `1. ensureSkillEntity("${currentSkillName}")`,
                `   → Creates: type='skill' entity (if doesn't exist)`,
                `   → Returns: Skill entity`,
                `2. POST /api/profile { action: 'updateProfile', ... }`,
                `   → Updates: type='user_profile' entity`,
                `   → Attributes: wallet='${wallet.toLowerCase().slice(0, 8)}...', skills, skillExpertise`,
                `   → Payload: Full profile data with updated skills`,
                `TTL: 1 year (31536000 seconds)`
              ]}
              label="Plant Skill"
            >
              <button
                type="button"
                onClick={handlePlantSkill}
                disabled={isSubmitting}
                className="flex-1 px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-medium text-lg disabled:opacity-50 shadow-lg hover:shadow-xl"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">🌱</span>
                    <span>Planting...</span>
                  </span>
                ) : (
                  'Plant Skill'
                )}
              </button>
            </ArkivQueryTooltip>
          ) : (
            <button
              type="button"
              onClick={handlePlantSkill}
              disabled={isSubmitting}
              className="flex-1 px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-medium text-lg disabled:opacity-50 shadow-lg hover:shadow-xl"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">🌱</span>
                  <span>Planting...</span>
                </span>
              ) : (
                'Plant Skill'
              )}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
