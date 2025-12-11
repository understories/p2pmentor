/**
 * Ask Path Step Component
 * 
 * Simplified form to create an ask during onboarding
 */

'use client';

import { useState, useEffect } from 'react';
import { createAsk } from '@/lib/arkiv/asks';
import { listSkills } from '@/lib/arkiv/skill';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { getWalletClient } from '@/lib/wallet/getWalletClient';
import type { Skill } from '@/lib/arkiv/skill';

interface AskPathStepProps {
  wallet: string;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export function AskPathStep({ wallet, onComplete, onError }: AskPathStepProps) {
  const [message, setMessage] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load user's skills for selection
  useEffect(() => {
    async function loadData() {
      try {
        const [profile, allSkills] = await Promise.all([
          getProfileByWallet(wallet),
          listSkills({ status: 'active', limit: 100 }),
        ]);

        // Filter to user's skills if available
        if (profile?.skillsArray && profile.skillsArray.length > 0) {
          const userSkills = allSkills.filter(skill =>
            profile.skillsArray!.some(userSkill =>
              skill.name_canonical.toLowerCase() === userSkill.toLowerCase()
            )
          );
          setAvailableSkills(userSkills.length > 0 ? userSkills : allSkills.slice(0, 10));
        } else {
          setAvailableSkills(allSkills.slice(0, 10));
        }

        // Pre-select first skill if available
        if (availableSkills.length > 0 && !selectedSkill) {
          setSelectedSkill(availableSkills[0].key);
        }
      } catch (err) {
        console.error('Failed to load skills:', err);
        setAvailableSkills([]);
      } finally {
        setIsLoadingSkills(false);
      }
    }
    loadData();
  }, [wallet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      onError(new Error('Ask message is required'));
      return;
    }

    if (!selectedSkill) {
      onError(new Error('Please select a skill'));
      return;
    }

    setIsSubmitting(true);

    try {
      const skill = availableSkills.find(s => s.key === selectedSkill);

      if (!skill) {
        throw new Error('Selected skill not found');
      }

      // Use API route for ask creation
      const res = await fetch('/api/asks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createAsk',
          wallet,
          skill: skill.name_canonical, // Legacy: kept for backward compatibility
          skill_id: skill.key, // New: preferred for beta
          skill_label: skill.name_canonical, // Derived from Skill entity
          message: message.trim(),
          expiresIn: 86400, // 24 hours default
        }),
      });

      const data = await res.json();
      if (data.ok) {
        onComplete();
      } else {
        throw new Error(data.error || 'Failed to create ask');
      }
    } catch (err) {
      onError(err instanceof Error ? err : new Error('Failed to create ask'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-4">🎓</div>
        <h2 className="text-2xl font-bold mb-2">What are you seeking?</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Your ask will rise into the constellation, visible to mentors who can help.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="skill" className="block text-sm font-medium mb-2">
            Skill <span className="text-red-500">*</span>
          </label>
          <select
            id="skill"
            value={selectedSkill}
            onChange={(e) => setSelectedSkill(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isLoadingSkills || isSubmitting}
          >
            {isLoadingSkills ? (
              <option>Loading skills...</option>
            ) : (
              <>
                <option value="">Select a skill</option>
                {availableSkills.map((skill) => (
                  <option key={skill.key} value={skill.key}>
                    {skill.name_canonical}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium mb-2">
            Your Ask <span className="text-red-500">*</span>
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What are you learning or seeking help with?"
            rows={4}
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            disabled={isSubmitting}
          />
        </div>


        <button
          type="submit"
          disabled={!message.trim() || !selectedSkill || isSubmitting}
          className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
        >
          {isSubmitting ? 'Creating ask...' : 'Create Ask →'}
        </button>
      </form>
    </div>
  );
}
