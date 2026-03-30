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
    // Validate wallet is profile wallet (not signing wallet)
    if (!wallet || wallet.trim() === '') {
      onError(new Error('Profile wallet address is required. Please refresh the page.'));
      return;
    }
    const normalizedWallet = wallet.toLowerCase().trim();
    if (normalizedWallet.length < 10) {
      onError(new Error('Invalid profile wallet address. Please refresh the page.'));
      return;
    }

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
      // wallet is the profile wallet address (from localStorage 'wallet_address')
      // This is used as the 'profile_wallet' attribute on the learning_follow entity
      // The API route uses getPrivateKey() (global signing wallet) to sign the transaction
      const res = await fetch('/api/learning-follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createFollow',
          wallet: normalizedWallet, // Profile wallet address (API will use as 'profile_wallet' attribute on entity)
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
    <div className="animate-fade-in space-y-8">
      <div className="text-center">
        <div
          className="mb-4 text-6xl"
          style={{
            filter: 'drop-shadow(0 0 20px rgba(34, 197, 94, 0.6))',
          }}
        >
          🌲
        </div>
        <h2
          className="mb-4 text-4xl font-bold text-white drop-shadow-lg dark:text-white md:text-5xl"
          style={{
            textShadow: '0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3)',
          }}
        >
          Join a Learning Community
        </h2>
        <p
          className="mb-8 text-lg text-gray-200 drop-shadow-md dark:text-gray-300"
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
            className="w-full rounded-xl border-2 border-white/30 bg-white/90 px-6 py-4 text-lg text-gray-900 shadow-lg backdrop-blur-md transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500 dark:border-white/20 dark:bg-gray-900/90 dark:text-gray-100"
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
              `TTL: 1 year (31536000 seconds)`,
            ]}
            label="Continue"
          >
            <button
              onClick={handleFollow}
              disabled={!selectedSkill || isSubmitting}
              className="w-full rounded-xl bg-green-600 px-6 py-4 text-lg font-medium text-white shadow-lg transition-all duration-200 hover:bg-green-700 hover:shadow-xl disabled:cursor-not-allowed disabled:bg-gray-400 disabled:opacity-50"
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
            className="w-full rounded-xl bg-green-600 px-6 py-4 text-lg font-medium text-white shadow-lg transition-all duration-200 hover:bg-green-700 hover:shadow-xl disabled:cursor-not-allowed disabled:bg-gray-400 disabled:opacity-50"
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
