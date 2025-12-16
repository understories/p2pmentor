/**
 * Community Path Step Component
 * 
 * Allows user to follow a learning community (skill)
 */

'use client';

import { useState, useEffect } from 'react';
import { listSkills } from '@/lib/arkiv/skill';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
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
  const arkivBuilderMode = useArkivBuilderMode();

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
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <div 
          className="text-6xl mb-4"
          style={{
            filter: 'drop-shadow(0 0 20px rgba(34, 197, 94, 0.6))',
          }}
        >
          🌲
        </div>
        <h2 
          className="text-4xl md:text-5xl font-bold mb-4 text-white dark:text-white drop-shadow-lg"
          style={{
            textShadow: '0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3)',
          }}
        >
          Join a Learning Community
        </h2>
        <p 
          className="text-gray-200 dark:text-gray-300 text-lg mb-8 drop-shadow-md"
          style={{
            textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
          }}
        >
          Joining a community plants a shared tree in your garden.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <select
            id="community"
            value={selectedSkill}
            onChange={(e) => setSelectedSkill(e.target.value)}
            required
            autoFocus
            className="w-full px-6 py-4 text-lg border-2 border-white/30 dark:border-white/20 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-md text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all shadow-lg"
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

        {arkivBuilderMode ? (
          <ArkivQueryTooltip
            query={[
              `POST /api/learning-follow { action: 'createFollow', ... }`,
              `Creates: type='learning_follow' entity`,
              `Attributes: wallet='${wallet.toLowerCase().slice(0, 8)}...', skill_id='${selectedSkill.slice(0, 12)}...', mode='learning'`,
              `Payload: Full learning follow data`,
              `TTL: 1 year (31536000 seconds)`
            ]}
            label="Continue"
          >
            <button
              onClick={handleFollow}
              disabled={!selectedSkill || isSubmitting}
              className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-medium text-lg disabled:opacity-50 shadow-lg hover:shadow-xl"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">🌲</span>
                  <span>Joining...</span>
                </span>
              ) : (
                'Continue →'
              )}
            </button>
          </ArkivQueryTooltip>
        ) : (
          <button
            onClick={handleFollow}
            disabled={!selectedSkill || isSubmitting}
            className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-medium text-lg disabled:opacity-50 shadow-lg hover:shadow-xl"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">🌲</span>
                <span>Joining...</span>
              </span>
            ) : (
              'Continue →'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
