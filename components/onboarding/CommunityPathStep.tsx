/**
 * Community Path Step Component
 * 
 * Allows user to follow a learning community (skill)
 */

'use client';

import { useState, useEffect } from 'react';
import { listSkills } from '@/lib/arkiv/skill';
import type { Skill } from '@/lib/arkiv/skill';

interface CommunityPathStepProps {
  wallet: string;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export function CommunityPathStep({ wallet, onComplete, onError }: CommunityPathStepProps) {
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [followedSkills, setFollowedSkills] = useState<string[]>([]);

  // Load available skills (communities)
  useEffect(() => {
    async function loadSkills() {
      try {
        const skills = await listSkills({ status: 'active', limit: 50 });
        setAvailableSkills(skills);
        if (skills.length > 0 && !selectedSkill) {
          setSelectedSkill(skills[0].key);
        }
      } catch (err) {
        console.error('Failed to load skills:', err);
        setAvailableSkills([]);
      } finally {
        setIsLoadingSkills(false);
      }
    }
    loadSkills();
  }, []);

  const handleFollow = async () => {
    if (!selectedSkill) {
      onError(new Error('Please select a community'));
      return;
    }

    if (followedSkills.includes(selectedSkill)) {
      onComplete(); // Already followed, can continue
      return;
    }

    setIsSubmitting(true);

    try {
      // Use API route for learning follow
      const res = await fetch('/api/learning-follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createFollow',
          wallet,
          skill_id: selectedSkill,
          mode: 'learning',
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setFollowedSkills([...followedSkills, selectedSkill]);
        onComplete();
      } else {
        throw new Error(data.error || 'Failed to follow community');
      }
    } catch (err) {
      onError(err instanceof Error ? err : new Error('Failed to follow community'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-4">🌲</div>
        <h2 className="text-2xl font-bold mb-2">Join a Learning Community</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Joining a community plants a shared tree in your garden.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="community" className="block text-sm font-medium mb-2">
            Select a Community <span className="text-red-500">*</span>
          </label>
          <select
            id="community"
            value={selectedSkill}
            onChange={(e) => setSelectedSkill(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isLoadingSkills || isSubmitting}
          >
            {isLoadingSkills ? (
              <option>Loading communities...</option>
            ) : (
              <>
                <option value="">Select a community</option>
                {availableSkills.map((skill) => (
                  <option key={skill.key} value={skill.key}>
                    {skill.name_canonical}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>


        <button
          onClick={handleFollow}
          disabled={!selectedSkill || isSubmitting}
          className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
        >
          {isSubmitting ? 'Joining...' : 'Join Community →'}
        </button>
      </div>
    </div>
  );
}
