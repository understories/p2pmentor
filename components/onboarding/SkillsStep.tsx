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
  const [skillName, setSkillName] = useState('');
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

  const handleAddSkill = async () => {
    if (!skillName.trim()) {
      onError(new Error('Skill name is required'));
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if skill already exists
      const normalizedName = skillName.trim().toLowerCase();
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
        newSkills = [...currentSkills, skillName.trim()];
        newExpertise = {
          ...currentExpertise,
          [skillName.trim().toLowerCase()]: expertise,
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

      const newSkillId = skill ? skill.key : skillName.trim().toLowerCase();
      setCreatedSkills([...createdSkills, {
        skillId: newSkillId,
        skillName: skill ? skill.name_canonical : skillName.trim(),
        expertise,
      }]);

      // Trigger garden animation callback if provided
      onSkillAdded?.(newSkillId);

      setSkillName('');
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

  const expertiseLabels = ['Seed', 'Sprout', 'Budding', 'Bush', 'Tree', 'Glowing Tree'];
  const expertiseEmojis = ['🌱', '🌿', '🌳', '🌲', '🌴', '🌴✨'];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-4">{expertiseEmojis[expertise]}</div>
        <h2 className="text-2xl font-bold mb-2">Plant Your First Skill</h2>
        <p className="text-gray-600 dark:text-gray-400">
          What are you growing skill in? Every skill grows in its own time.
        </p>
      </div>

      {/* Created Skills */}
      {createdSkills.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Your Skills:</h3>
          {createdSkills.map((skill, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span className="font-medium">{skill.skillName}</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {expertiseLabels[skill.expertise]} {expertiseEmojis[skill.expertise]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add Skill Form */}
      <div className="space-y-4">
        <div>
          <label htmlFor="skillName" className="block text-sm font-medium mb-2">
            Skill Name <span className="text-red-500">*</span>
          </label>
          <input
            id="skillName"
            type="text"
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            placeholder="e.g., Spanish, Solidity, Writing, Leadership"
            list="skillSuggestions"
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isSubmitting}
          />
          <datalist id="skillSuggestions">
            {existingSkills.slice(0, 20).map((skill) => (
              <option key={skill.key} value={skill.name_canonical} />
            ))}
          </datalist>
        </div>

        <div>
          <label htmlFor="expertise" className="block text-sm font-medium mb-2">
            Expertise Level: {expertiseLabels[expertise]} {expertiseEmojis[expertise]}
          </label>
          {createdSkills.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Increase this skill's level? The plant will grow as you move the slider.
            </p>
          )}
          <input
            id="expertise"
            type="range"
            min="0"
            max="5"
            value={expertise}
            onChange={(e) => setExpertise(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
            disabled={isSubmitting}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0 (Seed)</span>
            <span>5 (Glowing Tree)</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddSkill}
          disabled={!skillName.trim() || isSubmitting}
          className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 font-medium disabled:opacity-50"
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

      {/* Continue Button */}
      {createdSkills.length > 0 && (
        <button
          onClick={handleContinue}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        >
          Continue to Paths →
        </button>
      )}
    </div>
  );
}
