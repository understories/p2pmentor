/**
 * Skill Suggestion Prompt Component
 *
 * Shows a prompt after quest step completion suggesting the user add/upgrade
 * a related skill to their profile.
 *
 * Week 1 (Feb 1-7) - Skill linkage feature
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { getQuestCompletionSkillLinks } from '@/lib/arkiv/questSkillLink';

interface SkillSuggestionPromptProps {
  skillName: string;
  skillId?: string;
  proficiency?: number;
  message?: string;
  stepId: string;
  questId: string;
  wallet: string;
  onAddSkill: (skillName: string, stepId: string, proficiency?: number) => Promise<any>;
  onDismiss: () => void;
}

type TransactionStatus = 'idle' | 'pending' | 'submitted' | 'indexed' | 'error';

export function SkillSuggestionPrompt({
  skillName,
  skillId,
  proficiency,
  message,
  stepId,
  questId,
  wallet,
  onAddSkill,
  onDismiss,
}: SkillSuggestionPromptProps) {
  const [status, setStatus] = useState<TransactionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [skillEntityKey, setSkillEntityKey] = useState<string | null>(null);
  const [skillTxHash, setSkillTxHash] = useState<string | null>(null);
  const [linkEntityKey, setLinkEntityKey] = useState<string | null>(null);
  const [linkTxHash, setLinkTxHash] = useState<string | null>(null);
  const arkivBuilderMode = useArkivBuilderMode();

  // Poll for skill link entity after submission (following useProgressReconciliation pattern)
  const pollForSkillLink = useCallback(async (maxAttempts = 10) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const delay = Math.min(1000 * Math.pow(1.5, attempt), 10000); // Exponential backoff, max 10s
      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        const links = await getQuestCompletionSkillLinks({
          wallet,
          questId,
          stepId,
        });

        const foundLink = links.find(
          (link) => link.questId === questId && link.stepId === stepId
        );

        if (foundLink) {
          setStatus('indexed');
          setLinkEntityKey(foundLink.key);
          setLinkTxHash(foundLink.txHash || null);
          return true;
        }
      } catch (err) {
        console.warn('[SkillSuggestionPrompt] Polling error:', err);
      }
    }

    // Max attempts reached - leave as submitted (user can refresh)
    return false;
  }, [wallet, questId, stepId]);

  const handleAddSkill = async (skill: string, step: string, prof?: number) => {
    try {
      setStatus('pending');
      setError(null);

      const result = await onAddSkill(skill, step, prof);

      // Check if transaction is pending (following asks/offers pattern)
      if (result.pending) {
        setStatus('submitted');
        // Store entity info if available
        if (result.link?.txHash) {
          setLinkTxHash(result.link.txHash);
        }
        if (result.skill?.key) {
          setSkillEntityKey(result.skill.key);
        }
        // Start polling for skill link entity
        pollForSkillLink();
      } else if (result.link?.key && result.link?.txHash) {
        // Transaction completed immediately
        setStatus('indexed');
        setLinkEntityKey(result.link.key);
        setLinkTxHash(result.link.txHash);
        if (result.skill?.key) {
          setSkillEntityKey(result.skill.key);
        }
      } else {
        // Fallback: assume success if no pending flag
        setStatus('indexed');
        if (result.link?.key) setLinkEntityKey(result.link.key);
        if (result.link?.txHash) setLinkTxHash(result.link.txHash);
        if (result.skill?.key) setSkillEntityKey(result.skill.key);
      }
    } catch (err: any) {
      setStatus('error');
      const errorMessage = err.message || 'Failed to add skill';

      // Check for transaction rate limiting (following transaction-utils pattern)
      if (errorMessage.includes('still processing') ||
          errorMessage.includes('wait a moment')) {
        setError('Transaction is still processing. Please wait a moment and try again.');
      } else {
        setError(errorMessage);
      }
    }
  };

  // Success state (indexed)
  if (status === 'indexed') {
    return (
      <div className="mt-4 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 dark:text-emerald-400">✓</span>
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Skill "{skillName}" added to your profile
            </span>
          </div>
          {arkivBuilderMode && linkEntityKey && (
            <ViewOnArkivLink
              entityKey={linkEntityKey}
              txHash={linkTxHash || undefined}
              label=""
              className="text-xs"
              icon="🔗"
            />
          )}
        </div>
      </div>
    );
  }

  // Submitted state (waiting for indexing)
  if (status === 'submitted') {
    return (
      <div className="mt-4 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <LoadingSpinner text="" className="py-0" />
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Skill link submitted
              </span>
            </div>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              Transaction is being processed. Please wait a moment and refresh if needed.
            </p>
            {arkivBuilderMode && linkTxHash && (
              <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400 font-mono">
                TxHash: {linkTxHash.slice(0, 10)}...
              </div>
            )}
          </div>
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
          {error && status === 'error' && (
            <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <p className="text-xs text-red-600 dark:text-red-400 mb-1">
                {error}
              </p>
              <button
                onClick={() => {
                  setStatus('idle');
                  setError(null);
                  handleAddSkill(skillName, stepId, proficiency);
                }}
                className="text-xs text-red-700 dark:text-red-300 underline"
              >
                Try again
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAddSkill(skillName, stepId, proficiency)}
              disabled={status === 'pending' || status === 'submitted'}
              className="px-3 py-1.5 text-xs font-medium rounded bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'pending' ? (
                <>
                  <LoadingSpinner text="" className="py-0 mr-1" />
                  Adding...
                </>
              ) : status === 'submitted' ? (
                'Processing...'
              ) : (
                'Add to Profile'
              )}
            </button>
            <button
              onClick={onDismiss}
              disabled={status === 'pending' || status === 'submitted'}
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
