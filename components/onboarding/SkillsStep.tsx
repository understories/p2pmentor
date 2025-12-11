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

  // Step 2: Plant skill with selected expertise level
  const handlePlantSkill = async () => {
    if (!currentSkillName.trim()) {
      onError(new Error('Skill name is required'));
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if skill already exists
      const normalizedName = currentSkillName.trim().toLowerCase();
      let skill = existingSkills.find(s => s.name_canonical.toLowerCase() === normalizedName);
      
      // Get current profile
      const profile = await getProfileByWallet(wallet);
      if (!profile) {
        throw new Error('Profile not found. Please complete the identity step first.');
      }
      
      const currentSkills = profile.skillsArray || [];
      const currentExpertise = profile.skillExpertise || {};
      
      let newSkills: string[];
      let newExpertise: Record<string, number>;
      
      if (!skill) {
        // New skill - add to profile
        newSkills = [...currentSkills, currentSkillName.trim()];
        newExpertise = {
          ...currentExpertise,
          [currentSkillName.trim().toLowerCase()]: expertise,
        };
      } else {
        // Existing skill - add to profile if not already there
        if (!currentSkills.includes(skill.name_canonical)) {
          newSkills = [...currentSkills, skill.name_canonical];
        } else {
          newSkills = currentSkills;
        }
        newExpertise = {
          ...currentExpertise,
          [skill.key]: expertise,
        };
      }
      
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
          skillExpertise: newExpertise, // Store in payload
          timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      const newSkillId = skill ? skill.key : currentSkillName.trim().toLowerCase();
      setCreatedSkills([...createdSkills, {
        skillId: newSkillId,
        skillName: skill ? skill.name_canonical : currentSkillName.trim(),
        expertise,
      }]);

      // Trigger garden animation callback if provided
      onSkillAdded?.(newSkillId);

      // Reset for next skill
      setCurrentSkillName('');
      setExpertise(1);
      setStep('input');
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

  // Step 1: Input skill name (typeform style - minimal, focused)
  if (step === 'input') {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-3">What skill are you growing?</h2>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            Every skill grows in its own time.
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
              className="w-full px-6 py-4 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
              disabled={isSubmitting}
            />
            <datalist id="skillSuggestions">
              {existingSkills.slice(0, 20).map((skill) => (
                <option key={skill.key} value={skill.name_canonical} />
              ))}
            </datalist>
          </div>

          <button
            type="submit"
            disabled={!currentSkillName.trim() || isSubmitting}
            className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-medium text-lg disabled:opacity-50 shadow-lg hover:shadow-xl"
          >
            Continue →
          </button>
        </form>

        {/* Show created skills if any */}
        {createdSkills.length > 0 && (
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Your skills:</p>
            <div className="flex flex-wrap gap-2">
              {createdSkills.map((skill, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <span>{expertiseEmojis[skill.expertise]}</span>
                  <span className="text-sm font-medium">{skill.skillName}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Step 2: Set expertise level with sprout in center
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">{currentSkillName}</h2>
        <p className="text-gray-500 dark:text-gray-400 text-lg mb-8">
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
            className="flex-1 px-6 py-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-medium"
            disabled={isSubmitting}
          >
            Back
          </button>
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
        </div>
      </div>

      {/* Continue Button - show after at least one skill */}
      {createdSkills.length > 0 && (
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleContinue}
            className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium text-lg shadow-lg hover:shadow-xl"
          >
            Continue to Paths →
          </button>
        </div>
      )}
    </div>
  );
}
