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
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { SPACE_ID } from '@/lib/config';

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
  const [createdSkills, setCreatedSkills] = useState<
    Array<{ skillId: string; skillName: string; expertise: number }>
  >([]);
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
    const trimmedName = currentSkillName.trim();
    if (!trimmedName) {
      onError(new Error('Skill name is required'));
      return;
    }

    // Prevent commas - only allow one skill at a time
    if (trimmedName.includes(',')) {
      onError(new Error('Please enter only one skill at a time. No commas allowed.'));
      return;
    }

    // Move to level selection step
    setStep('level');
  };

  // Get profile count for a skill
  // Uses the same API endpoint as the skill garden to ensure identical counts
  const getSkillProfileCount = async (skillName: string): Promise<number> => {
    try {
      // Use the same API endpoint as the skill garden (/api/skills/explore)
      // This ensures the count matches exactly what's shown in the garden
      const res = await fetch('/api/skills/explore');
      const data = await res.json();

      if (!data.ok || !data.skills) {
        console.error('Failed to fetch skill profile counts:', data.error);
        return 0;
      }

      // Find the skill by name (case-insensitive match)
      const normalizedName = skillName.toLowerCase().trim();
      const skill = data.skills.find(
        (s: any) => s.name_canonical.toLowerCase().trim() === normalizedName
      );

      return skill?.profileCount ?? 0;
    } catch (error) {
      console.error('Error getting skill profile count:', error);
      return 0;
    }
  };

  // Step 2: Plant skill with selected expertise level
  const handlePlantSkill = async () => {
    if (!wallet) {
      onError(new Error('Wallet address is required. Please refresh the page.'));
      return;
    }

    const trimmedName = currentSkillName.trim();
    if (!trimmedName) {
      onError(new Error('Skill name is required'));
      return;
    }

    // Prevent commas - only allow one skill at a time
    if (trimmedName.includes(',')) {
      onError(new Error('Please enter only one skill at a time. No commas allowed.'));
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate wallet is still available (profile wallet, not signing wallet)
      if (!wallet || wallet.trim() === '') {
        throw new Error('Profile wallet address is required. Please refresh the page.');
      }

      // Ensure skill entity exists (Arkiv-native - creates if doesn't exist)
      const skillEntity = await ensureSkillEntity(trimmedName);
      if (!skillEntity) {
        throw new Error('Failed to create or find skill entity');
      }

      // Find the skill in our list (may need to reload if it was just created)
      let skill = existingSkills.find((s) => s.key === skillEntity.key);
      if (!skill) {
        // Skill was just created, reload skills list
        const updatedSkills = await listSkills({ status: 'active', limit: 50 });
        setExistingSkills(updatedSkills);
        skill = updatedSkills.find((s) => s.key === skillEntity.key);
        if (!skill) {
          // Use the entity data we have
          // Note: skillEntity from ensureSkillEntity doesn't include spaceId, so we use SPACE_ID from config
          // The skill should be in updatedSkills after reload, but if not, use SPACE_ID as fallback
          const foundSkill = updatedSkills.find((s) => s.key === skillEntity.key);
          skill = {
            key: skillEntity.key,
            name_canonical: skillEntity.name_canonical,
            slug: skillEntity.slug,
            status: 'active' as const,
            spaceId: foundSkill?.spaceId || SPACE_ID, // Use spaceId from found skill or SPACE_ID from config
            createdAt: foundSkill?.createdAt || new Date().toISOString(),
          } as Skill;
        }
      }

      // Check if this is a new skill (was just created) or existing
      const wasNewSkill = !existingSkills.find((s) => s.key === skillEntity.key);

      // Get current profile - validate wallet is profile wallet (normalized)
      const normalizedWallet = wallet.toLowerCase().trim();
      if (!normalizedWallet || normalizedWallet.length < 10) {
        throw new Error('Invalid profile wallet address. Please refresh the page.');
      }

      const profile = await getProfileByWallet(normalizedWallet);
      if (!profile) {
        throw new Error('Profile not found. Please complete the identity step first.');
      }

      // Verify profile wallet matches (safety check)
      if (profile.wallet.toLowerCase() !== normalizedWallet) {
        throw new Error('Profile wallet mismatch. Please refresh the page.');
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

      // Use API route for profile update (uses global Arkiv signing wallet for signing)
      // wallet is the profile wallet address (from localStorage 'wallet_address')
      // This is used as the 'wallet' attribute on the profile entity
      // The API route uses getPrivateKey() (global signing wallet) to sign the transaction
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateProfile',
          wallet: normalizedWallet, // Profile wallet address (used as 'wallet' attribute on entity)
          displayName: profile.displayName,
          bio: profile.bio,
          bioShort: profile.bioShort,
          skills: newSkills.join(', '),
          skillsArray: newSkills,
          skill_ids: [...((profile as any).skill_ids || []), skill.key].filter(
            (id, idx, arr) => arr.indexOf(id) === idx
          ), // Add skill_id, deduplicate
          skillExpertise: newExpertise, // Store in payload
          timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      // Small delay to allow Arkiv to index the new profile entity
      // This ensures the profile count includes the newly added profile
      // Also allows level calculation to see the updated profile
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Show confirmation based on whether skill was new or existing
      if (wasNewSkill) {
        setConfirmationType('new');
        setConfirmationMessage(
          `You added a new skill to the network! "${skill.name_canonical}" has been planted in the Arkiv garden.`
        );
      } else {
        // Get profile count for existing skill
        // Uses same API endpoint as skill garden to ensure identical counts
        // The count should now include the newly added profile after the delay
        const profileCount = await getSkillProfileCount(skill.name_canonical);
        setConfirmationType('existing');
        setConfirmationMessage(
          `You are joining ${profileCount} other${profileCount === 1 ? '' : 's'} in the network learning "${skill.name_canonical}".`
        );
      }
      setShowConfirmation(true);

      setCreatedSkills([
        ...createdSkills,
        {
          skillId: skill.key,
          skillName: skill.name_canonical,
          expertise,
        },
      ]);

      // Trigger garden animation callback if provided
      onSkillAdded?.(skill.key);

      // Reset submitting state before resetting form
      setIsSubmitting(false);

      // After planting, show "anything else?" prompt
      // Don't reset - let user decide to add more or continue
      setStep('input');
      setCurrentSkillName('');
      setExpertise(1);
    } catch (err) {
      console.error('[SkillsStep] Error adding skill:', err);
      // Always reset submitting state, even on error
      setIsSubmitting(false);
      onError(err instanceof Error ? err : new Error('Failed to add skill'));
      // Reset form state on error so user can try again
      setStep('input');
      setCurrentSkillName('');
      setExpertise(1);
    }
  };

  const handleContinue = () => {
    if (createdSkills.length === 0) {
      onError(new Error('Please add at least one skill'));
      return;
    }
    onComplete();
  };

  const expertiseLabels = [
    'Beginner',
    'Beginner',
    'Intermediate',
    'Advanced',
    'Advanced',
    'Expert',
  ];
  const expertiseEmojis = ['🌱', '🌿', '🌳', '🌲', '🌴', '🌴✨'];

  // Step 1: Input skill name (floating style - minimal, focused)
  if (step === 'input') {
    return (
      <>
        {/* Confirmation Modal */}
        {showConfirmation && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800">
              <div className="text-center">
                <div className="mb-4 animate-pulse text-6xl">
                  {confirmationType === 'new' ? '🌱' : '👥'}
                </div>
                <h3 className="mb-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {confirmationType === 'new' ? 'Skill Planted!' : 'Welcome to the Community!'}
                </h3>
                <p className="mb-6 text-gray-600 dark:text-gray-400">{confirmationMessage}</p>
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="w-full rounded-lg bg-green-600 px-6 py-3 text-lg font-medium text-white shadow-lg transition-all duration-200 hover:bg-green-700 hover:shadow-xl"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="animate-fade-in space-y-8">
          <div className="text-center">
            <h2
              className="mb-4 text-4xl font-bold text-white drop-shadow-lg dark:text-white md:text-5xl"
              style={{
                textShadow: '0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3)',
              }}
            >
              {createdSkills.length > 0 ? 'Anything else?' : 'What skill are you growing?'}
            </h2>
            <p
              className="text-lg text-gray-200 drop-shadow-md dark:text-gray-300"
              style={{
                textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
              }}
            >
              {createdSkills.length > 0
                ? 'Plant skill to continue or add another skill.'
                : 'Add one skill to start'}
            </p>
          </div>

          <form onSubmit={handleSkillNameSubmit} className="space-y-6">
            <div>
              <input
                id="skillName"
                type="text"
                value={currentSkillName}
                onChange={(e) => {
                  // Prevent commas - only allow one skill at a time
                  const value = e.target.value.replace(/,/g, '');
                  setCurrentSkillName(value);
                }}
                placeholder="e.g., Spanish"
                list="skillSuggestions"
                required
                autoFocus
                className="w-full rounded-xl border-2 border-white/30 bg-white/90 px-6 py-4 text-lg text-gray-900 shadow-lg backdrop-blur-md transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500 dark:border-white/20 dark:bg-gray-900/90 dark:text-gray-100"
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
                  className="flex-1 rounded-xl bg-blue-600 px-6 py-4 text-lg font-medium text-white shadow-lg transition-all duration-200 hover:bg-blue-700 hover:shadow-xl"
                >
                  Continue →
                </button>
              )}
              {arkivBuilderMode ? (
                <ArkivQueryTooltip
                  query={[
                    `Clicking opens expertise level selector`,
                    `Next step: ensureSkillEntity() + POST /api/profile { action: 'updateProfile', ... }`,
                    `Creates: type='skill' entity (if new)`,
                    `Updates: type='user_profile' entity (stable entity key)`,
                    `Attributes: wallet='${wallet.toLowerCase().slice(0, 8)}...', skills, skillExpertise`,
                    `Payload: Full profile data with updated skills`,
                  ]}
                  label={createdSkills.length > 0 ? 'Add Skill' : 'Continue'}
                >
                  <button
                    type="submit"
                    disabled={!currentSkillName.trim() || isSubmitting}
                    className={`${createdSkills.length > 0 ? 'flex-1' : 'w-full'} rounded-xl bg-green-600 px-6 py-4 text-lg font-medium text-white shadow-lg transition-all duration-200 hover:bg-green-700 hover:shadow-xl disabled:cursor-not-allowed disabled:bg-gray-400 disabled:opacity-50`}
                  >
                    {createdSkills.length > 0 ? 'Add Skill' : 'Continue →'}
                  </button>
                </ArkivQueryTooltip>
              ) : (
                <button
                  type="submit"
                  disabled={!currentSkillName.trim() || isSubmitting}
                  className={`${createdSkills.length > 0 ? 'flex-1' : 'w-full'} rounded-xl bg-green-600 px-6 py-4 text-lg font-medium text-white shadow-lg transition-all duration-200 hover:bg-green-700 hover:shadow-xl disabled:cursor-not-allowed disabled:bg-gray-400 disabled:opacity-50`}
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
                className="mb-3 text-center text-sm text-gray-200 drop-shadow-md dark:text-gray-300"
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
                    className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/90 px-3 py-2 shadow-lg backdrop-blur-md dark:bg-gray-900/90"
                  >
                    <span className="text-lg">{expertiseEmojis[skill.expertise]}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {skill.skillName}
                    </span>
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
    <div className="animate-fade-in space-y-8">
      <div className="text-center">
        <h2
          className="mb-4 text-4xl font-bold text-white drop-shadow-lg dark:text-white md:text-5xl"
          style={{
            textShadow: '0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3)',
          }}
        >
          {currentSkillName}
        </h2>
        <p
          className="mb-8 text-lg text-gray-200 drop-shadow-md dark:text-gray-300"
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
          className="hg-anim-plant-idle text-8xl transition-all duration-300"
          style={{
            transform: `scale(${1 + expertise * 0.05})`,
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
            className="h-3 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-green-600 dark:bg-gray-700"
            disabled={isSubmitting}
          />
          <div className="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
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
            className="flex-1 rounded-xl border-2 border-white/30 bg-white/90 px-6 py-4 font-medium text-gray-700 shadow-lg backdrop-blur-md transition-all hover:bg-white dark:border-white/20 dark:bg-gray-900/90 dark:text-gray-300 dark:hover:bg-gray-800"
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
                `TTL: 1 year (31536000 seconds)`,
              ]}
              label="Plant Skill"
            >
              <button
                type="button"
                onClick={handlePlantSkill}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-green-600 px-6 py-4 text-lg font-medium text-white shadow-lg transition-all duration-200 hover:bg-green-700 hover:shadow-xl disabled:cursor-not-allowed disabled:bg-gray-400 disabled:opacity-50"
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
              className="flex-1 rounded-xl bg-green-600 px-6 py-4 text-lg font-medium text-white shadow-lg transition-all duration-200 hover:bg-green-700 hover:shadow-xl disabled:cursor-not-allowed disabled:bg-gray-400 disabled:opacity-50"
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
