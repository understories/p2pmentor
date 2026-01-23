/**
 * Skill Suggestion Prompt Component
 *
 * Shows a prompt after quest step completion suggesting the user add/upgrade
 * a related skill to their profile.
 *
 * Week 1 (Feb 1-7) - Skill linkage feature
 */

'use client';

import { useState } from 'react';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';

interface SkillSuggestionPromptProps {
  skillName: string;
  skillId?: string;
  proficiency?: number;
  message?: string;
  stepId: string;
  questId: string;
  onAddSkill: (skillName: string, stepId: string, proficiency?: number) => Promise<void>;
  onDismiss: () => void;
}

export function SkillSuggestionPrompt({
  skillName,
  skillId,
  proficiency,
  message,
  stepId,
  questId,
  onAddSkill,
  onDismiss,
}: SkillSuggestionPromptProps) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skillEntityKey, setSkillEntityKey] = useState<string | null>(null);
  const [skillTxHash, setSkillTxHash] = useState<string | null>(null);
  const arkivBuilderMode = useArkivBuilderMode();

  const handleAddSkill = async (skill: string, step: string, prof?: number) => {
    try {
      setAdding(true);
      setError(null);
      await onAddSkill(skill, step, prof);
      setAdded(true);
    } catch (err: any) {
      setError(err.message || 'Failed to add skill');
    } finally {
      setAdding(false);
    }
  };

  if (added) {
    return (
      <div className="mt-4 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 dark:text-emerald-400">✓</span>
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Skill "{skillName}" added to your profile
            </span>
          </div>
          {arkivBuilderMode && skillEntityKey && (
            <ViewOnArkivLink
              entityKey={skillEntityKey}
              txHash={skillTxHash || undefined}
              label=""
              className="text-xs"
              icon="🔗"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">💡</span>
            <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200">
              Skill Suggestion
            </h4>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            {message || `You've completed this step! Would you like to add "${skillName}" to your profile?`}
          </p>
          {proficiency && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
              Suggested proficiency level: {proficiency}/5
            </p>
          )}
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 mb-2">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAddSkill(skillName, stepId, proficiency)}
              disabled={adding}
              className="px-3 py-1.5 text-xs font-medium rounded bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {adding ? 'Adding...' : 'Add to Profile'}
            </button>
            <button
              onClick={onDismiss}
              disabled={adding}
              className="px-3 py-1.5 text-xs font-medium rounded border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
        {arkivBuilderMode && (
          <ArkivQueryTooltip
            query={[
              `POST /api/skills/from-quest`,
              `Body: { skillName: '${skillName}', stepId: '${stepId}', questId: '${questId}' }`,
              `Creates: type='skill' (if doesn't exist)`,
              `Creates: type='quest_completion_skill_link'`,
              `Links quest step completion to skill profile`,
            ]}
            label="Skill Linkage"
          >
            <div className="text-xs text-blue-600 dark:text-blue-400 font-mono cursor-help border border-blue-300 dark:border-blue-700 rounded px-2 py-1 bg-blue-100 dark:bg-blue-900/50">
              Query
            </div>
          </ArkivQueryTooltip>
        )}
      </div>
    </div>
  );
}
