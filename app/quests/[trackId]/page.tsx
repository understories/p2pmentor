/**
 * Quest Detail Page
 *
 * Displays a quest track with all steps, progress tracking, and completion.
 * Uses the new quest engine with QuestStep types and evidence tracking.
 *
 * Route: /quests/[trackId]
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { BetaGate } from '@/components/auth/BetaGate';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { useProgressReconciliation } from '@/lib/hooks/useProgressReconciliation';
import type { LoadedQuest } from '@/lib/quests';
import type { QuestProgress } from '@/lib/arkiv/questProgress';
import { QuestStepRenderer } from '@/components/quests/QuestStepRenderer';
import { EvidencePanel } from '@/components/quests/EvidencePanel';
import { SkillSuggestionPrompt } from '@/components/quests/SkillSuggestionPrompt';
import { QUEST_ENTITY_MODE, SPACE_ID } from '@/lib/config';

export default function QuestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const trackId = params.trackId as string;

  const [wallet, setWallet] = useState<string | null>(null);
  const [quest, setQuest] = useState<LoadedQuest | null>(null);
  const [questEntityKey, setQuestEntityKey] = useState<string | null>(null);
  const [questTxHash, setQuestTxHash] = useState<string | null>(null);
  const [questSource, setQuestSource] = useState<string | null>(null);
  const [progress, setProgress] = useState<QuestProgress[]>([]);
  const [completion, setCompletion] = useState<{
    completedSteps: number;
    totalSteps: number;
    progressPercent: number;
    requiredComplete: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reconciliation = useProgressReconciliation();
  const arkivBuilderMode = useArkivBuilderMode();
  const [badgeIssued, setBadgeIssued] = useState(false);
  const [badgeEntityKey, setBadgeEntityKey] = useState<string | null>(null);
  const [badgeTxHash, setBadgeTxHash] = useState<string | null>(null);
  const [badgeError, setBadgeError] = useState<string | null>(null);
  const [dismissedSkillSuggestions, setDismissedSkillSuggestions] = useState<Set<string>>(new Set());

  // Check and issue badge if eligible
  const checkAndIssueBadge = async () => {
    if (!wallet || !quest || !quest.badge) return;

    try {
      // Check eligibility
      const eligibilityRes = await fetch('/api/badges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check-eligibility',
          wallet,
          questId: quest.questId,
          trackId,
        }),
      });

      const eligibilityData = await eligibilityRes.json();

      if (eligibilityData.ok && eligibilityData.eligibility.eligible) {
        // Issue badge
        const issueRes = await fetch('/api/badges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'issue',
            wallet,
            badgeType: quest.badge.id,
            questId: quest.questId,
            evidenceRefs: eligibilityData.eligibility.evidenceRefs,
            questVersion: quest.version || '1',
          }),
        });

        const issueData = await issueRes.json();

        if (issueData.ok) {
          setBadgeIssued(true);
          setBadgeError(null);
          // Store badge entity info for Arkiv builder mode
          setBadgeEntityKey(issueData.key || null);
          setBadgeTxHash(issueData.txHash || null);
        } else {
          setBadgeError(issueData.error || 'Failed to issue badge');
        }
      }
    } catch (err: any) {
      console.error('Error checking/issuing badge:', err);
      setBadgeError(err.message || 'Failed to process badge');
    }
  };

  // Load wallet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (!address) {
        router.push('/auth');
        return;
      }
      setWallet(address);
    }
  }, [router]);

  // Load quest
  useEffect(() => {
    if (!trackId) return;

    const loadQuest = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/quests?trackId=${trackId}`);
        const data = await res.json();

        if (!data.ok || !data.quest) {
          setError(data.error || 'Quest not found');
          return;
        }

        setQuest(data.quest);
        // Store entity info for Arkiv builder mode
        setQuestEntityKey(data.entityKey || null);
        setQuestTxHash(data.txHash || null);
        setQuestSource(data.source || null);
      } catch (err: any) {
        console.error('Error loading quest:', err);
        setError('Failed to load quest');
      } finally {
        setLoading(false);
      }
    };

    loadQuest();
  }, [trackId]);

  // Load progress
  useEffect(() => {
    if (!wallet || !quest) return;

    const loadProgress = async () => {
      try {
        const res = await fetch(
          `/api/quests/progress?wallet=${wallet}&questId=${quest.questId}&trackId=${trackId}`
        );
        const data = await res.json();

        if (data.ok) {
          setProgress(data.progress || []);
          setCompletion(data.completion || null);

          // Check if badge already issued
          if (quest.badge) {
            const badgeRes = await fetch(
              `/api/badges?wallet=${wallet}&badgeType=${quest.badge.id}`
            );
            const badgeData = await badgeRes.json();
            if (badgeData.ok && badgeData.badge) {
              setBadgeIssued(true);
              // Store badge entity info for Arkiv builder mode
              setBadgeEntityKey(badgeData.entityKey || null);
              setBadgeTxHash(badgeData.txHash || null);
            } else if (data.completion && data.completion.requiredComplete) {
              // Quest complete but badge not issued yet - check eligibility
              checkAndIssueBadge();
            }
          }
        }
      } catch (err: any) {
        console.error('Error loading progress:', err);
      }
    };

    loadProgress();

    // Poll for progress updates (to catch indexer confirmations)
    const interval = setInterval(loadProgress, 5000);
    return () => clearInterval(interval);
  }, [wallet, quest, trackId]);

  // Check if step is completed and get progress data
  const getStepProgressData = (stepId: string): {
    completed: boolean;
    txHash?: string;
    entityKey?: string;
  } => {
    // First check indexed progress
    const stepProgress = progress.find((p) => p.stepId === stepId);
    if (stepProgress) {
      return {
        completed: true,
        txHash: stepProgress.txHash,
        entityKey: stepProgress.key,
      };
    }

    // Check reconciliation state (for pending/submitted steps)
    const pending = reconciliation.getStepStatus(stepId);
    if (pending && (pending.status === 'indexed' || pending.status === 'submitted')) {
      return {
        completed: true,
        txHash: pending.txHash,
        entityKey: pending.entityKey,
      };
    }

    return { completed: false };
  };

  // Handle step completion
  const handleStepComplete = async (stepId: string, stepType: string) => {
    if (!wallet || !quest) return;

    // Mark as pending (optimistic)
    reconciliation.markPending(stepId, {
      stepId,
      completedAt: new Date().toISOString(),
      evidenceType: 'completion',
    });

    try {
      // Record progress
      const res = await fetch('/api/quests/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          questId: quest.questId,
          stepId,
          stepType,
          evidenceData: {},
        }),
      });

      const data = await res.json();

      if (data.ok && data.txHash) {
        // Update reconciliation with txHash and entityKey immediately
        reconciliation.markSubmitted(
          stepId,
          data.txHash,
          data.key,
          async () => {
            // Check function for polling
            const checkRes = await fetch(
              `/api/quests/progress?wallet=${wallet}&questId=${quest.questId}&trackId=${trackId}`
            );
            const checkData = await checkRes.json();
            if (checkData.ok) {
              const stepProgress = checkData.progress.find(
                (p: QuestProgress) => p.stepId === stepId
              );
              if (stepProgress) {
                // Mark as indexed when found
                reconciliation.markIndexed(stepId);
                return true;
              }
            }
            return false;
          }
        );

        // Reload progress after a delay
        setTimeout(() => {
          fetch(
            `/api/quests/progress?wallet=${wallet}&questId=${quest.questId}&trackId=${trackId}`
          )
            .then((r) => r.json())
            .then((d) => {
              if (d.ok) {
                setProgress(d.progress || []);
                setCompletion(d.completion || null);

                // Check for badge eligibility if quest is complete
                if (d.completion && d.completion.requiredComplete && quest.badge) {
                  checkAndIssueBadge();
                }
              }
            });
        }, 2000);
      } else {
        reconciliation.markError(stepId, data.error || 'Failed to record progress');
      }
    } catch (err: any) {
      console.error('Error completing step:', err);
      reconciliation.markError(stepId, err.message || 'Failed to complete step');
    }
  };

  // Handle skill addition from quest completion
  const handleAddSkillFromQuest = async (skillName: string, proficiency?: number) => {
    if (!wallet || !quest) return;

    // Find the current step that was just completed (most recent in progress)
    const recentProgress = progress
      .filter((p) => p.questId === quest.questId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!recentProgress) {
      throw new Error('No recent step completion found');
    }

    const res = await fetch('/api/skills/from-quest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet,
        skillName,
        stepId: recentProgress.stepId,
        questId: quest.questId,
        proficiency,
        progressEntityKey: recentProgress.key,
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Failed to add skill');
    }

    return data;
      } else {
        reconciliation.markError(stepId, data.error || 'Failed to record progress');
      }
    } catch (err: any) {
      console.error('Error completing step:', err);
      reconciliation.markError(stepId, err.message || 'Failed to complete step');
    }
  };

  if (loading) {
    return (
      <BetaGate>
        <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
          <div className="max-w-4xl mx-auto">
            <BackButton href="/learner-quests" />
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `GET /api/quests?trackId=${trackId}`,
                  `Mode: ${QUEST_ENTITY_MODE}`,
                  QUEST_ENTITY_MODE === 'entity'
                    ? `Query: type='quest_definition', track='${trackId}'`
                    : QUEST_ENTITY_MODE === 'dual'
                    ? `Query: type='quest_definition', track='${trackId}' (fallback to file)`
                    : `Load from: content/quests/${trackId}/quest.json`,
                  ``,
                  `Returns: LoadedQuest with stepContent`,
                  `Source: ${QUEST_ENTITY_MODE === 'entity' ? 'entity' : QUEST_ENTITY_MODE === 'dual' ? 'entity or file' : 'file'}`,
                ]}
                label="Loading Quest"
              >
                <LoadingSpinner text="Loading quest..." className="py-12" />
              </ArkivQueryTooltip>
            ) : (
              <LoadingSpinner text="Loading quest..." className="py-12" />
            )}
          </div>
        </div>
      </BetaGate>
    );
  }

  if (error || !quest) {
    return (
      <BetaGate>
        <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
          <div className="max-w-4xl mx-auto">
            <BackButton href="/learner-quests" />
            <EmptyState
              title={error || 'Quest not found'}
              description="The quest you're looking for doesn't exist or couldn't be loaded."
            />
          </div>
        </div>
      </BetaGate>
    );
  }

  const sortedSteps = [...quest.steps].sort((a, b) => a.order - b.order);

  return (
    <BetaGate>
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <BackButton href="/learner-quests" />

          {/* Quest Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold mb-2">{quest.title}</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {quest.description}
            </p>

            {/* Progress Bar */}
            {completion && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    Progress: {completion.completedSteps} / {completion.totalSteps} steps
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {completion.progressPercent}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-emerald-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${completion.progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Quest Metadata */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span>Duration: {quest.estimatedDuration}</span>
              <span>Difficulty: {quest.difficulty}</span>
              <span>Steps: {quest.steps.length}</span>
            </div>

            {/* Arkiv Builder Mode: Quest Entity Info */}
            {arkivBuilderMode && questEntityKey && (
              <div className="mt-4 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                <div className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-2 uppercase tracking-wide">
                  Quest Definition Entity
                </div>
                <div className="mb-2">
                  <div className="text-xs text-blue-700 dark:text-blue-300 mb-1">
                    Entity Key:
                  </div>
                  <div className="font-mono text-xs text-blue-900 dark:text-blue-100 break-all">
                    {questEntityKey}
                  </div>
                </div>
                {questTxHash && (
                  <div className="mb-2">
                    <div className="text-xs text-blue-700 dark:text-blue-300 mb-1">
                      Transaction Hash:
                    </div>
                    <div className="font-mono text-xs text-blue-900 dark:text-blue-100 break-all">
                      {questTxHash}
                    </div>
                  </div>
                )}
                {questSource && (
                  <div className="mb-2">
                    <div className="text-xs text-blue-700 dark:text-blue-300 mb-1">
                      Source:
                    </div>
                    <div className="text-xs text-blue-900 dark:text-blue-100 font-medium">
                      {questSource === 'entity' ? 'Arkiv Entity' : 'File-based'}
                    </div>
                  </div>
                )}
                <div className="mt-2">
                  <ViewOnArkivLink
                    entityKey={questEntityKey}
                    txHash={questTxHash || undefined}
                    label="View Quest Definition on Arkiv"
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            {/* Evidence Panel - Show My Proof */}
            {wallet && progress.length > 0 && (
              <div className="mt-6">
                <EvidencePanel
                  progress={progress}
                  wallet={wallet}
                  questId={quest.questId}
                />
              </div>
            )}

            {/* Badge Status */}
            {quest.badge && (
              <div className={`mt-4 p-3 rounded-lg border ${
                badgeIssued
                  ? 'border-emerald-500 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                  : completion?.requiredComplete
                  ? 'border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
              }`}>
                {arkivBuilderMode && completion?.requiredComplete && !badgeIssued ? (
                  <ArkivQueryTooltip
                    query={[
                      `checkAndIssueBadge()`,
                      ``,
                      `1. Check Eligibility:`,
                      `   POST /api/badges { action: 'check-eligibility', wallet, questId, trackId }`,
                      `   Query: type='quest_step_progress', wallet='${wallet?.slice(0, 10)}...', questId='${quest.questId}'`,
                      `   Returns: { eligible: boolean, evidenceRefs: [...] }`,
                      ``,
                      `2. If Eligible, Issue Badge:`,
                      `   POST /api/badges { action: 'issue', wallet, badgeType, questId, evidenceRefs, questVersion }`,
                      `   Creates: type='proof_of_skill_badge'`,
                      `   Entity Key: badge:${SPACE_ID}:${wallet?.slice(0, 10)}...:${quest.badge.id}`,
                      `   Attributes: wallet, badgeType, questId, spaceId, issuedAt`,
                      `   Payload: evidenceRefs, questVersion, version, issuer`,
                      `   TTL: 1 year`,
                    ]}
                    label="Badge Check"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏆</span>
                      <div className="flex-1">
                        <div className="font-semibold text-sm">
                          {badgeIssued
                            ? `Badge Earned: ${quest.badge.name}`
                            : completion?.requiredComplete
                            ? `Eligible for: ${quest.badge.name}`
                            : `Complete all steps to earn: ${quest.badge.name}`}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {quest.badge.description}
                        </div>
                      </div>
                      {badgeError && (
                        <div className="text-xs text-red-600 dark:text-red-400">
                          {badgeError}
                        </div>
                      )}
                    </div>
                  </ArkivQueryTooltip>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏆</span>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">
                        {badgeIssued
                          ? `Badge Earned: ${quest.badge.name}`
                          : completion?.requiredComplete
                          ? `Eligible for: ${quest.badge.name}`
                          : `Complete all steps to earn: ${quest.badge.name}`}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {quest.badge.description}
                      </div>
                    </div>
                    {badgeError && (
                      <div className="text-xs text-red-600 dark:text-red-400">
                        {badgeError}
                      </div>
                    )}
                  </div>
                )}
                {/* Arkiv Builder Mode: Badge Entity Info */}
                {arkivBuilderMode && badgeIssued && badgeEntityKey && (
                  <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
                    <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 mb-2 uppercase tracking-wide">
                      Badge Entity
                    </div>
                    <div className="mb-2">
                      <div className="text-xs text-emerald-700 dark:text-emerald-300 mb-1">
                        Entity Key:
                      </div>
                      <div className="font-mono text-xs text-emerald-900 dark:text-emerald-100 break-all">
                        {badgeEntityKey}
                      </div>
                    </div>
                    {badgeTxHash && (
                      <div className="mb-2">
                        <div className="text-xs text-emerald-700 dark:text-emerald-300 mb-1">
                          Transaction Hash:
                        </div>
                        <div className="font-mono text-xs text-emerald-900 dark:text-emerald-100 break-all">
                          {badgeTxHash}
                        </div>
                      </div>
                    )}
                    <div className="mt-2">
                      <ViewOnArkivLink
                        entityKey={badgeEntityKey}
                        txHash={badgeTxHash || undefined}
                        label="View Badge on Arkiv"
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Track Overview - All Steps */}
          <div className="mb-8 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Track Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedSteps.map((step) => {
                const stepProgress = getStepProgressData(step.stepId);
                const isCompleted = stepProgress.completed;
                const isLocked = step.required && !isCompleted && sortedSteps.some((s, idx) => {
                  if (s.stepId === step.stepId) return false;
                  if (s.order >= step.order) return false;
                  return s.required && !getStepProgressData(s.stepId).completed;
                });

                return (
                  <div
                    key={step.stepId}
                    className={`p-3 rounded border-2 transition-all cursor-pointer ${
                      isCompleted
                        ? 'border-emerald-500 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                        : isLocked
                        ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 opacity-60'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700'
                    }`}
                    onClick={() => {
                      if (!isLocked) {
                        document.getElementById(`step-${step.stepId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        Step {step.order}
                      </span>
                      {isCompleted && (
                        <span className="text-emerald-600 dark:text-emerald-400 text-xs">✓</span>
                      )}
                      {isLocked && (
                        <span className="text-gray-400 dark:text-gray-500 text-xs">🔒</span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {step.title}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        step.type === 'READ'
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          : step.type === 'DO'
                          ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                          : step.type === 'QUIZ'
                          ? 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}>
                        {step.type}
                      </span>
                      {!step.required && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">(Optional)</span>
                      )}
                    </div>
                    {/* Evidence link in overview */}
                    {isCompleted && stepProgress.entityKey && arkivBuilderMode && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <ViewOnArkivLink
                          entityKey={stepProgress.entityKey}
                          txHash={stepProgress.txHash}
                          label=""
                          className="text-xs"
                          icon="🔗"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Steps List */}
          <div className="space-y-6">
            {sortedSteps.map((step) => {
              const progressData = getStepProgressData(step.stepId);
              const pending = reconciliation.getStepStatus(step.stepId);
              const stepContent = quest.stepContent[step.stepId] || '';

              const showSkillSuggestion = 
                step.skillSuggestion &&
                progressData.completed &&
                !dismissedSkillSuggestions.has(step.stepId);

              return (
                <div key={step.stepId} id={`step-${step.stepId}`}>
                  <QuestStepRenderer
                    step={step}
                    content={stepContent}
                    completed={progressData.completed}
                    pendingStatus={pending?.status}
                    txHash={progressData.txHash}
                    entityKey={progressData.entityKey}
                    questId={quest.questId}
                    onComplete={() => handleStepComplete(step.stepId, step.type)}
                  />
                  {/* Skill Suggestion Prompt */}
                  {showSkillSuggestion && (
                    <SkillSuggestionPrompt
                      skillName={step.skillSuggestion.skillName}
                      skillId={step.skillSuggestion.skillId}
                      proficiency={step.skillSuggestion.proficiency}
                      message={step.skillSuggestion.message}
                      stepId={step.stepId}
                      questId={quest.questId}
                      onAddSkill={async (skillName, proficiency) => {
                        await handleAddSkillFromQuest(skillName, step.stepId, proficiency);
                      }}
                      onDismiss={() => {
                        setDismissedSkillSuggestions((prev) => new Set([...prev, step.stepId]));
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </BetaGate>
  );
}
