/**
 * Evidence Panel Component
 *
 * Displays all proof artifacts (Arkiv entities/tx hashes) produced by learning.
 * Shows evidence grouped by quest track with entity keys, transaction hashes,
 * and "View on Arkiv" links.
 *
 * Week 1 (Feb 1-7) - Progress visualization + "proof UX"
 */

'use client';

import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import type { QuestProgress } from '@/lib/arkiv/questProgress';

interface EvidencePanelProps {
  progress: QuestProgress[];
  wallet: string;
  questId?: string; // Optional: filter by specific quest
  className?: string;
}

/**
 * Get human-readable evidence type label
 */
function getEvidenceTypeLabel(evidenceType: string): string {
  const labels: Record<string, string> = {
    completion: 'Completion',
    entity_created: 'Entity Created',
    quiz_result: 'Quiz Result',
    submission: 'Submission',
    session_completed: 'Session Completed',
    query_proof: 'Query Proof',
    verification_output: 'Verification Output',
    checklist_completion: 'Checklist Completion',
  };
  return labels[evidenceType] || evidenceType;
}

/**
 * Get evidence type color classes
 */
function getEvidenceTypeColor(evidenceType: string): string {
  const colors: Record<string, string> = {
    completion:
      'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800',
    entity_created:
      'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800',
    quiz_result:
      'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800',
    submission:
      'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800',
    session_completed:
      'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
    query_proof:
      'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800',
    verification_output:
      'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
    checklist_completion:
      'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200 border-pink-200 dark:border-pink-800',
  };
  return (
    colors[evidenceType] ||
    'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700'
  );
}

export function EvidencePanel({ progress, wallet, questId, className = '' }: EvidencePanelProps) {
  const arkivBuilderMode = useArkivBuilderMode();

  // Filter by questId if provided
  const filteredProgress = questId ? progress.filter((p) => p.questId === questId) : progress;

  if (filteredProgress.length === 0) {
    return (
      <div
        className={`rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50 ${className}`}
      >
        <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Evidence Trail
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          No evidence yet. Complete quest steps to generate proof artifacts.
        </p>
      </div>
    );
  }

  // Group by questId
  const groupedByQuest = filteredProgress.reduce(
    (acc, p) => {
      if (!acc[p.questId]) {
        acc[p.questId] = [];
      }
      acc[p.questId].push(p);
      return acc;
    },
    {} as Record<string, QuestProgress[]>
  );

  return (
    <div
      className={`rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200">Evidence Trail</h3>
        {arkivBuilderMode && (
          <ArkivQueryTooltip
            query={[
              `GET /api/quests/progress?wallet=${wallet.toLowerCase()}${questId ? `&questId=${questId}` : ''}`,
              `Query: type='quest_step_progress', wallet='${wallet.slice(0, 8)}...'${questId ? `, questId='${questId}'` : ''}`,
              `Returns: Array of ${filteredProgress.length} progress entities with evidence`,
              `Each entity contains: stepId, evidenceType, entityKey, txHash`,
            ]}
            label="Evidence Query"
          >
            <div className="cursor-help rounded border border-blue-300 bg-blue-100 px-2 py-1 font-mono text-xs text-blue-600 dark:border-blue-700 dark:bg-blue-900/50 dark:text-blue-400">
              Query
            </div>
          </ArkivQueryTooltip>
        )}
      </div>

      <div className="space-y-4">
        {Object.entries(groupedByQuest).map(([qId, questProgress]) => (
          <div key={qId} className="space-y-2">
            {!questId && (
              <div className="mb-2 text-xs font-medium text-blue-700 dark:text-blue-300">
                Quest: {qId}
              </div>
            )}
            <div className="space-y-2">
              {questProgress.map((p) => {
                const evidenceType = p.evidence?.evidenceType || 'completion';
                return (
                  <div key={p.key} className="rounded border bg-white p-3 dark:bg-gray-800/50">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className={`rounded border px-2 py-0.5 text-xs font-medium ${getEvidenceTypeColor(evidenceType)}`}
                          >
                            {getEvidenceTypeLabel(evidenceType)}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            Step: {p.stepId}
                          </span>
                        </div>
                        <div className="break-all font-mono text-xs text-gray-500 dark:text-gray-500">
                          Entity: {p.key}
                        </div>
                        {p.txHash && (
                          <div className="mt-1 break-all font-mono text-xs text-gray-500 dark:text-gray-500">
                            Tx: {p.txHash}
                          </div>
                        )}
                        {p.createdAt && (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {new Date(p.createdAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <ViewOnArkivLink
                          entityKey={p.key}
                          txHash={p.txHash}
                          label=""
                          className="text-xs"
                          icon="🔗"
                        />
                      </div>
                    </div>
                    {/* Arkiv Builder Mode: Show evidence details */}
                    {arkivBuilderMode && p.evidence && (
                      <div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
                        <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                          Evidence Details:
                        </div>
                        <div className="break-all font-mono text-xs text-gray-600 dark:text-gray-400">
                          {JSON.stringify(p.evidence, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 border-t border-blue-200 pt-3 dark:border-blue-800">
        <div className="text-xs text-blue-700 dark:text-blue-300">
          Total evidence artifacts: {filteredProgress.length}
        </div>
      </div>
    </div>
  );
}
