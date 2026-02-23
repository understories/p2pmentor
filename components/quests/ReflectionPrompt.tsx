/**
 * Reflection Prompt Component
 *
 * "Explain in your own words" prompts stored as lightweight
 * Arkiv entities. Supports public/private visibility (user opt-in).
 *
 * Week 2 (Feb 8-14) - Intrinsic motivation design
 */

'use client';

import { useState, useCallback } from 'react';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import type { ReflectionVisibility } from '@/lib/arkiv/reflection';

interface ReflectionPromptProps {
  stepId: string;
  questId: string;
  prompt?: string;
  wallet?: string;
  progressEntityKey?: string;
  existingReflection?: string;
  existingEntityKey?: string;
}

export function ReflectionPrompt({
  stepId,
  questId,
  prompt = 'Explain this concept in your own words:',
  wallet,
  progressEntityKey,
  existingReflection,
  existingEntityKey,
}: ReflectionPromptProps) {
  const arkivBuilderMode = useArkivBuilderMode();
  const [reflectionText, setReflectionText] = useState(existingReflection || '');
  const [visibility, setVisibility] = useState<ReflectionVisibility>('private');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>(
    existingReflection ? 'submitted' : 'idle'
  );
  const [entityKey, setEntityKey] = useState<string | null>(existingEntityKey || null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!existingReflection);

  const handleSubmit = useCallback(async () => {
    if (!wallet || reflectionText.length < 10) return;

    setStatus('submitting');
    setError(null);

    try {
      const res = await fetch('/api/quests/reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          questId,
          stepId,
          prompt,
          reflectionText,
          visibility,
          progressEntityKey: progressEntityKey || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit reflection');
      }

      setStatus('submitted');
      if (data.reflection?.key) setEntityKey(data.reflection.key);
      if (data.reflection?.txHash) setTxHash(data.reflection.txHash);

      if (data.pending) {
        setEntityKey(null);
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Failed to submit reflection');
    }
  }, [wallet, questId, stepId, prompt, reflectionText, visibility, progressEntityKey]);

  if (status === 'submitted' && !expanded) {
    return (
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-indigo-600 dark:text-indigo-400">&#x270D;</span>
            <span className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
              Reflection saved
            </span>
            {visibility === 'public' && (
              <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                Public
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {arkivBuilderMode && entityKey && (
              <ViewOnArkivLink entityKey={entityKey} txHash={txHash || undefined} />
            )}
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-indigo-600 underline dark:text-indigo-400"
            >
              Edit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-900/20">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-indigo-600 dark:text-indigo-400">&#x270D;</span>
        <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">
          Reflection
        </span>
      </div>

      <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">{prompt}</p>

      {arkivBuilderMode && (
        <ArkivQueryTooltip
          query={[
            `POST /api/quests/reflection`,
            `Creates: type='quest_reflection' entity`,
            `Attributes: wallet, questId, stepId, visibility, spaceId`,
            `Payload: prompt, reflectionText, progressEntityKey`,
          ]}
          label="Reflection Entity"
        >
          <div className="mb-2 text-xs text-indigo-500">
            Arkiv Builder Mode: hover for query details
          </div>
        </ArkivQueryTooltip>
      )}

      <textarea
        value={reflectionText}
        onChange={(e) => setReflectionText(e.target.value)}
        placeholder="Write your reflection here... (minimum 10 characters)"
        className="mb-3 w-full rounded-lg border border-indigo-300 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-indigo-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
        rows={4}
        disabled={status === 'submitting'}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={visibility === 'public'}
              onChange={(e) => setVisibility(e.target.checked ? 'public' : 'private')}
              className="rounded"
              disabled={status === 'submitting'}
            />
            Share publicly
          </label>
          <span className="text-xs text-gray-400">{reflectionText.length}/2000</span>
        </div>

        <div className="flex items-center gap-2">
          {status === 'submitted' && (
            <button
              onClick={() => setExpanded(false)}
              className="rounded px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Collapse
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={status === 'submitting' || reflectionText.length < 10 || !wallet}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              status === 'submitting' || reflectionText.length < 10 || !wallet
                ? 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-500'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {status === 'submitting' ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner text="" className="py-0" />
                Saving...
              </span>
            ) : status === 'submitted' ? (
              'Update Reflection'
            ) : (
              'Save Reflection'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          <button
            onClick={handleSubmit}
            className="mt-1 text-xs text-red-700 underline dark:text-red-300"
          >
            Try again
          </button>
        </div>
      )}

      {status === 'submitted' && entityKey && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
          <div className="flex items-center justify-between">
            <span className="text-sm text-emerald-700 dark:text-emerald-300">
              Reflection saved on Arkiv
            </span>
            {arkivBuilderMode && (
              <ViewOnArkivLink entityKey={entityKey} txHash={txHash || undefined} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
