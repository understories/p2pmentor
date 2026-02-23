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

  const reconciliation = useProgressReconciliation({}, quest?.questId);
  const arkivBuilderMode = useArkivBuilderMode();
  const [badgeIssued, setBadgeIssued] = useState(false);
  const [badgeEntityKey, setBadgeEntityKey] = useState<string | null>(null);
  const [badgeTxHash, setBadgeTxHash] = useState<string | null>(null);
  const [badgeError, setBadgeError] = useState<string | null>(null);
  const [dismissedSkillSuggestions, setDismissedSkillSuggestions] = useState<Set<string>>(
    new Set()
  );

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
  const getStepProgressData = (
    stepId: string
  ): {
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
  const handleStepComplete = async (
    stepId: string,
    stepType: string,
    evidenceData?: Record<string, unknown>
  ) => {
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
          evidenceData: evidenceData || {},
        }),
      });

      const data = await res.json();

      if (data.ok && data.txHash) {
        // Update reconciliation with txHash and entityKey immediately
        reconciliation.markSubmitted(stepId, data.txHash, data.key, async () => {
          // Check function for polling
          const checkRes = await fetch(
            `/api/quests/progress?wallet=${wallet}&questId=${quest.questId}&trackId=${trackId}`
          );
          const checkData = await checkRes.json();
          if (checkData.ok) {
            const stepProgress = checkData.progress.find((p: QuestProgress) => p.stepId === stepId);
            if (stepProgress) {
              // Mark as indexed when found
              reconciliation.markIndexed(stepId);
              return true;
            }
          }
          return false;
        });

        // Reload progress after a delay
        setTimeout(() => {
          fetch(`/api/quests/progress?wallet=${wallet}&questId=${quest.questId}&trackId=${trackId}`)
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
  const handleAddSkillFromQuest = async (
    skillName: string,
    stepId: string,
    proficiency?: number
  ) => {
    if (!wallet || !quest) return;

    // Find progress for this step
    const stepProgress = progress.find((p) => p.stepId === stepId && p.questId === quest.questId);
    if (!stepProgress) {
      throw new Error('Step progress not found. Complete the step first.');
    }

    const res = await fetch('/api/skills/from-quest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet,
        skillName,
        stepId,
        questId: quest.questId,
        proficiency,
        progressEntityKey: stepProgress.key,
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Failed to add skill');
    }

    return data;
  };

  if (loading) {
    return (
      <BetaGate>
        <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
          <div className="mx-auto max-w-4xl">
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
        <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
          <div className="mx-auto max-w-4xl">
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
      <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
        <div className="mx-auto max-w-4xl">
          <BackButton href="/learner-quests" />

          {/* Quest Header */}
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-semibold">{quest.title}</h1>
            <p className="mb-4 text-gray-600 dark:text-gray-400">{quest.description}</p>

            {/* Progress Bar */}
            {completion && (
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Progress: {completion.completedSteps} / {completion.totalSteps} steps
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {completion.progressPercent}%
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-3 rounded-full bg-emerald-600 transition-all duration-300"
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
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-200">
                  Quest Definition Entity
                </div>
                <div className="mb-2">
                  <div className="mb-1 text-xs text-blue-700 dark:text-blue-300">Entity Key:</div>
                  <div className="break-all font-mono text-xs text-blue-900 dark:text-blue-100">
                    {questEntityKey}
                  </div>
                </div>
                {questTxHash && (
                  <div className="mb-2">
                    <div className="mb-1 text-xs text-blue-700 dark:text-blue-300">
                      Transaction Hash:
                    </div>
                    <div className="break-all font-mono text-xs text-blue-900 dark:text-blue-100">
                      {questTxHash}
                    </div>
                  </div>
                )}
                {questSource && (
                  <div className="mb-2">
                    <div className="mb-1 text-xs text-blue-700 dark:text-blue-300">Source:</div>
                    <div className="text-xs font-medium text-blue-900 dark:text-blue-100">
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
                <EvidencePanel progress={progress} wallet={wallet} questId={quest.questId} />
              </div>
            )}

            {/* Badge Status */}
            {quest.badge && (
              <div
                className={`mt-4 rounded-lg border p-3 ${
                  badgeIssued
                    ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20'
                    : completion?.requiredComplete
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20'
                      : 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                }`}
              >
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
                        <div className="text-sm font-semibold">
                          {badgeIssued
                            ? `Badge Earned: ${quest.badge.name}`
                            : completion?.requiredComplete
                              ? `Eligible for: ${quest.badge.name}`
                              : `Complete all steps to earn: ${quest.badge.name}`}
                        </div>
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          {quest.badge.description}
                        </div>
                      </div>
                      {badgeError && (
                        <div className="text-xs text-red-600 dark:text-red-400">{badgeError}</div>
                      )}
                    </div>
                  </ArkivQueryTooltip>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏆</span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">
                        {badgeIssued
                          ? `Badge Earned: ${quest.badge.name}`
                          : completion?.requiredComplete
                            ? `Eligible for: ${quest.badge.name}`
                            : `Complete all steps to earn: ${quest.badge.name}`}
                      </div>
                      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        {quest.badge.description}
                      </div>
                    </div>
                    {badgeError && (
                      <div className="text-xs text-red-600 dark:text-red-400">{badgeError}</div>
                    )}
                  </div>
                )}
                {/* Arkiv Builder Mode: Badge Entity Info */}
                {arkivBuilderMode && badgeIssued && badgeEntityKey && (
                  <div className="mt-3 border-t border-emerald-200 pt-3 dark:border-emerald-800">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                      Badge Entity
                    </div>
                    <div className="mb-2">
                      <div className="mb-1 text-xs text-emerald-700 dark:text-emerald-300">
                        Entity Key:
                      </div>
                      <div className="break-all font-mono text-xs text-emerald-900 dark:text-emerald-100">
                        {badgeEntityKey}
                      </div>
                    </div>
                    {badgeTxHash && (
                      <div className="mb-2">
                        <div className="mb-1 text-xs text-emerald-700 dark:text-emerald-300">
                          Transaction Hash:
                        </div>
                        <div className="break-all font-mono text-xs text-emerald-900 dark:text-emerald-100">
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
          <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Track Overview
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {sortedSteps.map((step) => {
                const stepProgress = getStepProgressData(step.stepId);
                const isCompleted = stepProgress.completed;
                const isLocked =
                  step.required &&
                  !isCompleted &&
                  sortedSteps.some((s, idx) => {
                    if (s.stepId === step.stepId) return false;
                    if (s.order >= step.order) return false;
                    return s.required && !getStepProgressData(s.stepId).completed;
                  });

                return (
                  <div
                    key={step.stepId}
                    className={`cursor-pointer rounded border-2 p-3 transition-all ${
                      isCompleted
                        ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20'
                        : isLocked
                          ? 'border-gray-300 bg-gray-100 opacity-60 dark:border-gray-600 dark:bg-gray-800'
                          : 'border-gray-200 bg-white hover:border-emerald-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-emerald-700'
                    }`}
                    onClick={() => {
                      if (!isLocked) {
                        document
                          .getElementById(`step-${step.stepId}`)
                          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        Step {step.order}
                      </span>
                      {isCompleted && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">✓</span>
                      )}
                      {isLocked && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">🔒</span>
                      )}
                    </div>
                    <div className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {step.title}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          step.type === 'READ'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : step.type === 'DO'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                              : step.type === 'QUIZ'
                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {step.type}
                      </span>
                      {!step.required && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">(Optional)</span>
                      )}
                    </div>
                    {/* Evidence link in overview */}
                    {isCompleted && stepProgress.entityKey && arkivBuilderMode && (
                      <div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
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
                step.skillSuggestion !== undefined &&
                progressData.completed &&
                !dismissedSkillSuggestions.has(step.stepId);

              // Resolve quiz rubric for QUIZ steps
              const quizRubric =
                step.type === 'QUIZ' && step.quizRubricId && quest.rubrics
                  ? quest.rubrics[step.quizRubricId]
                  : undefined;

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
                    wallet={wallet || undefined}
                    rubric={quizRubric}
                    onComplete={(evidenceData) =>
                      handleStepComplete(step.stepId, step.type, evidenceData)
                    }
                    onQuizComplete={(result) => {
                      // Quiz was submitted via the quiz API - reload progress
                      if (result.passed) {
                        setTimeout(() => {
                          fetch(
                            `/api/quests/progress?wallet=${wallet}&questId=${quest.questId}&trackId=${trackId}`
                          )
                            .then((r) => r.json())
                            .then((d) => {
                              if (d.ok) {
                                setProgress(d.progress || []);
                                setCompletion(d.completion || null);
                                if (d.completion?.requiredComplete && quest.badge) {
                                  checkAndIssueBadge();
                                }
                              }
                            });
                        }, 2000);
                      }
                    }}
                  />
                  {/* Skill Suggestion Prompt */}
                  {showSkillSuggestion && step.skillSuggestion && wallet && (
                    <SkillSuggestionPrompt
                      skillName={step.skillSuggestion.skillName}
                      skillId={step.skillSuggestion.skillId}
                      proficiency={step.skillSuggestion.proficiency}
                      message={step.skillSuggestion.message}
                      stepId={step.stepId}
                      questId={quest.questId}
                      wallet={wallet}
                      onAddSkill={async (skillName, stepId, proficiency) => {
                        return await handleAddSkillFromQuest(skillName, stepId, proficiency);
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
